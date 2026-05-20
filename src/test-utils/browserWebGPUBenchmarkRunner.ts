import { bundleTests, findBrave, startServer, ROOT_DIR } from './browserTestRunnerUtils.js';
import path from 'path';
import { spawn } from 'child_process';

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
  }
  const { url: baseUrl } = await startServer();
  const benchmarkBaseUrl = browserProvingMode
    ? baseUrl.replace('/index.html', '/browser-proving.html')
    : baseUrl.replace('/index.html', '/index.benchmarks.html');
  const url = extraQuery ? `${benchmarkBaseUrl}${extraQuery}` : benchmarkBaseUrl;
  const brave = findBrave();

  console.log('Opening Brave at', url);

  spawn(
    brave,
    [
      '--enable-unsafe-webgpu',
      '--ignore-gpu-blocklist',
      '--enable-features=DefaultANGLEVulkan,Vulkan,VulkanFromANGLE',
      '--disable-features=PdfUseSkiaRenderer',
      url,
    ],
    { stdio: 'inherit', detached: true }
  ).unref();
}

main().catch(console.error);
