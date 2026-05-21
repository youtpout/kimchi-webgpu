import { expect } from 'chai';
import { pippengerMSMPallas } from '../gpu/256bit/pallas/pippenger_msm.js';
import { kimchiMsmDatasetFileFromJson } from '../datasets/kimchiMsmDataset.js';

interface CpuBenchmarkResultFile {
    version: 1;
    results: {
        label: string;
        curve: 'pallas' | 'vesta';
        msmKind: string;
        pointCount: number;
        coldMs: number;
        warmTimingsMs: number[];
        medianWarmMs: number;
        result: { x: string; y: string };
    }[];
}

const PALLAS_REAL_DATASET_LABEL = 'runRollup-pallas-witness-column-commitment-0';

async function getDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter found');
    return adapter.requestDevice();
}

async function fetchJson<T>(path: string): Promise<T> {
    const response = await fetch(path);
    if (!response.ok) {
        throw new Error(`Failed to fetch ${path}: ${response.status}`);
    }
    return (await response.json()) as T;
}

describe('pippengerMSMPallas — real dataset regression', () => {
    (it as any)(
        'matches CPU wasm on runRollup-pallas-witness-column-commitment-0',
        async () => {
            const [datasetFileJson, cpuResultsJson] = await Promise.all([
                fetchJson<any>('/datasets/rollup-internal-msm.json'),
                fetchJson<CpuBenchmarkResultFile>(
                    '/datasets/rollup-internal-msm-cpu-results.json'
                ),
            ]);

            const datasetFile = kimchiMsmDatasetFileFromJson(datasetFileJson);
            const dataset = datasetFile.datasets.find(
                (entry) => entry.label === PALLAS_REAL_DATASET_LABEL
            );
            if (!dataset) {
                throw new Error(`Dataset not found: ${PALLAS_REAL_DATASET_LABEL}`);
            }
            const cpuResult = cpuResultsJson.results.find(
                (entry) => entry.label === PALLAS_REAL_DATASET_LABEL
            );
            if (!cpuResult) {
                throw new Error(
                    `CPU benchmark result not found: ${PALLAS_REAL_DATASET_LABEL}`
                );
            }

            const device = await getDevice();
            const gpuResult = await pippengerMSMPallas(
                device,
                dataset.scalars,
                dataset.points,
                { bucketWidthBits: 8, verbose: false }
            );

            expect(gpuResult.x.toString()).to.equal(
                cpuResult.result.x,
                'real dataset regression x'
            );
            expect(gpuResult.y.toString()).to.equal(
                cpuResult.result.y,
                'real dataset regression y'
            );
        },
        300_000
    );
});
