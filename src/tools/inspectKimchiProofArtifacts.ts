import fs from 'fs';
import path from 'path';
import {
    kimchiProofArtifactFileFromJson,
} from '../datasets/kimchiProofArtifacts.js';
import {
    summarizeKimchiProofArtifactFile,
} from '../datasets/kimchiProofArtifactReplay.js';

async function main() {
    const inputArg = process.argv[2] ?? 'public/datasets/kimchi-proof-artifacts.json';
    const inputPath = path.isAbsolute(inputArg)
        ? inputArg
        : path.resolve(process.cwd(), inputArg);

    const json = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const artifactFile = kimchiProofArtifactFileFromJson(json);
    const summaries = summarizeKimchiProofArtifactFile(artifactFile);

    console.log(`Artifacts: ${summaries.length}`);
    for (const summary of summaries) {
        console.log('');
        console.log(`Label: ${summary.label}`);
        console.log(`Source: ${summary.source}`);
        console.log(`Curve: ${summary.curve}`);
        console.log(`Extraction mode: ${summary.extractionMode}`);
        console.log(`Serialized proof chars: ${summary.serializedProofBytes}`);
        console.log(`Commitment points: ${summary.commitmentPointCount}`);
        console.log(`Opening points: ${summary.openingPointCount}`);
        console.log(`Replayable points total: ${summary.totalReplayPointCount}`);
        console.log(`Previous challenges: ${summary.prevChallengeCount}`);
        if (summary.parserError) {
            console.log(`Parser error: ${summary.parserError}`);
        }
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
