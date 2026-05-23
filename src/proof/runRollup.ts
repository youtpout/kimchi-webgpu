import {
    Field,
    getGpuMsmRunner,
    getGpuProver,
    MerkleTree,
    PrivateKey,
    PublicKey,
    setBackend,
    setGpuMsmRunner,
    setGpuProver,
    setNumberOfWorkers,
    Signature,
    UInt64,
} from 'o1js';
import {
    preloadEmbeddedO1jsCompileCache,
    type CacheLike,
} from './embeddedO1jsCompileCache.js';
import { createWebGpuBatchedMsmRunner } from './webgpuMsmBatcher.js';

import {
    AccountLeaf,
    BALANCES_TREE_HEIGHT,
    BalanceWitness,
    MinaVaultRollup,
    MinaVaultRollupProof,
    VaultState,
} from './rollup.js';

setBackend('wasm');
//setNumberOfWorkers(0);

const OP_WITHDRAW = Field(3);

export interface RootTransition {
    initialRoot: string;
    newRoot: string;
}

export interface VaultRollupProofHarness {
    tree: MerkleTree;
    ownerKey: PrivateKey;
    owner: PublicKey;

    currentRoot: () => Field;
    currentRootString: () => string;

    proveDepositNew: (amount: UInt64 | bigint | number | string) => Promise<RootTransition>;
    proveDeposit: (amount: UInt64 | bigint | number | string) => Promise<RootTransition>;
    proveWithdraw: (amount: UInt64 | bigint | number | string) => Promise<RootTransition>;

    mergeLastTwoProofs: () => Promise<RootTransition>;
    mergeAllProofs: () => Promise<RootTransition>;
}

export interface VaultRollupHarnessOptions {
    compileCache?: CacheLike;
}

type LocalAccountState = {
    index: bigint;
    owner: PublicKey;
    key: PrivateKey;
    leaf: AccountLeaf;
};

type InternalProofResult = {
    proof: MinaVaultRollupProof;
    initialState: VaultState;
    newState: VaultState;
};

function nowMs() {
    return performance.now();
}

function logPhase(name: string, startMs: number) {
    const elapsedMs = nowMs() - startMs;
    console.log(`[o1js rollup-profile] phase=${name} elapsed_ms=${elapsedMs.toFixed(2)}`);
    return nowMs();
}

function toUInt64(value: UInt64 | bigint | number | string): UInt64 {
    if (value instanceof UInt64) return value;
    return UInt64.from(value);
}

function toRootTransition(result: InternalProofResult): RootTransition {
    return {
        initialRoot: result.initialState.root.toString(),
        newRoot: result.newState.root.toString(),
    };
}

function installGpuProofHook() {
    if (getGpuProver() !== undefined) return;

    setGpuProver(async ({ cpuFallback, proverData }) => {
        const callIndex =
            typeof proverData === 'object' &&
                proverData !== null &&
                'index' in proverData &&
                typeof (proverData as { index?: unknown }).index === 'number'
                ? (proverData as { index: number }).index
                : -1;

        console.log(`GPU prover hook called for proof index=${callIndex}`);

        // Temporary fallback to validate the o1js gpuProving plumbing.
        return await cpuFallback();
    });
}

function installGpuMsmHook() {
    if (getGpuMsmRunner() !== undefined) return;
    setGpuMsmRunner(createWebGpuBatchedMsmRunner());
}

