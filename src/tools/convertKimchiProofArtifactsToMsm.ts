import fs from 'fs';
import path from 'path';
import {
    kimchiProofArtifactFileFromJson,
} from '../datasets/kimchiProofArtifacts.js';
import {
    kimchiProofArtifactFileToSyntheticDatasetFile,
    summarizeKimchiProofArtifactFile,
} from '../datasets/kimchiProofArtifactReplay.js';
import { kimchiMsmDatasetFileToJson } from '../datasets/kimchiMsmDataset.js';

async function main() {
    const inputArg = process.argv[2] ?? 'public/datasets/kimchi-proof-artifacts.json';
    const outputArg =
        process.argv[3] ?? 'public/datasets/kimchi-proof-synthetic-msm.json';

    const inputPath = path.isAbsolute(inputArg)
        ? inputArg
        : path.resolve(process.cwd(), inputArg);
    const outputPath = path.isAbsolute(outputArg)
        ? outputArg
        : path.resolve(process.cwd(), outputArg);

    const artifactJson = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const artifactFile = kimchiProofArtifactFileFromJson(artifactJson);
    const datasetFile = kimchiProofArtifactFileToSyntheticDatasetFile(artifactFile);

    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(
        outputPath,
        JSON.stringify(kimchiMsmDatasetFileToJson(datasetFile), null, 2),
        'utf8'
    );

    const summaries = summarizeKimchiProofArtifactFile(artifactFile);
    console.log(`Converted ${summaries.length} proof artifacts into ${datasetFile.datasets.length} synthetic MSM datasets`);
    console.log(`Output: ${outputPath}`);
    for (const summary of summaries) {
        console.log(
            `- ${summary.label}: curve=${summary.curve}, extraction=${summary.extractionMode}, replayablePoints=${summary.totalReplayPointCount}`
        );
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
