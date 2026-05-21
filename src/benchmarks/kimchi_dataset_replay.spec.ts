import { expect } from 'chai';
import {
    createPippengerMSMPallasRunner,
    pippengerMSMPallas,
    type PippengerMSMJob as PallasPippengerMSMJob,
} from '../gpu/256bit/pallas/pippenger_msm.js';
import {
    createPippengerMSMVestaRunner,
    pippengerMSMVesta,
    type PippengerMSMJob as VestaPippengerMSMJob,
} from '../gpu/256bit/vesta/pippenger_msm.js';
import { kimchiMsmDatasetFileFromJson } from '../datasets/kimchiMsmDataset.js';
import type { Point } from '../types/point.js';

interface CpuPoint {
    x: bigint;
    y: bigint;
    isInfinity: boolean;
}

interface CpuBenchmarkResultFile {
    version: 1;
    results: {
        label: string;
        curve: 'pallas' | 'vesta';
        msmKind: string;
        pointCount: number;
        coldMs: number;
        warmTimingsMs: number[];
        medianWarmMs: number;
        result: { x: string; y: string };
    }[];
}

async function getDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter found');
    return adapter.requestDevice();
}

async function fetchDatasetFile() {
    const params = new URLSearchParams(window.location.search);
    const datasetPath = params.get('dataset');

    if (!datasetPath) return null;

    const response = await fetch(`/${datasetPath}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch dataset file: ${datasetPath}`);
    }

    return kimchiMsmDatasetFileFromJson(await response.json());
}

async function fetchCpuBenchmarkFile() {
    const params = new URLSearchParams(window.location.search);
    const cpuResultsPath = params.get('cpuResults');
    if (!cpuResultsPath) return null;

    const response = await fetch(`/${cpuResultsPath}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch CPU benchmark file: ${cpuResultsPath}`);
    }
    return (await response.json()) as CpuBenchmarkResultFile;
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function pointMismatchSummary(
    gpu: Point,
    cpu: CpuPoint,
    _curve: 'pallas' | 'vesta'
): string | null {
    if (gpu.x === cpu.x && gpu.y === cpu.y) return null;

    return `x mismatch: gpu=${gpu.x} cpu=${cpu.x}; y mismatch: gpu=${gpu.y} cpu=${cpu.y}`;
}

async function runTimed(
    run: () => Promise<{ x: bigint; y: bigint }>,
    rounds: number
): Promise<{ result: { x: bigint; y: bigint }; timingsMs: number[] }> {
    const timingsMs: number[] = [];
    let result = await run();

    for (let i = 0; i < rounds; i++) {
        const start = performance.now();
        result = await run();
        timingsMs.push(performance.now() - start);
    }

    return { result, timingsMs };
}

function createRunner(
    device: GPUDevice,
    curve: 'pallas' | 'vesta'
): {
    runMany?: (
        jobs: { scalars: bigint[]; points: Point[]; label?: string }[],
        config?: { verbose?: boolean }
    ) => Promise<Point[]>;
    run: (
        scalars: bigint[],
        points: Point[],
        config?: { verbose?: boolean }
    ) => Promise<Point>;
} {
    return curve === 'pallas'
        ? createPippengerMSMPallasRunner(device, { bucketWidthBits: 8 })
        : createPippengerMSMVestaRunner(device, { bucketWidthBits: 8 });
}

async function runWarmBatch(
    device: GPUDevice,
    datasets: {
        label: string;
        curve: 'pallas' | 'vesta';
        scalars: bigint[];
        points: Point[];
    }[],
    rounds: number
) {
    const pallasRunner = createPippengerMSMPallasRunner(device, {
        bucketWidthBits: 8,
    });
    const vestaRunner = createPippengerMSMVestaRunner(device, {
        bucketWidthBits: 8,
    });

    const pallasJobs: PallasPippengerMSMJob[] = datasets
        .filter((dataset) => dataset.curve === 'pallas')
        .map((dataset) => ({
            label: dataset.label,
            scalars: dataset.scalars,
            points: dataset.points,
        }));
    const vestaJobs: VestaPippengerMSMJob[] = datasets
        .filter((dataset) => dataset.curve === 'vesta')
        .map((dataset) => ({
            label: dataset.label,
            scalars: dataset.scalars,
            points: dataset.points,
        }));

    if (pallasJobs.length > 0) {
        await pallasRunner.runMany!(pallasJobs, { verbose: false });
    }
    if (vestaJobs.length > 0) {
        await vestaRunner.runMany!(vestaJobs, { verbose: false });
    }

    const timingsMs: number[] = [];
    let lastResults = new Map<string, Point>();

    for (let round = 0; round < rounds; round++) {
        const start = performance.now();
        const roundResults = new Map<string, Point>();

        if (pallasJobs.length > 0) {
            const results = await pallasRunner.runMany!(pallasJobs, { verbose: false });
            for (let i = 0; i < pallasJobs.length; i++) {
                roundResults.set(pallasJobs[i].label ?? `pallas-${i}`, results[i]);
            }
        }
        if (vestaJobs.length > 0) {
            const results = await vestaRunner.runMany!(vestaJobs, { verbose: false });
            for (let i = 0; i < vestaJobs.length; i++) {
                roundResults.set(vestaJobs[i].label ?? `vesta-${i}`, results[i]);
            }
        }

        timingsMs.push(performance.now() - start);
        lastResults = roundResults;
    }

    return { timingsMs, results: lastResults };
}

