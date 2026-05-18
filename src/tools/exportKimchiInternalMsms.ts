import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
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
const kimchiWasmModulePath = path.join(
    o1jsPackageRoot,
    'dist/node/bindings/compiled/node_bindings/kimchi_wasm.cjs'
);
const kimchiWasmModule = require(kimchiWasmModulePath) as any;
const bindingsModule = (await import(
    pathToFileURL(path.join(o1jsPackageRoot, 'dist/node/bindings.js')).href
)) as {
    initializeBindings: () => Promise<void>;
    wasm: any;
    Pickles: {
        loadSrsFp: () => unknown;
        loadSrsFq: () => unknown;
    };
};
const { getRustConversion } = (await import(
    pathToFileURL(
        path.join(o1jsPackageRoot, 'dist/node/bindings/crypto/bindings.js')
    ).href
)) as {
    getRustConversion: (rust: any) => any;
};

type FieldName = 'fp' | 'fq';

interface CaptureOptions {
    outFile?: string;
    maxColumns?: number;
    maxDatasets?: number;
    sourceLabel?: string;
    beforeInitialize?: () => Promise<void> | void;
}

class KimchiInternalMsmUnsupportedError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'KimchiInternalMsmUnsupportedError';
    }
}

interface ProofCreateFns {
    fp: (
        index: unknown,
        witness: { get: (i: number) => Uint8Array },
        wasmRuntimeTables: Uint32Array,
        prevChallenges: Uint8Array,
        prevSgs: Uint32Array
    ) => unknown;
    fq: (
        index: unknown,
        witness: { get: (i: number) => Uint8Array },
        wasmRuntimeTables: Uint32Array,
        prevChallenges: Uint8Array,
        prevSgs: Uint32Array
    ) => unknown;
}

const FIELD_TO_CURVE: Record<FieldName, KimchiCurveName> = {
    fp: 'vesta',
    fq: 'pallas',
};

function mlArrayItems<T>(mlArray: [0, ...T[]]): T[] {
    return mlArray.slice(1) as T[];
}

function orInfinityToPoint(point: any): { x: bigint; y: bigint } | null {
    if (point === 0) return null;

    return {
        x: point[1][1][1],
        y: point[1][2][1],
    };
}

function polyCommToAffinePoint(polyComm: any): { x: bigint; y: bigint } {
    const elems = mlArrayItems(polyComm[1]);
    if (elems.length !== 1) {
        throw new Error(
            `Expected a PolyComm with exactly one affine point, received ${elems.length}`
        );
    }

    const point = orInfinityToPoint(elems[0]);
    if (point === null) {
        throw new Error('Unexpected point at infinity in lagrange basis commitment');
    }
    return point;
}

function readWitnessColumns(
    witness: { get: (i: number) => Uint8Array },
    maxColumns: number
): Uint8Array[] {
    const columns: Uint8Array[] = [];
    for (let i = 0; i < maxColumns; i++) {
        try {
            // Copy into plain JS-owned memory before Rust takes ownership.
            columns.push(Uint8Array.from(witness.get(i)));
        } catch {
            break;
        }
    }
    return columns;
}

