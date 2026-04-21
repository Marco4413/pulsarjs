import { PrintBindings } from "../pulsar/bindings/print.js";
import { StdIOBindings } from "../pulsar/bindings/stdio.js";
import { ThreadBindings } from "../pulsar/bindings/thread.js";
import { TimeBindings } from "../pulsar/bindings/time.js";
import { findCodeDebugSymbol } from "../pulsar/debug.js";
import { readNeutronBuffer } from "../pulsar/neutron.js";
import { ExecutionContext, StopSignal, Value } from "../pulsar/runtime.js";

/** @import { FrameReportOptions } from '../pulsar/runtime.js'; */

/** @enum {number} */
export const StepKind = Object.freeze({
    Instruction: 0,
    StepOver:    1,
    StepInto:    2,
    StepOut:     3,
});

export class PulsarScript {
    #fileName;
    #module;
    #bindings;
    #context;
    #running;

    #stopSignal;

    #reportListeners;
    #callStackDepth;

    /** @throws any load error */
    constructor(fileName, buffer) {
        this.#load(fileName, buffer);
        this.#stopSignal      = new StopSignal();
        this.#reportListeners = [];
        this.#callStackDepth  = 5;
    }

    async stop() {
        await this.#stopSignal.stop();
        this.#running = false;
    }

    /**
     * @throws any runtime error
     * @param {FrameReportOptions} [frameReportOptions]
     * @returns 
     */
    async run(frameReportOptions) {
        if (this.#running) return false;
        this.#running = true;
        this.#stopSignal = new StopSignal();

        try {
            this.#context.callFunctionByName("main");
            await this.#context.runAsync(this.#stopSignal);
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

        let doStep, stepPromise;
        const step = (stepKind) => {
            if (doStep != null) {
                doStep(stepKind);
                return stepPromise;
            }
            return Promise.resolve(false);
        };

        let stepResolve, stepReject;
        stepPromise = new Promise((resolve, reject) => {
            stepResolve = resolve;
            stepReject  = reject;
        });

        let doStepPromise = new Promise(resolve => {
            doStep = resolve;
        });

        frameReportOptions = { ...(frameReportOptions ?? {}) };
        frameReportOptions.showFullCursor = true;
        frameReportOptions.instructionIndexOffset = 1;

        (async () => {
            try {
                this.#context.callFunctionByName("main");

                let stepKind, prevDebugState;
                while (!this.#context.isDone) {
                    if (stepKind == null) {
                        this.report(this.#context.getStateReport(this.#callStackDepth, frameReportOptions));
    
                        await Promise.any([
                            doStepPromise.then(requestedStepKind => {
                                stepKind = requestedStepKind ?? StepKind.Instruction;
                            }),
                            this.#stopSignal.waitStop(),
                        ]);

                        doStepPromise = new Promise(resolve => {
                            doStep = resolve;
                        });

                        if (stepKind === StepKind.Instruction) {
                            prevDebugState = undefined;
                            frameReportOptions.showFullCursor = true;
                        } else {
                            prevDebugState = this.#getDebugState(frameReportOptions.instructionIndexOffset);
                            frameReportOptions.showFullCursor = false;
                        }
                    }

                    this.#stopSignal.handleRequest();
                    await this.#context.step(this.#stopSignal);

                    if (this.#stepRequiresAction(stepKind, prevDebugState, this.#getDebugState(frameReportOptions.instructionIndexOffset))) {
                        stepKind = undefined;

                        stepResolve(!this.#context.isDone);
                        stepPromise = new Promise((resolve, reject) => {
                            stepResolve = resolve;
                            stepReject  = reject;
                        });
                    }
                }

                this.report("execution completed");
            } catch (error) {
                if (this.#stopSignal.isStopping) {
                    stepResolve(false);
                } else {
                    stepReject(error);
                    frameReportOptions.showFullCursor = true;
                    frameReportOptions.instructionIndexOffset = 0;
                    this.report(this.#context.getErrorReport(error, this.#callStackDepth, frameReportOptions));
                }
            } finally {
                doStep = stepPromise = stepResolve = stepReject = doStepPromise = undefined;
                this.#stopSignal.complete();
                this.#running = false;
            }
        })();

        return step;
    }

    onReport(listener) {
        this.#reportListeners.push(listener);
    }

    report(message) {
        this.#reportListeners.forEach(listener => listener(message));
    }

    bindNatives(consoleWrite, consoleRead) {
        if (this.#bindings != null) return;
        this.#bindings = [
            new PrintBindings(this.#module, consoleWrite),
            new StdIOBindings(this.#module, consoleRead, consoleWrite),
            new ThreadBindings(this.#module),
            new TimeBindings(this.#module),
        ];
    
        for (const binding of this.#bindings) {
            binding.bind();
        }
    }

    #load(fileName, buffer) {
        this.#fileName = fileName;
        this.#module = readNeutronBuffer(buffer);
        this.#context = new ExecutionContext(this.#module);
        this.#context.stack.push(Value.fromList([ Value.fromString(fileName) ]));
    }
}
