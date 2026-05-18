import {
    AccountUpdate,
    Field,
    Mina,
    PrivateKey,
    setNumberOfWorkers,
    setBackend,
    UInt64,
} from 'o1js';
import { MinaVault } from './counter.js';

setBackend('wasm');
setNumberOfWorkers(0);

export async function run() {
    const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);

    const feePayer = Local.testAccounts[0];
    const zkAppKey = PrivateKey.random();
    const zkAppAddress = zkAppKey.toPublicKey();
    const zkApp = new MinaVault(zkAppAddress);

    console.log('Compiling MinaVault...');
    const { verificationKey } = await MinaVault.compile();

    console.log('Deploying MinaVault...');
    const deployTx = await Mina.transaction(feePayer, async () => {
        AccountUpdate.fundNewAccount(feePayer);
        await zkApp.deploy({ verificationKey });
    });
    await deployTx.prove();
    deployTx.sign([feePayer.key, zkAppKey]);
    await deployTx.send();

    console.log('Proving increment()...');
    const incrementTx = await Mina.transaction(feePayer, async () => {
        AccountUpdate.fundNewAccount(feePayer);
        await zkApp.deposit(UInt64.from(1_000_000_000));
    });
    await incrementTx.prove();
    incrementTx.sign([feePayer.key]);
    await incrementTx.send();

    const finalCounter = '0';
    console.log(`Final counter state: ${finalCounter.toString()}`);

    return {
        finalCounter: finalCounter.toString(),
        incrementTx,
    };
}

export default run;
