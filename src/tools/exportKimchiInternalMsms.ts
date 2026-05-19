import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import {
    clearGpuMsmRunner,
    getGpuMsmRunner,
    setGpuMsmRunner,
    type GpuMsmRunner,
} from 'o1js';
import { kimchiMsmDatasetFileToJson } from '../datasets/kimchiMsmDataset.js';
import type {
    KimchiCurveName,
    KimchiMsmDataset,
    KimchiMsmDatasetFile,
} from '../datasets/kimchiMsmDataset.js';

process.env.O1JS_BACKEND = 'wasm';

const require = createRequire(import.meta.url);
const o1jsEntrypointPath = require.resolve('o1js');
const o1jsPackageRoot = path.resolve(path.dirname(o1jsEntrypointPath), '..', '..');
const bindingsModule = (await import(
    pathToFileURL(path.join(o1jsPackageRoot, 'dist/node/bindings.js')).href
)) as {
    initializeBindings: () => Promise<void>;
    wasm: any;
};

interface CaptureOptions {
    outFile?: string;
    maxDatasets?: number;
    sourceLabel?: string;
    beforeInitialize?: () => Promise<void> | void;
}

const RUST_MSM_EVENT_PREFIX = '[o1js gpu-proving dataset] ';

type CapturedRustMsmEvent = {
    kind: string;
    curve: KimchiCurveName;
    hiding: 'non_hiding' | 'blinded';
    domainSize: number;
    evalCount: number;
    scalars: string[];
    points: { x: string; y: string }[];
};

function normalizeMsmKind(msmKind: string): KimchiMsmDataset['msmKind'] {
    switch (msmKind) {
        case 'witness-column-commitment':
        case 'lookup-sorted-commitment':
        case 'lookup-aggregation-commitment':
        case 'srs-commit-evaluations':
        case 'proof-commitments-synthetic':
        case 'proof-opening-synthetic':
        case 'proof-all-points-synthetic':
            return msmKind;
        default:
            return 'srs-commit-evaluations';
    }
}

