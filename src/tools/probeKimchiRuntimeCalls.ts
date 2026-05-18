import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';

process.env.O1JS_BACKEND = 'wasm';

const require = createRequire(import.meta.url);
const o1jsEntrypointPath = require.resolve('o1js');
const o1jsPackageRoot = path.resolve(path.dirname(o1jsEntrypointPath), '..', '..');

type ModuleName = 'kimchi_wasm' | 'plonk_wasm' | 'bindings.wasm';

type CandidateFunctionName =
    | 'caml_pasta_fp_plonk_proof_create'
    | 'caml_pasta_fq_plonk_proof_create'
    | 'caml_fp_srs_commit_evaluations'
    | 'caml_fq_srs_commit_evaluations'
    | 'caml_fp_srs_b_poly_commitment'
    | 'caml_fq_srs_b_poly_commitment'
    | 'caml_fp_srs_batch_accumulator_generate'
    | 'caml_fq_srs_batch_accumulator_generate'
    | 'caml_fp_srs_add_lagrange_basis'
    | 'caml_fq_srs_add_lagrange_basis';

interface ProbeEvent {
    module: ModuleName;
    fn: CandidateFunctionName;
    callIndex: number;
    details: Record<string, number | string | boolean | null>;
}

interface ProbeSummary {
    totalCalls: number;
    byModule: Partial<Record<ModuleName, number>>;
    byFunction: Partial<Record<CandidateFunctionName, number>>;
    uniqueFunctionsCalled: CandidateFunctionName[];
}

interface ProbeReport {
    version: 1;
    sourceLabel: string;
    provingModule: string;
    backend: string;
    summary: ProbeSummary;
    events: ProbeEvent[];
}

interface ProbeOptions {
    outFile?: string;
    sourceLabel?: string;
    maxEvents?: number;
    verbose?: boolean;
}

interface ProbingModule {
    [name: string]: unknown;
}

const CANDIDATE_FUNCTIONS: CandidateFunctionName[] = [
    'caml_pasta_fp_plonk_proof_create',
    'caml_pasta_fq_plonk_proof_create',
    'caml_fp_srs_commit_evaluations',
    'caml_fq_srs_commit_evaluations',
    'caml_fp_srs_b_poly_commitment',
    'caml_fq_srs_b_poly_commitment',
    'caml_fp_srs_batch_accumulator_generate',
    'caml_fq_srs_batch_accumulator_generate',
    'caml_fp_srs_add_lagrange_basis',
    'caml_fq_srs_add_lagrange_basis',
];

function summarizeArg(value: unknown): number | string | boolean | null {
    if (value === null || value === undefined) return null;
    if (typeof value === 'number' || typeof value === 'string' || typeof value === 'boolean') {
        return value;
    }
    if (ArrayBuffer.isView(value)) return value.byteLength;
    if (value instanceof ArrayBuffer) return value.byteLength;
    if (typeof value === 'object' && '__wbg_ptr' in (value as object)) {
        const ptr = (value as { __wbg_ptr?: unknown }).__wbg_ptr;
        return typeof ptr === 'number' ? `ptr:${ptr}` : 'ptr';
    }
    return Object.prototype.toString.call(value);
}

function eventDetails(fn: CandidateFunctionName, args: unknown[]) {
    switch (fn) {
        case 'caml_pasta_fp_plonk_proof_create':
        case 'caml_pasta_fq_plonk_proof_create':
            return {
                index: summarizeArg(args[0]),
                witness: summarizeArg(args[1]),
                wasmRuntimeTablesBytes: summarizeArg(args[2]),
                prevChallengesBytes: summarizeArg(args[3]),
                prevSgsBytes: summarizeArg(args[4]),
            };
        case 'caml_fp_srs_commit_evaluations':
        case 'caml_fq_srs_commit_evaluations':
            return {
                srs: summarizeArg(args[0]),
                domainSize: summarizeArg(args[1]),
                evalBytes: summarizeArg(args[2]),
            };
        case 'caml_fp_srs_b_poly_commitment':
        case 'caml_fq_srs_b_poly_commitment':
            return {
                srs: summarizeArg(args[0]),
                challengeBytes: summarizeArg(args[1]),
            };
        case 'caml_fp_srs_batch_accumulator_generate':
        case 'caml_fq_srs_batch_accumulator_generate':
            return {
                srs: summarizeArg(args[0]),
                commCount: summarizeArg(args[1]),
                challengeBytes: summarizeArg(args[2]),
            };
        case 'caml_fp_srs_add_lagrange_basis':
        case 'caml_fq_srs_add_lagrange_basis':
            return {
                srs: summarizeArg(args[0]),
                log2Size: summarizeArg(args[1]),
            };
    }
}

