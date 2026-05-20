type CacheHeader = {
    persistentId: string;
    uniqueId: string;
    dataType: 'string' | 'bytes';
};

type CacheLike = {
    read(header: CacheHeader): Uint8Array | undefined;
    write(header: CacheHeader, value: Uint8Array): void;
    canWrite: boolean;
    debug?: boolean;
};

type EmbeddedCacheManifestEntry = {
    persistentId: string;
    uniqueId: string;
    dataType: 'string' | 'bytes';
    file: string;
};

type EmbeddedCacheManifest = {
    version: 1;
    entries: EmbeddedCacheManifestEntry[];
};

export type { CacheLike, EmbeddedCacheManifest, EmbeddedCacheManifestEntry };

const manifestPromiseCache = new Map<string, Promise<CacheLike | undefined>>();

function normalizeBaseUrl(baseUrl: string) {
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

async function fetchManifest(baseUrl: string) {
    const manifestResponse = await fetch(`${baseUrl}/manifest.json`);
    if (!manifestResponse.ok) {
        if (manifestResponse.status === 404) return undefined;
        throw new Error(
            `Failed to fetch embedded compile cache manifest: ${manifestResponse.status} ${manifestResponse.statusText}`
        );
    }
    return (await manifestResponse.json()) as EmbeddedCacheManifest;
}

async function loadManifestEntries(baseUrl: string, manifest: EmbeddedCacheManifest) {
    const entries = await Promise.all(
        manifest.entries.map(async (entry) => {
            const response = await fetch(`${baseUrl}/${entry.file}`);
            if (!response.ok) {
                throw new Error(
                    `Failed to fetch embedded compile cache entry ${entry.persistentId}: ${response.status} ${response.statusText}`
                );
            }
            const bytes =
                entry.dataType === 'bytes'
                    ? new Uint8Array(await response.arrayBuffer())
                    : new TextEncoder().encode(await response.text());
            return [entry.persistentId, bytes, entry] as const;
        })
    );

    const payloads = new Map<string, { bytes: Uint8Array; entry: EmbeddedCacheManifestEntry }>();
    for (const [persistentId, bytes, entry] of entries) {
        payloads.set(persistentId, { bytes, entry });
    }
    return payloads;
}

function createReadonlyCache(
    payloads: Map<string, { bytes: Uint8Array; entry: EmbeddedCacheManifestEntry }>
): CacheLike {
    return {
        canWrite: false,
        read(header) {
            const payload = payloads.get(header.persistentId);
            if (payload === undefined) return undefined;
            if (payload.entry.uniqueId !== header.uniqueId) return undefined;
            if (payload.entry.dataType !== header.dataType) return undefined;
            return payload.bytes;
        },
        write() {
            throw new Error('Embedded compile cache is read-only');
        },
    };
}

export async function preloadEmbeddedO1jsCompileCache(
    cacheName: string
): Promise<CacheLike | undefined> {
    if (typeof window === 'undefined') return undefined;

    const baseUrl = normalizeBaseUrl(`/o1js-cache/${cacheName}`);
    const cachedPromise = manifestPromiseCache.get(baseUrl);
    if (cachedPromise !== undefined) return cachedPromise;

    const cachePromise = (async () => {
        const manifest = await fetchManifest(baseUrl);
        if (manifest === undefined) return undefined;
        const payloads = await loadManifestEntries(baseUrl, manifest);
        return createReadonlyCache(payloads);
    })();

    manifestPromiseCache.set(baseUrl, cachePromise);
    return cachePromise;
}
