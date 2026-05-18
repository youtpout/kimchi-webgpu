import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath, pathToFileURL } from 'url';
import { enrichKimchiProofArtifact } from '../datasets/kimchiProofArtifactReplay.js';
import { kimchiProofArtifactFileToJson } from '../datasets/kimchiProofArtifacts.js';
import type {
    KimchiProofArtifact,
    KimchiProofArtifactFile,
    KimchiOpeningPair,
    KimchiPolyComm,
    KimchiRecursionChallenge,
} from '../datasets/kimchiProofArtifacts.js';

process.env.O1JS_BACKEND = 'wasm';

const require = createRequire(import.meta.url);
const o1jsEntrypointPath = require.resolve('o1js');
const o1jsPackageRoot = path.resolve(path.dirname(o1jsEntrypointPath), '..', '..');
const bindingsModule = (await import(
    pathToFileURL(path.join(o1jsPackageRoot, 'dist/node/bindings.js')).href
)) as {
    initializeBindings: () => Promise<void>;
    Snarky: {
        circuit: {
            proofToBackendProofEvals: (
                publicInput: unknown,
                proof: unknown
            ) => unknown;
        };
    };
};
const { MlFieldConstArray } = (await import(
    pathToFileURL(path.join(o1jsPackageRoot, 'dist/node/lib/ml/fields.js')).href
)) as {
    MlFieldConstArray: {
        to: (fields: unknown[]) => unknown;
    };
};

interface CaptureOptions {
    outFile?: string;
    sourceLabel?: string;
}

interface ProofLike {
    proof: unknown;
    maxProofsVerified: number;
    publicFields: () => {
        input: { toString(): string }[];
        output: { toString(): string }[];
    };
    toJSON?: () => {
        proof: string;
        publicInput: string[];
        publicOutput: string[];
        maxProofsVerified: number;
    };
}

function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null;
}

function isProofLike(value: unknown): value is ProofLike {
    return (
        isObject(value) &&
        'proof' in value &&
        'maxProofsVerified' in value &&
        'publicFields' in value &&
        typeof value.publicFields === 'function'
    );
}

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

function polyCommToJson(polyComm: any) {
    return {
        unshifted: mlArrayItems(polyComm[1]).map(orInfinityToPoint),
    };
}

function extractProofArtifacts(
    proofLike: ProofLike,
    label: string,
    source: string
): KimchiProofArtifact {
    const publicFields = proofLike.publicFields();
    const emptyPolyComm: KimchiPolyComm = { unshifted: [] };
    const emptyOpeningPairs: KimchiOpeningPair[] = [];
    const emptyPrevChallenges: KimchiRecursionChallenge[] = [];
    const baseArtifact: KimchiProofArtifact = {
        version: 1 as const,
        label,
        source,
        curve: 'vesta' as const,
        maxProofsVerified: proofLike.maxProofsVerified,
        publicInput: publicFields.input.map((field) => BigInt(field.toString())),
        publicOutput: publicFields.output.map((field) => BigInt(field.toString())),
        commitments: {
            wComm: [],
            zComm: emptyPolyComm,
            tComm: emptyPolyComm,
        },
        openingProof: {
            lr: emptyOpeningPairs,
            delta: null,
            z1: 0n,
            z2: 0n,
            sg: null,
        },
        prevChallenges: emptyPrevChallenges,
        serializedProof: proofLike.toJSON?.(),
    };

    let proofWithEvals: any;
    try {
        proofWithEvals = bindingsModule.Snarky.circuit.proofToBackendProofEvals(
            MlFieldConstArray.to(publicFields.input),
            proofLike.proof
        ) as any;
    } catch (error) {
        return enrichKimchiProofArtifact({
            ...baseArtifact,
            metadata: {
                extractionMode: 'serialized-proof-only',
                backendProofDecodeError:
                    error instanceof Error ? error.message : String(error),
            },
        });
    }

    const proverProof = proofWithEvals[2];
    const commitments = proverProof[1];
    const openingProof = proverProof[2];
    const prevChallenges = mlArrayItems(proverProof[6]);

    return {
        ...baseArtifact,
        commitments: {
            wComm: mlArrayItems(commitments[1]).map((polyComm) => polyCommToJson(polyComm)),
            zComm: polyCommToJson(commitments[2]),
            tComm: polyCommToJson(commitments[3]),
        },
        openingProof: {
            lr: mlArrayItems(openingProof[1]).map((pair) => {
                const openingPair = pair as any;
                return {
                    left: orInfinityToPoint(openingPair[1]),
                    right: orInfinityToPoint(openingPair[2]),
                };
            }),
            delta: orInfinityToPoint(openingProof[2]),
            z1: openingProof[3],
            z2: openingProof[4],
            sg: orInfinityToPoint(openingProof[5]),
        },
        prevChallenges: prevChallenges.map((challenge) => {
            const recursionChallenge = challenge as any;
            return {
                scalars: mlArrayItems(recursionChallenge[1]),
                commitment: polyCommToJson(recursionChallenge[2]),
            };
        }),
        metadata: {
            extractionMode: 'backend-proof-evals',
        },
    };
}

async function findProofs(
    value: unknown,
    visited = new Set<unknown>(),
    depth = 0
): Promise<ProofLike[]> {
    if (depth > 4 || !isObject(value) || visited.has(value)) {
        return [];
    }
    visited.add(value);

    if (isProofLike(value)) {
        return [value];
    }

    const proofs: ProofLike[] = [];

    if ('proofs' in value) {
        const proofCollection =
            typeof value.proofs === 'function'
                ? await value.proofs()
                : value.proofs;

        if (Array.isArray(proofCollection)) {
            for (const proof of proofCollection) {
                if (isProofLike(proof)) {
                    proofs.push(proof);
                }
            }
        }
    }

    for (const nested of Object.values(value)) {
        if (proofs.length > 0) break;
        proofs.push(...(await findProofs(nested, visited, depth + 1)));
    }

    return proofs;
}

export async function captureKimchiCommitmentMsms<T>(
    run: () => Promise<T> | T,
    options: CaptureOptions = {}
): Promise<{ result: T; artifacts: KimchiProofArtifact[] }> {
    await bindingsModule.initializeBindings();

    const result = await run();
    const sourceLabel = options.sourceLabel ?? 'kimchi-proof';
    const proofs = await findProofs(result);

    if (proofs.length === 0) {
        throw new Error(
            'No o1js proofs were found in the proving module result. Return the proved transaction or an object that contains its proofs.'
        );
    }

    const artifacts = proofs.map((proof, index) =>
        extractProofArtifacts(proof, `${sourceLabel}-proof-${index}`, sourceLabel)
    );

    if (options.outFile) {
        const artifactFile: KimchiProofArtifactFile = {
            version: 1,
            artifacts,
        };
        const outFile = path.resolve(options.outFile);
        fs.mkdirSync(path.dirname(outFile), { recursive: true });
        fs.writeFileSync(
            outFile,
            JSON.stringify(kimchiProofArtifactFileToJson(artifactFile), null, 2),
            'utf8'
        );
    }

    return { result, artifacts };
}

async function main() {
    const entryArg = process.argv[2];
    const outFile = process.argv[3] ?? 'public/datasets/kimchi-proof-artifacts.json';

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

    const { artifacts } = await captureKimchiCommitmentMsms(
        async () => await run(),
        {
            outFile,
            sourceLabel: path.basename(entryPath, path.extname(entryPath)),
        }
    );

    console.log(
        `Captured ${artifacts.length} Kimchi proof artifacts into ${path.resolve(outFile)}`
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
