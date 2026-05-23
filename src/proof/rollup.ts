import {
    Bool,
    Field,
    MerkleMapWitness,
    Poseidon,
    Provable,
    PublicKey,
    SelfProof,
    Signature,
    Struct,
    UInt64,
    ZkProgram,
} from 'o1js';

const MERKLE_MAP_BITS = 255;
const EMPTY_LEAF_VALUE = Field(0);
export const TOTALS_KEY = Field(0);

const OP_DEPOSIT_NEW = Field(1);
const OP_DEPOSIT = Field(2);
export const OP_WITHDRAW = Field(3);

function mulDivFloor(x: UInt64, y: UInt64, denominator: UInt64): UInt64 {
    denominator.assertGreaterThan(UInt64.zero, 'division by zero');

    const quotient = Provable.witness(UInt64, () => {
        const numerator = x.toBigInt() * y.toBigInt();
        return UInt64.from(numerator / denominator.toBigInt());
    });

    const remainder = Provable.witness(UInt64, () => {
        const numerator = x.toBigInt() * y.toBigInt();
        return UInt64.from(numerator % denominator.toBigInt());
    });

    remainder.assertLessThan(denominator, 'bad floor division remainder');

    x.value
        .mul(y.value)
        .assertEquals(quotient.value.mul(denominator.value).add(remainder.value));

    return quotient;
}

function hashChildren(isLeft: Bool, child: Field, sibling: Field): Field {
    const left = Provable.if(isLeft, child, sibling);
    const right = Provable.if(isLeft, sibling, child);
    return Poseidon.hash([left, right]);
}

export function deriveAccountKey(owner: PublicKey): Field {
    const ownerHash = Poseidon.hash(owner.toFields());
    return Field.fromBits(ownerHash.toBits().slice(0, 254));
}

function assertTotalsWitness(witness: MerkleMapWitness) {
    const [, key] = witness.computeRootAndKey(EMPTY_LEAF_VALUE);
    key.assertEquals(TOTALS_KEY);
}

function combineUpdatedLeaves(
    totalsWitness: MerkleMapWitness,
    newTotalsLeafValue: Field,
    accountWitness: MerkleMapWitness,
    newAccountLeafValue: Field
): Field {
    const accountSubtreeHashes: Field[] = [newAccountLeafValue];
    for (let i = 0; i < MERKLE_MAP_BITS; i++) {
        accountSubtreeHashes.push(
            hashChildren(
                accountWitness.isLefts[i],
                accountSubtreeHashes[i],
                accountWitness.siblings[i]
            )
        );
    }

    const accountHighestBitAtLevel: Bool[] = new Array(MERKLE_MAP_BITS);
    let noHigherBits = Bool(true);
    for (let i = MERKLE_MAP_BITS - 1; i >= 0; i--) {
        const bitIsOne = accountWitness.isLefts[i].not();
        accountHighestBitAtLevel[i] = noHigherBits.and(bitIsOne);
        noHigherBits = noHigherBits.and(accountWitness.isLefts[i]);
    }

    let root = newTotalsLeafValue;
    for (let i = 0; i < MERKLE_MAP_BITS; i++) {
        const sibling = Provable.if(
            accountHighestBitAtLevel[i],
            accountSubtreeHashes[i],
            totalsWitness.siblings[i]
        );
        root = hashChildren(totalsWitness.isLefts[i], root, sibling);
    }
    return root;
}

export class VaultTotalsLeaf extends Struct({
    totalAssets: UInt64,
    totalShares: UInt64,
}) {
    hash(): Field {
        return Poseidon.hash([this.totalAssets.value, this.totalShares.value]);
    }
}

