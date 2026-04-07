import { Binding } from "../binding.js";

/** @import { ExecutionContext, Module } from '../runtime.js'; */

export class PrintBindings extends Binding {
    #write;

    /**
     * @param {Module} module
     * @param {(...data: any[]) => void} write
     */
    constructor(module, write) {
        super(module);
        this.#write = write;
    }

    bind() {
        this.module.bindNativeByName("println!", context => this.#println(context));
    }

    /** @param {ExecutionContext} context */
    async #println(context) {
        this.#write(context.currentFrame.locals[0].value, "\n");
    }
}
