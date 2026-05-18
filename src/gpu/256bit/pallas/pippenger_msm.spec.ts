/**
 * Pippenger MSM – correctness tests (inspired by o1js MSM test suite).
 *
 * Each test verifies that the GPU result matches a CPU reference implementation
 * using the same Pallas curve arithmetic.  The CPU reference is intentionally
 * simple (double-and-add, no Montgomery tricks) to serve as an independent
 * ground truth.
 */
import { expect } from 'chai';
import { pippengerMSMPallas } from './pippenger_msm.js';

// ---------------------------------------------------------------------------
// Pallas curve parameters (standard form, no Montgomery encoding on CPU side)
// ---------------------------------------------------------------------------

const Fp = 0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n; // field prime
const Fr = 0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n; // scalar field

/** Generator point of the Pallas curve (y² = x³ + 5, x = 1). */
const PALLAS_G = pallasMakePoint(1n);

// ---------------------------------------------------------------------------
// CPU reference: minimal Pallas arithmetic using BigInt
// ---------------------------------------------------------------------------

interface CpuPoint { x: bigint; y: bigint; isInfinity: boolean }

function fpMod(a: bigint): bigint { return ((a % Fp) + Fp) % Fp; }

function fpAdd(a: bigint, b: bigint): bigint { return fpMod(a + b); }
function fpSub(a: bigint, b: bigint): bigint { return fpMod(a - b); }
function fpMul(a: bigint, b: bigint): bigint { return fpMod(a * b); }

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

function fpInv(a: bigint): bigint { return fpPow(a, Fp - 2n); }

/** Given x, solve y² = x³ + 5 and return the point (positive square root). */
function pallasMakePoint(x: bigint): CpuPoint {
    const rhs = fpAdd(fpMul(fpMul(x, x), x), 5n); // x³ + 5
    // Square root via Tonelli–Shanks (for Pallas, p ≡ 1 mod 4 but we need the
    // general case; however p ≡ 3 mod 4 does NOT hold here, so we use p ≡ 1 mod 4
    // property: p-1 = 4 * k.  Use Tonelli–Shanks or direct formula if 5 is a QR.)
    // For simplicity use the 5-modular-exponent formula that works for Pallas.
    // The Pallas prime satisfies p ≡ 1 (mod 4), so we use Cipolla or a lookup.
    // Here we use: y = rhs^((p+1)/4) only when p ≡ 3 mod 4; since it doesn't,
    // we use Tonelli–Shanks via repeated squaring trial.  For test correctness we
    // accept that this may fail for non-QR values and document that below.
    const y = tonelliShanks(rhs);
    if (y === null) throw new Error(`x=${x} does not yield a valid Pallas y coordinate`);
    return { x, y, isInfinity: false };
}

/** Tonelli–Shanks square root modulo Fp.  Returns null if rhs is a non-residue. */
function tonelliShanks(n: bigint): bigint | null {
    if (n === 0n) return 0n;
    if (fpPow(n, (Fp - 1n) / 2n) !== 1n) return null; // Euler criterion

    // Write p - 1 = Q * 2^S with Q odd.
    let Q = Fp - 1n;
    let S = 0n;
    while ((Q & 1n) === 0n) { Q >>= 1n; S++; }

    // Find a quadratic non-residue z.
    let z = 2n;
    while (fpPow(z, (Fp - 1n) / 2n) !== Fp - 1n) z++;

    let M = S;
    let c = fpPow(z, Q);
    let t = fpPow(n, Q);
    let R = fpPow(n, (Q + 1n) / 2n);

    while (true) {
        if (t === 1n) return R;
        let i = 1n;
        let tmp = fpMul(t, t);
        while (tmp !== 1n) { tmp = fpMul(tmp, tmp); i++; }
        const b = fpPow(c, fpPow(2n, M - i - 1n));
        M = i;
        c = fpMul(b, b);
        t = fpMul(t, c);
        R = fpMul(R, b);
    }
}

const CPU_INFINITY: CpuPoint = { x: 0n, y: 0n, isInfinity: true };

function cpuAdd(P: CpuPoint, Q: CpuPoint): CpuPoint {
    if (P.isInfinity) return Q;
    if (Q.isInfinity) return P;
    if (P.x === Q.x) {
        if (P.y !== Q.y) return CPU_INFINITY; // P + (-P)
        return cpuDouble(P);
    }
    const lambda = fpMul(fpSub(Q.y, P.y), fpInv(fpSub(Q.x, P.x)));
    const x3 = fpSub(fpSub(fpMul(lambda, lambda), P.x), Q.x);
    const y3 = fpSub(fpMul(lambda, fpSub(P.x, x3)), P.y);
    return { x: x3, y: y3, isInfinity: false };
}

