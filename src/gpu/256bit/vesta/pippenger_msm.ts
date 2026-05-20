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
    writeBigint256ToLimbs,
    limbs256ToBigint,
    BYTES_PER_ELEMENT_256,
    LIMBS_PER_ELEMENT_256,
} from '../helpers.js';
import { Point } from '../../../types/point.js';

const WORKGROUP_SIZE_A = 64;
const WORKGROUP_SIZE_BI1 = 64;
const WORKGROUP_SIZE_BI2 = 64;
const WORKGROUP_SIZE_C = 64;
const WORKGROUP_SIZE_D = 64;
const WORKGROUP_SIZE_E = 64;
const SCALAR_BITS = 256;

const runnerCache = new WeakMap<GPUDevice, Map<number, PippengerMSMVestaRunner>>();

export interface PippengerMSMConfig {
    bucketWidthBits?: number;
    verbose?: boolean;
}

export interface PippengerMSMJob {
    scalars: bigint[];
    points: Point[];
    label?: string;
}

function normalizeBucketWidthBits(config?: PippengerMSMConfig): number {
    const bucketWidthBits = config?.bucketWidthBits ?? 8;
    if (bucketWidthBits < 1 || bucketWidthBits > 22) {
        throw new Error('bucketWidthBits must be 1–22');
    }
    return bucketWidthBits;
}

export function createPippengerMSMVestaRunner(
    device: GPUDevice,
    config?: PippengerMSMConfig
): PippengerMSMVestaRunner {
    const bucketWidthBits = normalizeBucketWidthBits(config);
    let runnersByBucketWidth = runnerCache.get(device);

    if (!runnersByBucketWidth) {
        runnersByBucketWidth = new Map();
        runnerCache.set(device, runnersByBucketWidth);
    }

    let runner = runnersByBucketWidth.get(bucketWidthBits);
    if (!runner) {
        runner = new PippengerMSMVestaRunner(device, bucketWidthBits);
        runnersByBucketWidth.set(bucketWidthBits, runner);
    }

    return runner;
}

export async function pippengerMSMVesta(
    device: GPUDevice,
    scalars: bigint[],
    points: Point[],
    config?: PippengerMSMConfig
): Promise<Point> {
    const runner = createPippengerMSMVestaRunner(device, config);
    return runner.run(scalars, points, config);
}

export class PippengerMSMVestaRunner {
    readonly device: GPUDevice;
    readonly bucketWidthBits: number;
    readonly numberOfBuckets: number;
    readonly numWindows: number;
    readonly maxChunkN: number;
    readonly maxNumWorkgroupsBi1: number;
    readonly maxNumWorkgroupsC: number;

    private readonly kHost: Uint32Array;
    private readonly pxHost: Uint32Array;
    private readonly pyHost: Uint32Array;

    private readonly layoutPassA: GPUBindGroupLayout;
    private readonly layoutBi1Params: GPUBindGroupLayout;
    private readonly layoutUniformSingle: GPUBindGroupLayout;
    private readonly layoutWGG: GPUBindGroupLayout;
    private readonly layoutBi2Uniforms: GPUBindGroupLayout;
    private readonly layoutBucketsStorage: GPUBindGroupLayout;
    private readonly layoutCUniforms: GPUBindGroupLayout;
    private readonly layoutFStorage: GPUBindGroupLayout;
    private readonly layoutUniformNBatchIdx: GPUBindGroupLayout;
    private readonly layoutBatchFinalPoints: GPUBindGroupLayout;
    private readonly layoutHornerUniforms: GPUBindGroupLayout;
    private readonly layoutFinalPoint: GPUBindGroupLayout;

    private readonly pipelineA: GPUComputePipeline;
    private readonly pipelineBi1: GPUComputePipeline;
    private readonly pipelineBi2: GPUComputePipeline;
    private readonly pipelineC: GPUComputePipeline;
    private readonly pipelineD: GPUComputePipeline;
    private readonly pipelineE: GPUComputePipeline;
    private readonly pipelineHorner: GPUComputePipeline;

    private readonly bXBuffer: GPUBuffer;
    private readonly bYBuffer: GPUBuffer;
    private readonly bZBuffer: GPUBuffer;
    private readonly fWindowsXBuffer: GPUBuffer;
    private readonly fWindowsYBuffer: GPUBuffer;
    private readonly fWindowsZBuffer: GPUBuffer;
    private readonly finalPointXBuffer: GPUBuffer;
    private readonly finalPointYBuffer: GPUBuffer;
    private readonly finalPointXStagingBuffer: GPUBuffer;
    private readonly finalPointYStagingBuffer: GPUBuffer;

