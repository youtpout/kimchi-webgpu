import { expect } from 'chai';
import {
    createPippengerMSMPallasRunner,
    pippengerMSMPallas,
} from '../gpu/256bit/pallas/pippenger_msm.js';
import {
    createPippengerMSMVestaRunner,
    pippengerMSMVesta,
} from '../gpu/256bit/vesta/pippenger_msm.js';
import { kimchiMsmDatasetFileFromJson } from '../datasets/kimchiMsmDataset.js';
import type { Point } from '../types/point.js';

const PALLAS_BASE_FIELD =
    0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;
const PALLAS_SCALAR_FIELD =
    0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;
const VESTA_BASE_FIELD =
    0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;
const VESTA_SCALAR_FIELD =
    0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;

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

const CPU_INFINITY: CpuPoint = { x: 0n, y: 0n, isInfinity: true };

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

function curveParams(curve: 'pallas' | 'vesta') {
    return curve === 'pallas'
        ? { baseField: PALLAS_BASE_FIELD, scalarField: PALLAS_SCALAR_FIELD }
        : { baseField: VESTA_BASE_FIELD, scalarField: VESTA_SCALAR_FIELD };
}

function fpMod(a: bigint, modulus: bigint): bigint {
    return ((a % modulus) + modulus) % modulus;
}

function fpSub(a: bigint, b: bigint, modulus: bigint): bigint {
    return fpMod(a - b, modulus);
}

function fpMul(a: bigint, b: bigint, modulus: bigint): bigint {
    return fpMod(a * b, modulus);
}

function fpPow(base: bigint, exp: bigint, modulus: bigint): bigint {
    let result = 1n;
    base = fpMod(base, modulus);
    while (exp > 0n) {
        if (exp & 1n) result = fpMul(result, base, modulus);
        exp >>= 1n;
        base = fpMul(base, base, modulus);
    }
    return result;
}

function fpInv(a: bigint, modulus: bigint): bigint {
    return fpPow(a, modulus - 2n, modulus);
}

function cpuAdd(p: CpuPoint, q: CpuPoint, modulus: bigint): CpuPoint {
    if (p.isInfinity) return q;
    if (q.isInfinity) return p;
    if (p.x === q.x) {
        if (p.y !== q.y) return CPU_INFINITY;
        return cpuDouble(p, modulus);
    }
    const lambda = fpMul(
        fpSub(q.y, p.y, modulus),
        fpInv(fpSub(q.x, p.x, modulus), modulus),
        modulus
    );
    const x3 = fpSub(fpSub(fpMul(lambda, lambda, modulus), p.x, modulus), q.x, modulus);
    const y3 = fpSub(fpMul(lambda, fpSub(p.x, x3, modulus), modulus), p.y, modulus);
    return { x: x3, y: y3, isInfinity: false };
}

function cpuDouble(p: CpuPoint, modulus: bigint): CpuPoint {
    if (p.isInfinity) return p;
    const lambda = fpMul(
        fpMul(3n, fpMul(p.x, p.x, modulus), modulus),
        fpInv(fpMul(2n, p.y, modulus), modulus),
        modulus
    );
    const x3 = fpSub(fpMul(lambda, lambda, modulus), fpMul(2n, p.x, modulus), modulus);
    const y3 = fpSub(fpMul(lambda, fpSub(p.x, x3, modulus), modulus), p.y, modulus);
    return { x: x3, y: y3, isInfinity: false };
}

function cpuScalarMul(k: bigint, p: CpuPoint, curve: 'pallas' | 'vesta'): CpuPoint {
    const { baseField, scalarField } = curveParams(curve);
    k = ((k % scalarField) + scalarField) % scalarField;
    let r = CPU_INFINITY;
    let base = p;
    while (k > 0n) {
        if (k & 1n) r = cpuAdd(r, base, baseField);
        base = cpuDouble(base, baseField);
        k >>= 1n;
    }
    return r;
}

