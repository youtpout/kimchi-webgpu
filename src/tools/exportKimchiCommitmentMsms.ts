import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import {
    kimchiMsmDatasetFileToJson,
} from '../datasets/kimchiMsmDataset.js';
import type {
    KimchiCurveName,
    KimchiMsmDataset,
    KimchiMsmDatasetFile,
} from '../datasets/kimchiMsmDataset.js';

process.env.O1JS_BACKEND = 'wasm';

const require = createRequire(import.meta.url);
const o1jsEntrypointPath = require.resolve('o1js');
const o1jsPackageRoot = path.resolve(path.dirname(o1jsEntrypointPath), '..', '..');
const wasm = require(
    path.join(
        o1jsPackageRoot,
        'dist/node/bindings/compiled/node_bindings/plonk_wasm.cjs'
    )
) as any;
const { getRustConversion } = (await import(
    pathToFileURL(
        path.join(o1jsPackageRoot, 'dist/node/bindings/crypto/bindings.js')
    ).href
)) as {
    getRustConversion: (rust: any) => any;
};

type FieldName = 'fp' | 'fq';
type OriginalCommitEvaluationsFn = (
    srs: unknown,
    domainSize: number,
    evals: Uint8Array
) => unknown;

interface CaptureOptions {
    outFile?: string;
    minDomainSize?: number;
    maxDatasets?: number;
    sourceLabel?: string;
}

const FIELD_TO_CURVE: Record<FieldName, KimchiCurveName> = {
    fp: 'vesta',
    fq: 'pallas',
};

function mlArrayItems<T>(mlArray: [0, ...T[]]): T[] {
    return mlArray.slice(1) as T[];
}

function polyCommToAffinePoint(polyComm: any): { x: bigint; y: bigint } {
    const elems = mlArrayItems(polyComm[1]);
    if (elems.length !== 1) {
        throw new Error(
            `Expected a PolyComm with exactly one affine point, received ${elems.length}`
        );
    }
    const point = elems[0] as any;
    if (point === 0) {
        throw new Error('Unexpected point at infinity in lagrange basis commitment');
    }
    return {
        x: point[1][1][1],
        y: point[1][2][1],
    };
}

export async function captureKimchiCommitmentMsms<T>(
    run: () => Promise<T> | T,
    options: CaptureOptions = {}
): Promise<{ result: T; datasets: KimchiMsmDataset[] }> {
    const conversion = getRustConversion(wasm as any);
    const datasets: KimchiMsmDataset[] = [];
    const minDomainSize = options.minDomainSize ?? 1;
    const maxDatasets = options.maxDatasets ?? Number.POSITIVE_INFINITY;
    const sourceLabel = options.sourceLabel ?? 'kimchi-proving';
    const basisCache = new Map<string, { x: bigint; y: bigint }[]>();
    const originals = {
        fp: wasm.caml_fp_srs_commit_evaluations as OriginalCommitEvaluationsFn,
        fq: wasm.caml_fq_srs_commit_evaluations as OriginalCommitEvaluationsFn,
    };
    const counters = { fp: 0, fq: 0 };

    function installWrapper(field: FieldName) {
        const original = originals[field];
        const curve = FIELD_TO_CURVE[field];
        const getBasis = field === 'fp'
            ? wasm.caml_fp_srs_get_lagrange_basis
            : wasm.caml_fq_srs_get_lagrange_basis;
        const fieldConversion = field === 'fp' ? conversion.fp : conversion.fq;

        const wrapped: OriginalCommitEvaluationsFn = (srs, domainSize, evals) => {
            if (domainSize >= minDomainSize && datasets.length < maxDatasets) {
                const basisCacheKey = `${field}:${domainSize}`;
                let points = basisCache.get(basisCacheKey);

                if (!points) {
                    const basisRust = getBasis(srs as any, domainSize);
                    const basisPolyComms = mlArrayItems(
                        fieldConversion.polyCommsFromRust(basisRust as any)
                    );
                    points = basisPolyComms.map(polyCommToAffinePoint);
                    basisCache.set(basisCacheKey, points);
                }

                const scalars = mlArrayItems(
                    conversion.fieldsFromRustFlat(evals)
                ).map((fieldElement: any) => fieldElement[1] as bigint);

                if (scalars.length !== points.length) {
                    throw new Error(
                        `Captured commit_evaluations(${field}) with ${scalars.length} scalars and ${points.length} points`
                    );
                }

                const index = counters[field]++;
                datasets.push({
                    version: 1,
                    label: `${sourceLabel}-${field}-commit-evals-${index}`,
                    source: sourceLabel,
                    curve,
                    msmKind: 'srs-commit-evaluations',
                    domainSize,
                    pointCount: points.length,
                    scalars,
                    points,
                    metadata: {
                        field,
                        callIndex: index,
                    },
                });
            }

            return original(srs, domainSize, evals);
        };

        if (field === 'fp') {
            (wasm as any).caml_fp_srs_commit_evaluations = wrapped;
        } else {
            (wasm as any).caml_fq_srs_commit_evaluations = wrapped;
        }
    }

    installWrapper('fp');
    installWrapper('fq');

    try {
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
        (wasm as any).caml_fp_srs_commit_evaluations = originals.fp;
        (wasm as any).caml_fq_srs_commit_evaluations = originals.fq;
    }
}

async function main() {
    const entryArg = process.argv[2];
    const outFile = process.argv[3] ?? 'public/datasets/kimchi-commit-evals.json';

    if (!entryArg) {
        throw new Error(
            'Usage: node dist/src/tools/exportKimchiCommitmentMsms.js <proving-module> [out-file]'
        );
    }

    const entryPath = path.isAbsolute(entryArg)
        ? entryArg
        : path.resolve(process.cwd(), entryArg);
    const imported = await import(pathToFileURL(entryPath).href);
    const run =
        imported.default ??
        imported.run ??
        imported.main ??
        imported.prove;

    if (typeof run !== 'function') {
        throw new Error(
            'The proving module must export one of: default, run, main, or prove'
        );
    }

    const { datasets } = await captureKimchiCommitmentMsms(
        async () => await run(),
        {
            outFile,
            sourceLabel: path.basename(entryPath, path.extname(entryPath)),
        }
    );

    console.log(
        `Captured ${datasets.length} Kimchi commitment MSM datasets into ${path.resolve(outFile)}`
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
