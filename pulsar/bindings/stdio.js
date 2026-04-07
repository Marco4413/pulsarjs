import { Binding } from "../binding.js";
import { Value, ValueTypeError, valueTypeToString } from "../runtime.js";

/** @import { ExecutionContext, Module, StopSignal } from '../runtime.js'; */

export class StdIOBindings extends Binding {
    #read;
    #write;

    /**
     * @param {Module} module
     * @param {(stopSignal: StopSignal|null|undefined) => Promise<string>} read
     * @param {(...data: any[]) => void} write
     */
    constructor(module, read, write) {
        super(module);
        this.#read  = read;
        this.#write = write;
    }

    bind() {
        this.module.bindNativeByName("stdin/read",    context => this.#stdinRead(context));
        this.module.bindNativeByName("stdout/write!", context => this.#stdoutWrite(context));
    }

    /** @param {ExecutionContext} context */
    async #stdinRead(context) {
        context.currentStack.push(Value.fromString(await this.#read(context.stopSignal)));
    }

    /** @param {ExecutionContext} context */
    #stdoutWrite(context) {
        const [str] = context.currentFrame.locals;
        if (!str.isString()) throw new ValueTypeError(`expected String, got ${valueTypeToString(str.type)}`);
        this.#write(str.value);
    }
}
