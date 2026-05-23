async function main() {
    const params = new URLSearchParams(window.location.search);
    const requestedTarget = params.get('browserProving') ?? 'counter';
    const target =
        requestedTarget === 'rollup-deposit-new'
            ? 'rollup-deposit'
            : requestedTarget;
    const roundsParam = params.get('rounds');
    const rounds = roundsParam ? Number.parseInt(roundsParam, 10) : 1;

    if (!Number.isFinite(rounds) || rounds < 1) {
        throw new Error(`Invalid rounds parameter: ${roundsParam}`);
    }

    const timeRun = async <T>(run: () => Promise<T>) => {
        const startMs = performance.now();
        const result = await run();
        return { result, elapsedMs: performance.now() - startMs };
    };

    const formatError = (error: unknown) => {
        if (error instanceof Error) {
            return {
                name: error.name,
                message: error.message,
                stack: error.stack,
            };
        }
        if (typeof error === 'object' && error !== null) {
            const serialized = Object.fromEntries(
                Object.entries(error).map(([key, value]) => [key, String(value)])
            );
            return serialized;
        }
        return { value: String(error) };
    };

    const median = (values: number[]) => {
        const sorted = [...values].sort((a, b) => a - b);
        const mid = Math.floor(sorted.length / 2);
        return sorted.length % 2 === 0
            ? (sorted[mid - 1] + sorted[mid]) / 2
            : sorted[mid];
    };

    console.log(`[browser-proving] target=${target} rounds=${rounds}`);

    const warmTimingsMs: number[] = [];
    let lastSummary = '';

    if (target === 'counter') {
        const { createCounterProofHarness } = await import('../proof/runCounterProof.js');
        const setup = await timeRun(async () => createCounterProofHarness());
        console.log(`[browser-proving] setup_total_ms=${setup.elapsedMs.toFixed(2)}`);

        const cold = await timeRun(async () => setup.result.proveIncrement());
        lastSummary = `final_counter=${cold.result.finalCounter}`;
        console.log(
            `[browser-proving] cold_prove_ms=${cold.elapsedMs.toFixed(2)} ${lastSummary}`
        );

        for (let i = 0; i < rounds; i++) {
            let warm;
            try {
                warm = await timeRun(async () => setup.result.proveIncrement());
            } catch (error) {
                console.error(
                    '[browser-proving] warm_prove_failed',
                    JSON.stringify({
                        round: i + 1,
                        ...formatError(error),
                    })
                );
                throw error;
            }
            warmTimingsMs.push(warm.elapsedMs);
            lastSummary = `final_counter=${warm.result.finalCounter}`;
            console.log(
                `[browser-proving] warm_prove_round=${i + 1} elapsed_ms=${warm.elapsedMs.toFixed(2)} ${lastSummary}`
            );
        }
    } else if (target === 'rollup-deposit') {
        const { createVaultRollupProofHarness } = await import('../proof/runRollup.js');
        const bootstrapAmount = params.get('bootstrapAmount') ?? '1000000000';
        const amount = params.get('amount') ?? '500000000';

        const setup = await timeRun(async () => createVaultRollupProofHarness());
        console.log(`[browser-proving] setup_total_ms=${setup.elapsedMs.toFixed(2)}`);

        const bootstrap = await timeRun(async () =>
            setup.result.proveDepositNew(bootstrapAmount)
        );
        console.log(
            `[browser-proving] bootstrap_ms=${bootstrap.elapsedMs.toFixed(2)} initial_root=${bootstrap.result.initialRoot} new_root=${bootstrap.result.newRoot}`
        );

        const cold = await timeRun(async () => setup.result.proveDeposit(amount));
        lastSummary = `initial_root=${cold.result.initialRoot} new_root=${cold.result.newRoot}`;
        console.log(
            `[browser-proving] cold_prove_ms=${cold.elapsedMs.toFixed(2)} ${lastSummary}`
        );

        for (let i = 0; i < rounds; i++) {
            let warm;
            try {
                warm = await timeRun(async () => createVaultRollupProofHarness());
            } catch (error) {
                console.error(
                    '[browser-proving] warm_setup_failed',
                    JSON.stringify({
                        round: i + 1,
                        ...formatError(error),
                    })
                );
                throw error;
            }
            console.log(
                `[browser-proving] warm_setup_round=${i + 1} elapsed_ms=${warm.elapsedMs.toFixed(2)}`
            );
            let warmBootstrap;
            try {
                warmBootstrap = await timeRun(async () =>
                    warm.result.proveDepositNew(bootstrapAmount)
                );
            } catch (error) {
                console.error(
                    '[browser-proving] warm_bootstrap_failed',
                    JSON.stringify({
                        round: i + 1,
                        ...formatError(error),
                    })
                );
                throw error;
            }
            console.log(
                `[browser-proving] warm_bootstrap_round=${i + 1} elapsed_ms=${warmBootstrap.elapsedMs.toFixed(2)} initial_root=${warmBootstrap.result.initialRoot} new_root=${warmBootstrap.result.newRoot}`
            );
            let prove;
            try {
                prove = await timeRun(async () => warm.result.proveDeposit(amount));
            } catch (error) {
                console.error(
                    '[browser-proving] warm_prove_failed',
                    JSON.stringify({
                        round: i + 1,
                        ...formatError(error),
                    })
                );
                throw error;
            }
            warmTimingsMs.push(prove.elapsedMs);
            lastSummary = `initial_root=${prove.result.initialRoot} new_root=${prove.result.newRoot}`;
            console.log(
                `[browser-proving] warm_prove_round=${i + 1} elapsed_ms=${prove.elapsedMs.toFixed(2)} ${lastSummary}`
            );
        }
    } else {
        throw new Error(`Unsupported browserProving target: ${target}`);
    }

    console.log(
        `[browser-proving] warm_prove_runs_ms=${warmTimingsMs
            .map((value) => value.toFixed(2))
            .join(', ')}`
    );
    console.log(
        `[browser-proving] warm_prove_median_ms=${median(warmTimingsMs).toFixed(2)}`
    );

    if (target === 'counter' && lastSummary !== 'final_counter=0') {
        throw new Error(`Unexpected counter summary: ${lastSummary}`);
    }

    (window as any).testsFailures = 0;
    (window as any).testsFinished = true;
}

main().catch((error) => {
    console.error('[browser-proving] fatal', JSON.stringify(error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
    } : error));
    (window as any).testsFailures = 1;
    (window as any).testsFinished = true;
});
