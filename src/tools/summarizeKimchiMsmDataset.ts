import fs from 'fs';
import path from 'path';
import {
    kimchiMsmDatasetFileFromJson,
    type KimchiMsmDataset,
    type KimchiMsmDatasetFileJson,
} from '../datasets/kimchiMsmDataset.js';

function groupKey(dataset: KimchiMsmDataset) {
    return `${dataset.curve}:${dataset.msmKind}:${dataset.domainSize ?? 'na'}:${dataset.pointCount}`;
}

async function main() {
    const inputArg = process.argv[2];
    if (!inputArg) {
        throw new Error(
            'Usage: node dist/src/tools/summarizeKimchiMsmDataset.js <dataset-file>'
        );
    }

    const inputPath = path.resolve(inputArg);
    const raw = JSON.parse(fs.readFileSync(inputPath, 'utf8')) as KimchiMsmDatasetFileJson;
    const file = kimchiMsmDatasetFileFromJson(raw);

    const groups = new Map<
        string,
        {
            dataset: KimchiMsmDataset;
            count: number;
        }
    >();

    for (const dataset of file.datasets) {
        const key = groupKey(dataset);
        const existing = groups.get(key);
        if (existing) {
            existing.count += 1;
        } else {
            groups.set(key, { dataset, count: 1 });
        }
    }

    const sortedGroups = [...groups.values()].sort((a, b) => {
        if (b.dataset.pointCount !== a.dataset.pointCount) {
            return b.dataset.pointCount - a.dataset.pointCount;
        }
        return a.dataset.label.localeCompare(b.dataset.label);
    });

    console.log(`Dataset file: ${inputPath}`);
    console.log(`Datasets: ${file.datasets.length}`);
    console.log('');
    console.log('Groups:');
    for (const { dataset, count } of sortedGroups) {
        console.log(
            `- curve=${dataset.curve} msmKind=${dataset.msmKind} domainSize=${dataset.domainSize ?? 'n/a'} pointCount=${dataset.pointCount} count=${count}`
        );
    }

    const largest = [...file.datasets]
        .sort((a, b) => b.pointCount - a.pointCount)
        .slice(0, 10);

    console.log('');
    console.log('Largest datasets:');
    for (const dataset of largest) {
        console.log(
            `- ${dataset.label} curve=${dataset.curve} msmKind=${dataset.msmKind} domainSize=${dataset.domainSize ?? 'n/a'} pointCount=${dataset.pointCount}`
        );
    }
}

await main();
