import {
    pippengerShaderPassAProjectiveConversion as ShaderPassA,
    pippengerShaderPassBi1BucketScalarWeightedPointContribution as ShaderPassBi1,
    pippengerShaderPassBi2TreeReduceBucket as ShaderPassBi2,
    pippengerShaderPassCBucketAggregation as ShaderPassC,
    pippengerShaderPassDTreeReduceFinalPoint as ShaderPassD,
    pippengerShaderPassEFinalAccumulation as ShaderPassE,
    pippengerShaderPassHorner as ShaderPassHorner,
} from './pippenger_msm.wgslc.js';
import {
    bigint256ToLimbs,
    limbs256ToBigint,
    BYTES_PER_ELEMENT_256,
    LIMBS_PER_ELEMENT_256,
} from '../helpers.js';
import { Point } from '../../../types/point.js';

const WORKGROUP_SIZE_A = 64;
const WORKGROUP_SIZE_Bi1 = 64;
const WORKGROUP_SIZE_Bi2 = 64;
const WORKGROUP_SIZE_C = 64;
const WORKGROUP_SIZE_D = 64;
const WORKGROUP_SIZE_E = 64;

const SCALAR_BITS = 256;

export interface PippengerMSMConfig {
    bucketWidthBits?: number;
    verbose?: boolean;
}

