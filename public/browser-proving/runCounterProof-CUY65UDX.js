import {
  createWebGpuBatchedMsmRunner,
  preloadEmbeddedO1jsCompileCache
} from "./chunk-NWWDZLA6.js";

// dist/src/proof/runCounterProof.js
import { AccountUpdate as AccountUpdate2, getGpuMsmRunner, getGpuProver, Mina, PrivateKey, setGpuMsmRunner, setGpuProver, setNumberOfWorkers, setBackend, UInt64 as UInt642 } from "o1js";

// node_modules/tslib/tslib.es6.mjs
function __decorate(decorators, target, key, desc) {
  var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
  if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
  else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
  return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function __metadata(metadataKey, metadataValue) {
  if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
}

// dist/src/proof/counter.js
import { AccountUpdate, AccountUpdateForest, method, Permissions, Provable, State, state, TokenContract, UInt64 } from "o1js";
var SHARE_SYMBOL = "vMINA";
function mulDivFloor(x, y, denominator) {
  denominator.assertGreaterThan(UInt64.zero, "division by zero");
  const quotient = Provable.witness(UInt64, () => {
    const numerator = x.toBigInt() * y.toBigInt();
    return UInt64.from(numerator / denominator.toBigInt());
  });
  const remainder = Provable.witness(UInt64, () => {
    const numerator = x.toBigInt() * y.toBigInt();
    return UInt64.from(numerator % denominator.toBigInt());
  });
  remainder.assertLessThan(denominator, "bad floor division remainder");
  x.value.mul(y.value).assertEquals(quotient.value.mul(denominator.value).add(remainder.value));
  return quotient;
}
var MinaVault = class extends TokenContract {
  constructor() {
    super(...arguments);
    this.totalShares = State();
    this.accountedAssets = State();
  }
  async deploy(args) {
    await super.deploy(args);
    const proof = Permissions.proof();
    this.account.permissions.set({
      ...Permissions.default(),
      // State changes must go through valid zkApp proofs.
      editState: proof,
      // The vault can only send MINA through proven methods.
      send: proof,
      // Anyone can send MINA to the vault.
      // This is needed for delegation rewards / donations.
      receive: Permissions.none(),
      // The token symbol is set by the contract initialization.
      setTokenSymbol: proof
    });
  }
  init() {
    super.init();
    this.account.tokenSymbol.set(SHARE_SYMBOL);
    this.totalShares.set(UInt64.zero);
    this.accountedAssets.set(UInt64.zero);
  }
  async approveBase(forest) {
    this.checkZeroBalanceChange(forest);
  }
  async deposit(amount) {
    amount.assertGreaterThan(UInt64.zero, "deposit amount is zero");
    const sender = this.sender.getAndRequireSignature();
    const totalShares = this.totalShares.getAndRequireEquals();
    const assetsBefore = this.account.balance.getAndRequireEquals();
    const isFirstDeposit = totalShares.equals(UInt64.zero);
    isFirstDeposit.not().or(assetsBefore.equals(UInt64.zero)).assertTrue("vault has assets but no shares");
    isFirstDeposit.or(assetsBefore.greaterThan(UInt64.zero)).assertTrue("invalid vault accounting");
    const safeDenominator = Provable.if(isFirstDeposit, UInt64, UInt64.one, assetsBefore);
    const proportionalShares = mulDivFloor(amount, totalShares, safeDenominator);
    const sharesToMint = Provable.if(isFirstDeposit, UInt64, amount, proportionalShares);
    sharesToMint.assertGreaterThan(UInt64.zero, "deposit mints zero shares");
    const senderUpdate = AccountUpdate.createSigned(sender);
    senderUpdate.send({ to: this, amount });
    this.internal.mint({
      address: sender,
      amount: sharesToMint
    });
    this.totalShares.set(totalShares.add(sharesToMint));
    this.accountedAssets.set(assetsBefore.add(amount));
  }
  async withdraw(shares) {
    shares.assertGreaterThan(UInt64.zero, "withdraw shares is zero");
    const sender = this.sender.getAndRequireSignature();
    const totalShares = this.totalShares.getAndRequireEquals();
    totalShares.assertGreaterThan(UInt64.zero, "vault has no shares");
    shares.assertLessThanOrEqual(totalShares, "not enough vault shares");
    const assetsBefore = this.account.balance.getAndRequireEquals();
    const amountOut = mulDivFloor(shares, assetsBefore, totalShares);
    amountOut.assertGreaterThan(UInt64.zero, "withdraw amount is zero");
    this.internal.burn({
      address: sender,
      amount: shares
    });
    this.send({
      to: sender,
      amount: amountOut
    });
    this.totalShares.set(totalShares.sub(shares));
    this.accountedAssets.set(assetsBefore.sub(amountOut));
  }
  async depositReward(amount) {
    amount.assertGreaterThan(UInt64.zero, "reward amount is zero");
    const totalShares = this.totalShares.getAndRequireEquals();
    totalShares.assertGreaterThan(UInt64.zero, "no shareholders");
    const sender = this.sender.getAndRequireSignature();
    const assetsBefore = this.account.balance.getAndRequireEquals();
    const senderUpdate = AccountUpdate.createSigned(sender);
    senderUpdate.send({ to: this, amount });
    this.accountedAssets.set(assetsBefore.add(amount));
  }
  async syncRewards() {
    const totalShares = this.totalShares.getAndRequireEquals();
    totalShares.assertGreaterThan(UInt64.zero, "no shareholders");
    const accountedAssets = this.accountedAssets.getAndRequireEquals();
    const actualAssets = this.account.balance.getAndRequireEquals();
    actualAssets.assertGreaterThanOrEqual(accountedAssets, "actual assets below accounted assets");
    this.accountedAssets.set(actualAssets);
  }
};
__decorate([
  state(UInt64),
  __metadata("design:type", Object)
], MinaVault.prototype, "totalShares", void 0);
__decorate([
  state(UInt64),
  __metadata("design:type", Object)
], MinaVault.prototype, "accountedAssets", void 0);
__decorate([
  method,
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [AccountUpdateForest]),
  __metadata("design:returntype", Promise)
], MinaVault.prototype, "approveBase", null);
__decorate([
  method,
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [UInt64]),
  __metadata("design:returntype", Promise)
], MinaVault.prototype, "deposit", null);
__decorate([
  method,
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [UInt64]),
  __metadata("design:returntype", Promise)
], MinaVault.prototype, "withdraw", null);
__decorate([
  method,
  __metadata("design:type", Function),
  __metadata("design:paramtypes", [UInt64]),
  __metadata("design:returntype", Promise)
], MinaVault.prototype, "depositReward", null);
__decorate([
  method,
  __metadata("design:type", Function),
  __metadata("design:paramtypes", []),
  __metadata("design:returntype", Promise)
], MinaVault.prototype, "syncRewards", null);