async function runCold(
    device: GPUDevice,
    curve: 'pallas' | 'vesta',
    scalars: bigint[],
    points: Point[]
): Promise<Point> {
    return curve === 'pallas'
        ? pippengerMSMPallas(device, scalars, points, {
              bucketWidthBits: 8,
              verbose: false,
          })
        : pippengerMSMVesta(device, scalars, points, {
              bucketWidthBits: 8,
              verbose: false,
          });
}

const requestedDataset = new URLSearchParams(window.location.search).get('dataset');

if (requestedDataset) {
    describe('Kimchi MSM dataset replay', () => {
        (it as any)(
            'replays exported Kimchi MSM datasets',
            async () => {
                const datasetFile = await fetchDatasetFile();
                if (!datasetFile) {
                    throw new Error('Dataset query parameter was set but no dataset file was loaded');
                }

                const params = new URLSearchParams(window.location.search);
                const roundsParam = params.get('rounds');
                const rounds = roundsParam ? Number.parseInt(roundsParam, 10) : 3;
                const batchMsms = params.get('batchMsms') === '1';
                const limitParam = params.get('limit');
                const limit = limitParam ? Number.parseInt(limitParam, 10) : null;
                const labelFilter = params.get('label');
                const cpuBenchmarkFile = await fetchCpuBenchmarkFile();
                if (!cpuBenchmarkFile) {
                    throw new Error(
                        'Missing cpuResults query parameter. Generate CPU wasm results with bench:kimchi-cpu-msm and pass cpuResults=datasets/...json'
                    );
                }
                const cpuBenchmarks = new Map(
                    cpuBenchmarkFile.results.map((entry) => [entry.label, entry])
                );
                const device = await getDevice();
                const selectedDatasets = datasetFile.datasets
                    .filter((dataset) =>
                        labelFilter ? dataset.label.includes(labelFilter) : true
                    )
                    .slice(0, limit ?? undefined);

                if (selectedDatasets.length === 0) {
                    throw new Error(
                        `No datasets selected for replay (label=${labelFilter ?? '*'}, limit=${limit ?? 'all'})`
                    );
                }

                console.log(
                    `[dataset-replay] selected=${selectedDatasets.length}/${datasetFile.datasets.length}` +
                        (labelFilter ? ` label~=${labelFilter}` : '') +
                        (limit !== null ? ` limit=${limit}` : '')
                );

                const batchedWarmResults = batchMsms
                    ? await runWarmBatch(
                          device,
                          selectedDatasets.map((dataset) => ({
                              label: dataset.label,
                              curve: dataset.curve,
                              scalars: dataset.scalars,
                              points: dataset.points,
                          })),
                          rounds
                      )
                    : null;

                if (batchMsms && batchedWarmResults) {
                    console.log('');
                    console.log(
                        `[batched-msm] warm batch runs: ${batchedWarmResults.timingsMs
                            .map((ms) => ms.toFixed(2))
                            .join(', ')} ms`
                    );
                    console.log(
                        `[batched-msm] warm batch median: ${median(
                            batchedWarmResults.timingsMs
                        ).toFixed(2)} ms`
                    );
                }

                let totalCpuColdMs = 0;
                let totalCpuWarmMedianMs = 0;
                let totalGpuColdMs = 0;
                let totalGpuWarmMedianMs = 0;

                for (const dataset of selectedDatasets) {
                    console.log('');
                    console.log(`=== Dataset: ${dataset.label} ===`);
                    console.log(`Source: ${dataset.source}`);
                    console.log(`Curve: ${dataset.curve}`);
                    console.log(`MSM kind: ${dataset.msmKind}`);
                    console.log(`Point count: ${dataset.pointCount}`);

                    expect(dataset.scalars.length).to.equal(
                        dataset.points.length,
                        `${dataset.label} scalar/point length mismatch`
                    );

                    const cpuBenchmark = cpuBenchmarks.get(dataset.label);
                    if (!cpuBenchmark) {
                        throw new Error(
                            `Missing CPU wasm benchmark result for dataset ${dataset.label}`
                        );
                    }
                    const cpuColdMs = cpuBenchmark.coldMs;
                    const cpuMs = cpuBenchmark.medianWarmMs;
                    const cpuResult: CpuPoint = {
                        x: BigInt(cpuBenchmark.result.x),
                        y: BigInt(cpuBenchmark.result.y),
                        isInfinity: false,
                    };
                    console.log(`CPU wasm cold run: ${cpuColdMs.toFixed(2)} ms`);
                    console.log(`CPU wasm median warm run: ${cpuMs.toFixed(2)} ms`);
                    totalCpuColdMs += cpuColdMs;
                    totalCpuWarmMedianMs += cpuMs;

                    const coldStart = performance.now();
                    const coldResult = await runCold(
                        device,
                        dataset.curve,
                        dataset.scalars,
                        dataset.points
                    );
                    const coldMs = performance.now() - coldStart;

                    console.log(`GPU cold run: ${coldMs.toFixed(2)} ms`);
                    console.log(
                        `Cold result x: ${coldResult.x.toString().slice(0, 24)}...`
                    );
                    totalGpuColdMs += coldMs;

                    let result: Point;
                    let timingsMs: number[];
                    let medianMs: number;

                    if (batchMsms && batchedWarmResults) {
                        const batchedResult = batchedWarmResults.results.get(dataset.label);
                        if (!batchedResult) {
                            throw new Error(`Missing batched result for dataset ${dataset.label}`);
                        }
                        result = batchedResult;
                        timingsMs = batchedWarmResults.timingsMs;
                        medianMs = median(timingsMs);
                        console.log(
                            `GPU warm runs (batched): ${timingsMs
                                .map((ms) => ms.toFixed(2))
                                .join(', ')} ms`
                        );
                        console.log(
                            `GPU median warm run (batched): ${medianMs.toFixed(2)} ms`
                        );
                    } else {
                        const runner = createRunner(device, dataset.curve);
                        await runner.run(dataset.scalars, dataset.points, {
                            verbose: false,
                        });

                        const timed = await runTimed(
                            () =>
                                runner.run(dataset.scalars, dataset.points, {
                                    verbose: false,
                                }),
                            rounds
                        );
                        result = timed.result;
                        timingsMs = timed.timingsMs;
                        medianMs = median(timingsMs);
                        console.log(
                            `GPU warm runs: ${timingsMs
                                .map((ms) => ms.toFixed(2))
                                .join(', ')} ms`
                        );
                        console.log(`GPU median warm run: ${medianMs.toFixed(2)} ms`);
                    }
                    console.log(
                        `Warm result x: ${result.x.toString().slice(0, 24)}...`
                    );
                    totalGpuWarmMedianMs += medianMs;

                    const mismatch = pointMismatchSummary(
                        result,
                        cpuResult,
                        dataset.curve
                    );
                    expect(
                        mismatch,
                        mismatch === null
                            ? undefined
                            : `${dataset.label} CPU/GPU mismatch: ${mismatch}`
                    ).to.equal(null);
                    console.log('Correctness: CPU/GPU match');
                    console.log(
                        `Speedup CPU/GPU cold: ${(cpuColdMs / coldMs).toFixed(2)}x`
                    );
                    console.log(
                        `Speedup CPU/GPU warm median: ${(cpuMs / medianMs).toFixed(2)}x`
                    );
                }

                console.log('');
                console.log('=== Total comparison ===');
                console.log(
                    `CPU wasm total cold: ${totalCpuColdMs.toFixed(2)} ms`
                );
                console.log(
                    `CPU wasm total median warm: ${totalCpuWarmMedianMs.toFixed(2)} ms`
                );
                console.log(`GPU total cold: ${totalGpuColdMs.toFixed(2)} ms`);
                console.log(
                    `GPU total median warm: ${totalGpuWarmMedianMs.toFixed(2)} ms`
                );
                console.log(
                    `Total speedup CPU/GPU cold: ${(
                        totalCpuColdMs / totalGpuColdMs
                    ).toFixed(2)}x`
                );
                console.log(
                    `Total speedup CPU/GPU warm median: ${(
                        totalCpuWarmMedianMs / totalGpuWarmMedianMs
                    ).toFixed(2)}x`
                );
            },
            1_800_000
        );
    });
}
