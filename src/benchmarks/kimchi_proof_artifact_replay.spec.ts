import { expect } from 'chai';
import {
    createPippengerMSMPallasRunner,
    pippengerMSMPallas,
} from '../gpu/256bit/pallas/pippenger_msm.js';
import { kimchiProofArtifactFileFromJson } from '../datasets/kimchiProofArtifacts.js';
import {
    kimchiProofArtifactFileToSyntheticDatasetFile,
    summarizeKimchiProofArtifactFile,
} from '../datasets/kimchiProofArtifactReplay.js';

async function getDevice(): Promise<GPUDevice> {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No WebGPU adapter found');
    return adapter.requestDevice();
}

async function fetchArtifactFile() {
    const params = new URLSearchParams(window.location.search);
    const artifactPath = params.get('proofArtifact');

    if (!artifactPath) return null;

    const response = await fetch(`/${artifactPath}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch proof artifact file: ${artifactPath}`);
    }

    return kimchiProofArtifactFileFromJson(await response.json());
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

const requestedArtifact = new URLSearchParams(window.location.search).get(
    'proofArtifact'
);

if (requestedArtifact) {
    describe('Kimchi proof artifact replay', () => {
        (it as any)(
            'parses proof artifacts and benchmarks replayable datasets',
            async () => {
                const artifactFile = await fetchArtifactFile();
                if (!artifactFile) {
                    throw new Error(
                        'proofArtifact query parameter was set but no artifact file was loaded'
                    );
                }

                const summaries = summarizeKimchiProofArtifactFile(artifactFile);
                for (const summary of summaries) {
                    console.log('');
                    console.log(`=== Proof artifact: ${summary.label} ===`);
                    console.log(`Curve: ${summary.curve}`);
                    console.log(`Extraction mode: ${summary.extractionMode}`);
                    console.log(`Commitment points: ${summary.commitmentPointCount}`);
                    console.log(`Opening points: ${summary.openingPointCount}`);
                    console.log(`Replayable points total: ${summary.totalReplayPointCount}`);
                }

                const datasetFile =
                    kimchiProofArtifactFileToSyntheticDatasetFile(artifactFile);
                expect(datasetFile.datasets.length).to.be.greaterThan(
                    0,
                    'No synthetic replay datasets were generated from the proof artifacts'
                );

                const roundsParam = new URLSearchParams(window.location.search).get(
                    'rounds'
                );
                const rounds = roundsParam ? Number.parseInt(roundsParam, 10) : 3;
                const device = await getDevice();

                let replayedDatasets = 0;

                for (const dataset of datasetFile.datasets) {
                    console.log('');
                    console.log(`=== Synthetic dataset: ${dataset.label} ===`);
                    console.log(`Curve: ${dataset.curve}`);
                    console.log(`MSM kind: ${dataset.msmKind}`);
                    console.log(`Point count: ${dataset.pointCount}`);

                    if (dataset.curve !== 'pallas') {
                        console.log(
                            `Skipping GPU replay for ${dataset.label}: curve=${dataset.curve} is not supported by the current browser MSM backend`
                        );
                        continue;
                    }

                    replayedDatasets++;
                    expect(dataset.scalars.length).to.equal(
                        dataset.points.length,
                        `${dataset.label} scalar/point length mismatch`
                    );

                    const coldStart = performance.now();
                    const coldResult = await pippengerMSMPallas(
                        device,
                        dataset.scalars,
                        dataset.points,
                        { bucketWidthBits: 8, verbose: false }
                    );
                    const coldMs = performance.now() - coldStart;

                    console.log(`GPU cold run: ${coldMs.toFixed(2)} ms`);
                    console.log(
                        `Cold result x: ${coldResult.x.toString().slice(0, 24)}...`
                    );

                    const runner = createPippengerMSMPallasRunner(device, {
                        bucketWidthBits: 8,
                    });
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

                if (replayedDatasets === 0) {
                    console.log('');
                    console.log(
                        'No proof-artifact datasets were replayed on GPU because they target curves that are not yet supported by the current browser MSM backend.'
                    );
                }
            },
            1_800_000
        );
    });
}
