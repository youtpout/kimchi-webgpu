import {
    Field,
    MerkleWitness,
    Poseidon,
    Provable,
    PublicKey,
    SelfProof,
    Signature,
    Struct,
    UInt64,
    ZkProgram,
} from 'o1js';

export const BALANCES_TREE_HEIGHT = 32;

export class BalanceWitness extends MerkleWitness(BALANCES_TREE_HEIGHT) { }

const EMPTY_LEAF_HASH = Field(0);

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

export class VaultState extends Struct({
    root: Field,
    totalAssets: UInt64,
    totalShares: UInt64,
}) { }

export class VaultRollupOutput extends Struct({
    oldState: VaultState,
    newState: VaultState,
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
    index: Field,
    owner: PublicKey,
    amount: UInt64,
    shares: UInt64,
    nonce: UInt64
): Field {
    return Poseidon.hash([
        kind,
        index,
        ...owner.toFields(),
        amount.value,
        shares.value,
        nonce.value,
    ]);
}

function emptyOutput(state: VaultState): VaultRollupOutput {
    return new VaultRollupOutput({
        oldState: state,
        newState: state,
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

    publicInput: VaultState,
    publicOutput: VaultRollupOutput,

    methods: {
        noop: {
            privateInputs: [],

            async method(state: VaultState): Promise<RollupMethodResult> {
                return {
                    publicOutput: emptyOutput(state),
                };
            },
        },

        depositNew: {
            privateInputs: [BalanceWitness, PublicKey, UInt64],

            async method(
                oldState: VaultState,
                witness: BalanceWitness,
                owner: PublicKey,
                amount: UInt64
            ): Promise<RollupMethodResult> {
                amount.assertGreaterThan(UInt64.zero, 'deposit amount is zero');

                const index = witness.calculateIndex();

                witness.calculateRoot(EMPTY_LEAF_HASH).assertEquals(oldState.root);
                oldState.totalShares.equals(UInt64.zero).assertTrue('shares already exist');
                oldState.totalAssets.equals(UInt64.zero).assertTrue('assets already exist');

                const mintedShares = amount;

                const newLeaf = new AccountLeaf({
                    owner,
                    balance: amount,
                    shares: mintedShares,
                    nonce: UInt64.zero,
                });

                const newState = new VaultState({
                    root: witness.calculateRoot(newLeaf.hash()),
                    totalAssets: oldState.totalAssets.add(amount),
                    totalShares: oldState.totalShares.add(mintedShares),
                });

                const actionsHash = hashOperation(
                    OP_DEPOSIT_NEW,
                    index,
                    owner,
                    amount,
                    mintedShares,
                    UInt64.zero
                );

                return {
                    publicOutput: new VaultRollupOutput({
                        oldState,
                        newState,
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
            privateInputs: [BalanceWitness, AccountLeaf, UInt64],

            async method(
                oldState: VaultState,
                witness: BalanceWitness,
                currentLeaf: AccountLeaf,
                amount: UInt64
            ): Promise<RollupMethodResult> {
                amount.assertGreaterThan(UInt64.zero, 'deposit amount is zero');

                const index = witness.calculateIndex();

                witness.calculateRoot(currentLeaf.hash()).assertEquals(oldState.root);
                oldState.totalShares.assertGreaterThan(UInt64.zero, 'vault has no shares');
                oldState.totalAssets.assertGreaterThan(UInt64.zero, 'vault has no assets');

                const mintedShares = mulDivFloor(
                    amount,
                    oldState.totalShares,
                    oldState.totalAssets
                );
                mintedShares.assertGreaterThan(UInt64.zero, 'deposit mints zero shares');

                const newLeaf = currentLeaf.addPosition(amount, mintedShares);
                const newState = new VaultState({
                    root: witness.calculateRoot(newLeaf.hash()),
                    totalAssets: oldState.totalAssets.add(amount),
                    totalShares: oldState.totalShares.add(mintedShares),
                });

                const actionsHash = hashOperation(
                    OP_DEPOSIT,
                    index,
                    currentLeaf.owner,
                    amount,
                    mintedShares,
                    currentLeaf.nonce
                );

                return {
                    publicOutput: new VaultRollupOutput({
                        oldState,
                        newState,
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
            privateInputs: [BalanceWitness, AccountLeaf, UInt64, Signature],

            async method(
                oldState: VaultState,
                witness: BalanceWitness,
                currentLeaf: AccountLeaf,
                shares: UInt64,
                signature: Signature
            ): Promise<RollupMethodResult> {
                shares.assertGreaterThan(UInt64.zero, 'withdraw shares is zero');

                const index = witness.calculateIndex();

                witness.calculateRoot(currentLeaf.hash()).assertEquals(oldState.root);
                oldState.totalShares.assertGreaterThan(UInt64.zero, 'vault has no shares');
                shares.assertLessThanOrEqual(oldState.totalShares, 'too many shares');

                signature
                    .verify(currentLeaf.owner, [
                        OP_WITHDRAW,
                        oldState.root,
                        index,
                        shares.value,
                        currentLeaf.nonce.value,
                    ])
                    .assertTrue('invalid withdraw signature');

                const amount = mulDivFloor(
                    shares,
                    oldState.totalAssets,
                    oldState.totalShares
                );
                amount.assertGreaterThan(UInt64.zero, 'withdraw amount is zero');

                const newLeaf = currentLeaf.subPosition(amount, shares);
                const newState = new VaultState({
                    root: witness.calculateRoot(newLeaf.hash()),
                    totalAssets: oldState.totalAssets.sub(amount),
                    totalShares: oldState.totalShares.sub(shares),
                });

                const actionsHash = hashOperation(
                    OP_WITHDRAW,
                    index,
                    currentLeaf.owner,
                    amount,
                    shares,
                    currentLeaf.nonce
                );

                return {
                    publicOutput: new VaultRollupOutput({
                        oldState,
                        newState,
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
                oldState: VaultState,
                leftProof: SelfProof<VaultState, VaultRollupOutput>,
                rightProof: SelfProof<VaultState, VaultRollupOutput>
            ): Promise<RollupMethodResult> {
                leftProof.verify();
                rightProof.verify();

                leftProof.publicInput.root.assertEquals(oldState.root);
                leftProof.publicInput.totalAssets.assertEquals(oldState.totalAssets);
                leftProof.publicInput.totalShares.assertEquals(oldState.totalShares);
                leftProof.publicOutput.oldState.root.assertEquals(oldState.root);
                leftProof.publicOutput.oldState.totalAssets.assertEquals(oldState.totalAssets);
                leftProof.publicOutput.oldState.totalShares.assertEquals(oldState.totalShares);

                rightProof.publicInput.root.assertEquals(leftProof.publicOutput.newState.root);
                rightProof.publicInput.totalAssets.assertEquals(
                    leftProof.publicOutput.newState.totalAssets
                );
                rightProof.publicInput.totalShares.assertEquals(
                    leftProof.publicOutput.newState.totalShares
                );
                rightProof.publicOutput.oldState.root.assertEquals(
                    leftProof.publicOutput.newState.root
                );
                rightProof.publicOutput.oldState.totalAssets.assertEquals(
                    leftProof.publicOutput.newState.totalAssets
                );
                rightProof.publicOutput.oldState.totalShares.assertEquals(
                    leftProof.publicOutput.newState.totalShares
                );

                const actionsHash = Poseidon.hash([
                    leftProof.publicOutput.actionsHash,
                    rightProof.publicOutput.actionsHash,
                ]);

                return {
                    publicOutput: new VaultRollupOutput({
                        oldState,
                        newState: rightProof.publicOutput.newState,

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
