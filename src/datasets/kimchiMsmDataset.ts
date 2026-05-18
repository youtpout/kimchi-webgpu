export type KimchiCurveName = 'pallas' | 'vesta';

export interface KimchiAffinePointJson {
    x: string;
    y: string;
}

export interface KimchiMsmDatasetJson {
    version: 1;
    label: string;
    source: string;
    curve: KimchiCurveName;
    msmKind:
        | 'srs-commit-evaluations'
        | 'witness-column-commitment'
        | 'proof-commitments-synthetic'
        | 'proof-opening-synthetic'
        | 'proof-all-points-synthetic';
    domainSize?: number;
    pointCount: number;
    scalars: string[];
    points: KimchiAffinePointJson[];
    metadata?: Record<string, string | number | boolean>;
}

export interface KimchiMsmDataset {
    version: 1;
    label: string;
    source: string;
    curve: KimchiCurveName;
    msmKind:
        | 'srs-commit-evaluations'
        | 'witness-column-commitment'
        | 'proof-commitments-synthetic'
        | 'proof-opening-synthetic'
        | 'proof-all-points-synthetic';
    domainSize?: number;
    pointCount: number;
    scalars: bigint[];
    points: { x: bigint; y: bigint }[];
    metadata?: Record<string, string | number | boolean>;
}

export interface KimchiMsmDatasetFileJson {
    version: 1;
    datasets: KimchiMsmDatasetJson[];
}

export interface KimchiMsmDatasetFile {
    version: 1;
    datasets: KimchiMsmDataset[];
}

export function kimchiMsmDatasetFromJson(
    dataset: KimchiMsmDatasetJson
): KimchiMsmDataset {
    return {
        ...dataset,
        scalars: dataset.scalars.map((scalar) => BigInt(scalar)),
        points: dataset.points.map((point) => ({
            x: BigInt(point.x),
            y: BigInt(point.y),
        })),
    };
}

export function kimchiMsmDatasetToJson(
    dataset: KimchiMsmDataset
): KimchiMsmDatasetJson {
    return {
        ...dataset,
        scalars: dataset.scalars.map((scalar) => scalar.toString()),
        points: dataset.points.map((point) => ({
            x: point.x.toString(),
            y: point.y.toString(),
        })),
    };
}

export function kimchiMsmDatasetFileFromJson(
    file: KimchiMsmDatasetFileJson
): KimchiMsmDatasetFile {
    return {
        version: file.version,
        datasets: file.datasets.map(kimchiMsmDatasetFromJson),
    };
}

export function kimchiMsmDatasetFileToJson(
    file: KimchiMsmDatasetFile
): KimchiMsmDatasetFileJson {
    return {
        version: file.version,
        datasets: file.datasets.map(kimchiMsmDatasetToJson),
    };
}