export class AccountLeaf extends Struct({
    owner: PublicKey,
    balance: UInt64,
    shares: UInt64,
    nonce: UInt64,
}) {
    hash(): Field {
        return Poseidon.hash([
            ...this.owner.toFields(),
            this.balance.value,
            this.shares.value,
            this.nonce.value,
        ]);
    }

    addPosition(amount: UInt64, shares: UInt64): AccountLeaf {
        return new AccountLeaf({
            owner: this.owner,
            balance: this.balance.add(amount),
            shares: this.shares.add(shares),
            nonce: this.nonce,
        });
    }

    subPosition(amount: UInt64, shares: UInt64): AccountLeaf {
        this.balance.assertGreaterThanOrEqual(amount, 'insufficient balance');
        this.shares.assertGreaterThanOrEqual(shares, 'insufficient shares');

        return new AccountLeaf({
            owner: this.owner,
            balance: this.balance.sub(amount),
            shares: this.shares.sub(shares),
            nonce: this.nonce.add(UInt64.one),
        });
    }
}

export class VaultRollupOutput extends Struct({
    oldRoot: Field,
    newRoot: Field,
    deposited: UInt64,
    withdrawn: UInt64,
    mintedShares: UInt64,
    burnedShares: UInt64,
    operations: UInt64,
    actionsHash: Field,
}) { }

type RollupMethodResult = {
    publicOutput: VaultRollupOutput;
};

function hashOperation(
    kind: Field,
    key: Field,
    owner: PublicKey,
    amount: UInt64,
    shares: UInt64,
    nonce: UInt64
): Field {
    return Poseidon.hash([
        kind,
        key,
        ...owner.toFields(),
        amount.value,
        shares.value,
        nonce.value,
    ]);
}

function emptyOutput(root: Field): VaultRollupOutput {
    return new VaultRollupOutput({
        oldRoot: root,
        newRoot: root,
        deposited: UInt64.zero,
        withdrawn: UInt64.zero,
        mintedShares: UInt64.zero,
        burnedShares: UInt64.zero,
        operations: UInt64.zero,
        actionsHash: Field(0),
    });
}

