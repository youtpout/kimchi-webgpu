import type { GpuMsmContext, GpuMsmRunner } from 'o1js';
import type { Point } from '../types/point.js';

type PendingRequest = {
    context: GpuMsmContext;
    resolve: (value: unknown) => void;
    reject: (error: unknown) => void;
};

let sharedDevicePromise: Promise<GPUDevice | null> | undefined;
let pallasModulePromise: Promise<typeof import('../gpu/256bit/pallas/pippenger_msm.js')> | undefined;
let vestaModulePromise: Promise<typeof import('../gpu/256bit/vesta/pippenger_msm.js')> | undefined;

async function getSharedDevice() {
    if (typeof navigator === 'undefined' || navigator.gpu === undefined) {
        return null;
    }
    sharedDevicePromise ??= (async () => {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) return null;
        return await adapter.requestDevice();
    })();
    return await sharedDevicePromise;
}

async function loadPallasModule() {
    pallasModulePromise ??= import('../gpu/256bit/pallas/pippenger_msm.js');
    return await pallasModulePromise;
}

async function loadVestaModule() {
    vestaModulePromise ??= import('../gpu/256bit/vesta/pippenger_msm.js');
    return await vestaModulePromise;
}

function isAffinePoint(point: { x?: unknown; y?: unknown } | null): point is Point {
    return (
        point !== null &&
        typeof point === 'object' &&
        typeof point.x === 'bigint' &&
        typeof point.y === 'bigint'
    );
}

function canBatchRequest(context: GpuMsmContext) {
    return (
        (context.curve === 'pallas' || context.curve === 'vesta') &&
        Array.isArray(context.scalars) &&
        Array.isArray(context.points) &&
        context.scalars.length > 0 &&
        context.points.length === context.scalars.length &&
        context.points.every((point) => isAffinePoint(point))
    );
}

export function createWebGpuBatchedMsmRunner(options?: {
    bucketWidthBits?: number;
    verbose?: boolean;
}): GpuMsmRunner {
    const bucketWidthBits = options?.bucketWidthBits ?? 8;
    const verbose = options?.verbose ?? false;

    let queue: PendingRequest[] = [];
    let flushScheduled = false;

    async function fallbackRequest(request: PendingRequest) {
        const fallback = request.context.cpuFallback;
        if (!fallback) {
            request.resolve(undefined);
            return;
        }
        try {
            request.resolve(await fallback());
        } catch (error) {
            request.reject(error);
        }
    }

    async function flush() {
        flushScheduled = false;
        const batch = queue;
        queue = [];

        const device = await getSharedDevice();
        if (!device) {
            await Promise.all(batch.map((request) => fallbackRequest(request)));
            return;
        }

        const pallasRequests = batch.filter(
            (request) => request.context.curve === 'pallas' && canBatchRequest(request.context)
        );
        const vestaRequests = batch.filter(
            (request) => request.context.curve === 'vesta' && canBatchRequest(request.context)
        );
        const fallbackRequests = batch.filter(
            (request) =>
                !(
                    (request.context.curve === 'pallas' || request.context.curve === 'vesta') &&
                    canBatchRequest(request.context)
                )
        );

        await Promise.all(fallbackRequests.map((request) => fallbackRequest(request)));

        const runGroup = async (
            curve: 'pallas' | 'vesta',
            requests: PendingRequest[]
        ) => {
            if (requests.length === 0) return;

            const jobs = requests.map((request) => ({
                label:
                    request.context.metadata?.label?.toString() ??
                    request.context.msmKind,
                scalars: request.context.scalars as bigint[],
                points: request.context.points as Point[],
            }));

            if (verbose) {
                console.log(
                    `[gpu-batch] curve=${curve} jobs=${jobs.length} sizes=${jobs
                        .map((job) => job.scalars.length)
                        .join(',')}`
                );
            }

            try {
                const results = curve === 'pallas'
                    ? await (await loadPallasModule())
                          .createPippengerMSMPallasRunner(device, {
                              bucketWidthBits,
                          })
                          .runMany(jobs, { verbose: false })
                    : await (await loadVestaModule())
                          .createPippengerMSMVestaRunner(device, {
                              bucketWidthBits,
                          })
                          .runMany(jobs, { verbose: false });

                for (let i = 0; i < requests.length; i++) {
                    requests[i].resolve(results[i]);
                }
            } catch (error) {
                await Promise.all(requests.map((request) => fallbackRequest(request)));
            }
        };

        await runGroup('pallas', pallasRequests);
        await runGroup('vesta', vestaRequests);
    }

    return (context: GpuMsmContext) =>
        new Promise((resolve, reject) => {
            queue.push({ context, resolve, reject });
            if (!flushScheduled) {
                flushScheduled = true;
                queueMicrotask(() => {
                    void flush();
                });
            }
        });
}
