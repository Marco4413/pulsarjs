import { Console } from "./utils/console.js";
import { PulsarScript, StepKind } from "./utils/pulsarScript.js";

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

    const $windows = document.getElementById("windows");
    $windows.innerHTML = "";

    try {
        runningScript = new PulsarScript(fileName, buffer);
        const scriptHooks = runningScript.bindNatives(
                (...data)    => myConsole.write(...data),
                (stopSignal) => myConsole.read(stopSignal));
        runningScript.onReport(message => {
            $report.innerText = message;
        });

        $windows.append(...scriptHooks.windows);
    } catch (error) {
        $report.innerText = `${error.constructor.name}: ${error.message}`;
        runningScript = null;
    }

    return runningScript;
}

window.addEventListener("load", async () => {
    window.addEventListener("keydown", async ev => await runningScript?.hooks?.sendKeyDown(ev));
    window.addEventListener("keyup",   async ev => await runningScript?.hooks?.sendKeyUp(ev));
    window.addEventListener("click",   async ev => await runningScript?.hooks?.sendClick(ev));

    const $console = document.getElementById("console");
    $console.replaceWith(myConsole.$element);

    $report = document.getElementById("report");

    /** @type {HTMLSelectElement} */
    const $examplePicker = document.getElementById("example-picker");
    const $exampleShare  = document.getElementById("example-share");

    /** @type {HTMLLabelElement} */
    const $scriptLabel = document.getElementById("script-label");
    const NO_SCRIPT_TEXT = $scriptLabel.innerText;
    /** @type {HTMLInputElement} */
    const $scriptPicker = document.getElementById("script-picker");

    let debugStep;
    /** @type {HTMLInputElement} */
    const $debug = document.getElementById("debug");

    const $stepButtons = document.getElementById("step-buttons");
    $stepButtons.classList.add("collapsed");

    const attachStepFunction = (elementId, stepKind) => {
        const $step = document.getElementById(elementId);
        $step.addEventListener("click", () => {
            if (debugStep != null) {
                debugStep(stepKind).catch(console.warn);
            }
        });
    };

    attachStepFunction("debug-step",      StepKind.Instruction);
    attachStepFunction("debug-step-over", StepKind.StepOver);
    attachStepFunction("debug-step-into", StepKind.StepInto);
    attachStepFunction("debug-step-out",  StepKind.StepOut);
    attachStepFunction("debug-step-continue", StepKind.Continue);
    attachStepFunction("debug-step-pause",    StepKind.Pause);

    const runScript = async (fileName, buffer) => {
        debugStep = undefined;
        const script = await loadNewScript(fileName, buffer);
        if ($debug.checked) {
            $stepButtons.classList.remove("collapsed");
            debugStep = script.runDebug({ linesBefore: 2, linesAfter: 2 });
        } else {
            $stepButtons.classList.add("collapsed");
            script.run(undefined, { frameTime: 250 }).catch(console.warn);
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

    /** @param {HTMLOptionElement} $option */
    const getExampleName = ($option) => {
        return $option.innerText.replaceAll(/\s+/g, "").toLowerCase();
    };

    $exampleShare.addEventListener("click", () => {
        if ($examplePicker.value.length <= 0) return;
        const $option = $examplePicker.options.item($examplePicker.selectedIndex);

        const url = new URL(document.location);
        url.searchParams.set("example", getExampleName($option));
        window.location.replace(url);
    });

    {
        const url = new URL(document.location);
        const example = url.searchParams.get("example")?.toLowerCase();
        if (example != null) {
            console.log(`Loading '${example}' from URL`);
            let exampleFound = false;
            for (let index = 0; index < $examplePicker.options.length; index++) {
                const $option = $examplePicker.options.item(index);
                if (getExampleName($option) === example) {
                    exampleFound = true;
                    $examplePicker.selectedIndex = index;
                    runFromExamplePicker();
                    break;
                }
            }
            if (!exampleFound) {
                console.warn(`Could not load '${example}', it's not a valid example`);
            }
        }
    }
});
