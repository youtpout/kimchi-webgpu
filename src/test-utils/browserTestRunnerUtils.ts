import express from 'express';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import * as esbuild from 'esbuild';
import { fileURLToPath } from 'url';
import os from 'os';
import { createRequire } from 'module';

export const __filename = fileURLToPath(import.meta.url);
export const __dirname = path.dirname(__filename);

// Root and public folder
export const ROOT_DIR = path.resolve(__dirname, '..', '..', '..');
export const PUBLIC_DIR = path.resolve(ROOT_DIR, 'public');
const require = createRequire(import.meta.url);
const O1JS_ENTRYPOINT = require.resolve('o1js');
const O1JS_PACKAGE_ROOT = path.resolve(path.dirname(O1JS_ENTRYPOINT), '..', '..');
const O1JS_WEB_DIR = path.resolve(O1JS_PACKAGE_ROOT, 'dist', 'web');
const TSLIB_ESM_PATH = path.resolve(
    ROOT_DIR,
    'node_modules',
    'tslib',
    'tslib.es6.js'
);

/** Find Brave Nightly executable */
export function findBrave(): string {
    const candidates =
        os.platform() === 'darwin'
            ? [
                '/Applications/Brave Browser Nightly.app/Contents/MacOS/Brave Browser Nightly',
                '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',
            ]
            : [
                '/usr/bin/brave-browser-nightly',
                '/usr/bin/brave-browser',
                '/usr/bin/brave',
                '/snap/bin/brave',
            ];

    for (const candidate of candidates) {
        if (fs.existsSync(candidate)) return candidate;
    }

    try {
        return execSync(
            'which brave-browser-nightly || which brave-browser || which brave',
            { encoding: 'utf8' }
        ).trim();
    } catch {
        throw new Error('Brave not found! Install Brave Nightly.');
    }
}

/** Start Express server serving public folder */
export async function startServer(port = 3001) {
    const app = express();
    app.use((_, res, next) => {
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
        next();
    });
    app.use(express.static(PUBLIC_DIR));
    app.use('/dist', express.static(path.resolve(ROOT_DIR, 'dist')));
    app.use('/o1js', express.static(O1JS_WEB_DIR));
    app.use('/vendor/tslib', express.static(path.dirname(TSLIB_ESM_PATH)));

    return new Promise<{ server: any; url: string }>((resolve) => {
        const server = app.listen(port, () => {
            const url = `http://localhost:${port}/index.html`;
            console.log(
                `Server running at: ${url}. Please open this in brave with the nessesary flags.`
            );
            resolve({ server, url });
        });
    });
}

/** Bundle all tests into ESM for browser */
export async function bundleTests(
    entryFile: string,
    outFile = 'bundle.tests.js',
    htmlFile = 'index.html'
) {
    if (!fs.existsSync(PUBLIC_DIR))
        fs.mkdirSync(PUBLIC_DIR, { recursive: true });

    const outfile = path.resolve(PUBLIC_DIR, outFile);

    await esbuild.build({
        entryPoints: [entryFile],
        bundle: true,
        format: 'esm',
        outfile,
        platform: 'browser',
        define: { 'process.env.NODE_ENV': '"test"' },
        loader: {
            '.wgsl': 'text',
        },
    });

    // Create a minimal index.html if missing
    const htmlPath = path.resolve(PUBLIC_DIR, htmlFile);
    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>WebGPU Tests</title></head>
<body>
<h1>WebGPU Tests</h1>
<div id="test-results"></div>
<script type="module">
  import './${outFile}';
  window.addEventListener('DOMContentLoaded', () => {
    if (!window.runTests) {
      console.error('runTests not found on globalThis!');
      return;
    }
    window.runTests();
  });
</script>
</body>
</html>`;
    fs.writeFileSync(htmlPath, html, 'utf-8');

    return outfile;
}

export async function bundleBrowserProving(
    entryFile: string,
    outDir = 'browser-proving',
    htmlFile = 'browser-proving.html'
) {
    if (!fs.existsSync(PUBLIC_DIR))
        fs.mkdirSync(PUBLIC_DIR, { recursive: true });

    const outdir = path.resolve(PUBLIC_DIR, outDir);
    fs.mkdirSync(outdir, { recursive: true });

    await esbuild.build({
        entryPoints: [entryFile],
        bundle: true,
        format: 'esm',
        splitting: true,
        outdir,
        platform: 'browser',
        external: ['o1js'],
        define: { 'process.env.NODE_ENV': '"test"' },
        loader: {
            '.wgsl': 'text',
        },
    });

    const htmlPath = path.resolve(PUBLIC_DIR, htmlFile);
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Browser Proving</title>
  <script type="importmap">
    {
      "imports": {
        "o1js": "/o1js/index.js",
        "tslib": "/vendor/tslib/tslib.es6.js"
      }
    }
  </script>
</head>
<body>
  <h1>Browser Proving</h1>
  <div>Check console output for proving timings.</div>
  <script type="module" src="/${outDir}/counter-browser.js"></script>
</body>
</html>`;
    fs.writeFileSync(htmlPath, html, 'utf-8');
}