export const MinaVaultRollup = ZkProgram({
    name: 'mina-vault-rollup',

    publicInput: Field,
    publicOutput: VaultRollupOutput,

    methods: {
        noop: {
            privateInputs: [],

            async method(root: Field): Promise<RollupMethodResult> {
                return {
                    publicOutput: emptyOutput(root),
                };
            },
        },

        depositNew: {
            privateInputs: [
                MerkleMapWitness,
                VaultTotalsLeaf,
                MerkleMapWitness,
                PublicKey,
                UInt64,
            ],

            async method(
                oldRoot: Field,
                totalsWitness: MerkleMapWitness,
                totalsLeaf: VaultTotalsLeaf,
                accountWitness: MerkleMapWitness,
                owner: PublicKey,
                amount: UInt64
            ): Promise<RollupMethodResult> {
                amount.assertGreaterThan(UInt64.zero, 'deposit amount is zero');

                assertTotalsWitness(totalsWitness);
                const [impliedOldRoot] = totalsWitness.computeRootAndKey(totalsLeaf.hash());
                impliedOldRoot.assertEquals(oldRoot);
                totalsLeaf.totalAssets.assertEquals(UInt64.zero);
                totalsLeaf.totalShares.assertEquals(UInt64.zero);

                const accountKey = deriveAccountKey(owner);
                accountKey.assertNotEquals(TOTALS_KEY);
                const [emptyAccountRoot, impliedAccountKey] =
                    accountWitness.computeRootAndKey(EMPTY_LEAF_VALUE);
                impliedAccountKey.assertEquals(accountKey);
                emptyAccountRoot.assertEquals(oldRoot);

                const mintedShares = amount;
                const newTotalsLeaf = new VaultTotalsLeaf({
                    totalAssets: amount,
                    totalShares: mintedShares,
                });
                const newAccountLeaf = new AccountLeaf({
                    owner,
                    balance: amount,
                    shares: mintedShares,
                    nonce: UInt64.zero,
                });

                const newRoot = combineUpdatedLeaves(
                    totalsWitness,
                    newTotalsLeaf.hash(),
                    accountWitness,
                    newAccountLeaf.hash()
                );

                const actionsHash = hashOperation(
                    OP_DEPOSIT_NEW,
                    accountKey,
                    owner,
                    amount,
                    mintedShares,
                    UInt64.zero
                );

                return {
                    publicOutput: new VaultRollupOutput({
                        oldRoot,
                        newRoot,
                        deposited: amount,
                        withdrawn: UInt64.zero,
                        mintedShares,
                        burnedShares: UInt64.zero,
                        operations: UInt64.one,
                        actionsHash,
                    }),
                };
            },
        },

        deposit: {
            privateInputs: [
                MerkleMapWitness,
                VaultTotalsLeaf,
                MerkleMapWitness,
                AccountLeaf,
                UInt64,
            ],

            async method(
                oldRoot: Field,
                totalsWitness: MerkleMapWitness,
                totalsLeaf: VaultTotalsLeaf,
                accountWitness: MerkleMapWitness,
                currentLeaf: AccountLeaf,
                amount: UInt64
            ): Promise<RollupMethodResult> {
                amount.assertGreaterThan(UInt64.zero, 'deposit amount is zero');

                assertTotalsWitness(totalsWitness);
                const [impliedOldRoot] = totalsWitness.computeRootAndKey(totalsLeaf.hash());
                impliedOldRoot.assertEquals(oldRoot);
                totalsLeaf.totalShares.assertGreaterThan(UInt64.zero, 'vault has no shares');
                totalsLeaf.totalAssets.assertGreaterThan(UInt64.zero, 'vault has no assets');

                const accountKey = deriveAccountKey(currentLeaf.owner);
                accountKey.assertNotEquals(TOTALS_KEY);
                const [accountRoot, impliedAccountKey] =
                    accountWitness.computeRootAndKey(currentLeaf.hash());
                impliedAccountKey.assertEquals(accountKey);
                accountRoot.assertEquals(oldRoot);

                const mintedShares = mulDivFloor(
                    amount,
                    totalsLeaf.totalShares,
                    totalsLeaf.totalAssets
                );
                mintedShares.assertGreaterThan(UInt64.zero, 'deposit mints zero shares');

                const newTotalsLeaf = new VaultTotalsLeaf({
                    totalAssets: totalsLeaf.totalAssets.add(amount),
                    totalShares: totalsLeaf.totalShares.add(mintedShares),
                });
                const newAccountLeaf = currentLeaf.addPosition(amount, mintedShares);
                const newRoot = combineUpdatedLeaves(
                    totalsWitness,
                    newTotalsLeaf.hash(),
                    accountWitness,
                    newAccountLeaf.hash()
                );

                const actionsHash = hashOperation(
                    OP_DEPOSIT,
                    accountKey,
                    currentLeaf.owner,
                    amount,
                    mintedShares,
                    currentLeaf.nonce
                );

                return {
                    publicOutput: new VaultRollupOutput({
                        oldRoot,
                        newRoot,
                        deposited: amount,
                        withdrawn: UInt64.zero,
                        mintedShares,
                        burnedShares: UInt64.zero,
                        operations: UInt64.one,
                        actionsHash,
                    }),
                };
            },
        },

        withdraw: {
            privateInputs: [
                MerkleMapWitness,
                VaultTotalsLeaf,
                MerkleMapWitness,
                AccountLeaf,
                UInt64,
                Signature,
            ],

            async method(
                oldRoot: Field,
                totalsWitness: MerkleMapWitness,
                totalsLeaf: VaultTotalsLeaf,
                accountWitness: MerkleMapWitness,
                currentLeaf: AccountLeaf,
                shares: UInt64,
                signature: Signature
            ): Promise<RollupMethodResult> {
                shares.assertGreaterThan(UInt64.zero, 'withdraw shares is zero');

                assertTotalsWitness(totalsWitness);
                const [impliedOldRoot] = totalsWitness.computeRootAndKey(totalsLeaf.hash());
                impliedOldRoot.assertEquals(oldRoot);
                totalsLeaf.totalShares.assertGreaterThan(UInt64.zero, 'vault has no shares');
                shares.assertLessThanOrEqual(totalsLeaf.totalShares, 'too many shares');

                const accountKey = deriveAccountKey(currentLeaf.owner);
                accountKey.assertNotEquals(TOTALS_KEY);
                const [accountRoot, impliedAccountKey] =
                    accountWitness.computeRootAndKey(currentLeaf.hash());
                impliedAccountKey.assertEquals(accountKey);
                accountRoot.assertEquals(oldRoot);

                signature
                    .verify(currentLeaf.owner, [
                        OP_WITHDRAW,
                        oldRoot,
                        accountKey,
                        shares.value,
                        currentLeaf.nonce.value,
                    ])
                    .assertTrue('invalid withdraw signature');

                const amount = mulDivFloor(
                    shares,
                    totalsLeaf.totalAssets,
                    totalsLeaf.totalShares
                );
                amount.assertGreaterThan(UInt64.zero, 'withdraw amount is zero');

                const newTotalsLeaf = new VaultTotalsLeaf({
                    totalAssets: totalsLeaf.totalAssets.sub(amount),
                    totalShares: totalsLeaf.totalShares.sub(shares),
                });
                const newAccountLeaf = currentLeaf.subPosition(amount, shares);
                const newRoot = combineUpdatedLeaves(
                    totalsWitness,
                    newTotalsLeaf.hash(),
                    accountWitness,
                    newAccountLeaf.hash()
                );

                const actionsHash = hashOperation(
                    OP_WITHDRAW,
                    accountKey,
                    currentLeaf.owner,
                    amount,
                    shares,
                    currentLeaf.nonce
                );

                return {
                    publicOutput: new VaultRollupOutput({
                        oldRoot,
                        newRoot,
                        deposited: UInt64.zero,
                        withdrawn: amount,
                        mintedShares: UInt64.zero,
                        burnedShares: shares,
                        operations: UInt64.one,
                        actionsHash,
                    }),
                };
            },
        },

        merge: {
            privateInputs: [SelfProof, SelfProof],

            async method(
                oldRoot: Field,
                leftProof: SelfProof<Field, VaultRollupOutput>,
                rightProof: SelfProof<Field, VaultRollupOutput>
            ): Promise<RollupMethodResult> {
                leftProof.verify();
                rightProof.verify();

                leftProof.publicInput.assertEquals(oldRoot);
                leftProof.publicOutput.oldRoot.assertEquals(oldRoot);
                rightProof.publicInput.assertEquals(leftProof.publicOutput.newRoot);
                rightProof.publicOutput.oldRoot.assertEquals(leftProof.publicOutput.newRoot);

                const actionsHash = Poseidon.hash([
                    leftProof.publicOutput.actionsHash,
                    rightProof.publicOutput.actionsHash,
                ]);

                return {
                    publicOutput: new VaultRollupOutput({
                        oldRoot,
                        newRoot: rightProof.publicOutput.newRoot,
                        deposited: leftProof.publicOutput.deposited.add(
                            rightProof.publicOutput.deposited
                        ),
                        withdrawn: leftProof.publicOutput.withdrawn.add(
                            rightProof.publicOutput.withdrawn
                        ),
                        mintedShares: leftProof.publicOutput.mintedShares.add(
                            rightProof.publicOutput.mintedShares
                        ),
                        burnedShares: leftProof.publicOutput.burnedShares.add(
                            rightProof.publicOutput.burnedShares
                        ),
                        operations: leftProof.publicOutput.operations.add(
                            rightProof.publicOutput.operations
                        ),
                        actionsHash,
                    }),
                };
            },
        },
    },
});

export class MinaVaultRollupProof extends ZkProgram.Proof(MinaVaultRollup) { }
