import {
    bundleTests,
    bundleBrowserProving,
    findBrave,
    startServer,
    ROOT_DIR,
} from './browserTestRunnerUtils.js';
import path from 'path';
import puppeteer from 'puppeteer';
import os from 'os';

const platform = os.platform();

const commonArgs = ['--enable-unsafe-webgpu', '--ignore-gpu-blocklist'];

const linuxArgs = [
    '--enable-features=Vulkan,WebGPU',
    '--use-angle=vulkan',
    '--disable-vulkan-surface',
    '--disable-gpu-sandbox',
    '--no-sandbox',
];

const macArgs = ['--enable-features=Metal,WebGPU', '--use-angle=metal'];

async function main() {
    const extraQuery = process.argv[2] ?? '';
    const browserProvingMode = new URLSearchParams(
        extraQuery.startsWith('?') ? extraQuery.slice(1) : extraQuery
    ).get('browserProving');
    if (!browserProvingMode) {
        const entryFile = path.resolve(ROOT_DIR, 'src/benchmarks/index.ts');
        await bundleTests(
            entryFile,
            'bundle.benchmarks.js',
            'index.benchmarks.html'
        );
    } else {
        const entryFile = path.resolve(
            ROOT_DIR,
            'dist/src/browser-proving/counter-browser.js'
        );
        await bundleBrowserProving(entryFile);
    }
    const { url: baseUrl } = await startServer();
    const benchmarkBaseUrl = browserProvingMode
        ? baseUrl.replace('/index.html', '/browser-proving.html')
        : baseUrl.replace('/index.html', '/index.benchmarks.html');
    const url = extraQuery
        ? `${benchmarkBaseUrl}${extraQuery}`
        : benchmarkBaseUrl;
    const brave = findBrave();
    console.log('Launching headless Brave for benchmarks');

    const browser = await puppeteer.launch({
        headless: true,
        executablePath: brave,
        protocolTimeout: 0,
        args: [
            ...commonArgs,
            ...(platform === 'linux' ? linuxArgs : []),
            ...(platform === 'darwin' ? macArgs : []),
        ],
    });

    const page = await browser.newPage();

    page.on('console', async (msg) => {
        const args = await Promise.all(
            msg.args().map(async (a) => {
                try {
                    return await a.jsonValue();
                } catch {
                    return '[Unserializable]';
                }
            })
        );

        if (
            args.length === 0 ||
            (args.length === 1 &&
                (args[0] === '' || args[0] === null || args[0] === undefined))
        ) {
            return;
        }

        console.log('[browser]', ...args);
    });

    await page.goto(url, { waitUntil: 'domcontentloaded' });

    await page.waitForFunction(() => (window as any).testsFinished === true, {
        polling: 100,
        timeout: 0,
    });

    const failuresCount = await page.evaluate(
        () => (window as any).testsFailures || 0
    );

    console.log(`Benchmarks finished. Failures: ${failuresCount}`);
    await browser.close();
    process.exit(failuresCount ? 1 : 0);
}

main().catch(console.error);