function cpuMSM(
    scalars: bigint[],
    points: Point[],
    curve: 'pallas' | 'vesta'
): CpuPoint {
    const { baseField } = curveParams(curve);
    let acc = CPU_INFINITY;
    for (let i = 0; i < scalars.length; i++) {
        acc = cpuAdd(
            acc,
            cpuScalarMul(scalars[i], { ...points[i], isInfinity: false }, curve),
            baseField
        );
    }
    return acc;
}

function pointMismatchSummary(
    gpu: Point,
    cpu: CpuPoint,
    curve: 'pallas' | 'vesta'
): string | null {
    const { baseField } = curveParams(curve);
    if (gpu.x === cpu.x && gpu.y === cpu.y) return null;

    const negCpuY = fpMod(-cpu.y, baseField);
    if (gpu.x === cpu.x && gpu.y === negCpuY) {
        return 'same x but negated y (gpu.y = -cpu.y mod p)';
    }

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
                const cpuMaxNParam = params.get('cpuMaxN');
                const cpuMaxN = cpuMaxNParam
                    ? Number.parseInt(cpuMaxNParam, 10)
                    : 4096;
                const cpuBenchmarkFile = await fetchCpuBenchmarkFile();
                const cpuBenchmarks = new Map(
                    (cpuBenchmarkFile?.results ?? []).map((entry) => [entry.label, entry])
                );
                const device = await getDevice();

                for (const dataset of datasetFile.datasets) {
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

                    let cpuMs: number | null = null;
                    let cpuColdMs: number | null = null;
                    let cpuResult: CpuPoint | null = null;
                    const cpuBenchmark = cpuBenchmarks.get(dataset.label);
                    if (cpuBenchmark) {
                        cpuColdMs = cpuBenchmark.coldMs;
                        cpuMs = cpuBenchmark.medianWarmMs;
                        cpuResult = {
                            x: BigInt(cpuBenchmark.result.x),
                            y: BigInt(cpuBenchmark.result.y),
                            isInfinity: false,
                        };
                        console.log(`CPU wasm cold run: ${cpuColdMs.toFixed(2)} ms`);
                        console.log(`CPU wasm median warm run: ${cpuMs.toFixed(2)} ms`);
                    } else if (dataset.pointCount <= cpuMaxN) {
                        const cpuStart = performance.now();
                        cpuResult = cpuMSM(
                            dataset.scalars,
                            dataset.points,
                            dataset.curve
                        );
                        cpuMs = performance.now() - cpuStart;
                        cpuColdMs = cpuMs;
                        console.log(`CPU reference: ${cpuMs.toFixed(2)} ms`);
                    } else {
                        console.log('CPU reference skipped for this dataset');
                    }

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

                    const runner = createRunner(device, dataset.curve);
                    await runner.run(dataset.scalars, dataset.points, {
                        verbose: false,
                    });

                    const { result, timingsMs } = await runTimed(
                        () =>
                            runner.run(dataset.scalars, dataset.points, {
                                verbose: false,
                            }),
                        rounds
                    );

                    const medianMs = median(timingsMs);
                    console.log(
                        `GPU warm runs: ${timingsMs
                            .map((ms) => ms.toFixed(2))
                            .join(', ')} ms`
                    );
                    console.log(`GPU median warm run: ${medianMs.toFixed(2)} ms`);
                    console.log(
                        `Warm result x: ${result.x.toString().slice(0, 24)}...`
                    );

                    if (cpuMs !== null && cpuResult !== null) {
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
                        if (cpuColdMs !== null) {
                            console.log(
                                `Speedup CPU/GPU cold: ${(cpuColdMs / coldMs).toFixed(2)}x`
                            );
                        }
                        console.log(
                            `Speedup CPU/GPU warm median: ${(cpuMs / medianMs).toFixed(2)}x`
                        );
                    }
                }
            },
            1_800_000
        );
    });
}