export async function captureKimchiInternalMsms<T>(
    run: () => Promise<T> | T,
    options: CaptureOptions = {}
): Promise<{ result: T; datasets: KimchiMsmDataset[] }> {
    const datasets: KimchiMsmDataset[] = [];
    const maxDatasets = options.maxDatasets ?? Number.POSITIVE_INFINITY;
    const sourceLabel = options.sourceLabel ?? 'kimchi-internal-msm';
    const gpuMsmCounters: Partial<Record<KimchiCurveName, number>> = {};
    const originalGpuMsmRunner = getGpuMsmRunner();
    const originalConsoleError = console.error;

    function nextGpuMsmCallIndex(curve: KimchiCurveName) {
        const current = gpuMsmCounters[curve] ?? 0;
        gpuMsmCounters[curve] = current + 1;
        return current;
    }

    function tryCaptureGpuMsm(
        curve: unknown,
        msmKind: unknown,
        scalars: unknown,
        points: unknown,
        metadata: unknown
    ): boolean {
        if (datasets.length >= maxDatasets) return false;
        if ((curve !== 'pallas' && curve !== 'vesta') || typeof msmKind !== 'string') {
            return false;
        }
        if (!Array.isArray(scalars) || !Array.isArray(points)) {
            return false;
        }
        if (
            !scalars.every((scalar) => typeof scalar === 'bigint') ||
            !points.every(
                (point) =>
                    point !== null &&
                    typeof point === 'object' &&
                    'x' in point &&
                    'y' in point &&
                    typeof (point as { x: unknown }).x === 'bigint' &&
                    typeof (point as { y: unknown }).y === 'bigint'
            )
        ) {
            return false;
        }

        const affinePoints = points as { x: bigint; y: bigint }[];
        const domainSize =
            typeof metadata === 'object' &&
            metadata !== null &&
            'domainSize' in metadata &&
            typeof (metadata as { domainSize?: unknown }).domainSize === 'number'
                ? (metadata as { domainSize: number }).domainSize
                : undefined;
        const callIndex = nextGpuMsmCallIndex(curve);
        const datasetMetadata: Record<string, string | number | boolean> = {
            callIndex,
        };

        if (domainSize !== undefined) {
            datasetMetadata.domainSize = domainSize;
        }

        if (typeof metadata === 'object' && metadata !== null) {
            for (const [key, value] of Object.entries(metadata)) {
                if (
                    typeof value === 'string' ||
                    typeof value === 'number' ||
                    typeof value === 'boolean'
                ) {
                    datasetMetadata[key] = value;
                }
            }
        }

        datasets.push({
            version: 1,
            label: `${sourceLabel}-${curve}-${msmKind}-${callIndex}`,
            source: sourceLabel,
            curve,
            msmKind:
                msmKind === 'witness-column-commitment' ||
                msmKind === 'srs-commit-evaluations' ||
                msmKind === 'proof-commitments-synthetic' ||
                msmKind === 'proof-opening-synthetic' ||
                msmKind === 'proof-all-points-synthetic'
                    ? msmKind
                    : 'srs-commit-evaluations',
            domainSize,
            pointCount: affinePoints.length,
            scalars: scalars as bigint[],
            points: affinePoints,
            metadata: datasetMetadata,
        });

        return true;
    }

    const captureGpuMsmRunner: GpuMsmRunner = async ({
        curve,
        msmKind,
        scalars,
        points,
        metadata,
        cpuFallback,
    }) => {
        const captured = tryCaptureGpuMsm(curve, msmKind, scalars, points, metadata);
        if (captured) {
            return await cpuFallback?.();
        }
        return await originalGpuMsmRunner?.({
            curve,
            msmKind,
            scalars,
            points,
            metadata,
            cpuFallback,
        });
    };

    console.error = (...args: unknown[]) => {
        const [firstArg, ...rest] = args;

        if (typeof firstArg === 'string' && firstArg.startsWith(RUST_MSM_EVENT_PREFIX)) {
            const jsonPayload = firstArg.slice(RUST_MSM_EVENT_PREFIX.length);
            try {
                const event = JSON.parse(jsonPayload) as CapturedRustMsmEvent;
                if (
                    datasets.length < maxDatasets &&
                    Array.isArray(event.scalars) &&
                    Array.isArray(event.points) &&
                    (event.curve === 'pallas' || event.curve === 'vesta')
                ) {
                    const callIndex = nextGpuMsmCallIndex(event.curve);
                    datasets.push({
                        version: 1,
                        label: `${sourceLabel}-${event.curve}-${event.kind}-${callIndex}`,
                        source: sourceLabel,
                        curve: event.curve,
                        msmKind: normalizeMsmKind(event.kind),
                        domainSize: event.domainSize,
                        pointCount: event.points.length,
                        scalars: event.scalars.map((scalar) => BigInt(scalar)),
                        points: event.points.map((point) => ({
                            x: BigInt(point.x),
                            y: BigInt(point.y),
                        })),
                        metadata: {
                            callIndex,
                            hiding: event.hiding,
                            evalCount: event.evalCount,
                            capturedFrom: 'rust-prover',
                        },
                    });
                }
                return;
            } catch {
                // Fall through to the original console if parsing fails.
            }
        }

        originalConsoleError(firstArg, ...rest);
    };

    setGpuMsmRunner(captureGpuMsmRunner);

    try {
        await options.beforeInitialize?.();
        await bindingsModule.initializeBindings();

        const result = await run();

        if (options.outFile) {
            const datasetFile: KimchiMsmDatasetFile = {
                version: 1,
                datasets,
            };
            const outFile = path.resolve(options.outFile);
            fs.mkdirSync(path.dirname(outFile), { recursive: true });
            fs.writeFileSync(
                outFile,
                JSON.stringify(kimchiMsmDatasetFileToJson(datasetFile), null, 2),
                'utf8'
            );
        }

        return { result, datasets };
    } finally {
        console.error = originalConsoleError;
        if (originalGpuMsmRunner === undefined) {
            clearGpuMsmRunner();
        } else {
            setGpuMsmRunner(originalGpuMsmRunner);
        }
    }
}

async function main() {
    const entryArg = process.argv[2];
    const outFile = process.argv[3] ?? 'public/datasets/kimchi-internal-msm.json';

    if (!entryArg) {
        throw new Error(
            'Usage: node dist/src/tools/exportKimchiInternalMsms.js <proving-module> [out-file]'
        );
    }

    const entryPath = path.isAbsolute(entryArg)
        ? entryArg
        : path.resolve(process.cwd(), entryArg);

    let run: (() => Promise<unknown>) | undefined;

    const { datasets } = await captureKimchiInternalMsms(
        async () => {
            if (!run) {
                throw new Error('Proving module was not loaded before execution');
            }
            return await run();
        },
        {
            outFile,
            sourceLabel: path.basename(entryPath, path.extname(entryPath)),
            beforeInitialize: async () => {
                const imported = await import(pathToFileURL(entryPath).href);
                const loadedRun =
                    imported.default ??
                    imported.run ??
                    imported.main ??
                    imported.prove;

                if (typeof loadedRun !== 'function') {
                    throw new Error(
                        'The proving module must export one of: default, run, main, or prove'
                    );
                }
                run = loadedRun as () => Promise<unknown>;
            },
        }
    );

    console.log(
        `Captured ${datasets.length} internal Kimchi MSM datasets into ${path.resolve(outFile)}`
    );
}

const isMainModule =
    process.argv[1] !== undefined &&
    path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
