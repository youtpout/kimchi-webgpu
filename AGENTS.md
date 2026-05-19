# Kimchi WebGPU Agent Notes

## Goal

This repo can now capture **real Kimchi proving-time MSM datasets**, not only final proof artifacts.

The current working path is:

1. `proof-systems` emits real MSM events from `kimchi/src/prover.rs`
2. `o1js` rebuilds `kimchi-wasm`
3. `kimchi-webgpu` captures those events and writes a bench-ready JSON dataset

## Active Repos

- `~/Projects/proof-systems-gpu`
- `~/Projects/mina`
- `~/Projects/o1js`
- `~/Projects/kimchi-webgpu`

Expected branch for all forks/submodules:

- `gpu-proving`

## Key Files

### Rust proving instrumentation

- `~/Projects/proof-systems-gpu/kimchi/src/prover.rs`
- `~/Projects/mina/src/lib/crypto/proof-systems/kimchi/src/prover.rs`
- `~/Projects/o1js/src/mina/src/lib/crypto/proof-systems/kimchi/src/prover.rs`

These files emit:

- `[o1js gpu-proving] ...` human logs
- `[o1js gpu-proving dataset] {json}` structured MSM events

### Wasm proof entry instrumentation

- `~/Projects/proof-systems-gpu/kimchi-wasm/src/plonk_proof.rs`
- `~/Projects/mina/src/lib/crypto/proof-systems/kimchi-wasm/src/plonk_proof.rs`
- `~/Projects/o1js/src/mina/src/lib/crypto/proof-systems/kimchi-wasm/src/plonk_proof.rs`

These currently include debug logs around:

- `caml_pasta_fp_plonk_proof_create`
- `caml_pasta_fq_plonk_proof_create`

They also currently bypass `run_in_pool()` for debugging by executing the closure directly.

### JS dataset capture

- `src/tools/exportKimchiInternalMsms.ts`
- `src/datasets/kimchiMsmDataset.ts`

This tool captures proving-time MSM datasets from Rust-emitted JSON events and writes:

- `public/datasets/kimchi-internal-msm.json`

## Build Order

If Rust changes in `proof-systems` / `mina` / `o1js`:

```bash
cd /home/eddy/Projects/o1js/src/mina
eval $(opam env)

cd /home/eddy/Projects/o1js
npm run build:bindings-node
npm run build
```

Then rebuild `kimchi-webgpu` implicitly via the capture command.

## Capture Commands

### Real proving-time MSM dataset

```bash
cd /home/eddy/Projects/kimchi-webgpu
npm run capture:kimchi-internal-msm -- ./dist/src/proof/runCounterProof.js public/datasets/kimchi-internal-msm.json
```

### Final proof artifact capture

```bash
cd /home/eddy/Projects/kimchi-webgpu
npm run capture:kimchi-proof -- ./dist/src/proof/runCounterProof.js public/datasets/counter-proof-artifacts.json
```

## Bench Command

```bash
cd /home/eddy/Projects/kimchi-webgpu
npm run bench:browser-cli -- '?dataset=datasets/kimchi-internal-msm.json&rounds=3'
```

## Current Status

- Real proving-time dataset capture works
- Last successful run captured `30` internal Kimchi MSM datasets
- The dataset file is:
  - `public/datasets/kimchi-internal-msm.json`

## Known Caveats

- Do not use `std::time::Instant` inside wasm prover instrumentation here; it panics on this platform
- JS-only pre-reading of witness columns from `proof_create()` caused Rust ownership conflicts and is no longer used
- `kimchi-wasm` debug wrappers in generated artifacts can be overwritten by rebuilds
- `kimchi/Cargo.toml` needs `serde_json` in normal dependencies, not only dev-dependencies

## Recommended Workflow

1. Change durable prover logic in `~/Projects/proof-systems-gpu`
2. Mirror or update submodule state in `~/Projects/mina`
3. Rebuild through `~/Projects/o1js`
4. Capture or benchmark from `~/Projects/kimchi-webgpu`

Do not rely on editing only generated wasm artifacts unless doing temporary debugging.