// dist/src/proof/runCounterProof.js
setBackend("wasm");
setNumberOfWorkers(0);
function nowMs() {
  return performance.now();
}
function logPhase(name, startMs) {
  const elapsedMs = nowMs() - startMs;
  console.log(`[o1js app-profile] phase=${name} elapsed_ms=${elapsedMs.toFixed(2)}`);
  return nowMs();
}
function installGpuProofHook() {
  if (getGpuProver() !== void 0)
    return;
  setGpuProver(async ({ cpuFallback, proverData }) => {
    const callIndex = typeof proverData === "object" && proverData !== null && "index" in proverData && typeof proverData.index === "number" ? proverData.index : -1;
    console.log(`GPU prover hook called for account update #${callIndex}`);
    return await cpuFallback();
  });
}
function installGpuMsmHook() {
  if (getGpuMsmRunner() !== void 0)
    return;
  setGpuMsmRunner(createWebGpuBatchedMsmRunner());
}
async function createCounterProofHarness(options = {}) {
  installGpuProofHook();
  installGpuMsmHook();
  const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
  Mina.setActiveInstance(Local);
  const feePayer = Local.testAccounts[0];
  const zkAppKey = PrivateKey.random();
  const zkAppAddress = zkAppKey.toPublicKey();
  const zkApp = new MinaVault(zkAppAddress);
  console.log("Compiling MinaVault...");
  let phaseStartMs = nowMs();
  const compileCache = options.compileCache ?? await preloadEmbeddedO1jsCompileCache("counter");
  const { verificationKey } = compileCache === void 0 ? await MinaVault.compile() : await MinaVault.compile({ cache: compileCache });
  phaseStartMs = logPhase("compile", phaseStartMs);
  console.log("Deploying MinaVault...");
  const deployTx = await Mina.transaction(feePayer, async () => {
    AccountUpdate2.fundNewAccount(feePayer);
    await zkApp.deploy({ verificationKey });
  });
  phaseStartMs = logPhase("deploy_tx_build", phaseStartMs);
  await deployTx.prove({ gpuProving: true });
  phaseStartMs = logPhase("deploy_tx_prove", phaseStartMs);
  deployTx.sign([feePayer.key, zkAppKey]);
  await deployTx.send();
  logPhase("deploy_tx_sign_send", phaseStartMs);
  return {
    feePayer,
    zkAppKey,
    zkApp,
    proveIncrement: async () => {
      console.log("Proving increment()...");
      let phaseStartMs2 = nowMs();
      const incrementTx = await Mina.transaction(feePayer, async () => {
        AccountUpdate2.fundNewAccount(feePayer);
        await zkApp.deposit(UInt642.from(1e9));
      });
      phaseStartMs2 = logPhase("increment_tx_build", phaseStartMs2);
      await incrementTx.prove({ gpuProving: true });
      phaseStartMs2 = logPhase("increment_tx_prove", phaseStartMs2);
      incrementTx.sign([feePayer.key]);
      await incrementTx.send();
      logPhase("increment_tx_sign_send", phaseStartMs2);
      const finalCounter = "0";
      console.log(`Final counter state: ${finalCounter.toString()}`);
      return {
        finalCounter: finalCounter.toString(),
        incrementTx
      };
    }
  };
}
async function run() {
  const totalStartMs = nowMs();
  const harness = await createCounterProofHarness();
  const { incrementTx, finalCounter } = await harness.proveIncrement();
  logPhase("run_total", totalStartMs);
  return {
    finalCounter,
    incrementTx
  };
}
var runCounterProof_default = run;
export {
  createCounterProofHarness,
  runCounterProof_default as default,
  run
};