export async function createVaultRollupProofHarness(
    options: VaultRollupHarnessOptions = {}
): Promise<VaultRollupProofHarness> {
    installGpuProofHook();
    installGpuMsmHook();

    const tree = new MerkleTree(BALANCES_TREE_HEIGHT);

    const ownerKey = PrivateKey.random();
    const owner = ownerKey.toPublicKey();

    const accountIndex = 0n;

    let accountState: LocalAccountState | undefined;
    let proofs: MinaVaultRollupProof[] = [];
    let totalAssets = UInt64.zero;
    let totalShares = UInt64.zero;

    console.log('Compiling MinaVaultRollup...');
    const compileStartMs = nowMs();
    const compileCache =
        options.compileCache ?? (await preloadEmbeddedO1jsCompileCache('rollup'));
    if (compileCache === undefined) {
        await MinaVaultRollup.compile();
    } else {
        await MinaVaultRollup.compile({ cache: compileCache });
    }
    logPhase('compile', compileStartMs);

    function currentRoot() {
        return tree.getRoot();
    }

    function currentRootString() {
        return currentRoot().toString();
    }

    function currentState() {
        return new VaultState({
            root: currentRoot(),
            totalAssets,
            totalShares,
        });
    }

    function getAccountState(): LocalAccountState {
        if (accountState === undefined) {
            throw new Error('Account does not exist yet. Call proveDepositNew() first.');
        }

        return accountState;
    }

    function getWitness(index: bigint): BalanceWitness {
        return new BalanceWitness(tree.getWitness(index));
    }

    async function proveDepositNewInternal(
        rawAmount: UInt64 | bigint | number | string
    ): Promise<InternalProofResult> {
        if (accountState !== undefined) {
            throw new Error('Account already exists. Use proveDeposit() instead.');
        }

        const amount = toUInt64(rawAmount);

        console.log('Proving depositNew()...');
        let phaseStartMs = nowMs();

        const initialState = currentState();
        const witness = getWitness(accountIndex);

        const { proof } = await MinaVaultRollup.depositNew(
            initialState,
            witness,
            owner,
            amount
        );

        phaseStartMs = logPhase('deposit_new_prove', phaseStartMs);

        const newLeaf = new AccountLeaf({
            owner,
            balance: amount,
            shares: amount,
            nonce: UInt64.zero,
        });

        tree.setLeaf(accountIndex, newLeaf.hash());
        totalAssets = totalAssets.add(amount);
        totalShares = totalShares.add(amount);

        accountState = {
            index: accountIndex,
            owner,
            key: ownerKey,
            leaf: newLeaf,
        };

        const newState = currentState();

        proof.publicOutput.newState.root.assertEquals(newState.root);
        proof.publicOutput.newState.totalAssets.assertEquals(newState.totalAssets);
        proof.publicOutput.newState.totalShares.assertEquals(newState.totalShares);

        proofs.push(proof);

        logPhase('deposit_new_apply_local_tree', phaseStartMs);

        return {
            proof,
            initialState,
            newState,
        };
    }

    async function proveDepositInternal(
        rawAmount: UInt64 | bigint | number | string
    ): Promise<InternalProofResult> {
        const state = getAccountState();
        const amount = toUInt64(rawAmount);

        console.log('Proving deposit()...');
        let phaseStartMs = nowMs();

        const initialState = currentState();
        const witness = getWitness(state.index);

        const mintedShares =
            totalShares.equals(UInt64.zero).toBoolean()
                ? amount
                : UInt64.from(
                    (amount.toBigInt() * totalShares.toBigInt()) / totalAssets.toBigInt()
                );

        const { proof } = await MinaVaultRollup.deposit(
            initialState,
            witness,
            state.leaf,
            amount
        );

        phaseStartMs = logPhase('deposit_prove', phaseStartMs);

        const newLeaf = state.leaf.addPosition(amount, mintedShares);

        tree.setLeaf(state.index, newLeaf.hash());
        totalAssets = totalAssets.add(amount);
        totalShares = totalShares.add(mintedShares);

        accountState = {
            ...state,
            leaf: newLeaf,
        };

        const newState = currentState();

        proof.publicOutput.newState.root.assertEquals(newState.root);
        proof.publicOutput.newState.totalAssets.assertEquals(newState.totalAssets);
        proof.publicOutput.newState.totalShares.assertEquals(newState.totalShares);

        proofs.push(proof);

        logPhase('deposit_apply_local_tree', phaseStartMs);

        return {
            proof,
            initialState,
            newState,
        };
    }

    async function proveWithdrawInternal(
        rawAmount: UInt64 | bigint | number | string
    ): Promise<InternalProofResult> {
        const state = getAccountState();
        const shares = toUInt64(rawAmount);

        console.log('Proving withdraw()...');
        let phaseStartMs = nowMs();

        const initialState = currentState();
        const witness = getWitness(state.index);
        const index = witness.calculateIndex();

        const signature = Signature.create(state.key, [
            OP_WITHDRAW,
            initialState.root,
            index,
            shares.value,
            state.leaf.nonce.value,
        ]);

        const amountOut = UInt64.from(
            (shares.toBigInt() * totalAssets.toBigInt()) / totalShares.toBigInt()
        );

        const { proof } = await MinaVaultRollup.withdraw(
            initialState,
            witness,
            state.leaf,
            shares,
            signature
        );

        phaseStartMs = logPhase('withdraw_prove', phaseStartMs);

        const newLeaf = state.leaf.subPosition(amountOut, shares);

        tree.setLeaf(state.index, newLeaf.hash());
        totalAssets = totalAssets.sub(amountOut);
        totalShares = totalShares.sub(shares);

        accountState = {
            ...state,
            leaf: newLeaf,
        };

        const newState = currentState();

        proof.publicOutput.newState.root.assertEquals(newState.root);
        proof.publicOutput.newState.totalAssets.assertEquals(newState.totalAssets);
        proof.publicOutput.newState.totalShares.assertEquals(newState.totalShares);

        proofs.push(proof);

        logPhase('withdraw_apply_local_tree', phaseStartMs);

        return {
            proof,
            initialState,
            newState,
        };
    }

    async function mergeTwoProofs(
        leftProof: MinaVaultRollupProof,
        rightProof: MinaVaultRollupProof
    ): Promise<MinaVaultRollupProof> {
        const initialState = leftProof.publicOutput.oldState;

        const { proof } = await MinaVaultRollup.merge(
            initialState,
            leftProof,
            rightProof
        );

        return proof;
    }

    return {
        tree,
        ownerKey,
        owner,

        currentRoot,
        currentRootString,

        proveDepositNew: async (amount) => {
            const result = await proveDepositNewInternal(amount);
            return toRootTransition(result);
        },

        proveDeposit: async (amount) => {
            const result = await proveDepositInternal(amount);
            return toRootTransition(result);
        },

        proveWithdraw: async (amount) => {
            const result = await proveWithdrawInternal(amount);
            return toRootTransition(result);
        },

        mergeLastTwoProofs: async () => {
            if (proofs.length < 2) {
                throw new Error('Need at least two proofs to merge.');
            }

            console.log('Proving mergeLastTwoProofs()...');
            const phaseStartMs = nowMs();

            const rightProof = proofs.pop()!;
            const leftProof = proofs.pop()!;

            const mergedProof = await mergeTwoProofs(leftProof, rightProof);

            proofs.push(mergedProof);

            logPhase('merge_last_two_proofs', phaseStartMs);

            return {
                initialRoot: mergedProof.publicOutput.oldState.root.toString(),
                newRoot: mergedProof.publicOutput.newState.root.toString(),
            };
        },

        mergeAllProofs: async () => {
            if (proofs.length === 0) {
                throw new Error('No proofs to merge.');
            }

            if (proofs.length === 1) {
                const proof = proofs[0];

                return {
                    initialRoot: proof.publicOutput.oldState.root.toString(),
                    newRoot: proof.publicOutput.newState.root.toString(),
                };
            }

            console.log('Proving mergeAllProofs()...');
            const phaseStartMs = nowMs();

            let mergedProof = proofs[0];

            for (let i = 1; i < proofs.length; i++) {
                mergedProof = await mergeTwoProofs(mergedProof, proofs[i]);
            }

            proofs = [mergedProof];

            logPhase('merge_all_proofs', phaseStartMs);

            return {
                initialRoot: mergedProof.publicOutput.oldState.root.toString(),
                newRoot: mergedProof.publicOutput.newState.root.toString(),
            };
        },
    };
}

export async function run(): Promise<RootTransition> {
    const totalStartMs = nowMs();

    const harness = await createVaultRollupProofHarness();

    const result = await harness.proveDepositNew(1_000_000_000);
    // await harness.proveDeposit(500_000_000);
    // await harness.proveWithdraw(250_000_000);

    // const result = await harness.mergeAllProofs();

    logPhase('run_total', totalStartMs);

    return result;
}

export default run;
