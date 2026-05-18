# Abstract

**Kimchi WebGPU** explores accelerating Kimchi zero-knowledge provers by performing **Number-Theoretic Transforms (NTTs)** [NTT](https://en.wikipedia.org/wiki/Number-theoretic_transform) and **Multi-Scalar Multiplications (MSMs)** [MSM](https://en.wikipedia.org/wiki/Scalar_multiplication#Multiple_scalar_multiplication) over the Pallas and Vesta fields entirely on the GPU via WebGPU. The approach keeps all polynomial coefficients and intermediate results resident on-device, minimizing host-GPU synchronization, with the goal of improving prover throughput while preserving correctness and determinism.

# Requirements

- Brave Nightly installed (macOS or Linux) to run browser-based WebGPU tests and benchmarks.  
  - Ensure flags like `--enable-unsafe-webgpu` and `--ignore-gpu-blocklist` are enabled for full GPU support.e

# Installation

1. Install dependencies:  
   `npm install`  

# Build  

- Compile TypeScript source files into the `dist` folder:  
  `npm run build`  
  This runs the command: `tsc`  

## Test / Run Browser WebGPU Tests

- **Headless CLI Tests** (for CI or automated runs):  
  `npm run test:browser-cli`  
  This runs the compiled browser test runner in Node using Puppeteer + Brave in headless mode.

- **Interactive Browser Tests** (leave browser open for inspection):  
  `npm run test:browser`  
  This starts an Express server, opens Brave with WebGPU enabled, and displays test results in the browser page.  
  The page URL will be printed to stdout so you can open it manually if needed.

## Benchmark Browser WebGPU

- **Headless benchmark**:  
  `npm run bench:browser-cli`

- **Interactive benchmark**:  
  `npm run bench:browser`

The benchmark uses valid Pallas curve points, verifies CPU/GPU equality on small datasets, then measures GPU cold runs and warm reused-runner performance on larger datasets.

### Benchmark Commands

- **Petit lot, comparaison CPU/GPU**:  
  `npm run bench:browser-cli -- '?sizes=128,1024&cpuMaxN=1024&rounds=3'`

- **Lot moyen, comparaison CPU/GPU**:  
  `npm run bench:browser-cli -- '?sizes=1024,4096,8192&cpuMaxN=8192&rounds=3'`

- **Lot plus grand, comparaison CPU/GPU si la machine tient**:  
  `npm run bench:browser-cli -- '?sizes=1024,4096,8192,16384&cpuMaxN=16384&rounds=3'`

- **Gros lot, mesure GPU seule**:  
  `npm run bench:browser-cli -- '?sizes=32768,65536,131072&cpuMaxN=0&rounds=5'`

- **Choisir une bucket width fixe**:  
  `npm run bench:browser-cli -- '?sizes=4096,8192&cpuMaxN=8192&rounds=3&bucketWidthBits=10'`

- **Mode interactif avec paramètres**:  
  `npm run bench:browser -- '?sizes=1024,4096&cpuMaxN=4096&rounds=3'`

### Benchmark Query Params

- `sizes`: liste des tailles MSM séparées par des virgules
- `cpuMaxN`: taille maximale pour exécuter la référence CPU
- `rounds`: nombre de runs GPU chauds mesurés
- `bucketWidthBits`: force une bucket width fixe pour tous les cas

# Browser Proving Note

For repeated browser proofs, reuse the same WebGPU device and the same Pippenger MSM runner. The reusable entrypoint is `createPippengerMSMPallasRunner(device, { bucketWidthBits })` in `src/gpu/256bit/pallas/pippenger_msm.ts`.

This avoids rebuilding shader modules, pipelines, bind groups, and large GPU buffers for every MSM invocation, which materially reduces host-side overhead during prover loops.
