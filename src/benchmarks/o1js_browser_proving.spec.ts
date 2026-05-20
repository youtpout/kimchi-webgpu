import { expect } from 'chai';

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

async function timeRun<T>(run: () => Promise<T>): Promise<{ result: T; elapsedMs: number }> {
    const startMs = performance.now();
    const result = await run();
    return { result, elapsedMs: performance.now() - startMs };
}

const browserProving = new URLSearchParams(window.location.search).get('browserProving');

if (browserProving === 'counter') {
    describe('Browser o1js proving', () => {
        (it as any)(
            'runs the real counter proving flow in the browser',
            async () => {
                const params = new URLSearchParams(window.location.search);
                const roundsParam = params.get('rounds');
                const rounds = roundsParam ? Number.parseInt(roundsParam, 10) : 1;

                if (!Number.isFinite(rounds) || rounds < 1) {
                    throw new Error(`Invalid rounds parameter: ${roundsParam}`);
                }

                console.log(`[browser-proving] target=counter rounds=${rounds}`);

                const harnessModulePath = '/dist/src/proof/runCounterProof.js';
                const { createCounterProofHarness } = (await import(
                    harnessModulePath
                )) as {
                    createCounterProofHarness: () => Promise<{
                        proveIncrement: () => Promise<{
                            incrementTx: unknown;
                            finalCounter: string;
                        }>;
                    }>;
                };

                const setup = await timeRun(async () => createCounterProofHarness());
                console.log(
                    `[browser-proving] setup_total_ms=${setup.elapsedMs.toFixed(2)}`
                );

                const cold = await timeRun(async () => setup.result.proveIncrement());
                console.log(
                    `[browser-proving] cold_prove_ms=${cold.elapsedMs.toFixed(2)} final_counter=${cold.result.finalCounter}`
                );

                const warmTimingsMs: number[] = [];
                let lastFinalCounter = cold.result.finalCounter;

                for (let i = 0; i < rounds; i++) {
                    const warm = await timeRun(async () => setup.result.proveIncrement());
                    warmTimingsMs.push(warm.elapsedMs);
                    lastFinalCounter = warm.result.finalCounter;
                    console.log(
                        `[browser-proving] warm_prove_round=${i + 1} elapsed_ms=${warm.elapsedMs.toFixed(2)} final_counter=${warm.result.finalCounter}`
                    );
                }

                console.log(
                    `[browser-proving] warm_prove_runs_ms=${warmTimingsMs
                        .map((value) => value.toFixed(2))
                        .join(', ')}`
                );
                console.log(
                    `[browser-proving] warm_prove_median_ms=${median(warmTimingsMs).toFixed(2)}`
                );

                expect(lastFinalCounter).to.equal('0');
            },
            Infinity
        );
    });
}
