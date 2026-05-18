import { expect } from 'chai';
import {
    createPippengerMSMPallasRunner,
    pippengerMSMPallas,
} from '../gpu/256bit/pallas/pippenger_msm.js';

const Fp = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;
const Fr = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;
const PALLAS_G = pallasMakePoint(1n);

interface CpuPoint {
    x: bigint;
    y: bigint;
    isInfinity: boolean;
}

interface BenchmarkDataset {
    scalars: bigint[];
    gpuPoints: { x: bigint; y: bigint }[];
    cpuPoints: CpuPoint[];
}

function fpMod(a: bigint): bigint {
    return ((a % Fp) + Fp) % Fp;
}

function fpAdd(a: bigint, b: bigint): bigint {
    return fpMod(a + b);
}

function fpSub(a: bigint, b: bigint): bigint {
    return fpMod(a - b);
}

function fpMul(a: bigint, b: bigint): bigint {
    return fpMod(a * b);
}

function fpPow(base: bigint, exp: bigint): bigint {
    let result = 1n;
    base = fpMod(base);
    while (exp > 0n) {
        if (exp & 1n) result = fpMul(result, base);
        exp >>= 1n;
        base = fpMul(base, base);
    }
    return result;
}

function fpInv(a: bigint): bigint {
    return fpPow(a, Fp - 2n);
}

function tonelliShanks(n: bigint): bigint | null {
    if (n === 0n) return 0n;
    if (fpPow(n, (Fp - 1n) / 2n) !== 1n) return null;

    let q = Fp - 1n;
    let s = 0n;
    while ((q & 1n) === 0n) {
        q >>= 1n;
        s++;
    }

    let z = 2n;
    while (fpPow(z, (Fp - 1n) / 2n) !== Fp - 1n) z++;

    let m = s;
    let c = fpPow(z, q);
    let t = fpPow(n, q);
    let r = fpPow(n, (q + 1n) / 2n);

    while (true) {
        if (t === 1n) return r;
        let i = 1n;
        let tmp = fpMul(t, t);
        while (tmp !== 1n) {
            tmp = fpMul(tmp, tmp);
            i++;
        }
        const b = fpPow(c, fpPow(2n, m - i - 1n));
        m = i;
        c = fpMul(b, b);
        t = fpMul(t, c);
        r = fpMul(r, b);
    }
}

function pallasMakePoint(x: bigint): CpuPoint {
    const rhs = fpAdd(fpMul(fpMul(x, x), x), 5n);
    const y = tonelliShanks(rhs);
    if (y === null) throw new Error(`invalid Pallas point for x=${x}`);
    return { x, y, isInfinity: false };
}

const CPU_INFINITY: CpuPoint = { x: 0n, y: 0n, isInfinity: true };

function cpuAdd(p: CpuPoint, q: CpuPoint): CpuPoint {
    if (p.isInfinity) return q;
    if (q.isInfinity) return p;
    if (p.x === q.x) {
        if (p.y !== q.y) return CPU_INFINITY;
        return cpuDouble(p);
    }
    const lambda = fpMul(fpSub(q.y, p.y), fpInv(fpSub(q.x, p.x)));
    const x3 = fpSub(fpSub(fpMul(lambda, lambda), p.x), q.x);
    const y3 = fpSub(fpMul(lambda, fpSub(p.x, x3)), p.y);
    return { x: x3, y: y3, isInfinity: false };
}

function cpuDouble(p: CpuPoint): CpuPoint {
    if (p.isInfinity) return p;
    const lambda = fpMul(fpMul(3n, fpMul(p.x, p.x)), fpInv(fpMul(2n, p.y)));
    const x3 = fpSub(fpMul(lambda, lambda), fpMul(2n, p.x));
    const y3 = fpSub(fpMul(lambda, fpSub(p.x, x3)), p.y);
    return { x: x3, y: y3, isInfinity: false };
}

function cpuScalarMul(k: bigint, p: CpuPoint): CpuPoint {
    k = ((k % Fr) + Fr) % Fr;
    let r = CPU_INFINITY;
    let base = p;
    while (k > 0n) {
        if (k & 1n) r = cpuAdd(r, base);
        base = cpuDouble(base);
        k >>= 1n;
    }
    return r;
}

function cpuMSM(scalars: bigint[], points: CpuPoint[]): CpuPoint {
    let acc = CPU_INFINITY;
    for (let i = 0; i < scalars.length; i++) {
        acc = cpuAdd(acc, cpuScalarMul(scalars[i], points[i]));
    }
    return acc;
}

function deterministicScalar(i: number): bigint {
    let x = BigInt(i + 1) * 0x9e3779b97f4a7c15n + 0xbf58476d1ce4e5b9n;
    x ^= x >> 30n;
    x *= 0xbf58476d1ce4e5b9n;
    x ^= x >> 27n;
    x *= 0x94d049bb133111ebn;
    x ^= x >> 31n;
    return (x % (Fr - 1n)) + 1n;
}

function buildDataset(n: number): BenchmarkDataset {
    const scalars: bigint[] = new Array(n);
    const cpuPoints: CpuPoint[] = new Array(n);
    const gpuPoints: { x: bigint; y: bigint }[] = new Array(n);

    let current = PALLAS_G;
    for (let i = 0; i < n; i++) {
        if (i > 0) current = cpuAdd(current, PALLAS_G);
        scalars[i] = deterministicScalar(i);
        cpuPoints[i] = current;
        gpuPoints[i] = { x: current.x, y: current.y };
    }

    return { scalars, cpuPoints, gpuPoints };
}

