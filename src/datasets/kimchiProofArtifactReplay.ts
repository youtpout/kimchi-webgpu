import type {
    KimchiProofArtifact,
    KimchiProofArtifactFile,
    KimchiPolyComm,
    KimchiOpeningPair,
    KimchiRecursionChallenge,
} from './kimchiProofArtifacts.js';
import type { KimchiMsmDataset, KimchiMsmDatasetFile } from './kimchiMsmDataset.js';

type Sexp = string | Sexp[];

const PALLAS_BASE_FIELD =
    0x40000000000000000000000000000000224698fc094cf91b992d30ed00000001n;
const PALLAS_SCALAR_FIELD =
    0x40000000000000000000000000000000224698fc0994a8dd8c46eb2100000001n;

function isList(node: Sexp): node is Sexp[] {
    return Array.isArray(node);
}

function isAtom(node: Sexp): node is string {
    return typeof node === 'string';
}

function tokenizeSexp(input: string): string[] {
    const tokens: string[] = [];
    let current = '';

    for (const char of input) {
        if (char === '(' || char === ')') {
            if (current.length > 0) {
                tokens.push(current);
                current = '';
            }
            tokens.push(char);
            continue;
        }

        if (/\s/.test(char)) {
            if (current.length > 0) {
                tokens.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }

    if (current.length > 0) {
        tokens.push(current);
    }

    return tokens;
}

function parseSexpTokens(tokens: string[], cursor: { index: number }): Sexp {
    const token = tokens[cursor.index++];
    if (token === undefined) {
        throw new Error('Unexpected end of serialized proof while parsing S-expression');
    }

    if (token === '(') {
        const list: Sexp[] = [];
        while (tokens[cursor.index] !== ')') {
            if (cursor.index >= tokens.length) {
                throw new Error('Unclosed list in serialized proof');
            }
            list.push(parseSexpTokens(tokens, cursor));
        }
        cursor.index++;
        return list;
    }

    if (token === ')') {
        throw new Error('Unexpected closing parenthesis in serialized proof');
    }

    return token;
}

function parseSerializedProofSexp(input: string): Sexp {
    const decoded =
        typeof Buffer !== 'undefined'
            ? Buffer.from(input, 'base64').toString('utf8')
            : decodeURIComponent(
                  Array.from(atob(input), (char) =>
                      `%${char.charCodeAt(0).toString(16).padStart(2, '0')}`
                  ).join('')
              );
    const tokens = tokenizeSexp(decoded);
    const cursor = { index: 0 };
    const parsed = parseSexpTokens(tokens, cursor);
    if (cursor.index !== tokens.length) {
        throw new Error('Trailing tokens after serialized proof root');
    }
    return parsed;
}

function findNamedInChildren(nodes: Sexp[], name: string): Sexp[] | null {
    for (const child of nodes) {
        if (
            isList(child) &&
            child.length > 0 &&
            isAtom(child[0]) &&
            child[0] === name
        ) {
            return child;
        }
    }

    return null;
}

function findDirectNamed(node: Sexp | null, name: string): Sexp[] | null {
    if (!isList(node)) return null;

    const found = findNamedInChildren(node, name);
    if (found !== null) {
        return found;
    }

    if (node.length > 1 && isList(node[1])) {
        return findNamedInChildren(node[1], name);
    }

    return null;
}

function findRecursiveNamed(node: Sexp, name: string): Sexp[] | null {
    if (!isList(node)) return null;

    if (node.length > 0 && isAtom(node[0]) && node[0] === name) {
        return node;
    }

    for (const child of node) {
        const found = findRecursiveNamed(child, name);
        if (found) return found;
    }

    return null;
}

function parseFieldAtom(atom: Sexp): bigint {
    if (!isAtom(atom)) {
        throw new Error('Expected field atom in serialized proof');
    }
    if (/^(0x)?[0-9a-fA-F]+$/.test(atom)) {
        return BigInt(atom.startsWith('0x') ? atom : `0x${atom}`);
    }
    return BigInt(atom);
}

function parsePoint(pointNode: Sexp): { x: bigint; y: bigint } {
    if (!isList(pointNode) || pointNode.length !== 2) {
        throw new Error('Expected affine point pair in serialized proof');
    }

    return {
        x: parseFieldAtom(pointNode[0]),
        y: parseFieldAtom(pointNode[1]),
    };
}

function parsePointSequence(node: Sexp): { x: bigint; y: bigint }[] {
    if (!isList(node)) {
        throw new Error('Expected point sequence in serialized proof');
    }

    return node.map(parsePoint);
}

function parseCommNode(node: Sexp[] | null): KimchiPolyComm {
    if (node === null || node.length < 2) {
        return { unshifted: [] };
    }

    const payload = node[1];
    if (!isList(payload)) {
        return { unshifted: [parsePoint(payload)] };
    }

    if (payload.length === 0) {
        return { unshifted: [] };
    }

    if (isList(payload[0])) {
        return { unshifted: parsePointSequence(payload) };
    }

    return { unshifted: [parsePoint(payload)] };
}

function parseLrPairs(node: Sexp[] | null): KimchiOpeningPair[] {
    if (node === null || node.length < 2 || !isList(node[1])) {
        return [];
    }

    return node[1].map((pair) => {
        if (!isList(pair) || pair.length !== 2) {
            throw new Error('Invalid LR pair in serialized proof');
        }

        return {
            left: parsePoint(pair[0]),
            right: parsePoint(pair[1]),
        };
    });
}

function parsePointValue(node: Sexp[] | null): { x: bigint; y: bigint } | null {
    if (node === null || node.length < 2) return null;
    return parsePoint(node[1]);
}

function curveScalarField(curve: 'pallas' | 'vesta'): bigint {
    return curve === 'pallas' ? PALLAS_SCALAR_FIELD : PALLAS_BASE_FIELD;
}

function labelSeed(label: string): bigint {
    let seed = 0n;
    for (let i = 0; i < label.length; i++) {
        seed = (seed * 131n + BigInt(label.charCodeAt(i))) % PALLAS_SCALAR_FIELD;
    }
    return seed;
}

function deriveSyntheticScalar(
    point: { x: bigint; y: bigint },
    index: number,
    seed: bigint,
    modulus: bigint
): bigint {
    const mixed =
        seed +
        BigInt(index + 1) * 0x9e3779b97f4a7c15n +
        point.x * 0x10001n +
        point.y * 0x1000003n;
    const reduced = ((mixed % modulus) + modulus) % modulus;
    return reduced === 0n ? 1n : reduced;
}

function flattenCommitmentPoints(artifact: KimchiProofArtifact) {
    return [
        ...artifact.commitments.wComm.flatMap((commitment) => commitment.unshifted),
        ...artifact.commitments.zComm.unshifted,
        ...artifact.commitments.tComm.unshifted,
    ].filter((point): point is { x: bigint; y: bigint } => point !== null);
}

function flattenOpeningPoints(artifact: KimchiProofArtifact) {
    return [
        ...artifact.openingProof.lr.flatMap((pair) => [pair.left, pair.right]),
        artifact.openingProof.delta,
        artifact.openingProof.sg,
    ].filter((point): point is { x: bigint; y: bigint } => point !== null);
}

export function enrichKimchiProofArtifact(
    artifact: KimchiProofArtifact
): KimchiProofArtifact {
    const hasStructuredPoints =
        artifact.commitments.wComm.length > 0 ||
        artifact.commitments.zComm.unshifted.length > 0 ||
        artifact.commitments.tComm.unshifted.length > 0 ||
        artifact.openingProof.lr.length > 0 ||
        artifact.openingProof.delta !== null ||
        artifact.openingProof.sg !== null;

    if (hasStructuredPoints || artifact.serializedProof?.proof === undefined) {
        return artifact;
    }

    const root = parseSerializedProofSexp(artifact.serializedProof.proof);
    const proofNode = findRecursiveNamed(root, 'proof');
    if (proofNode === null) {
        throw new Error(`Could not find proof node in serialized proof for ${artifact.label}`);
    }

    const commitmentsNode = findDirectNamed(proofNode, 'commitments');
    const bulletproofNode = findRecursiveNamed(proofNode, 'bulletproof');
    const parsedArtifact: KimchiProofArtifact = {
        ...artifact,
        commitments: {
            wComm: parseCommNode(findDirectNamed(commitmentsNode, 'w_comm')).unshifted.map(
                (point) => ({ unshifted: point === null ? [] : [point] })
            ),
            zComm: parseCommNode(findDirectNamed(commitmentsNode, 'z_comm')),
            tComm: parseCommNode(findDirectNamed(commitmentsNode, 't_comm')),
        },
        openingProof: {
            ...artifact.openingProof,
            lr: parseLrPairs(findDirectNamed(bulletproofNode, 'lr')),
            delta: parsePointValue(findDirectNamed(bulletproofNode, 'delta')),
            z1:
                findDirectNamed(bulletproofNode, 'z_1') !== null
                    ? parseFieldAtom(findDirectNamed(bulletproofNode, 'z_1')![1])
                    : artifact.openingProof.z1,
            z2:
                findDirectNamed(bulletproofNode, 'z_2') !== null
                    ? parseFieldAtom(findDirectNamed(bulletproofNode, 'z_2')![1])
                    : artifact.openingProof.z2,
            sg: parsePointValue(
                findDirectNamed(bulletproofNode, 'challenge_polynomial_commitment')
            ),
        },
        prevChallenges: artifact.prevChallenges,
        metadata: {
            ...artifact.metadata,
            extractionMode: 'serialized-proof-parser',
        },
    };

    return parsedArtifact;
}

export function summarizeKimchiProofArtifact(artifact: KimchiProofArtifact) {
    let enriched = artifact;
    let parserError: string | undefined;
    try {
        enriched = enrichKimchiProofArtifact(artifact);
    } catch (error) {
        parserError = error instanceof Error ? error.message : String(error);
    }
    const commitmentPoints = flattenCommitmentPoints(enriched);
    const openingPoints = flattenOpeningPoints(enriched);

    return {
        label: enriched.label,
        source: enriched.source,
        curve: enriched.curve,
        extractionMode:
            enriched.metadata?.extractionMode ?? 'unknown',
        serializedProofBytes: enriched.serializedProof?.proof.length ?? 0,
        commitmentPointCount: commitmentPoints.length,
        openingPointCount: openingPoints.length,
        totalReplayPointCount: commitmentPoints.length + openingPoints.length,
        prevChallengeCount: enriched.prevChallenges.length,
        parserError,
    };
}

export function kimchiProofArtifactToSyntheticDatasets(
    artifact: KimchiProofArtifact
): KimchiMsmDataset[] {
    let enriched: KimchiProofArtifact;
    try {
        enriched = enrichKimchiProofArtifact(artifact);
    } catch {
        return [];
    }
    const modulus = curveScalarField(enriched.curve);
    const seed = labelSeed(enriched.label);
    const commitmentPoints = flattenCommitmentPoints(enriched);
    const openingPoints = flattenOpeningPoints(enriched);

    const buildDataset = (
        suffix: 'commitments' | 'opening' | 'all-points',
        msmKind:
            | 'proof-commitments-synthetic'
            | 'proof-opening-synthetic'
            | 'proof-all-points-synthetic',
        points: { x: bigint; y: bigint }[]
    ): KimchiMsmDataset | null => {
        if (points.length === 0) return null;

        return {
            version: 1,
            label: `${enriched.label}-${suffix}`,
            source: enriched.source,
            curve: enriched.curve,
            msmKind,
            pointCount: points.length,
            scalars: points.map((point, index) =>
                deriveSyntheticScalar(point, index, seed, modulus)
            ),
            points,
            metadata: {
                proofArtifact: enriched.label,
                extractionMode:
                    String(enriched.metadata?.extractionMode ?? 'unknown'),
                scalarMode: 'derived-from-point-and-label',
            },
        };
    };

    return [
        buildDataset(
            'commitments',
            'proof-commitments-synthetic',
            commitmentPoints
        ),
        buildDataset('opening', 'proof-opening-synthetic', openingPoints),
        buildDataset(
            'all-points',
            'proof-all-points-synthetic',
            [...commitmentPoints, ...openingPoints]
        ),
    ].filter((dataset): dataset is KimchiMsmDataset => dataset !== null);
}

export function kimchiProofArtifactFileToSyntheticDatasetFile(
    file: KimchiProofArtifactFile
): KimchiMsmDatasetFile {
    return {
        version: 1,
        datasets: file.artifacts.flatMap(kimchiProofArtifactToSyntheticDatasets),
    };
}

export function summarizeKimchiProofArtifactFile(file: KimchiProofArtifactFile) {
    return file.artifacts.map(summarizeKimchiProofArtifact);
}
