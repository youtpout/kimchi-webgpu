import { SmartContract, state, Field, State, method } from 'o1js';

export class SimpleCounter extends SmartContract {
    @state(Field) counter = State<Field>();

    @method async increment() {
        const currentCounter = this.counter.getAndRequireEquals();
        this.counter.set(currentCounter.add(1));
    }
}
