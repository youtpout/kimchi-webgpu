import {
    Field,
    getGpuMsmRunner,
    getGpuProver,
    MerkleMap,
    MerkleMapWitness,
    PrivateKey,
    PublicKey,
    setBackend,
    setGpuMsmRunner,
    setGpuProver,
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
    deriveAccountKey,
    MinaVaultRollup,
    MinaVaultRollupProof,
    OP_WITHDRAW,
    TOTALS_KEY,
    VaultTotalsLeaf,
} from './rollup.js';

setBackend('wasm');

export interface RootTransition {
    initialRoot: string;
    newRoot: string;
}

export interface VaultRollupProofHarness {
    balances: MerkleMap;
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
    key: Field;
    owner: PublicKey;
    privateKey: PrivateKey;
    leaf: AccountLeaf;
};

type InternalProofResult = {
    proof: MinaVaultRollupProof;
    initialRoot: Field;
    newRoot: Field;
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
        initialRoot: result.initialRoot.toString(),
        newRoot: result.newRoot.toString(),
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

    const balances = new MerkleMap();
    let totalsLeaf = new VaultTotalsLeaf({
        totalAssets: UInt64.zero,
        totalShares: UInt64.zero,
    });
    balances.set(TOTALS_KEY, totalsLeaf.hash());

    const ownerKey = PrivateKey.random();
    const owner = ownerKey.toPublicKey();
    const accountKey = deriveAccountKey(owner);

    if (accountKey.equals(TOTALS_KEY).toBoolean()) {
        throw new Error('Owner hash mapped to reserved totals key 0.');
    }

    let accountState: LocalAccountState | undefined;
    let proofs: MinaVaultRollupProof[] = [];

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
        return balances.getRoot();
    }

    function currentRootString() {
        return currentRoot().toString();
    }

    function getAccountState(): LocalAccountState {
        if (accountState === undefined) {
            throw new Error('Account does not exist yet. Call proveDepositNew() first.');
        }
        return accountState;
    }

    function getWitness(key: Field): MerkleMapWitness {
        return balances.getWitness(key);
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

        const initialRoot = currentRoot();
        const totalsWitness = getWitness(TOTALS_KEY);
        const accountWitness = getWitness(accountKey);
        const { proof } = await MinaVaultRollup.depositNew(
            initialRoot,
            totalsWitness,
            totalsLeaf,
            accountWitness,
            owner,
            amount
        );

        phaseStartMs = logPhase('deposit_new_prove', phaseStartMs);

        totalsLeaf = new VaultTotalsLeaf({
            totalAssets: amount,
            totalShares: amount,
        });
        const newLeaf = new AccountLeaf({
            owner,
            balance: amount,
            shares: amount,
            nonce: UInt64.zero,
        });

        balances.set(TOTALS_KEY, totalsLeaf.hash());
        balances.set(accountKey, newLeaf.hash());

        accountState = {
            key: accountKey,
            owner,
            privateKey: ownerKey,
            leaf: newLeaf,
        };

        const newRoot = currentRoot();
        proof.publicOutput.newRoot.assertEquals(newRoot);

        proofs.push(proof);
        logPhase('deposit_new_apply_local_tree', phaseStartMs);

        return { proof, initialRoot, newRoot };
    }

    async function proveDepositInternal(
        rawAmount: UInt64 | bigint | number | string
    ): Promise<InternalProofResult> {
        const state = getAccountState();
        const amount = toUInt64(rawAmount);

        console.log('Proving deposit()...');
        let phaseStartMs = nowMs();

        const initialRoot = currentRoot();
        const totalsWitness = getWitness(TOTALS_KEY);
        const accountWitness = getWitness(state.key);
        const mintedShares = UInt64.from(
            (amount.toBigInt() * totalsLeaf.totalShares.toBigInt()) /
            totalsLeaf.totalAssets.toBigInt()
        );

        const { proof } = await MinaVaultRollup.deposit(
            initialRoot,
            totalsWitness,
            totalsLeaf,
            accountWitness,
            state.leaf,
            amount
        );

        phaseStartMs = logPhase('deposit_prove', phaseStartMs);

        totalsLeaf = new VaultTotalsLeaf({
            totalAssets: totalsLeaf.totalAssets.add(amount),
            totalShares: totalsLeaf.totalShares.add(mintedShares),
        });
        const newLeaf = state.leaf.addPosition(amount, mintedShares);

        balances.set(TOTALS_KEY, totalsLeaf.hash());
        balances.set(state.key, newLeaf.hash());

        accountState = { ...state, leaf: newLeaf };

        const newRoot = currentRoot();
        proof.publicOutput.newRoot.assertEquals(newRoot);

        proofs.push(proof);
        logPhase('deposit_apply_local_tree', phaseStartMs);

        return { proof, initialRoot, newRoot };
    }

    async function proveWithdrawInternal(
        rawAmount: UInt64 | bigint | number | string
    ): Promise<InternalProofResult> {
        const state = getAccountState();
        const shares = toUInt64(rawAmount);

        console.log('Proving withdraw()...');
        let phaseStartMs = nowMs();

        const initialRoot = currentRoot();
        const totalsWitness = getWitness(TOTALS_KEY);
        const accountWitness = getWitness(state.key);

        const signature = Signature.create(state.privateKey, [
            OP_WITHDRAW,
            initialRoot,
            state.key,
            shares.value,
            state.leaf.nonce.value,
        ]);

        const amountOut = UInt64.from(
            (shares.toBigInt() * totalsLeaf.totalAssets.toBigInt()) /
            totalsLeaf.totalShares.toBigInt()
        );

        const { proof } = await MinaVaultRollup.withdraw(
            initialRoot,
            totalsWitness,
            totalsLeaf,
            accountWitness,
            state.leaf,
            shares,
            signature
        );

        phaseStartMs = logPhase('withdraw_prove', phaseStartMs);

        totalsLeaf = new VaultTotalsLeaf({
            totalAssets: totalsLeaf.totalAssets.sub(amountOut),
            totalShares: totalsLeaf.totalShares.sub(shares),
        });
        const newLeaf = state.leaf.subPosition(amountOut, shares);

        balances.set(TOTALS_KEY, totalsLeaf.hash());
        balances.set(state.key, newLeaf.hash());

        accountState = { ...state, leaf: newLeaf };

        const newRoot = currentRoot();
        proof.publicOutput.newRoot.assertEquals(newRoot);

        proofs.push(proof);
        logPhase('withdraw_apply_local_tree', phaseStartMs);

        return { proof, initialRoot, newRoot };
    }

    async function mergeTwoProofs(
        leftProof: MinaVaultRollupProof,
        rightProof: MinaVaultRollupProof
    ): Promise<MinaVaultRollupProof> {
        const initialRoot = leftProof.publicOutput.oldRoot;
        const { proof } = await MinaVaultRollup.merge(initialRoot, leftProof, rightProof);
        return proof;
    }

    return {
        balances,
        ownerKey,
        owner,

        currentRoot,
        currentRootString,

        proveDepositNew: async (amount) => toRootTransition(await proveDepositNewInternal(amount)),
        proveDeposit: async (amount) => toRootTransition(await proveDepositInternal(amount)),
        proveWithdraw: async (amount) => toRootTransition(await proveWithdrawInternal(amount)),

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
                initialRoot: mergedProof.publicOutput.oldRoot.toString(),
                newRoot: mergedProof.publicOutput.newRoot.toString(),
            };
        },

        mergeAllProofs: async () => {
            if (proofs.length === 0) {
                throw new Error('No proofs to merge.');
            }

            if (proofs.length === 1) {
                const proof = proofs[0];
                return {
                    initialRoot: proof.publicOutput.oldRoot.toString(),
                    newRoot: proof.publicOutput.newRoot.toString(),
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
                initialRoot: mergedProof.publicOutput.oldRoot.toString(),
                newRoot: mergedProof.publicOutput.newRoot.toString(),
            };
        },
    };
}

export async function run(): Promise<RootTransition> {
    const totalStartMs = nowMs();
    const harness = await createVaultRollupProofHarness();
    const result = await harness.proveDepositNew(1_000_000_000);
    logPhase('run_total', totalStartMs);
    return result;
}

export default run;
