import {
  createWebGpuBatchedMsmRunner,
  preloadEmbeddedO1jsCompileCache
} from "./chunk-NWWDZLA6.js";

// dist/src/proof/runRollup.js
import { Field as Field2, getGpuMsmRunner, getGpuProver, MerkleTree, PrivateKey, setBackend, setGpuMsmRunner, setGpuProver, setNumberOfWorkers, Signature as Signature2, UInt64 as UInt642 } from "o1js";

// dist/src/proof/rollup.js
import { Field, MerkleWitness, Poseidon, PublicKey, SelfProof, Signature, Struct, UInt64, ZkProgram } from "o1js";
var BALANCES_TREE_HEIGHT = 32;
var BalanceWitness = class extends MerkleWitness(BALANCES_TREE_HEIGHT) {
};
var EMPTY_LEAF_HASH = Field(0);
var OP_DEPOSIT_NEW = Field(1);
var OP_DEPOSIT = Field(2);
var OP_WITHDRAW = Field(3);
var AccountLeaf = class _AccountLeaf extends Struct({
  owner: PublicKey,
  balance: UInt64,
  nonce: UInt64
}) {
  hash() {
    return Poseidon.hash([
      ...this.owner.toFields(),
      this.balance.value,
      this.nonce.value
    ]);
  }
  addBalance(amount) {
    return new _AccountLeaf({
      owner: this.owner,
      balance: this.balance.add(amount),
      nonce: this.nonce
    });
  }
  subBalance(amount) {
    this.balance.assertGreaterThanOrEqual(amount, "insufficient balance");
    return new _AccountLeaf({
      owner: this.owner,
      balance: this.balance.sub(amount),
      nonce: this.nonce.add(UInt64.one)
    });
  }
};
var VaultRollupOutput = class extends Struct({
  oldRoot: Field,
  newRoot: Field,
  deposited: UInt64,
  withdrawn: UInt64,
  operations: UInt64,
  actionsHash: Field
}) {
};
function hashOperation(kind, index, owner, amount, nonce) {
  return Poseidon.hash([
    kind,
    index,
    ...owner.toFields(),
    amount.value,
    nonce.value
  ]);
}
function emptyOutput(root) {
  return new VaultRollupOutput({
    oldRoot: root,
    newRoot: root,
    deposited: UInt64.zero,
    withdrawn: UInt64.zero,
    operations: UInt64.zero,
    actionsHash: Field(0)
  });
}
var MinaVaultRollup = ZkProgram({
  name: "mina-vault-rollup",
  publicInput: Field,
  publicOutput: VaultRollupOutput,
  methods: {
    noop: {
      privateInputs: [],
      async method(root) {
        return {
          publicOutput: emptyOutput(root)
        };
      }
    },
    depositNew: {
      privateInputs: [BalanceWitness, PublicKey, UInt64],
      async method(oldRoot, witness, owner, amount) {
        amount.assertGreaterThan(UInt64.zero, "deposit amount is zero");
        const index = witness.calculateIndex();
        witness.calculateRoot(EMPTY_LEAF_HASH).assertEquals(oldRoot);
        const newLeaf = new AccountLeaf({
          owner,
          balance: amount,
          nonce: UInt64.zero
        });
        const newRoot = witness.calculateRoot(newLeaf.hash());
        const actionsHash = hashOperation(OP_DEPOSIT_NEW, index, owner, amount, UInt64.zero);
        return {
          publicOutput: new VaultRollupOutput({
            oldRoot,
            newRoot,
            deposited: amount,
            withdrawn: UInt64.zero,
            operations: UInt64.one,
            actionsHash
          })
        };
      }
    },
    deposit: {
      privateInputs: [BalanceWitness, AccountLeaf, UInt64],
      async method(oldRoot, witness, currentLeaf, amount) {
        amount.assertGreaterThan(UInt64.zero, "deposit amount is zero");
        const index = witness.calculateIndex();
        witness.calculateRoot(currentLeaf.hash()).assertEquals(oldRoot);
        const newLeaf = currentLeaf.addBalance(amount);
        const newRoot = witness.calculateRoot(newLeaf.hash());
        const actionsHash = hashOperation(OP_DEPOSIT, index, currentLeaf.owner, amount, currentLeaf.nonce);
        return {
          publicOutput: new VaultRollupOutput({
            oldRoot,
            newRoot,
            deposited: amount,
            withdrawn: UInt64.zero,
            operations: UInt64.one,
            actionsHash
          })
        };
      }
    },
    withdraw: {
      privateInputs: [BalanceWitness, AccountLeaf, UInt64, Signature],
      async method(oldRoot, witness, currentLeaf, amount, signature) {
        amount.assertGreaterThan(UInt64.zero, "withdraw amount is zero");
        const index = witness.calculateIndex();
        witness.calculateRoot(currentLeaf.hash()).assertEquals(oldRoot);
        signature.verify(currentLeaf.owner, [
          OP_WITHDRAW,
          oldRoot,
          index,
          amount.value,
          currentLeaf.nonce.value
        ]).assertTrue("invalid withdraw signature");
        const newLeaf = currentLeaf.subBalance(amount);
        const newRoot = witness.calculateRoot(newLeaf.hash());
        const actionsHash = hashOperation(OP_WITHDRAW, index, currentLeaf.owner, amount, currentLeaf.nonce);
        return {
          publicOutput: new VaultRollupOutput({
            oldRoot,
            newRoot,
            deposited: UInt64.zero,
            withdrawn: amount,
            operations: UInt64.one,
            actionsHash
          })
        };
      }
    },
    merge: {
      privateInputs: [SelfProof, SelfProof],
      async method(oldRoot, leftProof, rightProof) {
        leftProof.verify();
        rightProof.verify();
        leftProof.publicInput.assertEquals(oldRoot);
        leftProof.publicOutput.oldRoot.assertEquals(oldRoot);
        rightProof.publicInput.assertEquals(leftProof.publicOutput.newRoot);
        rightProof.publicOutput.oldRoot.assertEquals(leftProof.publicOutput.newRoot);
        const actionsHash = Poseidon.hash([
          leftProof.publicOutput.actionsHash,
          rightProof.publicOutput.actionsHash
        ]);
        return {
          publicOutput: new VaultRollupOutput({
            oldRoot,
            newRoot: rightProof.publicOutput.newRoot,
            deposited: leftProof.publicOutput.deposited.add(rightProof.publicOutput.deposited),
            withdrawn: leftProof.publicOutput.withdrawn.add(rightProof.publicOutput.withdrawn),
            operations: leftProof.publicOutput.operations.add(rightProof.publicOutput.operations),
            actionsHash
          })
        };
      }
    }
  }
});
var MinaVaultRollupProof = class extends ZkProgram.Proof(MinaVaultRollup) {
};

