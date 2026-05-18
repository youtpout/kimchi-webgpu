import type { KimchiCurveName } from './kimchiMsmDataset.js';

export interface KimchiAffinePointJson {
    x: string;
    y: string;
}

export interface KimchiPolyCommJson {
    unshifted: (KimchiAffinePointJson | null)[];
}

export interface KimchiOpeningPairJson {
    left: KimchiAffinePointJson | null;
    right: KimchiAffinePointJson | null;
}

export interface KimchiRecursionChallengeJson {
    scalars: string[];
    commitment: KimchiPolyCommJson;
}

export interface KimchiProofArtifactJson {
    version: 1;
    label: string;
    source: string;
    curve: KimchiCurveName;
    maxProofsVerified: number;
    publicInput: string[];
    publicOutput: string[];
    commitments: {
        wComm: KimchiPolyCommJson[];
        zComm: KimchiPolyCommJson;
        tComm: KimchiPolyCommJson;
    };
    openingProof: {
        lr: KimchiOpeningPairJson[];
        delta: KimchiAffinePointJson | null;
        z1: string;
        z2: string;
        sg: KimchiAffinePointJson | null;
    };
    prevChallenges: KimchiRecursionChallengeJson[];
    serializedProof?: {
        proof: string;
        publicInput: string[];
        publicOutput: string[];
        maxProofsVerified: number;
    };
    metadata?: Record<string, string | number | boolean>;
}

export interface KimchiProofArtifact {
    version: 1;
    label: string;
    source: string;
    curve: KimchiCurveName;
    maxProofsVerified: number;
    publicInput: bigint[];
    publicOutput: bigint[];
    commitments: {
        wComm: KimchiPolyComm[];
        zComm: KimchiPolyComm;
        tComm: KimchiPolyComm;
    };
    openingProof: {
        lr: KimchiOpeningPair[];
        delta: KimchiAffinePoint | null;
        z1: bigint;
        z2: bigint;
        sg: KimchiAffinePoint | null;
    };
    prevChallenges: KimchiRecursionChallenge[];
    serializedProof?: {
        proof: string;
        publicInput: string[];
        publicOutput: string[];
        maxProofsVerified: number;
    };
    metadata?: Record<string, string | number | boolean>;
}

export interface KimchiPolyComm {
    unshifted: ({ x: bigint; y: bigint } | null)[];
}

export interface KimchiOpeningPair {
    left: { x: bigint; y: bigint } | null;
    right: { x: bigint; y: bigint } | null;
}

export interface KimchiRecursionChallenge {
    scalars: bigint[];
    commitment: KimchiPolyComm;
}

export interface KimchiProofArtifactFileJson {
    version: 1;
    artifacts: KimchiProofArtifactJson[];
}

export interface KimchiProofArtifactFile {
    version: 1;
    artifacts: KimchiProofArtifact[];
}

type KimchiAffinePoint = { x: bigint; y: bigint };

function pointFromJson(
    point: KimchiAffinePointJson | null
): KimchiAffinePoint | null {
    if (point === null) return null;

    return {
        x: BigInt(point.x),
        y: BigInt(point.y),
    };
}

function pointToJson(
    point: KimchiAffinePoint | null
): KimchiAffinePointJson | null {
    if (point === null) return null;

    return {
        x: point.x.toString(),
        y: point.y.toString(),
    };
}

export function kimchiProofArtifactFromJson(
    artifact: KimchiProofArtifactJson
): KimchiProofArtifact {
    return {
        ...artifact,
        publicInput: artifact.publicInput.map((value) => BigInt(value)),
        publicOutput: artifact.publicOutput.map((value) => BigInt(value)),
        commitments: {
            wComm: artifact.commitments.wComm.map((commitment) => ({
                unshifted: commitment.unshifted.map(pointFromJson),
            })),
            zComm: {
                unshifted: artifact.commitments.zComm.unshifted.map(pointFromJson),
            },
            tComm: {
                unshifted: artifact.commitments.tComm.unshifted.map(pointFromJson),
            },
        },
        openingProof: {
            lr: artifact.openingProof.lr.map((pair) => ({
                left: pointFromJson(pair.left),
                right: pointFromJson(pair.right),
            })),
            delta: pointFromJson(artifact.openingProof.delta),
            z1: BigInt(artifact.openingProof.z1),
            z2: BigInt(artifact.openingProof.z2),
            sg: pointFromJson(artifact.openingProof.sg),
        },
        prevChallenges: artifact.prevChallenges.map((challenge) => ({
            scalars: challenge.scalars.map((value) => BigInt(value)),
            commitment: {
                unshifted: challenge.commitment.unshifted.map(pointFromJson),
            },
        })),
    };
}

export function kimchiProofArtifactToJson(
    artifact: KimchiProofArtifact
): KimchiProofArtifactJson {
    return {
        ...artifact,
        publicInput: artifact.publicInput.map((value) => value.toString()),
        publicOutput: artifact.publicOutput.map((value) => value.toString()),
        commitments: {
            wComm: artifact.commitments.wComm.map((commitment) => ({
                unshifted: commitment.unshifted.map(pointToJson),
            })),
            zComm: {
                unshifted: artifact.commitments.zComm.unshifted.map(pointToJson),
            },
            tComm: {
                unshifted: artifact.commitments.tComm.unshifted.map(pointToJson),
            },
        },
        openingProof: {
            lr: artifact.openingProof.lr.map((pair) => ({
                left: pointToJson(pair.left),
                right: pointToJson(pair.right),
            })),
            delta: pointToJson(artifact.openingProof.delta),
            z1: artifact.openingProof.z1.toString(),
            z2: artifact.openingProof.z2.toString(),
            sg: pointToJson(artifact.openingProof.sg),
        },
        prevChallenges: artifact.prevChallenges.map((challenge) => ({
            scalars: challenge.scalars.map((value) => value.toString()),
            commitment: {
                unshifted: challenge.commitment.unshifted.map(pointToJson),
            },
        })),
    };
}

export function kimchiProofArtifactFileFromJson(
    file: KimchiProofArtifactFileJson
): KimchiProofArtifactFile {
    return {
        version: file.version,
        artifacts: file.artifacts.map(kimchiProofArtifactFromJson),
    };
}

export function kimchiProofArtifactFileToJson(
    file: KimchiProofArtifactFile
): KimchiProofArtifactFileJson {
    return {
        version: file.version,
        artifacts: file.artifacts.map(kimchiProofArtifactToJson),
    };
}