export async function captureKimchiInternalMsms<T>(
    run: () => Promise<T> | T,
    options: CaptureOptions = {}
): Promise<{ result: T; datasets: KimchiMsmDataset[] }> {
    const datasets: KimchiMsmDataset[] = [];
    const maxColumns = options.maxColumns ?? 64;
    const maxDatasets = options.maxDatasets ?? Number.POSITIVE_INFINITY;
    const sourceLabel = options.sourceLabel ?? 'kimchi-internal-msm';
    const basisCache = new Map<string, { x: bigint; y: bigint }[]>();
    const srsCache: Partial<Record<FieldName, unknown>> = {};
    const counters: Record<FieldName, number> = { fp: 0, fq: 0 };
    let wasm: any = kimchiWasmModule;
    let conversion: any;

    const originals: ProofCreateFns = {
        fp: kimchiWasmModule.caml_pasta_fp_plonk_proof_create,
        fq: kimchiWasmModule.caml_pasta_fq_plonk_proof_create,
    };

    function getSrs(field: FieldName): unknown {
        const cached = srsCache[field];
        if (cached !== undefined) return cached;

        const srs =
            field === 'fp'
                ? bindingsModule.Pickles.loadSrsFp()
                : bindingsModule.Pickles.loadSrsFq();
        srsCache[field] = srs;
        return srs;
    }

    function getBasisPoints(field: FieldName, domainSize: number) {
        const cacheKey = `${field}:${domainSize}`;
        const cached = basisCache.get(cacheKey);
        if (cached) return cached;

        const rustBasis =
            field === 'fp'
                ? wasm.caml_fp_srs_get_lagrange_basis(getSrs(field), domainSize)
                : wasm.caml_fq_srs_get_lagrange_basis(getSrs(field), domainSize);
        const fieldConversion = field === 'fp' ? conversion.fp : conversion.fq;
        const basisPolyComms = mlArrayItems(
            fieldConversion.polyCommsFromRust(rustBasis as any)
        );
        const points = basisPolyComms.map(polyCommToAffinePoint);
        basisCache.set(cacheKey, points);
        return points;
    }

    function installProofCreateWrapper(field: FieldName) {
        const original = originals[field];

        const wrapped = (
            index: unknown,
            witness: { get: (i: number) => Uint8Array },
            wasmRuntimeTables: Uint32Array,
            prevChallenges: Uint8Array,
            prevSgs: Uint32Array
        ) => {
            let witnessColumns: Uint8Array[];
            try {
                witnessColumns = readWitnessColumns(witness, maxColumns);
            } catch (error) {
                throw new KimchiInternalMsmUnsupportedError(
                    `Reading witness columns before proof_create(${field}) is not supported by the current kimchi_wasm ownership model. Extracting true internal prover MSMs will require a lower-level Kimchi/Rust patch. Original error: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
            }

            let proof: unknown;
            try {
                proof = original(
                    index,
                    witness,
                    wasmRuntimeTables,
                    prevChallenges,
                    prevSgs
                );
            } catch (error) {
                if (
                    error instanceof Error &&
                    error.message.includes('attempted to take ownership of Rust value while it was borrowed')
                ) {
                    throw new KimchiInternalMsmUnsupportedError(
                        `The current kimchi_wasm JS bindings do call proof_create(${field}), but pre-reading witness columns causes a Rust ownership conflict. This means JS-level extraction of internal prover MSM scalars is not reliable here; a lower-level Kimchi/Rust patch is required.`
                    );
                }
                throw error;
            }

            if (datasets.length >= maxDatasets) {
                return proof;
            }

            wasm = bindingsModule.wasm ?? wasm;
            conversion ??= getRustConversion(wasm as any);
            const getDomainSize =
                field === 'fp'
                    ? wasm.caml_pasta_fp_plonk_index_domain_d1_size
                    : wasm.caml_pasta_fq_plonk_index_domain_d1_size;
            const domainSize = getDomainSize(index as any);
            const points = getBasisPoints(field, domainSize);

            for (let columnIndex = 0; columnIndex < witnessColumns.length; columnIndex++) {
                if (datasets.length >= maxDatasets) break;

                const scalars = mlArrayItems(
                    conversion.fieldsFromRustFlat(witnessColumns[columnIndex])
                ).map((fieldElement: any) => fieldElement[1] as bigint);

                if (scalars.length > points.length) {
                    throw new Error(
                        `Captured proof_create(${field}) witness column ${columnIndex} with ${scalars.length} scalars and ${points.length} points`
                    );
                }

                const paddedScalars =
                    scalars.length === points.length
                        ? scalars
                        : [
                              ...scalars,
                              ...new Array<bigint>(points.length - scalars.length).fill(0n),
                          ];

                const callIndex = counters[field]++;
                datasets.push({
                    version: 1,
                    label: `${sourceLabel}-${field}-witness-col-${columnIndex}-${callIndex}`,
                    source: sourceLabel,
                    curve: FIELD_TO_CURVE[field],
                    msmKind: 'witness-column-commitment',
                    domainSize,
                    pointCount: points.length,
                    scalars: paddedScalars,
                    points,
                    metadata: {
                        field,
                        callIndex,
                        witnessColumn: columnIndex,
                        originalScalarCount: scalars.length,
                    },
                });
            }

            return proof;
        };

        if (field === 'fp') {
            kimchiWasmModule.caml_pasta_fp_plonk_proof_create = wrapped;
        } else {
            kimchiWasmModule.caml_pasta_fq_plonk_proof_create = wrapped;
        }
    }

    installProofCreateWrapper('fp');
    installProofCreateWrapper('fq');

    try {
        await options.beforeInitialize?.();
        await bindingsModule.initializeBindings();
        wasm = bindingsModule.wasm;
        if (kimchiWasmModule !== wasm) {
            wasm.caml_pasta_fp_plonk_proof_create =
                kimchiWasmModule.caml_pasta_fp_plonk_proof_create;
            wasm.caml_pasta_fq_plonk_proof_create =
                kimchiWasmModule.caml_pasta_fq_plonk_proof_create;
        }

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
        kimchiWasmModule.caml_pasta_fp_plonk_proof_create = originals.fp;
        kimchiWasmModule.caml_pasta_fq_plonk_proof_create = originals.fq;
        if (bindingsModule.wasm && bindingsModule.wasm !== kimchiWasmModule) {
            bindingsModule.wasm.caml_pasta_fp_plonk_proof_create = originals.fp;
            bindingsModule.wasm.caml_pasta_fq_plonk_proof_create = originals.fq;
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
