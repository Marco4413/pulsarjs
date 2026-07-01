import { PrintBindings } from "../pulsar/bindings/print.js";
import { StdIOBindings } from "../pulsar/bindings/stdio.js";
import { ThreadBindings } from "../pulsar/bindings/thread.js";
import { TimeBindings } from "../pulsar/bindings/time.js";
import { RaylibBindings } from "../pulsar/bindings/raylib.js";
import { findCodeDebugSymbol } from "../pulsar/debug.js";
import { readNeutronBuffer } from "../pulsar/neutron.js";
import { ExecutionContext, StopSignal, Value } from "../pulsar/runtime.js";

/** @import { FrameReportOptions, RunAsyncOptions } from '../pulsar/runtime.js'; */
/** @import { ClickEvent, KeyboardEvent } from '../pulsar/binding.js'; */

export class ScriptHooks {
    /** @type {HTMLElement[]} */
    #windows;
    #keyDownListeners;
    #keyUpListeners;
    #clickListeners;

    constructor() {
        this.#windows          = [];
        this.#keyDownListeners = [];
        this.#keyUpListeners   = [];
        this.#clickListeners   = [];
    }

    get windows() { return this.#windows.values(); }

    /** @param {KeyboardEvent} evt */
    async sendKeyDown(evt) { await this.#dispatch(this.#keyDownListeners, evt); }
    /** @param {KeyboardEvent} evt */
    async sendKeyUp(evt)   { await this.#dispatch(this.#keyUpListeners, evt); }
    /** @param {ClickEvent} evt */
    async sendClick(evt)   { await this.#dispatch(this.#clickListeners, evt); }

    /** @param {HTMLElement} $window */
    addWindow($window)  { this.#windows.push($window); }
    /** @param {(evt: KeyboardEvent) => Promise<void>|void} listener */
    onKeyDown(listener) { this.#keyDownListeners.push(listener); }
    /** @param {(evt: KeyboardEvent) => Promise<void>|void} listener */
    onKeyUp(listener)   { this.#keyUpListeners.push(listener); }
    /** @param {(evt: ClickEvent) => Promise<void>|void} listener */
    onClick(listener)   { this.#clickListeners.push(listener); }

    async #dispatch(listeners, evt) {
        for (const listener of listeners) {
            try {
                await listener(evt);
            } catch (error) {
                console.error(error);
            }
        }
    }
}

/**
 * a clone of `Promise.withResolvers()` because it was implemented in 2024, see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/withResolvers#browser_compatibility
 * @template T
 * @returns {{ promise: Promise<T>, resolve: (value: T) => void, reject: (reason?: any) => void }}
 */
function promiseWithResolvers() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
        resolve = res;
        reject  = rej;
    });
    return { promise, resolve, reject };
}

/** @enum {number} */
export const StepKind = Object.freeze({
    Instruction: 0,
    StepOver:    1,
    StepInto:    2,
    StepOut:     3,
    Continue:    4,
    Pause:       5,
});

export class PulsarScript {
    #fileName;
    #module;
    #bindings;
    #hooks;
    #context;
    #running;

    #stopSignal;

    #reportListeners;
    #callStackDepth;

    /** @throws any load error */
    constructor(fileName, buffer) {
        this.#load(fileName, buffer);
        this.#hooks = new ScriptHooks();
        this.#stopSignal      = new StopSignal();
        this.#reportListeners = [];
        this.#callStackDepth  = 5;
    }

    get hooks() { return this.#hooks; }

    async stop() {
        await this.#stopSignal.stop();
        this.#running = false;
    }

    /**
     * @throws any runtime error
     * @param {FrameReportOptions} [frameReportOptions]
     * @param {RunAsyncOptions} [runAsyncOptions]
     * @returns {Promise<boolean>}
     */
    async run(frameReportOptions, runAsyncOptions) {
        if (this.#running) return false;
        this.#running = true;
        this.#stopSignal = new StopSignal();

        try {
            this.#context.callFunctionByName("main");
            await this.#context.runAsync(this.#stopSignal, runAsyncOptions);
        } catch (error) {
            if (!this.#stopSignal.isStopping) {
                this.report(this.#context.getErrorReport(error, this.#callStackDepth, frameReportOptions));
                throw error;
            }
        } finally {
            this.#running = false;
        }

        return true;
    }

    #getDebugState(instructionIndexOffset) {
        const callStackLength = this.#context.callStackLength;
        let codeDebugSymbol;
        if (this.#context.callStackLength > 0) {
            const frame = this.#context.currentFrame;
            codeDebugSymbol = findCodeDebugSymbol(
                    frame.function.codeDebugSymbols ?? [],
                    frame.instructionIndex+instructionIndexOffset);
        }
        return { callStackLength, codeDebugSymbol };
    }

    #stepRequiresAction(stepKind, prevDebugState, currDebugState) {
        if (prevDebugState == null || currDebugState == null)
            return true;

        switch (stepKind) {
        case StepKind.Instruction: return true;
        case StepKind.StepInto:
            if (currDebugState.callStackLength > prevDebugState.callStackLength)
                return true;
            // fallthrough
        case StepKind.StepOver:
            if (currDebugState.callStackLength > prevDebugState.callStackLength)
                return false;

            return prevDebugState.codeDebugSymbol == null || currDebugState.codeDebugSymbol == null
                || prevDebugState.codeDebugSymbol.resolvedSource            !== currDebugState.codeDebugSymbol.resolvedSource
                || prevDebugState.codeDebugSymbol.token.sourcePosition.line !== currDebugState.codeDebugSymbol.token.sourcePosition.line;
        case StepKind.StepOut:
            return currDebugState.callStackLength < prevDebugState.callStackLength;
        case StepKind.Continue: return false;
        case StepKind.Pause:    return true;
        default:
            throw new Error(`unhandled stepKind ${stepKind}`);
        }
    }

    /**
     * @param {FrameReportOptions} [frameReportOptions] showFullCursor and instructionIndexOffset are ignored
     * @returns {(stepKind: StepKind|undefined) => Promise<boolean>} step function, throws runtime errors, returns true if more steps can be taken
     */
    runDebug(frameReportOptions) {
        if (this.#running) return null;
        this.#running = true;

        let step = promiseWithResolvers();
        let next = promiseWithResolvers();

        let stepRequested = false;
        let stepKind = StepKind.Pause;
        const stepFn = (newStepKind) => {
            if (next != null) {
                stepRequested = true;
                stepKind = newStepKind ?? StepKind.Pause;
                next.resolve();
                return step.promise;
            }
            return Promise.resolve(false);
        };

        frameReportOptions = { ...(frameReportOptions ?? {}) };
        frameReportOptions.showFullCursor = true;
        frameReportOptions.instructionIndexOffset = 1;

        (async () => {
            try {
                this.#context.callFunctionByName("main");

                let prevDebugState;
                while (!this.#context.isDone) {
                    if (stepKind === StepKind.Pause) {
                        if (stepRequested) {
                            step.resolve(true);
                            step = promiseWithResolvers();
                            stepRequested = false;
                        }

                        this.report(this.#context.getStateReport(this.#callStackDepth, frameReportOptions));

                        await Promise.any([ next.promise, this.#stopSignal.waitStop() ]);
                        this.#stopSignal.handleRequest();
                        next = promiseWithResolvers();

                        // show the full cursor when the user explicitly asks to pause.
                        // if you continue, when pause is issued the full cursor won't be shown (expected behaviour);
                        // if the user wants to see the next instruction, it's as simple as asking to pause again
                        if (stepKind === StepKind.Instruction || stepKind === StepKind.Pause) {
                            // no need to calc prevDebugState
                            prevDebugState = undefined;
                            frameReportOptions.showFullCursor = true;
                        } else {
                            prevDebugState = this.#getDebugState(frameReportOptions.instructionIndexOffset);
                            frameReportOptions.showFullCursor = false;
                        }
                    } else {
                        await this.#context.step(this.#stopSignal);
                        if (this.#stepRequiresAction(stepKind, prevDebugState, this.#getDebugState(frameReportOptions.instructionIndexOffset))) {
                            stepKind = StepKind.Pause;
                        }
                    }
                }

                step.resolve(false);
                this.report("execution completed");
            } catch (error) {
                if (this.#stopSignal.isStopping) {
                    step.resolve(false);
                } else {
                    step.reject(error);
                    frameReportOptions.showFullCursor = true;
                    frameReportOptions.instructionIndexOffset = 0;
                    this.report(this.#context.getErrorReport(error, this.#callStackDepth, frameReportOptions));
                }
            } finally {
                step = undefined;
                next = undefined;
                this.#stopSignal.complete();
                this.#running = false;
            }
        })();

        return stepFn;
    }

    onReport(listener) {
        this.#reportListeners.push(listener);
    }

    report(message) {
        this.#reportListeners.forEach(listener => listener(message));
    }

    bindNatives(consoleWrite, consoleRead) {
        if (this.#bindings != null) return this.#hooks;
        const raylibBindings = new RaylibBindings(this.#module);
        this.#bindings = [
            new PrintBindings(this.#module, consoleWrite),
            new StdIOBindings(this.#module, consoleRead, consoleWrite),
            new ThreadBindings(this.#module),
            new TimeBindings(this.#module),
            raylibBindings,
        ];

        for (const binding of this.#bindings) {
            binding.bind();
        }

        this.#hooks.addWindow(raylibBindings.$window);
        this.#hooks.onKeyDown(evt => raylibBindings.receiveKeyDown(evt));
        this.#hooks.onKeyUp(evt => raylibBindings.receiveKeyUp(evt));
        this.#hooks.onClick(evt => raylibBindings.receiveClick(evt));
        return this.#hooks;
    }

    #load(fileName, buffer) {
        this.#fileName = fileName;
        this.#module = readNeutronBuffer(buffer);
        this.#context = new ExecutionContext(this.#module);
        this.#context.stack.push(Value.fromList([ Value.fromString(fileName) ]));
    }
}