export async function pippengerMSMPallas(
    device: GPUDevice,
    scalars: bigint[],
    P: Point[],
    config?: PippengerMSMConfig
): Promise<Point> {
    const n = scalars.length;
    if (n === 0) throw new Error('scalars and points arrays cannot be empty');
    if (P.length !== n) throw new Error('scalars and points must have same length');

    const BUCKET_WIDTH_BITS = config?.bucketWidthBits ?? 8;
    if (BUCKET_WIDTH_BITS < 1 || BUCKET_WIDTH_BITS > 22)
        throw new Error('bucketWidthBits must be 1–22');

    const NUMBER_OF_BUCKETS = 1 << BUCKET_WIDTH_BITS;
    const NUM_WINDOWS = Math.ceil(SCALAR_BITS / BUCKET_WIDTH_BITS);
    const verbose = config?.verbose ?? true;

    const maxBufferSize = device.limits.maxStorageBufferBindingSize;
    const MAX_WORKGROUPS = 65535;
    const maxChunkN = Math.min(
        Math.floor(maxBufferSize / BYTES_PER_ELEMENT_256),
        MAX_WORKGROUPS * WORKGROUP_SIZE_Bi1
    );
    const numBatches = Math.ceil(n / maxChunkN);

    if (verbose) {
        console.log('=== Pippenger MSM Configuration ===');
        console.log(`Total points:         ${n}`);
        console.log(`Bucket width (bits):  ${BUCKET_WIDTH_BITS}`);
        console.log(`Number of buckets:    ${NUMBER_OF_BUCKETS}`);
        console.log(`Number of windows:    ${NUM_WINDOWS}`);
        console.log(`Max points per batch: ${maxChunkN}`);
        console.log(`Number of batches:    ${numBatches}`);
        console.log('===================================');
    }

    let passCountA = 0, passCountBi1 = 0, passCountBi2 = 0;
    let passCountC = 0, passCountD = 0, passCountHorner = 0, passCountE = 0;

    // ---- Bind-group layouts ----

    const layoutPassA = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // x
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // y
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // Px
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // Py
            { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } }, // Pz
            { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }, // n
        ],
    });

    // Bi_1 group 0: BUCKET_WIDTH_BITS (binding 0) + window_idx (binding 1)
    const layoutBi1Params = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        ],
    });

    // Shared single-uniform layout (bucket_idx for Bi_1/Bi_2 group 1)
    const layoutUniformSingle = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        ],
    });

    const layoutPassBi1_Input = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // k
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // PPx
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // PPy
            { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } }, // PPz
        ],
    });

    const layoutWGG = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        ],
    });

    // Bi_2 group 0: struct { n, window_idx, number_of_buckets }
    const layoutBi2Uniforms = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        ],
    });

    const layoutBucketsStorage = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        ],
    });

    // Pass C group 0: struct { window_idx, number_of_buckets }
    const layoutCUniforms = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        ],
    });

    const layoutFStorage = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        ],
    });

    const layoutUniformN_BatchIdx = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        ],
    });

    const layoutBatchFinalPoints = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        ],
    });

    // Horner group 0: struct { num_windows, bucket_width_bits, batch_idx }
    const layoutHornerUniforms = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
        ],
    });

    // Horner groups 1 and 2 reuse layoutFStorage / layoutBatchFinalPoints.

    const layoutFinalPoint = device.createBindGroupLayout({
        entries: [
            { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
        ],
    });

    // ---- Shader modules & pipelines ----

    const shaderModules = {
        A: device.createShaderModule({ code: ShaderPassA }),
        Bi1: device.createShaderModule({ code: ShaderPassBi1 }),
        Bi2: device.createShaderModule({ code: ShaderPassBi2 }),
        C: device.createShaderModule({ code: ShaderPassC }),
        D: device.createShaderModule({ code: ShaderPassD }),
        E: device.createShaderModule({ code: ShaderPassE }),
        Horner: device.createShaderModule({ code: ShaderPassHorner }),
    };

    const pipelineA = device.createComputePipeline({
        layout: device.createPipelineLayout({ bindGroupLayouts: [layoutPassA] }),
        compute: { module: shaderModules.A, entryPoint: 'main' },
    });

    const pipelineBi1 = device.createComputePipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [layoutBi1Params, layoutUniformSingle, layoutPassBi1_Input, layoutWGG],
        }),
        compute: { module: shaderModules.Bi1, entryPoint: 'main' },
    });

    const pipelineBi2 = device.createComputePipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [layoutBi2Uniforms, layoutUniformSingle, layoutWGG, layoutBucketsStorage],
        }),
        compute: { module: shaderModules.Bi2, entryPoint: 'main' },
    });

    const pipelineC = device.createComputePipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [layoutCUniforms, layoutBucketsStorage, layoutFStorage],
        }),
        compute: { module: shaderModules.C, entryPoint: 'main' },
    });

    const pipelineD = device.createComputePipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [layoutUniformN_BatchIdx, layoutFStorage, layoutBatchFinalPoints],
        }),
        compute: { module: shaderModules.D, entryPoint: 'main' },
    });

    const pipelineE = device.createComputePipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [layoutUniformSingle, layoutBatchFinalPoints, layoutFinalPoint],
        }),
        compute: { module: shaderModules.E, entryPoint: 'main' },
    });

    const pipelineHorner = device.createComputePipeline({
        layout: device.createPipelineLayout({
            bindGroupLayouts: [layoutHornerUniforms, layoutFStorage, layoutBatchFinalPoints],
        }),
        compute: { module: shaderModules.Horner, entryPoint: 'main' },
    });

    // ---- Persistent GPU buffers ----

    // B buffers: NUM_WINDOWS * NUMBER_OF_BUCKETS (flat 2-D: B[w * NB + v])
    const bBufferSize = NUM_WINDOWS * NUMBER_OF_BUCKETS * BYTES_PER_ELEMENT_256;
    const BxBuffer = device.createBuffer({ size: bBufferSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const ByBuffer = device.createBuffer({ size: bBufferSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const BzBuffer = device.createBuffer({ size: bBufferSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });

    // F_windows: one point per window (Pass D → F_windows[windowIdx])
    const fWindowsXBuffer = device.createBuffer({ size: NUM_WINDOWS * BYTES_PER_ELEMENT_256, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const fWindowsYBuffer = device.createBuffer({ size: NUM_WINDOWS * BYTES_PER_ELEMENT_256, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const fWindowsZBuffer = device.createBuffer({ size: NUM_WINDOWS * BYTES_PER_ELEMENT_256, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });

    const batchFinalPointsSize = Math.max(numBatches * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
    const batchFinalPointsXBuffer = device.createBuffer({ size: batchFinalPointsSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const batchFinalPointsYBuffer = device.createBuffer({ size: batchFinalPointsSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const batchFinalPointsZBuffer = device.createBuffer({ size: batchFinalPointsSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });

    const finalPointXBuffer = device.createBuffer({ size: BYTES_PER_ELEMENT_256, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const finalPointYBuffer = device.createBuffer({ size: BYTES_PER_ELEMENT_256, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });

    const finalPointXStagingBuffer = device.createBuffer({ size: BYTES_PER_ELEMENT_256, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });
    const finalPointYStagingBuffer = device.createBuffer({ size: BYTES_PER_ELEMENT_256, usage: GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST });

    // ---- Uniform buffers (created once, updated via writeBuffer) ----

    const u32Size = 4;

    // Bi_1 group 0: BUCKET_WIDTH_BITS (constant) + window_idx (updated per window)
    const bi1BucketWidthBitsBuffer = device.createBuffer({
        size: u32Size, usage: GPUBufferUsage.UNIFORM, mappedAtCreation: true,
    });
    new Uint32Array(bi1BucketWidthBitsBuffer.getMappedRange()).set([BUCKET_WIDTH_BITS]);
    bi1BucketWidthBitsBuffer.unmap();

    const bi1WindowIdxBuffer = device.createBuffer({ size: u32Size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    // Bi_1 / Bi_2 shared bucket_idx uniform (group 1)
    const bucketIdxUniform = device.createBuffer({ size: u32Size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    // Bi_2 group 0 struct: { n, window_idx, number_of_buckets } — 3 × u32, padded to 16 bytes
    const bi2UniformsBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    // Pass A n uniform
    const passA_N_Uniform = device.createBuffer({ size: u32Size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    // Pass C group 0 struct: { window_idx, number_of_buckets } — padded to 8 bytes
    const cUniformsBuffer = device.createBuffer({ size: 8, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    // Pass D uniforms (n, batchIdx)
    const passD_N_Uniform = device.createBuffer({ size: u32Size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });
    const passD_batchIdxUniform = device.createBuffer({ size: u32Size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    // Pass E n uniform
    const passE_N_Uniform = device.createBuffer({ size: u32Size, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    // Horner uniforms struct: { num_windows, bucket_width_bits, batch_idx } — padded to 16 bytes
    const hornerUniformsBuffer = device.createBuffer({ size: 16, usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST });

    // ---- Per-batch reusable input/output GPU buffers ----

    const perBatchBufferSize = maxChunkN * BYTES_PER_ELEMENT_256;
    const kBuffer = device.createBuffer({ size: perBatchBufferSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const PxBuffer = device.createBuffer({ size: perBatchBufferSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const PyBuffer = device.createBuffer({ size: perBatchBufferSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST });
    const PPxBuffer = device.createBuffer({ size: perBatchBufferSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const PPyBuffer = device.createBuffer({ size: perBatchBufferSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const PPzBuffer = device.createBuffer({ size: perBatchBufferSize, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });

    const maxNumWorkgroupsBi1 = Math.ceil(maxChunkN / WORKGROUP_SIZE_Bi1);
    const wggSizeMax = maxNumWorkgroupsBi1 * BYTES_PER_ELEMENT_256;
    const WGGxBuffer = device.createBuffer({ size: wggSizeMax, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const WGGyBuffer = device.createBuffer({ size: wggSizeMax, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const WGGzBuffer = device.createBuffer({ size: wggSizeMax, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });

    const maxNumWorkgroupsC = Math.ceil(NUMBER_OF_BUCKETS / WORKGROUP_SIZE_C);
    const fBufferSizeMax = maxNumWorkgroupsC * BYTES_PER_ELEMENT_256;
    const FxBuffer = device.createBuffer({ size: fBufferSizeMax, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const FyBuffer = device.createBuffer({ size: fBufferSizeMax, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });
    const FzBuffer = device.createBuffer({ size: fBufferSizeMax, usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC });

    // ---- Bind groups (created once, reused across dispatches) ----

    const bindGroupPassA = device.createBindGroup({
        layout: layoutPassA,
        entries: [
            { binding: 0, resource: { buffer: PxBuffer } },
            { binding: 1, resource: { buffer: PyBuffer } },
            { binding: 2, resource: { buffer: PPxBuffer } },
            { binding: 3, resource: { buffer: PPyBuffer } },
            { binding: 4, resource: { buffer: PPzBuffer } },
            { binding: 5, resource: { buffer: passA_N_Uniform } },
        ],
    });

    const bindGroupBi1Params = device.createBindGroup({
        layout: layoutBi1Params,
        entries: [
            { binding: 0, resource: { buffer: bi1BucketWidthBitsBuffer } },
            { binding: 1, resource: { buffer: bi1WindowIdxBuffer } },
        ],
    });

    const bindGroupBucketIdx = device.createBindGroup({
        layout: layoutUniformSingle,
        entries: [{ binding: 0, resource: { buffer: bucketIdxUniform } }],
    });

    const bindGroupPassBi1_Input = device.createBindGroup({
        layout: pipelineBi1.getBindGroupLayout(2),
        entries: [
            { binding: 0, resource: { buffer: kBuffer } },
            { binding: 1, resource: { buffer: PPxBuffer } },
            { binding: 2, resource: { buffer: PPyBuffer } },
            { binding: 3, resource: { buffer: PPzBuffer } },
        ],
    });

    const bindGroupWGG = device.createBindGroup({
        layout: layoutWGG,
        entries: [
            { binding: 0, resource: { buffer: WGGxBuffer } },
            { binding: 1, resource: { buffer: WGGyBuffer } },
            { binding: 2, resource: { buffer: WGGzBuffer } },
        ],
    });

    const bindGroupBi2Uniforms = device.createBindGroup({
        layout: layoutBi2Uniforms,
        entries: [{ binding: 0, resource: { buffer: bi2UniformsBuffer } }],
    });

    const bindGroupBucketsStorage = device.createBindGroup({
        layout: layoutBucketsStorage,
        entries: [
            { binding: 0, resource: { buffer: BxBuffer } },
            { binding: 1, resource: { buffer: ByBuffer } },
            { binding: 2, resource: { buffer: BzBuffer } },
        ],
    });

    const bindGroupCUniforms = device.createBindGroup({
        layout: layoutCUniforms,
        entries: [{ binding: 0, resource: { buffer: cUniformsBuffer } }],
    });

    const bindGroupFStorage = device.createBindGroup({
        layout: layoutFStorage,
        entries: [
            { binding: 0, resource: { buffer: FxBuffer } },
            { binding: 1, resource: { buffer: FyBuffer } },
            { binding: 2, resource: { buffer: FzBuffer } },
        ],
    });

    const bindGroupPassD_Uniforms = device.createBindGroup({
        layout: layoutUniformN_BatchIdx,
        entries: [
            { binding: 0, resource: { buffer: passD_N_Uniform } },
            { binding: 1, resource: { buffer: passD_batchIdxUniform } },
        ],
    });

    // Pass D writing to F_windows (for per-window reduction)
    const bindGroupFWindowsOutput = device.createBindGroup({
        layout: layoutBatchFinalPoints,
        entries: [
            { binding: 0, resource: { buffer: fWindowsXBuffer } },
            { binding: 1, resource: { buffer: fWindowsYBuffer } },
            { binding: 2, resource: { buffer: fWindowsZBuffer } },
        ],
    });

    // Pass D writing to batch_final_points (for multi-batch Horner results after Pass E)
    const bindGroupBatchFinalPoints = device.createBindGroup({
        layout: layoutBatchFinalPoints,
        entries: [
            { binding: 0, resource: { buffer: batchFinalPointsXBuffer } },
            { binding: 1, resource: { buffer: batchFinalPointsYBuffer } },
            { binding: 2, resource: { buffer: batchFinalPointsZBuffer } },
        ],
    });

    const bindGroupHornerUniforms = device.createBindGroup({
        layout: layoutHornerUniforms,
        entries: [{ binding: 0, resource: { buffer: hornerUniformsBuffer } }],
    });

    // Horner reads from F_windows
    const bindGroupFWindowsInput = device.createBindGroup({
        layout: layoutFStorage,
        entries: [
            { binding: 0, resource: { buffer: fWindowsXBuffer } },
            { binding: 1, resource: { buffer: fWindowsYBuffer } },
            { binding: 2, resource: { buffer: fWindowsZBuffer } },
        ],
    });

    const bindGroupPassE_N = device.createBindGroup({
        layout: layoutUniformSingle,
        entries: [{ binding: 0, resource: { buffer: passE_N_Uniform } }],
    });

    const bindGroupFinalPoint = device.createBindGroup({
        layout: layoutFinalPoint,
        entries: [
            { binding: 0, resource: { buffer: finalPointXBuffer } },
            { binding: 1, resource: { buffer: finalPointYBuffer } },
        ],
    });

    // ---- Main computation loop ----

    let commandEncoder = device.createCommandEncoder();

    for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
        const batchOffset = batchIdx * maxChunkN;
        const currentBatchN = Math.min(n - batchOffset, maxChunkN);

        if (verbose)
            console.log(`Batch ${batchIdx + 1}/${numBatches} (${currentBatchN} points)`);

        // Upload input data for this batch
        const kArr = new Uint32Array(currentBatchN * LIMBS_PER_ELEMENT_256);
        const PxArr = new Uint32Array(currentBatchN * LIMBS_PER_ELEMENT_256);
        const PyArr = new Uint32Array(currentBatchN * LIMBS_PER_ELEMENT_256);
        for (let i = 0; i < currentBatchN; i++) {
            const g = batchOffset + i;
            kArr.set(bigint256ToLimbs(scalars[g]), i * LIMBS_PER_ELEMENT_256);
            PxArr.set(bigint256ToLimbs(P[g].x), i * LIMBS_PER_ELEMENT_256);
            PyArr.set(bigint256ToLimbs(P[g].y), i * LIMBS_PER_ELEMENT_256);
        }
        device.queue.writeBuffer(kBuffer, 0, kArr);
        device.queue.writeBuffer(PxBuffer, 0, PxArr);
        device.queue.writeBuffer(PyBuffer, 0, PyArr);
        device.queue.writeBuffer(passA_N_Uniform, 0, new Uint32Array([currentBatchN]));

        // Pass A: affine → projective (Montgomery form)
        {
            const numWG = Math.ceil(currentBatchN / WORKGROUP_SIZE_A);
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(pipelineA);
            pass.setBindGroup(0, bindGroupPassA);
            pass.dispatchWorkgroups(numWG);
            pass.end();
            passCountA++;
        }

        const numWorkgroupsBi1 = Math.ceil(currentBatchN / WORKGROUP_SIZE_Bi1);

        // For each window, for each non-zero bucket value:
        //   Pass Bi_1: gather points matching (window, bucketValue) into WGG
        //   Pass Bi_2: reduce WGG → B[window * NB + bucketValue]
        for (let windowIdx = 0; windowIdx < NUM_WINDOWS; windowIdx++) {
            device.queue.writeBuffer(bi1WindowIdxBuffer, 0, new Uint32Array([windowIdx]));

            for (let bucketValue = 1; bucketValue < NUMBER_OF_BUCKETS; bucketValue++) {
                device.queue.writeBuffer(bucketIdxUniform, 0, new Uint32Array([bucketValue]));

                // Pass Bi_1
                {
                    const pass = commandEncoder.beginComputePass();
                    pass.setPipeline(pipelineBi1);
                    pass.setBindGroup(0, bindGroupBi1Params);
                    pass.setBindGroup(1, bindGroupBucketIdx);
                    pass.setBindGroup(2, bindGroupPassBi1_Input);
                    pass.setBindGroup(3, bindGroupWGG);
                    pass.dispatchWorkgroups(numWorkgroupsBi1);
                    pass.end();
                    passCountBi1++;
                }

                // Pass Bi_2: tree-reduce WGG → B[windowIdx * NB + bucketValue]
                let currentN_Bi2 = numWorkgroupsBi1;
                while (currentN_Bi2 >= 1) {
                    device.queue.writeBuffer(bi2UniformsBuffer, 0,
                        new Uint32Array([currentN_Bi2, windowIdx, NUMBER_OF_BUCKETS, 0 /* padding */]));

                    const numWG = Math.ceil(currentN_Bi2 / WORKGROUP_SIZE_Bi2);
                    const pass = commandEncoder.beginComputePass();
                    pass.setPipeline(pipelineBi2);
                    pass.setBindGroup(0, bindGroupBi2Uniforms);
                    pass.setBindGroup(1, bindGroupBucketIdx);
                    pass.setBindGroup(2, bindGroupWGG);
                    pass.setBindGroup(3, bindGroupBucketsStorage);
                    pass.dispatchWorkgroups(numWG);
                    pass.end();
                    passCountBi2++;

                    if (currentN_Bi2 <= WORKGROUP_SIZE_Bi2) break;
                    currentN_Bi2 = Math.ceil(currentN_Bi2 / WORKGROUP_SIZE_Bi2);
                }

                // Submit after each (window, bucket) to guarantee ordering.
                device.queue.submit([commandEncoder.finish()]);
                commandEncoder = device.createCommandEncoder();
            }

            // Pass C: weight each bucket v by its value v, partial tree-reduce → F
            device.queue.writeBuffer(cUniformsBuffer, 0,
                new Uint32Array([windowIdx, NUMBER_OF_BUCKETS]));

            {
                const numWG = Math.ceil(NUMBER_OF_BUCKETS / WORKGROUP_SIZE_C);
                const pass = commandEncoder.beginComputePass();
                pass.setPipeline(pipelineC);
                pass.setBindGroup(0, bindGroupCUniforms);
                pass.setBindGroup(1, bindGroupBucketsStorage);
                pass.setBindGroup(2, bindGroupFStorage);
                pass.dispatchWorkgroups(numWG);
                pass.end();
                passCountC++;
            }

            // Pass D: reduce F → F_windows[windowIdx]
            // Reuse Pass D shader with F_windows bound as the "batch_final_points" output.
            let currentN_D = maxNumWorkgroupsC;
            while (currentN_D >= 1) {
                device.queue.writeBuffer(passD_N_Uniform, 0, new Uint32Array([currentN_D]));
                device.queue.writeBuffer(passD_batchIdxUniform, 0, new Uint32Array([windowIdx]));

                const numWG = Math.ceil(currentN_D / WORKGROUP_SIZE_D);
                const pass = commandEncoder.beginComputePass();
                pass.setPipeline(pipelineD);
                pass.setBindGroup(0, bindGroupPassD_Uniforms);
                pass.setBindGroup(1, bindGroupFStorage);
                pass.setBindGroup(2, bindGroupFWindowsOutput); // writes to fWindows[windowIdx]
                pass.dispatchWorkgroups(numWG);
                pass.end();
                passCountD++;

                if (currentN_D <= WORKGROUP_SIZE_D) break;
                currentN_D = Math.ceil(currentN_D / WORKGROUP_SIZE_D);
            }

            device.queue.submit([commandEncoder.finish()]);
            commandEncoder = device.createCommandEncoder();
        }

        // Pass Horner: Horner-combine F_windows[0..NUM_WINDOWS-1] → batch_final_points[batchIdx]
        device.queue.writeBuffer(hornerUniformsBuffer, 0,
            new Uint32Array([NUM_WINDOWS, BUCKET_WIDTH_BITS, batchIdx, 0 /* padding */]));

        {
            const pass = commandEncoder.beginComputePass();
            pass.setPipeline(pipelineHorner);
            pass.setBindGroup(0, bindGroupHornerUniforms);
            pass.setBindGroup(1, bindGroupFWindowsInput);
            pass.setBindGroup(2, bindGroupBatchFinalPoints);
            pass.dispatchWorkgroups(1);
            pass.end();
            passCountHorner++;
        }

        device.queue.submit([commandEncoder.finish()]);
        commandEncoder = device.createCommandEncoder();
    }

    // Pass E: accumulate all batch final points → final affine point
    let currentN_E = numBatches;
    while (currentN_E >= 1) {
        device.queue.writeBuffer(passE_N_Uniform, 0, new Uint32Array([currentN_E]));

        const pass = commandEncoder.beginComputePass();
        pass.setPipeline(pipelineE);
        pass.setBindGroup(0, bindGroupPassE_N);
        pass.setBindGroup(1, bindGroupBatchFinalPoints);
        pass.setBindGroup(2, bindGroupFinalPoint);
        pass.dispatchWorkgroups(Math.ceil(currentN_E / WORKGROUP_SIZE_E));
        pass.end();
        passCountE++;

        if (currentN_E <= WORKGROUP_SIZE_E) break;
        currentN_E = Math.ceil(currentN_E / WORKGROUP_SIZE_E);
    }

    commandEncoder.copyBufferToBuffer(finalPointXBuffer, 0, finalPointXStagingBuffer, 0, BYTES_PER_ELEMENT_256);
    commandEncoder.copyBufferToBuffer(finalPointYBuffer, 0, finalPointYStagingBuffer, 0, BYTES_PER_ELEMENT_256);

    if (verbose) {
        console.log(`\n--- Dispatches per Stage ---`);
        console.log(`Pass A:      ${passCountA}`);
        console.log(`Pass Bi1:    ${passCountBi1}`);
        console.log(`Pass Bi2:    ${passCountBi2}`);
        console.log(`Pass C:      ${passCountC}`);
        console.log(`Pass D:      ${passCountD}`);
        console.log(`Pass Horner: ${passCountHorner}`);
        console.log(`Pass E:      ${passCountE}`);
        console.log(`TOTAL:       ${passCountA + passCountBi1 + passCountBi2 + passCountC + passCountD + passCountHorner + passCountE}`);
        console.log('============================\n');
    }

    device.queue.submit([commandEncoder.finish()]);
    await device.queue.onSubmittedWorkDone();

    await finalPointXStagingBuffer.mapAsync(GPUMapMode.READ);
    await finalPointYStagingBuffer.mapAsync(GPUMapMode.READ);

    const xView = new Uint32Array(finalPointXStagingBuffer.getMappedRange()).slice();
    const yView = new Uint32Array(finalPointYStagingBuffer.getMappedRange()).slice();

    finalPointXStagingBuffer.unmap();
    finalPointYStagingBuffer.unmap();

    return { x: limbs256ToBigint(xView), y: limbs256ToBigint(yView) };
}
