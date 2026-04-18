import { Console } from "./utils/console.js";
import { PulsarScript } from "./utils/pulsarScript.js";

const myConsole = new Console();

/** @type {HTMLPreElement} */
let $report;

let runningScript = null;
/** @returns {Promise<PulsarScript>} */
async function loadNewScript(fileName, buffer) {
    myConsole.clearAll();
    $report.innerText = "";
    while (runningScript != null) {
        const thisScript = runningScript;
        await thisScript.stop();

        // if no other script was ran or this signal is still active
        if (runningScript == null || runningScript === thisScript) {
            // clear the script and resume execution
            runningScript = null;
        }
    }

    try {
        runningScript = new PulsarScript(fileName, buffer);
        runningScript.bindNatives(
                (...data)    => myConsole.write(...data),
                (stopSignal) => myConsole.read(stopSignal));
        runningScript.onReport(message => {
            $report.innerText = message;
        });
    } catch (error) {
        $report.innerText = `${error.constructor.name}: ${error.message}`;
    }

    return runningScript;
}

window.addEventListener("load", async () => {
    const $console = document.getElementById("console");
    $console.replaceWith(myConsole.$element);

    $report = document.getElementById("report");

    /** @type {HTMLSelectElement} */
    const $examplePicker = document.getElementById("example-picker");

    /** @type {HTMLLabelElement} */
    const $scriptLabel = document.getElementById("script-label");
    const NO_SCRIPT_TEXT = $scriptLabel.innerText;
    /** @type {HTMLInputElement} */
    const $scriptPicker = document.getElementById("script-picker");

    let debugStep;
    /** @type {HTMLInputElement} */
    const $debug = document.getElementById("debug");
    const $debugStep = document.getElementById("debug-step");
    $debugStep.classList.add("collapsed");
    $debugStep.addEventListener("click", () => {
        if (debugStep != null) {
            debugStep().catch(console.warn);
        }
    });

    const runScript = async (fileName, buffer) => {
        debugStep = undefined;
        const script = await loadNewScript(fileName, buffer);
        if ($debug.checked) {
            $debugStep.classList.remove("collapsed");
            debugStep = script.runDebug({ linesBefore: 2, linesAfter: 2 });
        } else {
            $debugStep.classList.add("collapsed");
            script.run().catch(console.warn);
        }
    };

    const clearExamplePicker = () => {
        $examplePicker.value = "";
    };

    const runFromExamplePicker = async () => {
        const filePath  = $examplePicker.value;
        if (filePath.length <= 0) return;
        const file      = await fetch(filePath);
        const fileBytes = await file.bytes();
        clearScriptPicker();
        runScript(filePath, fileBytes.buffer);
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

        const file      = $scriptPicker.files[0];
        const fileBytes = await file.bytes();
        $scriptLabel.innerText = `Script: '${file.name}'`;
        clearExamplePicker();
        runScript(file.name, fileBytes.buffer);
    };

    clearExamplePicker();
    clearScriptPicker();
    $examplePicker.addEventListener("change", () => runFromExamplePicker());
    $scriptPicker.addEventListener("input", () => runFromScriptPicker());
});
