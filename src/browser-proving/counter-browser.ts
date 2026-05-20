async function main() {
    const params = new URLSearchParams(window.location.search);
    const roundsParam = params.get('rounds');
    const rounds = roundsParam ? Number.parseInt(roundsParam, 10) : 1;

    if (!Number.isFinite(rounds) || rounds < 1) {
        throw new Error(`Invalid rounds parameter: ${roundsParam}`);
    }

    console.log(`[browser-proving] target=counter rounds=${rounds}`);

    const { createCounterProofHarness } = await import('../proof/runCounterProof.js');

    const timeRun = async <T>(run: () => Promise<T>) => {
        const startMs = performance.now();
        const result = await run();
        return { result, elapsedMs: performance.now() - startMs };
    };

    const median = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    };

    const setup = await timeRun(async () => createCounterProofHarness());
    console.log(`[browser-proving] setup_total_ms=${setup.elapsedMs.toFixed(2)}`);

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

    if (lastFinalCounter !== '0') {
        throw new Error(`Unexpected final counter state: ${lastFinalCounter}`);
    }

    (window as any).testsFailures = 0;
    (window as any).testsFinished = true;
}

main().catch((error) => {
    console.error('[browser-proving] fatal', error);
    (window as any).testsFailures = 1;
    (window as any).testsFinished = true;
});
