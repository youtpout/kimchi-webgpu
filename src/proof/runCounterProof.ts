import {
    AccountUpdate,
    Field,
    Mina,
    PrivateKey,
    setNumberOfWorkers,
    setBackend,
} from 'o1js';
import { SimpleCounter } from './counter.js';

setBackend('wasm');
setNumberOfWorkers(0);

export async function run() {
    const Local = await Mina.LocalBlockchain({ proofsEnabled: true });
    Mina.setActiveInstance(Local);

    const feePayer = Local.testAccounts[0];
    const zkAppKey = PrivateKey.random();
    const zkAppAddress = zkAppKey.toPublicKey();
    const zkApp = new SimpleCounter(zkAppAddress);

    console.log('Compiling SimpleCounter...');
    const { verificationKey } = await SimpleCounter.compile();

    console.log('Deploying SimpleCounter...');
    const deployTx = await Mina.transaction(feePayer, async () => {
        AccountUpdate.fundNewAccount(feePayer);
        await zkApp.deploy({ verificationKey });
        zkApp.counter.set(Field(0));
    });
    await deployTx.prove();
    deployTx.sign([feePayer.key, zkAppKey]);
    await deployTx.send();

    console.log('Proving increment()...');
    const incrementTx = await Mina.transaction(feePayer, async () => {
        await zkApp.increment();
    });
    await incrementTx.prove();
    incrementTx.sign([feePayer.key]);
    await incrementTx.send();

    const finalCounter = zkApp.counter.get();
    console.log(`Final counter state: ${finalCounter.toString()}`);

    return {
        finalCounter: finalCounter.toString(),
        incrementTx,
    };
}

export default run;
