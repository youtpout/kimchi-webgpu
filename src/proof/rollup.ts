import {
    Field,
    MerkleWitness,
    Poseidon,
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

export class AccountLeaf extends Struct({
    owner: PublicKey,
    balance: UInt64,
    nonce: UInt64,
}) {
    hash(): Field {
        return Poseidon.hash([
            ...this.owner.toFields(),
            this.balance.value,
            this.nonce.value,
        ]);
    }

    addBalance(amount: UInt64): AccountLeaf {
        return new AccountLeaf({
            owner: this.owner,
            balance: this.balance.add(amount),
            nonce: this.nonce,
        });
    }

    subBalance(amount: UInt64): AccountLeaf {
        this.balance.assertGreaterThanOrEqual(amount, 'insufficient balance');

        return new AccountLeaf({
            owner: this.owner,
            balance: this.balance.sub(amount),
            nonce: this.nonce.add(UInt64.one),
        });
    }
}

export class VaultRollupOutput extends Struct({
    oldRoot: Field,
    newRoot: Field,
    deposited: UInt64,
    withdrawn: UInt64,
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
    nonce: UInt64
): Field {
    return Poseidon.hash([
        kind,
        index,
        ...owner.toFields(),
        amount.value,
        nonce.value,
    ]);
}

function emptyOutput(root: Field): VaultRollupOutput {
    return new VaultRollupOutput({
        oldRoot: root,
        newRoot: root,
        deposited: UInt64.zero,
        withdrawn: UInt64.zero,
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
            privateInputs: [BalanceWitness, PublicKey, UInt64],

            async method(
                oldRoot: Field,
                witness: BalanceWitness,
                owner: PublicKey,
                amount: UInt64
            ): Promise<RollupMethodResult> {
                amount.assertGreaterThan(UInt64.zero, 'deposit amount is zero');

                const index = witness.calculateIndex();

                witness.calculateRoot(EMPTY_LEAF_HASH).assertEquals(oldRoot);

                const newLeaf = new AccountLeaf({
                    owner,
                    balance: amount,
                    nonce: UInt64.zero,
                });

                const newRoot = witness.calculateRoot(newLeaf.hash());

                const actionsHash = hashOperation(
                    OP_DEPOSIT_NEW,
                    index,
                    owner,
                    amount,
                    UInt64.zero
                );

                return {
                    publicOutput: new VaultRollupOutput({
                        oldRoot,
                        newRoot,
                        deposited: amount,
                        withdrawn: UInt64.zero,
                        operations: UInt64.one,
                        actionsHash,
                    }),
                };
            },
        },

        deposit: {
            privateInputs: [BalanceWitness, AccountLeaf, UInt64],

            async method(
                oldRoot: Field,
                witness: BalanceWitness,
                currentLeaf: AccountLeaf,
                amount: UInt64
            ): Promise<RollupMethodResult> {
                amount.assertGreaterThan(UInt64.zero, 'deposit amount is zero');

                const index = witness.calculateIndex();

                witness.calculateRoot(currentLeaf.hash()).assertEquals(oldRoot);

                const newLeaf = currentLeaf.addBalance(amount);
                const newRoot = witness.calculateRoot(newLeaf.hash());

                const actionsHash = hashOperation(
                    OP_DEPOSIT,
                    index,
                    currentLeaf.owner,
                    amount,
                    currentLeaf.nonce
                );

                return {
                    publicOutput: new VaultRollupOutput({
                        oldRoot,
                        newRoot,
                        deposited: amount,
                        withdrawn: UInt64.zero,
                        operations: UInt64.one,
                        actionsHash,
                    }),
                };
            },
        },

        withdraw: {
            privateInputs: [BalanceWitness, AccountLeaf, UInt64, Signature],

            async method(
                oldRoot: Field,
                witness: BalanceWitness,
                currentLeaf: AccountLeaf,
                amount: UInt64,
                signature: Signature
            ): Promise<RollupMethodResult> {
                amount.assertGreaterThan(UInt64.zero, 'withdraw amount is zero');

                const index = witness.calculateIndex();

                witness.calculateRoot(currentLeaf.hash()).assertEquals(oldRoot);

                signature
                    .verify(currentLeaf.owner, [
                        OP_WITHDRAW,
                        oldRoot,
                        index,
                        amount.value,
                        currentLeaf.nonce.value,
                    ])
                    .assertTrue('invalid withdraw signature');

                const newLeaf = currentLeaf.subBalance(amount);
                const newRoot = witness.calculateRoot(newLeaf.hash());

                const actionsHash = hashOperation(
                    OP_WITHDRAW,
                    index,
                    currentLeaf.owner,
                    amount,
                    currentLeaf.nonce
                );

                return {
                    publicOutput: new VaultRollupOutput({
                        oldRoot,
                        newRoot,
                        deposited: UInt64.zero,
                        withdrawn: amount,
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