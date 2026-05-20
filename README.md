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

- **Inspect and benchmark exported Kimchi proof artifacts**:  
  `npm run bench:browser-cli -- '?proofArtifact=datasets/counter-proof-artifacts.json&rounds=3'`

- **Run real `o1js` proving inside the browser**:  
  `npm run bench:browser-cli -- '?browserProving=counter&rounds=3'`

### Benchmark Query Params

- `sizes`: comma-separated list of MSM sizes
- `cpuMaxN`: maximum size for running the CPU reference
- `rounds`: number of measured warm GPU runs
- `bucketWidthBits`: forces a fixed bucket width for all cases
- `dataset`: path under `public/` to an exported Kimchi MSM dataset JSON file
- `proofArtifact`: path under `public/` to an exported Kimchi proof artifact JSON file
- `browserProving`: run a real browser-side proving flow instead of MSM replay. Current value: `counter`

## Export Real Kimchi Proof Artifacts

The repository includes a capture tool that runs a real `o1js` proving flow and exports the resulting Kimchi proof artifacts in a structured JSON format.

- **CLI entrypoint**:  
  `npm run capture:kimchi-proof -- <proving-module> [out-file]`

- **Backward-compatible alias**:  
  `npm run capture:kimchi-msm -- <proving-module> [out-file]`

The proving module must export one of:

- `default`
- `run`
- `main`
- `prove`

That exported function should run your normal `o1js` proving flow and return the proved transaction, or an object that contains it. The exporter reads the actual `o1js` proof objects from that result and writes:

- witness commitments `w_comm`
- quotient commitments `t_comm`
- permutation commitment `z_comm`
- opening proof pairs `lr`
- opening proof points `delta` and `sg`
- previous recursion challenges
- the serialized proof blob from `o1js`

This is a proof-artifact export path, not an internal prover-MSM hook. It is stable in JS land and gives you real Kimchi proof data you can inspect or transform into replay workloads later.

If `o1js` allows backend proof decoding for the proof shape you returned, the exporter also fills the structured commitment and opening-proof fields. If not, it falls back to a serialized-proof export and records the reason in `metadata.backendProofDecodeError`.

### Example Export Flow

1. Create a proving module, for example `scripts/run-my-proof.js`, that generates a real Kimchi proof and returns the proved transaction.
2. Run:

   `npm run capture:kimchi-proof -- ./scripts/run-my-proof.js public/datasets/kimchi-proof-artifacts.json`

3. Inspect the exported artifact JSON under `public/datasets/`.

### Inspect, Convert, and Replay Proof Artifacts

- **Inspect a captured proof artifact file**:  
  `npm run inspect:kimchi-proof -- public/datasets/counter-proof-artifacts.json`

- **Convert proof artifacts into synthetic replay MSM datasets**:  
  `npm run convert:kimchi-proof-msm -- public/datasets/counter-proof-artifacts.json public/datasets/counter-proof-synthetic-msm.json`

- **Replay the converted synthetic datasets in the browser benchmark**:  
  `npm run bench:browser-cli -- '?dataset=datasets/counter-proof-synthetic-msm.json&rounds=3'`

- **Run the proof-artifact-aware browser benchmark directly**:  
  `npm run bench:browser-cli -- '?proofArtifact=datasets/counter-proof-artifacts.json&rounds=3'`

The converter generates synthetic scalars from the real proof points and the artifact label. This is useful for stressing the GPU MSM pipeline with real Kimchi point sets, but it is not the original proving-time scalar distribution.

## Capture Internal Prover MSMs

The proof-artifact flow above extracts points from the final proof. If you want larger, more prover-like MSM workloads, use the internal capture mode:

- **Capture witness-column commitment MSMs from `proof_create()`**:  
  `npm run capture:kimchi-internal-msm -- ./dist/src/proof/runCounterProof.js public/datasets/kimchi-internal-msm.json`

This mode captures the real proving-time MSM inputs emitted from the low-level Kimchi prover path. The exported dataset contains the actual `points` and `scalars` used by the internal witness-column commitment MSMs.

Important limitations:

- this path is experimental and depends on `o1js` wasm bindings behavior
- it is much closer to real prover MSMs than proof-artifact replay
- if your circuit grows, this is the mode that should produce larger MSM datasets

### Compare CPU Wasm vs WebGPU on Internal Kimchi MSMs

Once `public/datasets/kimchi-internal-msm.json` is exported, generate a CPU wasm baseline:

