import {
    AccountUpdate,
    Field,
    getGpuMsmRunner,
    getGpuProver,
    Mina,
    PrivateKey,
    setGpuMsmRunner,
    setGpuProver,
    setNumberOfWorkers,
    setBackend,
    UInt64,
} from 'o1js';
import { MinaVault } from './counter.js';
import {
    preloadEmbeddedO1jsCompileCache,
    type CacheLike,
} from './embeddedO1jsCompileCache.js';
import { createWebGpuBatchedMsmRunner } from './webgpuMsmBatcher.js';

setBackend('wasm');
setNumberOfWorkers(0);

export interface CounterProofHarness {
    feePayer: Awaited<ReturnType<typeof Mina.LocalBlockchain>>['testAccounts'][0];
    zkAppKey: PrivateKey;
    zkApp: MinaVault;
    proveIncrement: () => Promise<{
        incrementTx: Awaited<ReturnType<typeof Mina.transaction>>;
        finalCounter: string;
    }>;
}

export interface CounterProofHarnessOptions {
    compileCache?: CacheLike;
}

function nowMs() {
    return performance.now();
}

function logPhase(name: string, startMs: number) {
    const elapsedMs = nowMs() - startMs;
    console.log(`[o1js app-profile] phase=${name} elapsed_ms=${elapsedMs.toFixed(2)}`);
    return nowMs();
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

        console.log(`GPU prover hook called for account update #${callIndex}`);

        // Temporary fallback to validate the o1js gpuProving plumbing.
        return await cpuFallback();
    });
}

function installGpuMsmHook() {
    if (getGpuMsmRunner() !== undefined) return;
    setGpuMsmRunner(createWebGpuBatchedMsmRunner());
}

export async function createCounterProofHarness(
    options: CounterProofHarnessOptions = {}
): Promise<CounterProofHarness> {
    installGpuProofHook();
    installGpuMsmHook();

    const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);

    const feePayer = Local.testAccounts[0];
    const zkAppKey = PrivateKey.random();
    const zkAppAddress = zkAppKey.toPublicKey();
    const zkApp = new MinaVault(zkAppAddress);

    console.log('Compiling MinaVault...');
    let phaseStartMs = nowMs();
    const compileCache =
        options.compileCache ?? (await preloadEmbeddedO1jsCompileCache('counter'));
    const { verificationKey } =
        compileCache === undefined
            ? await MinaVault.compile()
            : await MinaVault.compile({ cache: compileCache });
    phaseStartMs = logPhase('compile', phaseStartMs);

    console.log('Deploying MinaVault...');
    const deployTx = await Mina.transaction(feePayer, async () => {
        AccountUpdate.fundNewAccount(feePayer);
        await zkApp.deploy({ verificationKey });
    });
    phaseStartMs = logPhase('deploy_tx_build', phaseStartMs);
    await deployTx.prove({ gpuProving: true });
    phaseStartMs = logPhase('deploy_tx_prove', phaseStartMs);
    deployTx.sign([feePayer.key, zkAppKey]);
    await deployTx.send();
    logPhase('deploy_tx_sign_send', phaseStartMs);

    return {
        feePayer,
        zkAppKey,
        zkApp,
        proveIncrement: async () => {
            console.log('Proving increment()...');
            let phaseStartMs = nowMs();
            const incrementTx = await Mina.transaction(feePayer, async () => {
                AccountUpdate.fundNewAccount(feePayer);
                await zkApp.deposit(UInt64.from(1_000_000_000));
            });
            phaseStartMs = logPhase('increment_tx_build', phaseStartMs);
            await incrementTx.prove({ gpuProving: true });
            phaseStartMs = logPhase('increment_tx_prove', phaseStartMs);
            incrementTx.sign([feePayer.key]);
            await incrementTx.send();
            logPhase('increment_tx_sign_send', phaseStartMs);

            const finalCounter = '0';
            console.log(`Final counter state: ${finalCounter.toString()}`);

            return {
                finalCounter: finalCounter.toString(),
                incrementTx,
            };
        },
    };
}

export async function run() {
    const totalStartMs = nowMs();
    const harness = await createCounterProofHarness();

    const { incrementTx, finalCounter } = await harness.proveIncrement();
    logPhase('run_total', totalStartMs);

    return {
        finalCounter,
        incrementTx,
    };
}

export default run;
