import { Binding } from "../binding.js";
import { Value } from "../runtime.js";

/** @import { ExecutionContext } from '../runtime.js'; */

export class TimeBindings extends Binding {
    bind() {
        this.module.bindNativeByName("time/steady", context => this.#timeSteady(context));
        this.module.bindNativeByName("time/micros", context => this.#timeMicros(context));
    }

    /** @param {ExecutionContext} context */
    #timeSteady(context) {
        context.currentFrame.stack.push(Value.fromInteger(
            BigInt(performance.now())
        ));
    }

    /** @param {ExecutionContext} context */
    #timeMicros(context) {
        context.currentFrame.stack.push(Value.fromInteger(
            BigInt(performance.now()) * 1000n
        ));
    }
}
