import { expect } from 'chai';
import { pippengerMSMVesta } from './pippenger_msm.js';

const Fq =
    0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;
const Fr =
    0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;

const VESTA_G: CpuPoint = {
    x: 1n,
    y: 11426906929455361843568202299992114520848200991084027513389447476559454104162n,
    isInfinity: false,
};

interface CpuPoint {
    x: bigint;
    y: bigint;
    isInfinity: boolean;
}

const CPU_INFINITY: CpuPoint = { x: 0n, y: 0n, isInfinity: true };

function fqMod(a: bigint): bigint {
    return ((a % Fq) + Fq) % Fq;
}

function fqAdd(a: bigint, b: bigint): bigint {
    return fqMod(a + b);
}

function fqSub(a: bigint, b: bigint): bigint {
    return fqMod(a - b);
}

function fqMul(a: bigint, b: bigint): bigint {
    return fqMod(a * b);
}

function fqPow(base: bigint, exp: bigint): bigint {
    let result = 1n;
    base = fqMod(base);
    while (exp > 0n) {
        if (exp & 1n) result = fqMul(result, base);
        exp >>= 1n;
        base = fqMul(base, base);
    }
    return result;
}

function fqInv(a: bigint): bigint {
    return fqPow(a, Fq - 2n);
}

function cpuAdd(p: CpuPoint, q: CpuPoint): CpuPoint {
    if (p.isInfinity) return q;
    if (q.isInfinity) return p;
    if (p.x === q.x) {
        if (p.y !== q.y) return CPU_INFINITY;
        return cpuDouble(p);
    }
    const lambda = fqMul(fqSub(q.y, p.y), fqInv(fqSub(q.x, p.x)));
    const x3 = fqSub(fqSub(fqMul(lambda, lambda), p.x), q.x);
    const y3 = fqSub(fqMul(lambda, fqSub(p.x, x3)), p.y);
    return { x: x3, y: y3, isInfinity: false };
}

function cpuDouble(p: CpuPoint): CpuPoint {
    if (p.isInfinity) return p;
    const lambda = fqMul(fqMul(3n, fqMul(p.x, p.x)), fqInv(fqMul(2n, p.y)));
    const x3 = fqSub(fqMul(lambda, lambda), fqMul(2n, p.x));
    const y3 = fqSub(fqMul(lambda, fqSub(p.x, x3)), p.y);
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

async function getDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter found');
    return adapter.requestDevice();
}

describe('pippengerMSMVesta — correctness', () => {
    it('scalar=0 yields identity', async () => {
        const device = await getDevice();
        const g = { x: VESTA_G.x, y: VESTA_G.y };
        const result = await pippengerMSMVesta(device, [0n], [g], {
            bucketWidthBits: 4,
            verbose: false,
        });
        expect(result.x).to.equal(0n);
        expect(result.y).to.equal(0n);
    });

    it('scalar=1 returns the point itself', async () => {
        const device = await getDevice();
        const g = { x: VESTA_G.x, y: VESTA_G.y };
        const result = await pippengerMSMVesta(device, [1n], [g], {
            bucketWidthBits: 4,
            verbose: false,
        });
        expect(result.x).to.equal(VESTA_G.x);
        expect(result.y).to.equal(VESTA_G.y);
    });

    it('scalar=2 matches CPU doubling', async () => {
        const device = await getDevice();
        const g = { x: VESTA_G.x, y: VESTA_G.y };
        const expected = cpuDouble(VESTA_G);
        const result = await pippengerMSMVesta(device, [2n], [g], {
            bucketWidthBits: 4,
            verbose: false,
        });
        expect(result.x).to.equal(expected.x);
        expect(result.y).to.equal(expected.y);
    });

    it('scalar=3 matches CPU multiplication', async () => {
        const device = await getDevice();
        const g = { x: VESTA_G.x, y: VESTA_G.y };
        const expected = cpuScalarMul(3n, VESTA_G);
        const result = await pippengerMSMVesta(device, [3n], [g], {
            bucketWidthBits: 4,
            verbose: false,
        });
        expect(result.x).to.equal(expected.x);
        expect(result.y).to.equal(expected.y);
    });

    it('MSM([1,1,1],[G,G,G]) equals 3*G', async () => {
        const device = await getDevice();
        const g = { x: VESTA_G.x, y: VESTA_G.y };
        const expected = cpuScalarMul(3n, VESTA_G);
        const result = await pippengerMSMVesta(device, [1n, 1n, 1n], [g, g, g], {
            bucketWidthBits: 4,
            verbose: false,
        });
        expect(result.x).to.equal(expected.x);
        expect(result.y).to.equal(expected.y);
    });
});