// dist/src/proof/runRollup.js
setBackend("wasm");
setNumberOfWorkers(0);
var OP_WITHDRAW2 = Field2(3);
function nowMs() {
  return performance.now();
}
function logPhase(name, startMs) {
  const elapsedMs = nowMs() - startMs;
  console.log(`[o1js rollup-profile] phase=${name} elapsed_ms=${elapsedMs.toFixed(2)}`);
  return nowMs();
}
function toUInt64(value) {
  if (value instanceof UInt642)
    return value;
  return UInt642.from(value);
}
function toRootTransition(result) {
  return {
    initialRoot: result.initialRoot.toString(),
    newRoot: result.newRoot.toString()
  };
}
function installGpuProofHook() {
  if (getGpuProver() !== void 0)
    return;
  setGpuProver(async ({ cpuFallback, proverData }) => {
    const callIndex = typeof proverData === "object" && proverData !== null && "index" in proverData && typeof proverData.index === "number" ? proverData.index : -1;
    console.log(`GPU prover hook called for proof index=${callIndex}`);
    return await cpuFallback();
  });
}
function installGpuMsmHook() {
  if (getGpuMsmRunner() !== void 0)
    return;
  setGpuMsmRunner(createWebGpuBatchedMsmRunner());
}
async function createVaultRollupProofHarness(options = {}) {
  installGpuProofHook();
  installGpuMsmHook();
  const tree = new MerkleTree(BALANCES_TREE_HEIGHT);
  const ownerKey = PrivateKey.random();
  const owner = ownerKey.toPublicKey();
  const accountIndex = 0n;
  let accountState;
  let proofs = [];
  console.log("Compiling MinaVaultRollup...");
  const compileStartMs = nowMs();
  const compileCache = options.compileCache ?? await preloadEmbeddedO1jsCompileCache("rollup");
  if (compileCache === void 0) {
    await MinaVaultRollup.compile();
  } else {
    await MinaVaultRollup.compile({ cache: compileCache });
  }
  logPhase("compile", compileStartMs);
  function currentRoot() {
    return tree.getRoot();
  }
  function currentRootString() {
    return currentRoot().toString();
  }
  function getAccountState() {
    if (accountState === void 0) {
      throw new Error("Account does not exist yet. Call proveDepositNew() first.");
    }
    return accountState;
  }
  function getWitness(index) {
    return new BalanceWitness(tree.getWitness(index));
  }
  async function proveDepositNewInternal(rawAmount) {
    if (accountState !== void 0) {
      throw new Error("Account already exists. Use proveDeposit() instead.");
    }
    const amount = toUInt64(rawAmount);
    console.log("Proving depositNew()...");
    let phaseStartMs = nowMs();
    const initialRoot = tree.getRoot();
    const witness = getWitness(accountIndex);
    const { proof } = await MinaVaultRollup.depositNew(initialRoot, witness, owner, amount);
    phaseStartMs = logPhase("deposit_new_prove", phaseStartMs);
    const newLeaf = new AccountLeaf({
      owner,
      balance: amount,
      nonce: UInt642.zero
    });
    tree.setLeaf(accountIndex, newLeaf.hash());
    accountState = {
      index: accountIndex,
      owner,
      key: ownerKey,
      leaf: newLeaf
    };
    const newRoot = tree.getRoot();
    proof.publicOutput.newRoot.assertEquals(newRoot);
    proofs.push(proof);
    logPhase("deposit_new_apply_local_tree", phaseStartMs);
    return {
      proof,
      initialRoot,
      newRoot
    };
  }
  async function proveDepositInternal(rawAmount) {
    const state = getAccountState();
    const amount = toUInt64(rawAmount);
    console.log("Proving deposit()...");
    let phaseStartMs = nowMs();
    const initialRoot = tree.getRoot();
    const witness = getWitness(state.index);
    const { proof } = await MinaVaultRollup.deposit(initialRoot, witness, state.leaf, amount);
    phaseStartMs = logPhase("deposit_prove", phaseStartMs);
    const newLeaf = state.leaf.addBalance(amount);
    tree.setLeaf(state.index, newLeaf.hash());
    accountState = {
      ...state,
      leaf: newLeaf
    };
    const newRoot = tree.getRoot();
    proof.publicOutput.newRoot.assertEquals(newRoot);
    proofs.push(proof);
    logPhase("deposit_apply_local_tree", phaseStartMs);
    return {
      proof,
      initialRoot,
      newRoot
    };
  }
  async function proveWithdrawInternal(rawAmount) {
    const state = getAccountState();
    const amount = toUInt64(rawAmount);
    console.log("Proving withdraw()...");
    let phaseStartMs = nowMs();
    const initialRoot = tree.getRoot();
    const witness = getWitness(state.index);
    const index = witness.calculateIndex();
    const signature = Signature2.create(state.key, [
      OP_WITHDRAW2,
      initialRoot,
      index,
      amount.value,
      state.leaf.nonce.value
    ]);
    const { proof } = await MinaVaultRollup.withdraw(initialRoot, witness, state.leaf, amount, signature);
    phaseStartMs = logPhase("withdraw_prove", phaseStartMs);
    const newLeaf = state.leaf.subBalance(amount);
    tree.setLeaf(state.index, newLeaf.hash());
    accountState = {
      ...state,
      leaf: newLeaf
    };
    const newRoot = tree.getRoot();
    proof.publicOutput.newRoot.assertEquals(newRoot);
    proofs.push(proof);
    logPhase("withdraw_apply_local_tree", phaseStartMs);
    return {
      proof,
      initialRoot,
      newRoot
    };
  }
  async function mergeTwoProofs(leftProof, rightProof) {
    const initialRoot = leftProof.publicOutput.oldRoot;
    const { proof } = await MinaVaultRollup.merge(initialRoot, leftProof, rightProof);
    return proof;
  }
  return {
    tree,
    ownerKey,
    owner,
    currentRoot,
    currentRootString,
    proveDepositNew: async (amount) => {
      const result = await proveDepositNewInternal(amount);
      return toRootTransition(result);
    },
    proveDeposit: async (amount) => {
      const result = await proveDepositInternal(amount);
      return toRootTransition(result);
    },
    proveWithdraw: async (amount) => {
      const result = await proveWithdrawInternal(amount);
      return toRootTransition(result);
    },
    mergeLastTwoProofs: async () => {
      if (proofs.length < 2) {
        throw new Error("Need at least two proofs to merge.");
      }
      console.log("Proving mergeLastTwoProofs()...");
      const phaseStartMs = nowMs();
      const rightProof = proofs.pop();
      const leftProof = proofs.pop();
      const mergedProof = await mergeTwoProofs(leftProof, rightProof);
      proofs.push(mergedProof);
      logPhase("merge_last_two_proofs", phaseStartMs);
      return {
        initialRoot: mergedProof.publicOutput.oldRoot.toString(),
        newRoot: mergedProof.publicOutput.newRoot.toString()
      };
    },
    mergeAllProofs: async () => {
      if (proofs.length === 0) {
        throw new Error("No proofs to merge.");
      }
      if (proofs.length === 1) {
        const proof = proofs[0];
        return {
          initialRoot: proof.publicOutput.oldRoot.toString(),
          newRoot: proof.publicOutput.newRoot.toString()
        };
      }
      console.log("Proving mergeAllProofs()...");
      const phaseStartMs = nowMs();
      let mergedProof = proofs[0];
      for (let i = 1; i < proofs.length; i++) {
        mergedProof = await mergeTwoProofs(mergedProof, proofs[i]);
      }
      proofs = [mergedProof];
      logPhase("merge_all_proofs", phaseStartMs);
      return {
        initialRoot: mergedProof.publicOutput.oldRoot.toString(),
        newRoot: mergedProof.publicOutput.newRoot.toString()
      };
    }
  };
}
async function run() {
  const totalStartMs = nowMs();
  const harness = await createVaultRollupProofHarness();
  const result = await harness.proveDepositNew(1e9);
  logPhase("run_total", totalStartMs);
  return result;
}
var runRollup_default = run;
export {
  createVaultRollupProofHarness,
  runRollup_default as default,
  run
};
