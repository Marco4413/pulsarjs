/** @import { Module } from './runtime.js'; */

/**
 * @typedef {object} ClickEvent
 * @property {object|null} target
 */

/**
 * @typedef {object} KeyboardEvent
 * @property {string} key
 */

export class Binding {
    #module;

    /** @param {Module} module */
    constructor(module) {
        this.#module = module;
    }

    get module() { return this.#module; }

    bind() {}
}