    private readonly bi1BucketWidthBitsBuffer: GPUBuffer;
    private readonly bi1WindowIdxBuffer: GPUBuffer;
    private readonly bucketIdxUniform: GPUBuffer;
    private readonly bi2UniformsBuffer: GPUBuffer;
    private readonly passANUniform: GPUBuffer;
    private readonly cUniformsBuffer: GPUBuffer;
    private readonly passDNUniform: GPUBuffer;
    private readonly passDBatchIdxUniform: GPUBuffer;
    private readonly passENUniform: GPUBuffer;
    private readonly hornerUniformsBuffer: GPUBuffer;

    private readonly kBuffer: GPUBuffer;
    private readonly pxBuffer: GPUBuffer;
    private readonly pyBuffer: GPUBuffer;
    private readonly ppxBuffer: GPUBuffer;
    private readonly ppyBuffer: GPUBuffer;
    private readonly ppzBuffer: GPUBuffer;
    private readonly wggXBuffer: GPUBuffer;
    private readonly wggYBuffer: GPUBuffer;
    private readonly wggZBuffer: GPUBuffer;
    private readonly fXBuffer: GPUBuffer;
    private readonly fYBuffer: GPUBuffer;
    private readonly fZBuffer: GPUBuffer;

    private readonly bindGroupPassA: GPUBindGroup;
    private readonly bindGroupBi1Params: GPUBindGroup;
    private readonly bindGroupBucketIdx: GPUBindGroup;
    private readonly bindGroupPassBi1Input: GPUBindGroup;
    private readonly bindGroupWGG: GPUBindGroup;
    private readonly bindGroupBi2Uniforms: GPUBindGroup;
    private readonly bindGroupBucketsStorage: GPUBindGroup;
    private readonly bindGroupCUniforms: GPUBindGroup;
    private readonly bindGroupFStorage: GPUBindGroup;
    private readonly bindGroupPassDUniforms: GPUBindGroup;
    private readonly bindGroupFWindowsOutput: GPUBindGroup;
    private readonly bindGroupHornerUniforms: GPUBindGroup;
    private readonly bindGroupFWindowsInput: GPUBindGroup;
    private readonly bindGroupPassEN: GPUBindGroup;
    private readonly bindGroupFinalPoint: GPUBindGroup;

    private batchFinalPointsCapacity = 0;
    private batchFinalPointsXBuffer!: GPUBuffer;
    private batchFinalPointsYBuffer!: GPUBuffer;
    private batchFinalPointsZBuffer!: GPUBuffer;
    private bindGroupBatchFinalPoints!: GPUBindGroup;
    private multiResultCapacity = 0;
    private multiResultXBuffer!: GPUBuffer;
    private multiResultYBuffer!: GPUBuffer;
    private multiResultXStagingBuffer!: GPUBuffer;
    private multiResultYStagingBuffer!: GPUBuffer;

    constructor(device: GPUDevice, bucketWidthBits: number) {
        this.device = device;
        this.bucketWidthBits = bucketWidthBits;
        this.numberOfBuckets = 1 << bucketWidthBits;
        this.numWindows = Math.ceil(SCALAR_BITS / bucketWidthBits);

        const maxBufferSize = device.limits.maxStorageBufferBindingSize;
        const maxWorkgroups = 65535;
        this.maxChunkN = Math.min(
            Math.floor(maxBufferSize / BYTES_PER_ELEMENT_256),
            maxWorkgroups * WORKGROUP_SIZE_BI1
        );
        this.maxNumWorkgroupsBi1 = Math.ceil(this.maxChunkN / WORKGROUP_SIZE_BI1);
        this.maxNumWorkgroupsC = Math.ceil(this.numberOfBuckets / WORKGROUP_SIZE_C);

        this.kHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
        this.pxHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);
        this.pyHost = new Uint32Array(this.maxChunkN * LIMBS_PER_ELEMENT_256);

