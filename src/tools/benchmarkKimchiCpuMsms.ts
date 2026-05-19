import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { pathToFileURL } from 'url';
import {
    kimchiMsmDatasetFileFromJson,
    type KimchiCurveName,
    type KimchiMsmDataset,
} from '../datasets/kimchiMsmDataset.js';

type Backend = 'wasm' | 'native';

interface Args {
    datasetFile: string;
    backend: Backend;
    rounds: number;
    cpuMaxN: number;
    limit?: number;
}

interface CpuBenchmarkResult {
    dataset: KimchiMsmDataset;
    coldMs: number;
    warmTimingsMs: number[];
    medianWarmMs: number;
    result: { x: bigint; y: bigint };
}

function parseArgs(argv: string[]): Args {
    const datasetFile = argv[2];
    if (!datasetFile) {
        throw new Error(
            'Usage: node dist/src/tools/benchmarkKimchiCpuMsms.js <dataset-file> [--backend=wasm|native] [--rounds=N] [--cpuMaxN=N] [--limit=N]'
        );
    }

    let backend: Backend = 'wasm';
    let rounds = 3;
    let cpuMaxN = Number.POSITIVE_INFINITY;
    let limit: number | undefined;

    for (const arg of argv.slice(3)) {
        if (arg.startsWith('--backend=')) {
            const value = arg.slice('--backend='.length);
            if (value !== 'wasm' && value !== 'native') {
                throw new Error(`Unsupported backend: ${value}`);
            }
            backend = value;
        } else if (arg.startsWith('--rounds=')) {
            rounds = Number.parseInt(arg.slice('--rounds='.length), 10);
        } else if (arg.startsWith('--cpuMaxN=')) {
            cpuMaxN = Number.parseInt(arg.slice('--cpuMaxN='.length), 10);
        } else if (arg.startsWith('--limit=')) {
            limit = Number.parseInt(arg.slice('--limit='.length), 10);
        }
    }

    return { datasetFile, backend, rounds, cpuMaxN, limit };
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function summarizePoint(point: { x: bigint; y: bigint }) {
    return `x=${point.x.toString().slice(0, 24)}... y=${point.y
        .toString()
        .slice(0, 24)}...`;
}

function mlFields(fields: bigint[]) {
    return [0, ...fields.map((field) => [0, field])] as [0, ...[0, bigint][]];
}

function polyCommToPoint(polyComm: any): { x: bigint; y: bigint } {
    const unshifted = polyComm[1];
    const firstPoint = unshifted[1];
    if (firstPoint === 0) {
        return { x: 0n, y: 0n };
    }
    return {
        x: firstPoint[1][1][1],
        y: firstPoint[1][2][1],
    };
}

function createDatasetRunner(
    dataset: KimchiMsmDataset,
    deps: {
        bindingsModule: any;
        conversion: any;
        kimchiWasm: any;
    }
): () => { x: bigint; y: bigint } {
    const { bindingsModule, conversion, kimchiWasm } = deps;
    const field = dataset.curve === 'pallas' ? 'fq' : 'fp';
    const domainSize = dataset.domainSize ?? dataset.pointCount;
    if ((domainSize & (domainSize - 1)) !== 0) {
        throw new Error(
            `Expected a power-of-two domain size, received ${domainSize} for ${dataset.label}`
        );
    }
    const log2Size = Math.round(Math.log2(domainSize));
    const srs =
        field === 'fq'
            ? bindingsModule.Pickles.loadSrsFq()
            : bindingsModule.Pickles.loadSrsFp();
    if (field === 'fq') {
        kimchiWasm.caml_fq_srs_add_lagrange_basis(srs, log2Size);
    } else {
        kimchiWasm.caml_fp_srs_add_lagrange_basis(srs, log2Size);
    }
    const rustScalars =
        field === 'fq'
            ? conversion.fq.vectorToRust(mlFields(dataset.scalars))
            : conversion.fp.vectorToRust(mlFields(dataset.scalars));

    return () => {
        const rustPolyComm =
            field === 'fq'
                ? kimchiWasm.caml_fq_srs_commit_evaluations(
                      srs,
                      domainSize,
                      rustScalars
                  )
                : kimchiWasm.caml_fp_srs_commit_evaluations(
                      srs,
                      domainSize,
                      rustScalars
                  );

        const polyComm =
            field === 'fq'
                ? conversion.fq.polyCommFromRust(rustPolyComm)
                : conversion.fp.polyCommFromRust(rustPolyComm);

        return polyCommToPoint(polyComm);
    };
}

async function benchmarkDataset(
    dataset: KimchiMsmDataset,
    deps: {
        bindingsModule: any;
        conversion: any;
        kimchiWasm: any;
    },
    rounds: number
): Promise<CpuBenchmarkResult> {
    const run = createDatasetRunner(dataset, deps);

    const coldStart = performance.now();
    let result = run();
    const coldMs = performance.now() - coldStart;

    const warmTimingsMs: number[] = [];
    for (let i = 0; i < rounds; i++) {
        const start = performance.now();
        result = run();
        warmTimingsMs.push(performance.now() - start);
    }

    return {
        dataset,
        coldMs,
        warmTimingsMs,
        medianWarmMs: median(warmTimingsMs),
        result,
    };
}

async function main() {
    const args = parseArgs(process.argv);
    process.env.O1JS_BACKEND = args.backend;

    const datasetPath = path.resolve(args.datasetFile);
    const datasetFile = kimchiMsmDatasetFileFromJson(
        JSON.parse(fs.readFileSync(datasetPath, 'utf8'))
    );

    const require = createRequire(import.meta.url);
    const o1jsEntrypointPath = require.resolve('o1js');
    const o1jsPackageRoot = path.resolve(path.dirname(o1jsEntrypointPath), '..', '..');
    const kimchiWasmPath = path.join(
        o1jsPackageRoot,
        'dist/node/bindings/compiled/node_bindings/kimchi_wasm.cjs'
    );
    const kimchiWasm = require(kimchiWasmPath) as any;
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

    await bindingsModule.initializeBindings();
    const rust = bindingsModule.wasm ?? kimchiWasm;
    const conversion = getRustConversion(rust);

    const selectedDatasets = datasetFile.datasets
        .filter((dataset) => dataset.pointCount <= args.cpuMaxN)
        .slice(0, args.limit);

    if (selectedDatasets.length === 0) {
        throw new Error('No datasets selected. Increase --cpuMaxN or remove --limit.');
    }

    console.log(
        `Benchmarking ${selectedDatasets.length} dataset(s) with backend=${args.backend}, rounds=${args.rounds}`
    );
    console.log(`Dataset file: ${datasetPath}`);

    const results: CpuBenchmarkResult[] = [];

    for (const dataset of selectedDatasets) {
        console.log('');
        console.log(`=== CPU dataset: ${dataset.label} ===`);
        console.log(`Curve: ${dataset.curve}`);
        console.log(`MSM kind: ${dataset.msmKind}`);
        console.log(`Point count: ${dataset.pointCount}`);

        const result = await benchmarkDataset(dataset, {
            bindingsModule,
            conversion,
            kimchiWasm,
        }, args.rounds);

        console.log(`CPU cold run: ${result.coldMs.toFixed(2)} ms`);
        console.log(
            `CPU warm runs: ${result.warmTimingsMs
                .map((ms) => ms.toFixed(2))
                .join(', ')} ms`
        );
        console.log(`CPU median warm run: ${result.medianWarmMs.toFixed(2)} ms`);
        console.log(`CPU result: ${summarizePoint(result.result)}`);
        results.push(result);
    }

    const groups = new Map<string, CpuBenchmarkResult[]>();
    for (const result of results) {
        const key = `${result.dataset.curve}:${result.dataset.pointCount}:${result.dataset.msmKind}`;
        const group = groups.get(key);
        if (group) group.push(result);
        else groups.set(key, [result]);
    }

    console.log('');
    console.log('=== CPU summary ===');
    for (const [key, group] of groups) {
        const medianOfMedians = median(group.map((entry) => entry.medianWarmMs));
        const avgCold =
            group.reduce((sum, entry) => sum + entry.coldMs, 0) / group.length;
        console.log(
            `${key} datasets=${group.length} avg_cold_ms=${avgCold.toFixed(
                2
            )} median_warm_ms=${medianOfMedians.toFixed(2)}`
        );
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