async function getDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter found');
    return adapter.requestDevice();
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

async function runGpuTimed(
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

interface BenchmarkCase {
    n: number;
    bucketWidthBits: number;
    verifyCpu: boolean;
}

interface BenchmarkConfig {
    cases: BenchmarkCase[];
    rounds: number;
}

function parsePositiveInt(value: string | null, fallback: number): number {
    if (!value) return fallback;
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function defaultBucketWidthBits(n: number): number {
    if (n <= 1024) return 8;
    if (n <= 16384) return 10;
    return 12;
}

function readBenchmarkConfig(): BenchmarkConfig {
    const params = new URLSearchParams(window.location.search);
    const rounds = parsePositiveInt(params.get('rounds'), 3);
    const cpuMaxN = parsePositiveInt(params.get('cpuMaxN'), 1024);
    const forcedBucketWidthBits = params.get('bucketWidthBits');
    const forcedBucketWidth =
        forcedBucketWidthBits !== null
            ? parsePositiveInt(forcedBucketWidthBits, 8)
            : null;

    const sizesParam = params.get('sizes');
    const defaultCases: BenchmarkCase[] = [
        { n: 128, bucketWidthBits: 8, verifyCpu: true },
        { n: 1024, bucketWidthBits: 8, verifyCpu: true },
        { n: 4096, bucketWidthBits: 8, verifyCpu: false },
        { n: 16384, bucketWidthBits: 10, verifyCpu: false },
    ];

    if (!sizesParam) {
        return { cases: defaultCases, rounds };
    }

    const sizes = sizesParam
        .split(',')
        .map((value) => Number.parseInt(value.trim(), 10))
        .filter((value) => Number.isFinite(value) && value > 0);

    if (sizes.length === 0) {
        return { cases: defaultCases, rounds };
    }

    const cases = sizes.map((n) => ({
        n,
        bucketWidthBits: forcedBucketWidth ?? defaultBucketWidthBits(n),
        verifyCpu: n <= cpuMaxN,
    }));

    return { cases, rounds };
}

describe('Pippenger MSM benchmark with valid Pallas data', () => {
    (it as any)(
        'measures correctness on small sets and throughput on larger sets',
        async () => {
            const device = await getDevice();
            const { cases, rounds } = readBenchmarkConfig();

            for (const testCase of cases) {
                const { n, bucketWidthBits, verifyCpu } = testCase;
                const { scalars, cpuPoints, gpuPoints } = buildDataset(n);
                let cpuMs: number | null = null;

                console.log('');
                console.log(
                    `=== Benchmark case: N=${n}, bucketWidthBits=${bucketWidthBits} ===`
                );

                let expected: CpuPoint | null = null;
                if (verifyCpu) {
                    const cpuStart = performance.now();
                    expected = cpuMSM(scalars, cpuPoints);
                    cpuMs = performance.now() - cpuStart;
                    console.log(`CPU reference: ${cpuMs.toFixed(2)} ms`);
                } else {
                    console.log('CPU reference skipped for this size');
                }

                const coldStart = performance.now();
                const coldResult = await pippengerMSMPallas(
                    device,
                    scalars,
                    gpuPoints,
                    { bucketWidthBits, verbose: false }
                );
                const coldMs = performance.now() - coldStart;
                console.log(`GPU cold run: ${coldMs.toFixed(2)} ms`);

                if (expected && !expected.isInfinity) {
                    expect(coldResult.x).to.equal(expected.x, `cold run x for N=${n}`);
                    expect(coldResult.y).to.equal(expected.y, `cold run y for N=${n}`);
                }

                const runner = createPippengerMSMPallasRunner(device, {
                    bucketWidthBits,
                });

                await runner.run(scalars, gpuPoints, { verbose: false });

                const { result, timingsMs } = await runGpuTimed(
                    () => runner.run(scalars, gpuPoints, { verbose: false }),
                    rounds
                );

                const medianMs = median(timingsMs);
                const avgMs =
                    timingsMs.reduce((sum, value) => sum + value, 0) /
                    timingsMs.length;
                const msmPerSecond = (n / medianMs) * 1000;

                console.log(
                    `GPU warm runs: ${timingsMs
                        .map((ms) => ms.toFixed(2))
                        .join(', ')} ms`
                );
                console.log(`GPU median warm run: ${medianMs.toFixed(2)} ms`);
                console.log(`GPU average warm run: ${avgMs.toFixed(2)} ms`);
                console.log(
                    `Approx throughput: ${Math.round(msmPerSecond).toLocaleString()} scalar-point pairs/s`
                );
                if (cpuMs !== null) {
                    console.log(
                        `Speedup CPU/GPU cold: ${(cpuMs / coldMs).toFixed(2)}x`
                    );
                    console.log(
                        `Speedup CPU/GPU warm median: ${(cpuMs / medianMs).toFixed(2)}x`
                    );
                }

                if (expected && !expected.isInfinity) {
                    expect(result.x).to.equal(expected.x, `warm run x for N=${n}`);
                    expect(result.y).to.equal(expected.y, `warm run y for N=${n}`);
                    console.log('Correctness: CPU/GPU match');
                } else if (expected?.isInfinity) {
                    expect(result.x).to.equal(0n, `warm run x identity for N=${n}`);
                    expect(result.y).to.equal(0n, `warm run y identity for N=${n}`);
                    console.log('Correctness: CPU/GPU match on identity');
                }
            }
        },
        1_800_000
    );
});
