import { PrintBindings } from "./pulsar/bindings/print.js";
import { StdIOBindings } from "./pulsar/bindings/stdio.js";
import { ThreadBindings } from "./pulsar/bindings/thread.js";
import { TimeBindings } from "./pulsar/bindings/time.js";
import { readNeutronBuffer } from "./pulsar/neutron.js";
import {
    ExecutionContext,
    Module,
    StopSignal,
    Value,
    getErrorReport,
} from "./pulsar/runtime.js";
import { Console } from "./utils/console.js";

const myConsole = new Console();

/** @type {HTMLPreElement} */
let $errorReport;
function reportError(error, context) {
    console.error(error);
    if (context == null || context.isDone) {
        $errorReport.innerText = getErrorReport(error, undefined);
    } else {
        let report = getErrorReport(error, context.currentFrame);
        report += "\ncall stack:\n";
        report += context.getCallStackReport(5);
        $errorReport.innerText = report;
    }
}

function clearError() {
    $errorReport.innerText = "";
}

/** @param {Module} module */
function bindNatives(module) {
    const bindings = [
        new PrintBindings(module,
                (...data) => myConsole.write(...data)),
        new StdIOBindings(module,
                (stopSignal) => myConsole.read(stopSignal),
                (...data)    => myConsole.write(...data)),
        new ThreadBindings(module),
        new TimeBindings(module),
    ];

    for (const binding of bindings) {
        binding.bind();
    }
}

let lastStopSignal;

async function stopScript() {
    while (lastStopSignal != null) {
        const stopSignal = lastStopSignal;
        await stopSignal.stop();

        // if no other script was ran or this signal is still active
        if (lastStopSignal == null || lastStopSignal === stopSignal) {
            // clear the signal and resume execution
            lastStopSignal = null;
        }
    }
}

/**
 * @param {string} fileName
 * @param {ArrayBufferLike} buffer
 */
async function runScript(fileName, buffer) {
    await stopScript();

    clearError();
    myConsole.clearAll();

    try {
        const module = readNeutronBuffer(buffer);
        bindNatives(module);

        const context = new ExecutionContext(module);
        context.stack.push(Value.fromList([ Value.fromString(fileName) ]));
        context.callFunctionByName("main");

        const thisStopSignal = new StopSignal();
        lastStopSignal = thisStopSignal;

        try {
            await context.runAsync(thisStopSignal);
        } catch (error) {
            if (!thisStopSignal.isStopping) {
                reportError(error, context);
            }
        }
    } catch (error) {
        reportError(error, undefined);
    }
}

window.addEventListener("load", async () => {
    const $console = document.getElementById("console");
    $console.replaceWith(myConsole.$element);

    $errorReport = document.getElementById("error-report");

    /** @type {HTMLSelectElement} */
    const $examplePicker = document.getElementById("example-picker");

    /** @type {HTMLLabelElement} */
    const $scriptLabel = document.getElementById("script-label");
    const NO_SCRIPT_TEXT = $scriptLabel.innerText;
    /** @type {HTMLInputElement} */
    const $scriptPicker = document.getElementById("script-picker");

    const clearExamplePicker = () => {
        $examplePicker.value = "";
    };

    const runFromExamplePicker = async () => {
        const filePath  = $examplePicker.value;
        if (filePath.length <= 0) return;
        const file      = await fetch(filePath);
        const fileBytes = await file.bytes();
        clearScriptPicker();
        await runScript(filePath, fileBytes.buffer);
    };

    const clearScriptPicker = () => {
        $scriptLabel.innerText = NO_SCRIPT_TEXT;
        $scriptPicker.value = "";
    };

    const runFromScriptPicker = async () => {
        if ($scriptPicker.files.length <= 0) {
            clearScriptPicker();
            return;
        }

        const scriptFile  = $scriptPicker.files[0];
        const scriptBytes = await scriptFile.bytes();
        $scriptLabel.innerText = `Script: '${scriptFile.name}'`;
        clearExamplePicker();
        await runScript(scriptFile.name, scriptBytes.buffer);
    };

    clearExamplePicker();
    clearScriptPicker();
    $examplePicker.addEventListener("change", () => runFromExamplePicker());
    $scriptPicker.addEventListener("input", () => runFromScriptPicker());
});
