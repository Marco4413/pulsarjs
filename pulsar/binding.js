/** @import { Module } from './runtime.js'; */

export class Binding {
    #module;

    /** @param {Module} module */
    constructor(module) {
        this.#module = module;
    }

    get module() { return this.#module; }

    bind() {}
}