        this.layoutPassA = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            ],
        });

        this.layoutBi1Params = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            ],
        });

        this.layoutUniformSingle = device.createBindGroupLayout({
            entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }],
        });

        const layoutPassBi1Input = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
                { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'read-only-storage' } },
            ],
        });

        this.layoutWGG = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            ],
        });

        this.layoutBi2Uniforms = device.createBindGroupLayout({
            entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }],
        });

        this.layoutBucketsStorage = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            ],
        });

        this.layoutCUniforms = device.createBindGroupLayout({
            entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }],
        });

        this.layoutFStorage = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            ],
        });

        this.layoutUniformNBatchIdx = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
            ],
        });

        this.layoutBatchFinalPoints = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            ],
        });

        this.layoutHornerUniforms = device.createBindGroupLayout({
            entries: [{ binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } }],
        });

        this.layoutFinalPoint = device.createBindGroupLayout({
            entries: [
                { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
                { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'storage' } },
            ],
        });

        const shaderModules = {
            A: device.createShaderModule({ code: ShaderPassA }),
            Bi1: device.createShaderModule({ code: ShaderPassBi1 }),
            Bi2: device.createShaderModule({ code: ShaderPassBi2 }),
            C: device.createShaderModule({ code: ShaderPassC }),
            D: device.createShaderModule({ code: ShaderPassD }),
            E: device.createShaderModule({ code: ShaderPassE }),
            Horner: device.createShaderModule({ code: ShaderPassHorner }),
        };

        this.pipelineA = device.createComputePipeline({
            layout: device.createPipelineLayout({ bindGroupLayouts: [this.layoutPassA] }),
            compute: { module: shaderModules.A, entryPoint: 'main' },
        });

        this.pipelineBi1 = device.createComputePipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    this.layoutBi1Params,
                    this.layoutUniformSingle,
                    layoutPassBi1Input,
                    this.layoutWGG,
                ],
            }),
            compute: { module: shaderModules.Bi1, entryPoint: 'main' },
        });

        this.pipelineBi2 = device.createComputePipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    this.layoutBi2Uniforms,
                    this.layoutUniformSingle,
                    this.layoutWGG,
                    this.layoutBucketsStorage,
                ],
            }),
            compute: { module: shaderModules.Bi2, entryPoint: 'main' },
        });

        this.pipelineC = device.createComputePipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [this.layoutCUniforms, this.layoutBucketsStorage, this.layoutFStorage],
            }),
            compute: { module: shaderModules.C, entryPoint: 'main' },
        });

        this.pipelineD = device.createComputePipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    this.layoutUniformNBatchIdx,
                    this.layoutFStorage,
                    this.layoutBatchFinalPoints,
                ],
            }),
            compute: { module: shaderModules.D, entryPoint: 'main' },
        });

        this.pipelineE = device.createComputePipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    this.layoutUniformSingle,
                    this.layoutBatchFinalPoints,
                    this.layoutFinalPoint,
                ],
            }),
            compute: { module: shaderModules.E, entryPoint: 'main' },
        });

        this.pipelineHorner = device.createComputePipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: [
                    this.layoutHornerUniforms,
                    this.layoutFStorage,
                    this.layoutBatchFinalPoints,
                ],
            }),
            compute: { module: shaderModules.Horner, entryPoint: 'main' },
        });

        const bBufferSize = this.numWindows * this.numberOfBuckets * BYTES_PER_ELEMENT_256;
        this.bXBuffer = this.createBuffer(
            bBufferSize,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );
        this.bYBuffer = this.createBuffer(
            bBufferSize,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );
        this.bZBuffer = this.createBuffer(
            bBufferSize,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );

        this.fWindowsXBuffer = this.createBuffer(
            this.numWindows * BYTES_PER_ELEMENT_256,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );
        this.fWindowsYBuffer = this.createBuffer(
            this.numWindows * BYTES_PER_ELEMENT_256,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );
        this.fWindowsZBuffer = this.createBuffer(
            this.numWindows * BYTES_PER_ELEMENT_256,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );

        this.finalPointXBuffer = this.createBuffer(
            BYTES_PER_ELEMENT_256,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );
        this.finalPointYBuffer = this.createBuffer(
            BYTES_PER_ELEMENT_256,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );
        this.finalPointXStagingBuffer = this.createBuffer(
            BYTES_PER_ELEMENT_256,
            GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        );
        this.finalPointYStagingBuffer = this.createBuffer(
            BYTES_PER_ELEMENT_256,
            GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST
        );

        const u32Size = 4;
        this.bi1BucketWidthBitsBuffer = this.createUniformBufferWithData([bucketWidthBits]);
        this.bi1WindowIdxBuffer = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        this.bucketIdxUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        this.bi2UniformsBuffer = this.createBuffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        this.passANUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        this.cUniformsBuffer = this.createBuffer(8, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        this.passDNUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        this.passDBatchIdxUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        this.passENUniform = this.createBuffer(u32Size, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);
        this.hornerUniformsBuffer = this.createBuffer(16, GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST);

        const perBatchBufferSize = this.maxChunkN * BYTES_PER_ELEMENT_256;
        this.kBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        this.pxBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        this.pyBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST);
        this.ppxBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
        this.ppyBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
        this.ppzBuffer = this.createBuffer(perBatchBufferSize, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);

        const wggSizeMax = this.maxNumWorkgroupsBi1 * BYTES_PER_ELEMENT_256;
        this.wggXBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
        this.wggYBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
        this.wggZBuffer = this.createBuffer(wggSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);

        const fBufferSizeMax = this.maxNumWorkgroupsC * BYTES_PER_ELEMENT_256;
        this.fXBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
        this.fYBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);
        this.fZBuffer = this.createBuffer(fBufferSizeMax, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC);

        this.bindGroupPassA = device.createBindGroup({
            layout: this.layoutPassA,
            entries: [
                { binding: 0, resource: { buffer: this.pxBuffer } },
                { binding: 1, resource: { buffer: this.pyBuffer } },
                { binding: 2, resource: { buffer: this.ppxBuffer } },
                { binding: 3, resource: { buffer: this.ppyBuffer } },
                { binding: 4, resource: { buffer: this.ppzBuffer } },
                { binding: 5, resource: { buffer: this.passANUniform } },
            ],
        });

        this.bindGroupBi1Params = device.createBindGroup({
            layout: this.layoutBi1Params,
            entries: [
                { binding: 0, resource: { buffer: this.bi1BucketWidthBitsBuffer } },
                { binding: 1, resource: { buffer: this.bi1WindowIdxBuffer } },
            ],
        });

        this.bindGroupBucketIdx = device.createBindGroup({
            layout: this.layoutUniformSingle,
            entries: [{ binding: 0, resource: { buffer: this.bucketIdxUniform } }],
        });

        this.bindGroupPassBi1Input = device.createBindGroup({
            layout: layoutPassBi1Input,
            entries: [
                { binding: 0, resource: { buffer: this.kBuffer } },
                { binding: 1, resource: { buffer: this.ppxBuffer } },
                { binding: 2, resource: { buffer: this.ppyBuffer } },
                { binding: 3, resource: { buffer: this.ppzBuffer } },
            ],
        });

        this.bindGroupWGG = device.createBindGroup({
            layout: this.layoutWGG,
            entries: [
                { binding: 0, resource: { buffer: this.wggXBuffer } },
                { binding: 1, resource: { buffer: this.wggYBuffer } },
                { binding: 2, resource: { buffer: this.wggZBuffer } },
            ],
        });

        this.bindGroupBi2Uniforms = device.createBindGroup({
            layout: this.layoutBi2Uniforms,
            entries: [{ binding: 0, resource: { buffer: this.bi2UniformsBuffer } }],
        });

        this.bindGroupBucketsStorage = device.createBindGroup({
            layout: this.layoutBucketsStorage,
            entries: [
                { binding: 0, resource: { buffer: this.bXBuffer } },
                { binding: 1, resource: { buffer: this.bYBuffer } },
                { binding: 2, resource: { buffer: this.bZBuffer } },
            ],
        });

        this.bindGroupCUniforms = device.createBindGroup({
            layout: this.layoutCUniforms,
            entries: [{ binding: 0, resource: { buffer: this.cUniformsBuffer } }],
        });

        this.bindGroupFStorage = device.createBindGroup({
            layout: this.layoutFStorage,
            entries: [
                { binding: 0, resource: { buffer: this.fXBuffer } },
                { binding: 1, resource: { buffer: this.fYBuffer } },
                { binding: 2, resource: { buffer: this.fZBuffer } },
            ],
        });

        this.bindGroupPassDUniforms = device.createBindGroup({
            layout: this.layoutUniformNBatchIdx,
            entries: [
                { binding: 0, resource: { buffer: this.passDNUniform } },
                { binding: 1, resource: { buffer: this.passDBatchIdxUniform } },
            ],
        });

        this.bindGroupFWindowsOutput = device.createBindGroup({
            layout: this.layoutBatchFinalPoints,
            entries: [
                { binding: 0, resource: { buffer: this.fWindowsXBuffer } },
                { binding: 1, resource: { buffer: this.fWindowsYBuffer } },
                { binding: 2, resource: { buffer: this.fWindowsZBuffer } },
            ],
        });

        this.bindGroupHornerUniforms = device.createBindGroup({
            layout: this.layoutHornerUniforms,
            entries: [{ binding: 0, resource: { buffer: this.hornerUniformsBuffer } }],
        });

        this.bindGroupFWindowsInput = device.createBindGroup({
            layout: this.layoutFStorage,
            entries: [
                { binding: 0, resource: { buffer: this.fWindowsXBuffer } },
                { binding: 1, resource: { buffer: this.fWindowsYBuffer } },
                { binding: 2, resource: { buffer: this.fWindowsZBuffer } },
            ],
        });

        this.bindGroupPassEN = device.createBindGroup({
            layout: this.layoutUniformSingle,
            entries: [{ binding: 0, resource: { buffer: this.passENUniform } }],
        });

        this.bindGroupFinalPoint = device.createBindGroup({
            layout: this.layoutFinalPoint,
            entries: [
                { binding: 0, resource: { buffer: this.finalPointXBuffer } },
                { binding: 1, resource: { buffer: this.finalPointYBuffer } },
            ],
        });
    }

    async run(
        scalars: bigint[],
        points: Point[],
        config?: PippengerMSMConfig
    ): Promise<Point> {
        const [result] = await this.runMany([{ scalars, points }], config);
        return result;
    }

    async runMany(
        jobs: PippengerMSMJob[],
        config?: PippengerMSMConfig
    ): Promise<Point[]> {
        if (jobs.length === 0) throw new Error('jobs array cannot be empty');

        const verbose = config?.verbose ?? true;
        this.ensureMultiResultCapacity(jobs.length);

        let passCountA = 0;
        let passCountBi1 = 0;
        let passCountBi2 = 0;
        let passCountC = 0;
        let passCountD = 0;
        let passCountHorner = 0;
        let passCountE = 0;

        let commandEncoder = this.device.createCommandEncoder();

        for (let jobIdx = 0; jobIdx < jobs.length; jobIdx++) {
            const { scalars, points } = jobs[jobIdx];
            const n = scalars.length;
            if (n === 0) throw new Error('scalars and points arrays cannot be empty');
            if (points.length !== n) throw new Error('scalars and points must have same length');

            const numBatches = Math.ceil(n / this.maxChunkN);
            this.ensureBatchFinalPointsCapacity(numBatches);
            this.clearReusableState(commandEncoder, numBatches);
            this.device.queue.submit([commandEncoder.finish()]);
            commandEncoder = this.device.createCommandEncoder();

            if (verbose) {
                console.log('=== Pippenger MSM Configuration ===');
                console.log(`Job:                  ${jobs[jobIdx].label ?? jobIdx}`);
                console.log(`Total points:         ${n}`);
                console.log(`Bucket width (bits):  ${this.bucketWidthBits}`);
                console.log(`Number of buckets:    ${this.numberOfBuckets}`);
                console.log(`Number of windows:    ${this.numWindows}`);
                console.log(`Max points per batch: ${this.maxChunkN}`);
                console.log(`Number of batches:    ${numBatches}`);
                console.log('===================================');
            }

            for (let batchIdx = 0; batchIdx < numBatches; batchIdx++) {
                const batchOffset = batchIdx * this.maxChunkN;
                const currentBatchN = Math.min(n - batchOffset, this.maxChunkN);

                if (verbose) {
                    console.log(`Job ${jobIdx + 1}/${jobs.length} batch ${batchIdx + 1}/${numBatches} (${currentBatchN} points)`);
                }

                this.packBatchInputs(scalars, points, batchOffset, currentBatchN);
                const usedHostLimbs = currentBatchN * LIMBS_PER_ELEMENT_256;

                this.device.queue.writeBuffer(this.kBuffer, 0, this.kHost.buffer as ArrayBuffer, 0, usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT);
                this.device.queue.writeBuffer(this.pxBuffer, 0, this.pxHost.buffer as ArrayBuffer, 0, usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT);
                this.device.queue.writeBuffer(this.pyBuffer, 0, this.pyHost.buffer as ArrayBuffer, 0, usedHostLimbs * Uint32Array.BYTES_PER_ELEMENT);
                this.device.queue.writeBuffer(this.passANUniform, 0, new Uint32Array([currentBatchN]));

                {
                    const numWG = Math.ceil(currentBatchN / WORKGROUP_SIZE_A);
                    const pass = commandEncoder.beginComputePass();
                    pass.setPipeline(this.pipelineA);
                    pass.setBindGroup(0, this.bindGroupPassA);
                    pass.dispatchWorkgroups(numWG);
                    pass.end();
                    passCountA++;
                }

                const numWorkgroupsBi1 = Math.ceil(currentBatchN / WORKGROUP_SIZE_BI1);

                for (let windowIdx = 0; windowIdx < this.numWindows; windowIdx++) {
                    this.device.queue.writeBuffer(this.bi1WindowIdxBuffer, 0, new Uint32Array([windowIdx]));

                    for (let bucketValue = 1; bucketValue < this.numberOfBuckets; bucketValue++) {
                        this.device.queue.writeBuffer(this.bucketIdxUniform, 0, new Uint32Array([bucketValue]));

                        {
                            const pass = commandEncoder.beginComputePass();
                            pass.setPipeline(this.pipelineBi1);
                            pass.setBindGroup(0, this.bindGroupBi1Params);
                            pass.setBindGroup(1, this.bindGroupBucketIdx);
                            pass.setBindGroup(2, this.bindGroupPassBi1Input);
                            pass.setBindGroup(3, this.bindGroupWGG);
                            pass.dispatchWorkgroups(numWorkgroupsBi1);
                            pass.end();
                            passCountBi1++;
                        }

                        let currentNBi2 = numWorkgroupsBi1;
                        while (currentNBi2 >= 1) {
                            this.device.queue.writeBuffer(this.bi2UniformsBuffer, 0, new Uint32Array([currentNBi2, windowIdx, this.numberOfBuckets, 0]));

                            const numWG = Math.ceil(currentNBi2 / WORKGROUP_SIZE_BI2);
                            const pass = commandEncoder.beginComputePass();
                            pass.setPipeline(this.pipelineBi2);
                            pass.setBindGroup(0, this.bindGroupBi2Uniforms);
                            pass.setBindGroup(1, this.bindGroupBucketIdx);
                            pass.setBindGroup(2, this.bindGroupWGG);
                            pass.setBindGroup(3, this.bindGroupBucketsStorage);
                            pass.dispatchWorkgroups(numWG);
                            pass.end();
                            passCountBi2++;

                            if (currentNBi2 <= WORKGROUP_SIZE_BI2) break;
                            currentNBi2 = Math.ceil(currentNBi2 / WORKGROUP_SIZE_BI2);
                        }

                        this.device.queue.submit([commandEncoder.finish()]);
                        commandEncoder = this.device.createCommandEncoder();
                    }

                    this.device.queue.writeBuffer(this.cUniformsBuffer, 0, new Uint32Array([windowIdx, this.numberOfBuckets]));

                    {
                        const numWG = Math.ceil(this.numberOfBuckets / WORKGROUP_SIZE_C);
                        const pass = commandEncoder.beginComputePass();
                        pass.setPipeline(this.pipelineC);
                        pass.setBindGroup(0, this.bindGroupCUniforms);
                        pass.setBindGroup(1, this.bindGroupBucketsStorage);
                        pass.setBindGroup(2, this.bindGroupFStorage);
                        pass.dispatchWorkgroups(numWG);
                        pass.end();
                        passCountC++;
                    }

                    let currentND = this.maxNumWorkgroupsC;
                    while (currentND >= 1) {
                        this.device.queue.writeBuffer(this.passDNUniform, 0, new Uint32Array([currentND]));
                        this.device.queue.writeBuffer(this.passDBatchIdxUniform, 0, new Uint32Array([windowIdx]));

                        const numWG = Math.ceil(currentND / WORKGROUP_SIZE_D);
                        const pass = commandEncoder.beginComputePass();
                        pass.setPipeline(this.pipelineD);
                        pass.setBindGroup(0, this.bindGroupPassDUniforms);
                        pass.setBindGroup(1, this.bindGroupFStorage);
                        pass.setBindGroup(2, this.bindGroupFWindowsOutput);
                        pass.dispatchWorkgroups(numWG);
                        pass.end();
                        passCountD++;

                        if (currentND <= WORKGROUP_SIZE_D) break;
                        currentND = Math.ceil(currentND / WORKGROUP_SIZE_D);
                    }

                    this.device.queue.submit([commandEncoder.finish()]);
                    commandEncoder = this.device.createCommandEncoder();
                }

                this.device.queue.writeBuffer(this.hornerUniformsBuffer, 0, new Uint32Array([this.numWindows, this.bucketWidthBits, batchIdx, 0]));

                {
                    const pass = commandEncoder.beginComputePass();
                    pass.setPipeline(this.pipelineHorner);
                    pass.setBindGroup(0, this.bindGroupHornerUniforms);
                    pass.setBindGroup(1, this.bindGroupFWindowsInput);
                    pass.setBindGroup(2, this.bindGroupBatchFinalPoints);
                    pass.dispatchWorkgroups(1);
                    pass.end();
                    passCountHorner++;
                }

                this.device.queue.submit([commandEncoder.finish()]);
                commandEncoder = this.device.createCommandEncoder();
            }

            let currentNE = numBatches;
            while (currentNE >= 1) {
                this.device.queue.writeBuffer(this.passENUniform, 0, new Uint32Array([currentNE]));

                const pass = commandEncoder.beginComputePass();
                pass.setPipeline(this.pipelineE);
                pass.setBindGroup(0, this.bindGroupPassEN);
                pass.setBindGroup(1, this.bindGroupBatchFinalPoints);
                pass.setBindGroup(2, this.bindGroupFinalPoint);
                pass.dispatchWorkgroups(Math.ceil(currentNE / WORKGROUP_SIZE_E));
                pass.end();
                passCountE++;

                if (currentNE <= WORKGROUP_SIZE_E) break;
                currentNE = Math.ceil(currentNE / WORKGROUP_SIZE_E);
            }

            commandEncoder.copyBufferToBuffer(this.finalPointXBuffer, 0, this.multiResultXBuffer, jobIdx * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
            commandEncoder.copyBufferToBuffer(this.finalPointYBuffer, 0, this.multiResultYBuffer, jobIdx * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
        }

        commandEncoder.copyBufferToBuffer(this.multiResultXBuffer, 0, this.multiResultXStagingBuffer, 0, jobs.length * BYTES_PER_ELEMENT_256);
        commandEncoder.copyBufferToBuffer(this.multiResultYBuffer, 0, this.multiResultYStagingBuffer, 0, jobs.length * BYTES_PER_ELEMENT_256);

        if (verbose) {
            console.log('\n--- Dispatches per Stage ---');
            console.log(`Pass A:      ${passCountA}`);
            console.log(`Pass Bi1:    ${passCountBi1}`);
            console.log(`Pass Bi2:    ${passCountBi2}`);
            console.log(`Pass C:      ${passCountC}`);
            console.log(`Pass D:      ${passCountD}`);
            console.log(`Pass Horner: ${passCountHorner}`);
            console.log(`Pass E:      ${passCountE}`);
            console.log(
                `TOTAL:       ${
                    passCountA +
                    passCountBi1 +
                    passCountBi2 +
                    passCountC +
                    passCountD +
                    passCountHorner +
                    passCountE
                }`
            );
            console.log('============================\n');
        }

        this.device.queue.submit([commandEncoder.finish()]);
        await this.device.queue.onSubmittedWorkDone();

        await this.multiResultXStagingBuffer.mapAsync(GPUMapMode.READ);
        await this.multiResultYStagingBuffer.mapAsync(GPUMapMode.READ);

        const xView = new Uint32Array(this.multiResultXStagingBuffer.getMappedRange()).slice();
        const yView = new Uint32Array(this.multiResultYStagingBuffer.getMappedRange()).slice();

        this.multiResultXStagingBuffer.unmap();
        this.multiResultYStagingBuffer.unmap();

        const results: Point[] = [];
        for (let jobIdx = 0; jobIdx < jobs.length; jobIdx++) {
            const offset = jobIdx * LIMBS_PER_ELEMENT_256;
            results.push({
                x: limbs256ToBigint(xView.subarray(offset, offset + LIMBS_PER_ELEMENT_256)),
                y: limbs256ToBigint(yView.subarray(offset, offset + LIMBS_PER_ELEMENT_256)),
            });
        }

        return results;
    }

    destroy(): void {
        this.batchFinalPointsXBuffer?.destroy();
        this.batchFinalPointsYBuffer?.destroy();
        this.batchFinalPointsZBuffer?.destroy();
    }

    private packBatchInputs(
        scalars: bigint[],
        points: Point[],
        batchOffset: number,
        currentBatchN: number
    ): void {
        for (let i = 0; i < currentBatchN; i++) {
            const sourceIndex = batchOffset + i;
            const targetOffset = i * LIMBS_PER_ELEMENT_256;
            writeBigint256ToLimbs(scalars[sourceIndex], this.kHost, targetOffset);
            writeBigint256ToLimbs(points[sourceIndex].x, this.pxHost, targetOffset);
            writeBigint256ToLimbs(points[sourceIndex].y, this.pyHost, targetOffset);
        }
    }

    private ensureBatchFinalPointsCapacity(numBatches: number): void {
        if (numBatches <= this.batchFinalPointsCapacity) {
            return;
        }

        this.batchFinalPointsXBuffer?.destroy();
        this.batchFinalPointsYBuffer?.destroy();
        this.batchFinalPointsZBuffer?.destroy();

        const batchFinalPointsSize = Math.max(
            numBatches * BYTES_PER_ELEMENT_256,
            BYTES_PER_ELEMENT_256
        );

        this.batchFinalPointsXBuffer = this.createBuffer(
            batchFinalPointsSize,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );
        this.batchFinalPointsYBuffer = this.createBuffer(
            batchFinalPointsSize,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );
        this.batchFinalPointsZBuffer = this.createBuffer(
            batchFinalPointsSize,
            GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST
        );

        this.bindGroupBatchFinalPoints = this.device.createBindGroup({
            layout: this.layoutBatchFinalPoints,
            entries: [
                { binding: 0, resource: { buffer: this.batchFinalPointsXBuffer } },
                { binding: 1, resource: { buffer: this.batchFinalPointsYBuffer } },
                { binding: 2, resource: { buffer: this.batchFinalPointsZBuffer } },
            ],
        });

        this.batchFinalPointsCapacity = numBatches;
    }

    private ensureMultiResultCapacity(numJobs: number): void {
        if (numJobs <= this.multiResultCapacity) return;

        this.multiResultXBuffer?.destroy();
        this.multiResultYBuffer?.destroy();
        this.multiResultXStagingBuffer?.destroy();
        this.multiResultYStagingBuffer?.destroy();

        const size = Math.max(numJobs * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
        this.multiResultXBuffer = this.createBuffer(size, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
        this.multiResultYBuffer = this.createBuffer(size, GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST);
        this.multiResultXStagingBuffer = this.createBuffer(size, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
        this.multiResultYStagingBuffer = this.createBuffer(size, GPUBufferUsage.MAP_READ | GPUBufferUsage.COPY_DST);
        this.multiResultCapacity = numJobs;
    }

    private clearReusableState(commandEncoder: GPUCommandEncoder, numBatches: number): void {
        const batchBytes = Math.max(numBatches * BYTES_PER_ELEMENT_256, BYTES_PER_ELEMENT_256);
        commandEncoder.clearBuffer(this.bXBuffer);
        commandEncoder.clearBuffer(this.bYBuffer);
        commandEncoder.clearBuffer(this.bZBuffer);
        commandEncoder.clearBuffer(this.fWindowsXBuffer);
        commandEncoder.clearBuffer(this.fWindowsYBuffer);
        commandEncoder.clearBuffer(this.fWindowsZBuffer);
        commandEncoder.clearBuffer(this.batchFinalPointsXBuffer, 0, batchBytes);
        commandEncoder.clearBuffer(this.batchFinalPointsYBuffer, 0, batchBytes);
        commandEncoder.clearBuffer(this.batchFinalPointsZBuffer, 0, batchBytes);
        commandEncoder.clearBuffer(this.finalPointXBuffer);
        commandEncoder.clearBuffer(this.finalPointYBuffer);
    }

    private createBuffer(size: number, usage: GPUBufferUsageFlags): GPUBuffer {
        return this.device.createBuffer({ size, usage });
    }

    private createUniformBufferWithData(values: number[]): GPUBuffer {
        const buffer = this.device.createBuffer({
            size: values.length * 4,
            usage: GPUBufferUsage.UNIFORM,
            mappedAtCreation: true,
        });
        new Uint32Array(buffer.getMappedRange()).set(values);
        buffer.unmap();
        return buffer;
    }
}
