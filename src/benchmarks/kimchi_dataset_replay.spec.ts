import { expect } from 'chai';
import {
    createPippengerMSMPallasRunner,
    pippengerMSMPallas,
} from '../gpu/256bit/pallas/pippenger_msm.js';
import {
    createPippengerMSMVestaRunner,
    pippengerMSMVesta,
} from '../gpu/256bit/vesta/pippenger_msm.js';
import { kimchiMsmDatasetFileFromJson } from '../datasets/kimchiMsmDataset.js';
import type { Point } from '../types/point.js';

async function getDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter found');
    return adapter.requestDevice();
}

async function fetchDatasetFile() {
    const params = new URLSearchParams(window.location.search);
    const datasetPath = params.get('dataset');

    if (!datasetPath) return null;

    const response = await fetch(`/${datasetPath}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch dataset file: ${datasetPath}`);
    }

    return kimchiMsmDatasetFileFromJson(await response.json());
}

function median(values: number[]): number {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

async function runTimed(
    run: () => Promise<{ x: bigint; y: bigint }>,
    rounds: number
): Promise<{ result: { x: bigint; y: bigint }; timingsMs: number[] }> {
    const timingsMs: number[] = [];
    let result = await run();

    for (let i = 0; i < rounds; i++) {
        const start = performance.now();
        result = await run();
        timingsMs.push(performance.now() - start);
    }

    return { result, timingsMs };
}

function createRunner(
    device: GPUDevice,
    curve: 'pallas' | 'vesta'
): {
    run: (
        scalars: bigint[],
        points: Point[],
        config?: { verbose?: boolean }
    ) => Promise<Point>;
} {
    return curve === 'pallas'
        ? createPippengerMSMPallasRunner(device, { bucketWidthBits: 8 })
        : createPippengerMSMVestaRunner(device, { bucketWidthBits: 8 });
}

async function runCold(
    device: GPUDevice,
    curve: 'pallas' | 'vesta',
    scalars: bigint[],
    points: Point[]
): Promise<Point> {
    return curve === 'pallas'
        ? pippengerMSMPallas(device, scalars, points, {
              bucketWidthBits: 8,
              verbose: false,
          })
        : pippengerMSMVesta(device, scalars, points, {
              bucketWidthBits: 8,
              verbose: false,
          });
}

const requestedDataset = new URLSearchParams(window.location.search).get(
    'dataset'
);

if (requestedDataset) {
    describe('Kimchi MSM dataset replay', () => {
        (it as any)(
            'replays exported Kimchi MSM datasets',
            async () => {
                const datasetFile = await fetchDatasetFile();
                if (!datasetFile) {
                    throw new Error('Dataset query parameter was set but no dataset file was loaded');
                }

                const roundsParam = new URLSearchParams(window.location.search).get(
                    'rounds'
                );
                const rounds = roundsParam ? Number.parseInt(roundsParam, 10) : 3;
                const device = await getDevice();

                for (const dataset of datasetFile.datasets) {
                    console.log('');
                    console.log(`=== Dataset: ${dataset.label} ===`);
                    console.log(`Source: ${dataset.source}`);
                    console.log(`Curve: ${dataset.curve}`);
                    console.log(`MSM kind: ${dataset.msmKind}`);
                    console.log(`Point count: ${dataset.pointCount}`);

                    expect(dataset.scalars.length).to.equal(
                        dataset.points.length,
                        `${dataset.label} scalar/point length mismatch`
                    );

                    const coldStart = performance.now();
                    const coldResult = await runCold(
                        device,
                        dataset.curve,
                        dataset.scalars,
                        dataset.points
                    );
                    const coldMs = performance.now() - coldStart;

                    console.log(`GPU cold run: ${coldMs.toFixed(2)} ms`);
                    console.log(
                        `Cold result x: ${coldResult.x.toString().slice(0, 24)}...`
                    );

                    const runner = createRunner(device, dataset.curve);
                    await runner.run(dataset.scalars, dataset.points, {
                        verbose: false,
                    });

                    const { result, timingsMs } = await runTimed(
                        () =>
                            runner.run(dataset.scalars, dataset.points, {
                                verbose: false,
                            }),
                        rounds
                    );

                    const medianMs = median(timingsMs);
                    console.log(
                        `GPU warm runs: ${timingsMs
                            .map((ms) => ms.toFixed(2))
                            .join(', ')} ms`
                    );
                    console.log(`GPU median warm run: ${medianMs.toFixed(2)} ms`);
                    console.log(
                        `Warm result x: ${result.x.toString().slice(0, 24)}...`
                    );
                }
            },
            1_800_000
        );
    });
}