function installProbeWrappers(
    moduleName: ModuleName,
    target: ProbingModule,
    events: ProbeEvent[],
    maxEvents: number,
    verbose: boolean
) {
    for (const fn of CANDIDATE_FUNCTIONS) {
        const original = target[fn];
        if (typeof original !== 'function') continue;
        const alreadyWrapped = (original as { __kimchiProbeWrapped?: boolean }).__kimchiProbeWrapped;
        if (alreadyWrapped) continue;

        let callCount = 0;
        const wrapped = (...args: unknown[]) => {
            const event: ProbeEvent = {
                module: moduleName,
                fn,
                callIndex: callCount++,
                details: eventDetails(fn, args),
            };
            if (events.length < maxEvents) {
                events.push(event);
            }
            if (verbose) {
                console.log(`[kimchi-probe] ${moduleName}.${fn}`, event.details);
            }
            return (original as (...args: unknown[]) => unknown)(...args);
        };

        (wrapped as { __kimchiProbeWrapped?: boolean }).__kimchiProbeWrapped = true;
        target[fn] = wrapped;
    }
}

async function loadProvingEntrypoint(entryFile: string): Promise<() => Promise<unknown>> {
    const provingModule = await import(pathToFileURL(path.resolve(entryFile)).href);
    const run =
        provingModule.run ??
        provingModule.default ??
        provingModule.main ??
        provingModule.prove;

    if (typeof run !== 'function') {
        throw new Error(
            'Expected proving module to export one of: run, default, main, prove'
        );
    }
    return run as () => Promise<unknown>;
}

export async function probeKimchiRuntimeCalls(
    entryFile: string,
    options: ProbeOptions = {}
): Promise<ProbeReport> {
    const sourceLabel = options.sourceLabel ?? path.basename(entryFile, path.extname(entryFile));
    const maxEvents = options.maxEvents ?? 500;
    const verbose = options.verbose ?? false;
    const events: ProbeEvent[] = [];

    const kimchiWasmModulePath = path.join(
        o1jsPackageRoot,
        'dist/node/bindings/compiled/node_bindings/kimchi_wasm.cjs'
    );
    const plonkWasmModulePath = path.join(
        o1jsPackageRoot,
        'dist/node/bindings/compiled/node_bindings/plonk_wasm.cjs'
    );
    const kimchiWasmModule = require(kimchiWasmModulePath) as ProbingModule;
    const plonkWasmModule = require(plonkWasmModulePath) as ProbingModule;
    installProbeWrappers('kimchi_wasm', kimchiWasmModule, events, maxEvents, verbose);
    installProbeWrappers('plonk_wasm', plonkWasmModule, events, maxEvents, verbose);

    const run = await loadProvingEntrypoint(entryFile);
    const bindingsModule = (await import(
        pathToFileURL(path.join(o1jsPackageRoot, 'dist/node/bindings.js')).href
    )) as {
        initializeBindings: () => Promise<void>;
        wasm?: ProbingModule;
    };

    await bindingsModule.initializeBindings();
    if (bindingsModule.wasm) {
        installProbeWrappers('bindings.wasm', bindingsModule.wasm, events, maxEvents, verbose);
    }

    await run();

    const byModule: ProbeSummary['byModule'] = {};
    const byFunction: ProbeSummary['byFunction'] = {};
    for (const event of events) {
        byModule[event.module] = (byModule[event.module] ?? 0) + 1;
        byFunction[event.fn] = (byFunction[event.fn] ?? 0) + 1;
    }

    const report: ProbeReport = {
        version: 1,
        sourceLabel,
        provingModule: path.resolve(entryFile),
        backend: process.env.O1JS_BACKEND ?? 'unknown',
        summary: {
            totalCalls: events.length,
            byModule,
            byFunction,
            uniqueFunctionsCalled: Object.keys(byFunction) as CandidateFunctionName[],
        },
        events,
    };

    if (options.outFile) {
        const outFile = path.resolve(options.outFile);
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(outFile, JSON.stringify(report, null, 2), 'utf8');
    }

    return report;
}

async function main() {
    const entryArg = process.argv[2];
    const outFile = process.argv[3] ?? 'public/datasets/kimchi-runtime-probe.json';
    const verbose = process.argv.includes('--verbose');

    if (!entryArg) {
        throw new Error(
            'Usage: node dist/src/tools/probeKimchiRuntimeCalls.js <proving-module> [out-file] [--verbose]'
        );
    }

    const report = await probeKimchiRuntimeCalls(entryArg, {
        outFile,
        sourceLabel: path.basename(entryArg, path.extname(entryArg)),
        verbose,
    });

    console.log(`Probed ${report.summary.totalCalls} low-level Kimchi calls`);
    console.log(`Output: ${path.resolve(outFile)}`);
    console.log(`Functions observed: ${report.summary.uniqueFunctionsCalled.join(', ') || '(none)'}`);
}

const invokedPath = process.argv[1]
    ? path.resolve(process.argv[1])
    : fileURLToPath(import.meta.url);
if (fileURLToPath(import.meta.url) === invokedPath) {
    main().catch((error) => {
        console.error(error);
        process.exitCode = 1;
    });
}