- **Benchmark the real MSM datasets with CPU wasm and export the results**:  
  `npm run bench:kimchi-cpu-msm -- public/datasets/kimchi-internal-msm.json --backend=wasm --rounds=3 --cpuMaxN=8192 --out=public/datasets/kimchi-internal-msm-cpu-results.json`

Then replay the same datasets in the browser and compare against that CPU baseline:

- **Benchmark WebGPU and compare correctness + speedup against CPU wasm**:  
  `npm run bench:browser-cli -- '?dataset=datasets/kimchi-internal-msm.json&cpuResults=datasets/kimchi-internal-msm-cpu-results.json&rounds=3'`

This browser benchmark will report, for each dataset:

- the CPU wasm cold and warm timings
- the GPU cold and warm timings
- whether the CPU and GPU MSM results match
- the `Speedup CPU/GPU cold` and `Speedup CPU/GPU warm median` ratios

## Real Browser Proving

To benchmark actual `o1js` proving in browser conditions, use the browser proving mode:

- **Headless browser proving**:  
  `npm run bench:browser-cli -- '?browserProving=counter&rounds=3'`

- **Interactive browser proving**:  
  `npm run bench:browser -- '?browserProving=counter&rounds=3'`

This runs the real `runCounterProof()` flow inside Brave, not in Node. The output reports:

- `setup_total_ms`
- `cold_prove_ms`
- per-round `warm_prove_round`
- `warm_prove_median_ms`

Current proving target:

- `counter` -> [runCounterProof.ts](/home/eddy/Projects/kimchi-webgpu/src/proof/runCounterProof.ts)

Implementation note:

- this mode serves the real `o1js` web build from `/o1js/index.js`
- and loads the compiled browser entry from `/dist/src/browser-proving/counter-browser.js`
- it does not bundle the zkApp contract into the benchmark bundle

### Probe Low-Level Kimchi Runtime Calls

Before patching deeper, you can probe which low-level wasm entrypoints are actually hit during proving:

- **Runtime probe**:  
  `npm run probe:kimchi-runtime -- ./dist/src/proof/runCounterProof.js public/datasets/kimchi-runtime-probe.json`

The probe wraps these candidate functions when they exist:

- `caml_pasta_fp_plonk_proof_create`
- `caml_pasta_fq_plonk_proof_create`
- `caml_fp_srs_commit_evaluations`
- `caml_fq_srs_commit_evaluations`
- `caml_fp_srs_b_poly_commitment`
- `caml_fq_srs_b_poly_commitment`
- `caml_fp_srs_batch_accumulator_generate`
- `caml_fq_srs_batch_accumulator_generate`
- `caml_fp_srs_add_lagrange_basis`
- `caml_fq_srs_add_lagrange_basis`

It probes all three JS-visible layers:

- `kimchi_wasm.cjs`
- `plonk_wasm.cjs`
- the live `bindings.wasm` object after `initializeBindings()`

Use it to decide the next step:

- if `proof_create` or `commit_evaluations` calls appear in the report, JS-level interception is still viable
- if the report stays empty while proving succeeds, the real prover path is bypassing the JS wrappers we can patch here, so extracting true internal MSMs will require a lower-level Kimchi/Rust patch outside this repository

### Important Note About Curves

The proof-artifact parser now detects the actual curve used by the extracted points. In the current `o1js` zkApp proof flow tested here, those replayable proof points were detected as `pallas`, and the browser MSM replay path supports both `pallas` and `vesta`.

### Counter Example

This repository includes a minimal proving entrypoint for the sample counter contract:

- Proving module: [runCounterProof.ts](/home/eddy/Projects/kimchi-webgpu/src/proof/runCounterProof.ts)

Export proof artifacts from that proof flow with:

`npm run capture:kimchi-proof -- ./dist/src/proof/runCounterProof.js public/datasets/counter-proof-artifacts.json`

The proving entrypoint returns the proved `incrementTx`, so the exporter can read the generated proof objects directly.

Inspect the result with:

`npm run inspect:kimchi-proof -- public/datasets/counter-proof-artifacts.json`

Convert it into replay datasets with:

`npm run convert:kimchi-proof-msm -- public/datasets/counter-proof-artifacts.json public/datasets/counter-proof-synthetic-msm.json`

# Browser Proving Note

For repeated browser proofs, reuse the same WebGPU device and the same Pippenger MSM runner. The reusable entrypoint is `createPippengerMSMPallasRunner(device, { bucketWidthBits })` in `src/gpu/256bit/pallas/pippenger_msm.ts`.

This avoids rebuilding shader modules, pipelines, bind groups, and large GPU buffers for every MSM invocation, which materially reduces host-side overhead during prover loops.
