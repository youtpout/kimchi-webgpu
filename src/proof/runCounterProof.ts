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

setBackend('wasm');
setNumberOfWorkers(0);

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

    setGpuMsmRunner(({ curve, msmKind, scalars, points, cpuFallback, metadata }) => {
        const scalarCount = scalars?.length ?? 0;
        const pointCount = points?.length ?? 0;
        const domainSize =
            typeof metadata === 'object' &&
            metadata !== null &&
            'domainSize' in metadata &&
            typeof (metadata as { domainSize?: unknown }).domainSize === 'number'
                ? (metadata as { domainSize: number }).domainSize
                : undefined;

        console.log(
            `GPU MSM runner called: kind=${msmKind} curve=${curve} scalars=${scalarCount} points=${pointCount}` +
                (domainSize === undefined ? '' : ` domainSize=${domainSize}`)
        );

        return cpuFallback?.();
    });
}

export async function run() {
    installGpuProofHook();
    installGpuMsmHook();
    const totalStartMs = nowMs();

    const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);

    const feePayer = Local.testAccounts[0];
    const zkAppKey = PrivateKey.random();
    const zkAppAddress = zkAppKey.toPublicKey();
    const zkApp = new MinaVault(zkAppAddress);

    console.log('Compiling MinaVault...');
    let phaseStartMs = nowMs();
    const { verificationKey } = await MinaVault.compile();
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
    phaseStartMs = logPhase('deploy_tx_sign_send', phaseStartMs);

    console.log('Proving increment()...');
    const incrementTx = await Mina.transaction(feePayer, async () => {
        AccountUpdate.fundNewAccount(feePayer);
        await zkApp.deposit(UInt64.from(1_000_000_000));
    });
    phaseStartMs = logPhase('increment_tx_build', phaseStartMs);
    await incrementTx.prove({ gpuProving: true });
    phaseStartMs = logPhase('increment_tx_prove', phaseStartMs);
    incrementTx.sign([feePayer.key]);
    await incrementTx.send();
    phaseStartMs = logPhase('increment_tx_sign_send', phaseStartMs);
    logPhase('run_total', totalStartMs);

    const finalCounter = '0';
    console.log(`Final counter state: ${finalCounter.toString()}`);

    return {
        finalCounter: finalCounter.toString(),
        incrementTx,
    };
}

export default run;
