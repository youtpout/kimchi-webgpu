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

- **Small batch, CPU/GPU comparison**:  
  `npm run bench:browser-cli -- '?sizes=128,1024&cpuMaxN=1024&rounds=3'`

- **Medium batch, CPU/GPU comparison**:  
  `npm run bench:browser-cli -- '?sizes=1024,4096,8192&cpuMaxN=8192&rounds=3'`

- **Larger batch, CPU/GPU comparison if your machine can handle it**:  
  `npm run bench:browser-cli -- '?sizes=1024,4096,8192,16384&cpuMaxN=16384&rounds=3'`

- **Large batch, GPU-only measurement**:  
  `npm run bench:browser-cli -- '?sizes=32768,65536,131072&cpuMaxN=0&rounds=5'`

- **Use a fixed bucket width**:  
  `npm run bench:browser-cli -- '?sizes=4096,8192&cpuMaxN=8192&rounds=3&bucketWidthBits=10'`

- **Interactive mode with parameters**:  
  `npm run bench:browser -- '?sizes=1024,4096&cpuMaxN=4096&rounds=3'`

- **Replay an exported Kimchi MSM dataset**:  
  `npm run bench:browser-cli -- '?dataset=datasets/kimchi-commit-evals.json&rounds=3'`

### Benchmark Query Params

- `sizes`: comma-separated list of MSM sizes
- `cpuMaxN`: maximum size for running the CPU reference
- `rounds`: number of measured warm GPU runs
- `bucketWidthBits`: forces a fixed bucket width for all cases
- `dataset`: path under `public/` to an exported Kimchi MSM dataset JSON file

## Extract Real Kimchi MSM Datasets

The repository includes a capture tool that instruments `o1js` during proving and dumps real SRS commitment MSM inputs.

- **CLI entrypoint**:  
  `npm run capture:kimchi-msm -- <proving-module> [out-file]`

The proving module must export one of:

- `default`
- `run`
- `main`
- `prove`

That exported function should run your normal `o1js` proving flow. While it runs, the capture tool intercepts real calls to:

- `caml_fp_srs_commit_evaluations(...)`
- `caml_fq_srs_commit_evaluations(...)`

and writes them as replayable MSM datasets.

### Example Capture Flow

1. Create a proving module, for example `scripts/run-my-proof.js`, that generates a real Kimchi proof.
2. Run:

   `npm run capture:kimchi-msm -- ./scripts/run-my-proof.js public/datasets/kimchi-commit-evals.json`

3. Replay the captured datasets in the browser:

   `npm run bench:browser-cli -- '?dataset=datasets/kimchi-commit-evals.json&rounds=3'`

### Important Note About Curves

Real Kimchi prover MSMs can be on either Pasta curve.

- `fp` SRS commitment datasets are exported as `curve: "vesta"`
- `fq` SRS commitment datasets are exported as `curve: "pallas"`

The current GPU replay path in this repository only supports `pallas`. So the capture path is ready for real prover extraction now, but replaying `vesta` datasets on the GPU will require a Vesta backend to be added.

### Counter Example

This repository includes a minimal proving entrypoint for the sample counter contract:

- Proving module: [runCounterProof.ts](/home/eddy/Projects/kimchi-webgpu/src/proof/runCounterProof.ts)

Capture MSM datasets from that proof flow with:

`npm run capture:kimchi-msm -- ./dist/src/proof/runCounterProof.js public/datasets/counter-commit-evals.json`

Replay the exported datasets with:

`npm run bench:browser-cli -- '?dataset=datasets/counter-commit-evals.json&rounds=3'`

# Browser Proving Note

For repeated browser proofs, reuse the same WebGPU device and the same Pippenger MSM runner. The reusable entrypoint is `createPippengerMSMPallasRunner(device, { bucketWidthBits })` in `src/gpu/256bit/pallas/pippenger_msm.ts`.

This avoids rebuilding shader modules, pipelines, bind groups, and large GPU buffers for every MSM invocation, which materially reduces host-side overhead during prover loops.