function cpuDouble(P: CpuPoint): CpuPoint {
    if (P.isInfinity) return P;
    const lambda = fpMul(fpMul(3n, fpMul(P.x, P.x)), fpInv(fpMul(2n, P.y)));
    const x3 = fpSub(fpMul(lambda, lambda), fpMul(2n, P.x));
    const y3 = fpSub(fpMul(lambda, fpSub(P.x, x3)), P.y);
    return { x: x3, y: y3, isInfinity: false };
}

function cpuScalarMul(k: bigint, P: CpuPoint): CpuPoint {
    k = ((k % Fr) + Fr) % Fr;
    let R = CPU_INFINITY;
    let base = P;
    while (k > 0n) {
        if (k & 1n) R = cpuAdd(R, base);
        base = cpuDouble(base);
        k >>= 1n;
    }
    return R;
}

function cpuMSM(scalars: bigint[], points: CpuPoint[]): CpuPoint {
    let acc = CPU_INFINITY;
    for (let i = 0; i < scalars.length; i++) {
        acc = cpuAdd(acc, cpuScalarMul(scalars[i], points[i]));
    }
    return acc;
}

function pointsEqual(A: CpuPoint, B: { x: bigint; y: bigint }): boolean {
    if (A.isInfinity) return B.x === 0n && B.y === 0n;
    return A.x === B.x && A.y === B.y;
}

// ---------------------------------------------------------------------------
// Helper: get a GPU device (browser environment).
// ---------------------------------------------------------------------------

async function getDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter found');
    return adapter.requestDevice();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

const GPU_TIMEOUT = 300_000; // 5 min per test — GPU ops can be slow

