import fs from 'fs';
import path from 'path';
import type { EmbeddedCacheManifest } from '../proof/embeddedO1jsCompileCache.js';
import {
    createCounterProofHarness,
    type CounterProofHarnessOptions,
} from '../proof/runCounterProof.js';
import {
    createVaultRollupProofHarness,
    type VaultRollupHarnessOptions,
} from '../proof/runRollup.js';

type CacheHeader = {
    persistentId: string;
    uniqueId: string;
    dataType: 'string' | 'bytes';
};

type CacheLike = {
    read(header: CacheHeader): Uint8Array | undefined;
    write(header: CacheHeader, value: Uint8Array): void;
    canWrite: boolean;
};

type CacheTarget = 'counter' | 'rollup';

type WrittenHeader = CacheHeader & { persistentId: string };

function shouldEmbedCacheEntry(header: WrittenHeader) {
    return (
        header.persistentId.startsWith('srs-') ||
        header.persistentId.startsWith('lagrange-basis-') ||
        header.persistentId.startsWith('step-vk-') ||
        header.persistentId.startsWith('wrap-vk-')
    );
}

function createFileSystemCache(cacheDirectory: string) {
    const writtenHeaders = new Map<string, WrittenHeader>();
    return {
        writtenHeaders,
        canWrite: true,
        read({ persistentId, uniqueId }: CacheHeader) {
            const headerPath = path.join(cacheDirectory, `${persistentId}.header`);
            const dataPath = path.join(cacheDirectory, persistentId);

            if (!fs.existsSync(headerPath) || !fs.existsSync(dataPath)) return undefined;
            const currentUniqueId = fs.readFileSync(headerPath, 'utf8');
            if (currentUniqueId !== uniqueId) return undefined;
            return new Uint8Array(fs.readFileSync(dataPath));
        },
        write({ persistentId, uniqueId, dataType }: CacheHeader, value: Uint8Array) {
            fs.mkdirSync(cacheDirectory, { recursive: true });
            fs.writeFileSync(path.join(cacheDirectory, `${persistentId}.header`), uniqueId, 'utf8');
            fs.writeFileSync(path.join(cacheDirectory, persistentId), value, {
                encoding: dataType === 'string' ? 'utf8' : undefined,
            });
            writtenHeaders.set(persistentId, {
                persistentId,
                uniqueId,
                dataType,
            });
        },
    };
}

async function populateCache(target: CacheTarget, cache: CacheLike) {
    if (target === 'counter') {
        const options: CounterProofHarnessOptions = { compileCache: cache };
        await createCounterProofHarness(options);
        return;
    }
    const options: VaultRollupHarnessOptions = { compileCache: cache };
    await createVaultRollupProofHarness(options);
}

function exportEmbeddedCache(
    cacheDirectory: string,
    outDirectory: string,
    writtenHeaders: Map<string, WrittenHeader>
) {
    fs.mkdirSync(outDirectory, { recursive: true });

    const manifest: EmbeddedCacheManifest = {
        version: 1,
        entries: [],
    };

    for (const fileName of fs.readdirSync(cacheDirectory)) {
        if (fileName.endsWith('.header')) continue;

        const persistentId = fileName;
        const header = writtenHeaders.get(persistentId);
        if (header === undefined || !shouldEmbedCacheEntry(header)) continue;
        const headerPath = path.join(cacheDirectory, `${persistentId}.header`);
        const dataPath = path.join(cacheDirectory, persistentId);
        if (!fs.existsSync(headerPath) || !fs.existsSync(dataPath)) continue;

        const uniqueId = fs.readFileSync(headerPath, 'utf8');
        const outFile = persistentId;

        fs.copyFileSync(dataPath, path.join(outDirectory, outFile));
        manifest.entries.push({
            persistentId,
            uniqueId,
            dataType: header.dataType,
            file: outFile,
        });
    }

    manifest.entries.sort((a, b) => a.persistentId.localeCompare(b.persistentId));
    fs.writeFileSync(
        path.join(outDirectory, 'manifest.json'),
        JSON.stringify(manifest, null, 2),
        'utf8'
    );
}

async function main() {
    const targets = (process.argv.slice(2) as CacheTarget[]).length
        ? (process.argv.slice(2) as CacheTarget[])
        : (['counter', 'rollup'] as CacheTarget[]);

    for (const target of targets) {
        if (target !== 'counter' && target !== 'rollup') {
            throw new Error(`Unsupported cache target: ${target}`);
        }

        const tmpCacheDirectory = path.resolve('.tmp', 'o1js-embedded-cache', target);
        const outDirectory = path.resolve('public', 'o1js-cache', target);

        fs.rmSync(tmpCacheDirectory, { recursive: true, force: true });
        fs.rmSync(outDirectory, { recursive: true, force: true });

        const cache = createFileSystemCache(tmpCacheDirectory);
        console.log(`[embedded-cache] generating target=${target}`);
        await populateCache(target, cache);
        exportEmbeddedCache(tmpCacheDirectory, outDirectory, cache.writtenHeaders);
        console.log(`[embedded-cache] wrote ${outDirectory}`);
    }
}

await main();
