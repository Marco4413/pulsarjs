import { PrintBindings } from "../pulsar/bindings/print.js";
import { StdIOBindings } from "../pulsar/bindings/stdio.js";
import { ThreadBindings } from "../pulsar/bindings/thread.js";
import { TimeBindings } from "../pulsar/bindings/time.js";
import { readNeutronBuffer } from "../pulsar/neutron.js";
import { ExecutionContext, StopSignal, Value } from "../pulsar/runtime.js";

/** @import { SourceDebugDataOptions } from '../pulsar/debug.js'; */

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
     * @param {SourceDebugDataOptions} [frameReportOptions]
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

    /**
     * @param {SourceDebugDataOptions} [frameReportOptions]
     * @returns {() => Promise<void>} step function
     */
    runDebug(frameReportOptions) {
        if (this.#running) return null;
        this.#running = true;

        let doStep, stepPromise;
        const step = () => {
            if (doStep != null) {
                doStep();
                return stepPromise;
            }
            return Promise.resolve();
        };

        (async () => {
            let stepResolve, stepReject;
            stepPromise = new Promise((resolve, reject) => {
                stepResolve = resolve;
                stepReject  = reject;
            });

            try {
                this.#context.callFunctionByName("main");

                while (!this.#context.isDone) {
                    this.report(this.#context.getStateReport(this.#callStackDepth, frameReportOptions));

                    await Promise.any([
                        new Promise(resolve => { doStep = resolve; }),
                        this.#stopSignal.waitStop(),
                    ]);

                    doStep = undefined;
                    this.#stopSignal.handleRequest();

                    await this.#context.step(this.#stopSignal);

                    stepResolve();
                    stepPromise = new Promise((resolve, reject) => {
                        stepResolve = resolve;
                        stepReject  = reject;
                    });
                }

                this.report("execution completed");
            } catch (error) {
                if (this.#stopSignal.isStopping) {
                    stepResolve();
                } else {
                    stepReject(error);
                    this.report(this.#context.getErrorReport(error, this.#callStackDepth, frameReportOptions));
                }
            } finally {
                doStep = undefined;
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