describe('pippengerMSMPallas — correctness (inspired by o1js MSM tests)', () => {

    // -----------------------------------------------------------------------
    // 1. Identity: 0 * G = point at infinity (returned as (0,0))
    // -----------------------------------------------------------------------
    it('scalar=0 yields the identity point (0,0)', async () => {
        const device = await getDevice();
        const G: { x: bigint; y: bigint } = { x: PALLAS_G.x, y: PALLAS_G.y };
        const result = await pippengerMSMPallas(device, [0n], [G], { bucketWidthBits: 4, verbose: false });
        expect(result.x).to.equal(0n);
        expect(result.y).to.equal(0n);
    });

    // -----------------------------------------------------------------------
    // 2. 1 * G = G
    // -----------------------------------------------------------------------
    it('scalar=1 returns the point itself', async () => {
        const device = await getDevice();
        const G: { x: bigint; y: bigint } = { x: PALLAS_G.x, y: PALLAS_G.y };
        const result = await pippengerMSMPallas(device, [1n], [G], { bucketWidthBits: 4, verbose: false });
        expect(result.x).to.equal(PALLAS_G.x, 'x coordinate should match G.x');
        expect(result.y).to.equal(PALLAS_G.y, 'y coordinate should match G.y');
    });

    // -----------------------------------------------------------------------
    // 3. 2 * G = G + G (doubling)
    // -----------------------------------------------------------------------
    it('scalar=2 matches CPU point doubling', async () => {
        const device = await getDevice();
        const G: { x: bigint; y: bigint } = { x: PALLAS_G.x, y: PALLAS_G.y };
        const expected = cpuDouble(PALLAS_G);

        const result = await pippengerMSMPallas(device, [2n], [G], { bucketWidthBits: 4, verbose: false });
        expect(result.x).to.equal(expected.x, '2G x');
        expect(result.y).to.equal(expected.y, '2G y');
    });

    // -----------------------------------------------------------------------
    // 3b. MSM([3],[G]) = 3*G via weight=3 bucket (diagnostic for weight vs accumulation)
    // -----------------------------------------------------------------------
    it('scalar=3 matches CPU 3*G (via bucket weight)', async () => {
        const device = await getDevice();
        const G: { x: bigint; y: bigint } = { x: PALLAS_G.x, y: PALLAS_G.y };
        const expected = cpuScalarMul(3n, PALLAS_G);
        const result = await pippengerMSMPallas(device, [3n], [G], { bucketWidthBits: 4, verbose: false });
        console.log(`[s3] gpu.x = ${result.x.toString()}`);
        console.log(`[s3] cpu.x = ${expected.x.toString()}`);
        console.log(`[s3] gpu.y = ${result.y.toString()}`);
        console.log(`[s3] cpu.y = ${expected.y.toString()}`);
        expect(result.x.toString()).to.equal(expected.x.toString(), 'scalar=3 x');
        expect(result.y.toString()).to.equal(expected.y.toString(), 'scalar=3 y');
    });

    // -----------------------------------------------------------------------
    // 4. MSM([1,1,1], [G,G,G]) = 3*G
    // -----------------------------------------------------------------------
    it('MSM([1,1,1],[G,G,G]) equals 3*G', async () => {
        const device = await getDevice();
        const G: { x: bigint; y: bigint } = { x: PALLAS_G.x, y: PALLAS_G.y };
        const expected = cpuScalarMul(3n, PALLAS_G);

        const result = await pippengerMSMPallas(device, [1n, 1n, 1n], [G, G, G], { bucketWidthBits: 4, verbose: false });
        console.log(`[3G] gpu.x  = ${result.x.toString()}`);
        console.log(`[3G] cpu.x  = ${expected.x.toString()}`);
        console.log(`[3G] gpu.y  = ${result.y.toString()}`);
        console.log(`[3G] cpu.y  = ${expected.y.toString()}`);
        expect(result.x.toString()).to.equal(expected.x.toString(), '3G x');
        expect(result.y.toString()).to.equal(expected.y.toString(), '3G y');
    });

    // -----------------------------------------------------------------------
    // 5. Linearity: MSM([k1,k2],[G,G]) = (k1+k2)*G
    // -----------------------------------------------------------------------
    it('linearity: MSM([k1,k2],[G,G]) equals (k1+k2)*G', async () => {
        const device = await getDevice();
        const G: { x: bigint; y: bigint } = { x: PALLAS_G.x, y: PALLAS_G.y };
        const k1 = 7n, k2 = 13n;
        const expected = cpuScalarMul(k1 + k2, PALLAS_G);

        const result = await pippengerMSMPallas(device, [k1, k2], [G, G], { bucketWidthBits: 4, verbose: false });
        expect(result.x).to.equal(expected.x, 'linearity x');
        expect(result.y).to.equal(expected.y, 'linearity y');
    });

    // -----------------------------------------------------------------------
    // 6. Zero scalar in mixed MSM: MSM([0,k],[P,Q]) = k*Q
    // -----------------------------------------------------------------------
    it('zero scalar in mixed MSM: MSM([0,k],[P,Q]) equals k*Q', async () => {
        const device = await getDevice();
        const G: { x: bigint; y: bigint } = { x: PALLAS_G.x, y: PALLAS_G.y };
        const twoG = cpuDouble(PALLAS_G);
        const Q: { x: bigint; y: bigint } = { x: twoG.x, y: twoG.y };
        const k = 5n;
        const expected = cpuScalarMul(k, twoG);

        const result = await pippengerMSMPallas(device, [0n, k], [G, Q], { bucketWidthBits: 4, verbose: false });
        console.log(`[mixed] gpu.x = ${result.x.toString()}`);
        console.log(`[mixed] cpu.x = ${expected.x.toString()}`);
        console.log(`[mixed] match = ${result.x === expected.x && result.y === expected.y}`);
        expect(result.x.toString()).to.equal(expected.x.toString(), 'mixed MSM x');
        expect(result.y.toString()).to.equal(expected.y.toString(), 'mixed MSM y');
    });

    // -----------------------------------------------------------------------
    // 7. Small random batch vs CPU reference (N=20, random-looking but deterministic)
    // -----------------------------------------------------------------------
    it('N=20 deterministic scalars/points match CPU reference', async () => {
        const device = await getDevice();
        const N = 20;

        // Build deterministic test vectors: points are k*G for k=1..N, scalars are small primes.
        const smallPrimes = [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n, 41n, 43n, 47n, 53n, 59n, 61n, 67n, 71n];
        const cpuPoints: CpuPoint[] = [];
        const gpuPoints: { x: bigint; y: bigint }[] = [];
        const gpuScalars: bigint[] = [];

        for (let i = 0; i < N; i++) {
            const k = BigInt(i + 1);
            const pt = cpuScalarMul(k, PALLAS_G);
            cpuPoints.push(pt);
            gpuPoints.push({ x: pt.x, y: pt.y });
            gpuScalars.push(smallPrimes[i]);
        }

        const cpuResult = cpuMSM(gpuScalars, cpuPoints);
        const gpuResult = await pippengerMSMPallas(device, gpuScalars, gpuPoints, { bucketWidthBits: 4, verbose: false });

        if (!cpuResult.isInfinity) {
            expect(gpuResult.x).to.equal(cpuResult.x, 'N=20 x');
            expect(gpuResult.y).to.equal(cpuResult.y, 'N=20 y');
        } else {
            expect(gpuResult.x).to.equal(0n);
            expect(gpuResult.y).to.equal(0n);
        }
    });

    // -----------------------------------------------------------------------
    // 8. Scalar equals the curve order → result should be identity
    // -----------------------------------------------------------------------
    it('scalar equal to curve order (Fr) produces identity', async () => {
        const device = await getDevice();
        const G: { x: bigint; y: bigint } = { x: PALLAS_G.x, y: PALLAS_G.y };
        // Fr * G = identity; GPU scalars are reduced mod Fr inside the shader
        // (they're passed as raw 256-bit limbs, so we pass Fr directly).
        const result = await pippengerMSMPallas(device, [Fr], [G], { bucketWidthBits: 4, verbose: false });
        expect(result.x).to.equal(0n, 'Fr*G x should be 0 (identity)');
        expect(result.y).to.equal(0n, 'Fr*G y should be 0 (identity)');
    });

    // -----------------------------------------------------------------------
    // 9. Larger batch: N=100 points, bucket width 6 — correctness only
    // -----------------------------------------------------------------------
    it('N=100, bucketWidthBits=6 matches CPU reference', async () => {
        const device = await getDevice();
        const N = 100;

        const cpuPoints: CpuPoint[] = [];
        const gpuPoints: { x: bigint; y: bigint }[] = [];
        const gpuScalars: bigint[] = [];

        // Use simple arithmetic sequences so we can predict CPU result.
        // Points: i*G for i=1..N, Scalars: i for i=1..N
        let acc = PALLAS_G;
        for (let i = 0; i < N; i++) {
            if (i > 0) acc = cpuAdd(acc, PALLAS_G); // (i+1)*G
            cpuPoints.push(acc);
            gpuPoints.push({ x: acc.x, y: acc.y });
            gpuScalars.push(BigInt(i + 1));
        }

        const cpuResult = cpuMSM(gpuScalars, cpuPoints);
        const gpuResult = await pippengerMSMPallas(device, gpuScalars, gpuPoints, { bucketWidthBits: 6, verbose: false });

        if (!cpuResult.isInfinity) {
            expect(gpuResult.x).to.equal(cpuResult.x, 'N=100 x');
            expect(gpuResult.y).to.equal(cpuResult.y, 'N=100 y');
        } else {
            expect(gpuResult.x).to.equal(0n);
            expect(gpuResult.y).to.equal(0n);
        }
    });

    // -----------------------------------------------------------------------
    // 10. Performance smoke-test: N=1000, bucket width 8 — just ensure it completes
    //     and result equals CPU reference (not a timing benchmark).
    // -----------------------------------------------------------------------
    it('N=1000, bucketWidthBits=8 matches CPU reference', async () => {
        const device = await getDevice();
        const N = 1000;

        const cpuPoints: CpuPoint[] = [];
        const gpuPoints: { x: bigint; y: bigint }[] = [];
        const gpuScalars: bigint[] = [];

        let acc = PALLAS_G;
        for (let i = 0; i < N; i++) {
            if (i > 0) acc = cpuAdd(acc, PALLAS_G);
            cpuPoints.push(acc);
            gpuPoints.push({ x: acc.x, y: acc.y });
            gpuScalars.push(BigInt((i % 127) + 1)); // scalars 1..127 cycling
        }

        const t0 = performance.now();
        const cpuResult = cpuMSM(gpuScalars, cpuPoints);
        console.log(`CPU N=1000: ${(performance.now() - t0).toFixed(1)} ms`);

        const t1 = performance.now();
        const gpuResult = await pippengerMSMPallas(device, gpuScalars, gpuPoints, { bucketWidthBits: 8, verbose: true });
        console.log(`GPU N=1000: ${(performance.now() - t1).toFixed(1)} ms`);

        if (!cpuResult.isInfinity) {
            expect(gpuResult.x).to.equal(cpuResult.x, 'N=1000 x');
            expect(gpuResult.y).to.equal(cpuResult.y, 'N=1000 y');
        } else {
            expect(gpuResult.x).to.equal(0n);
            expect(gpuResult.y).to.equal(0n);
        }
    });
});
