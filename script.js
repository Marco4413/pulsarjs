import { readNeutronBuffer } from "./pulsar/neutron.js";
import {
    ExecutionContext,
    Module,
    StopSignal,
    Value,
    ValueTypeError,
    valueTypeToString,
    getErrorReport,
} from "./pulsar/runtime.js";

/** @type {HTMLElement} */
let $console;
function consoleWrite(...data) {
    if ($console == null) return;

    const MAX_LINES = 128;

    if ($console.children.length <= 0) {
        consoleClear();
    }

    const text  = data.map(datum => new String(datum)).join(" ");
    const spans = text.split(/(\x1B\[[\d;]*[A-Z]|\n)/gi);

    let scrollToBottom = false;
    for (const span of spans) {
        if (span.startsWith("\x1B")) {
            switch (span) {
            case "\x1B[2J": consoleClear(); break;
            default:
                console.warn(`unhandled escape sequence: ^${span.slice(1)}`);
            }
        } else if (span === "\n") {
            const $pre = document.createElement("pre");
            $console.appendChild($pre);
            scrollToBottom = true;
        } else {
            $console.lastChild.innerText += span;
        }
    }

    while ($console.children.length > MAX_LINES) {
        $console.children.item(0).remove();
    }

    if (scrollToBottom) {
        $console.scrollTop = $console.scrollHeight;
    }
}

function consoleClear() {
    if ($console == null) return;
    $console.innerHTML = "";
    const $pre = document.createElement("pre");
    $console.appendChild($pre);
}

/** @type {string[]} */
let inputBuffer = [];
function sendInput(text) {
    inputBuffer.push(text);
}

function clearInput() {
    inputBuffer = [];
}

async function getInput(stopSignal) {
    while (inputBuffer.length <= 0) {
        if (stopSignal != null) stopSignal.handleRequest();
        await new Promise(res => requestAnimationFrame(res));
    }
    return inputBuffer.shift();
}

/** @type {HTMLPreElement} */
let $errorReport;
function reportError(error, context) {
    console.error(error);
    $errorReport.innerText = context == null || context.isDone
        ? getErrorReport(error, undefined)
        : getErrorReport(error, context.currentFrame);
}

function clearError() {
    $errorReport.innerText = "";
}

/** @param {Module} module */
function bindNatives(module) {
    module.bindNativeByName("stdin/read", async context => {
        context.currentStack.push(Value.fromString(await getInput(context.stopSignal)));
    });
    module.bindNativeByName("stdout/write!", context => {
        const s = context.currentFrame.locals[0];
        if (!s.isString())
            throw new ValueTypeError(`expected String, got ${valueTypeToString(s.type)}`);
        consoleWrite(s.value);
    });
    module.bindNativeByName("println!", context => {
        consoleWrite(context.currentFrame.locals[0].value, "\n");
    });
}

let lastStopSignal;

/**
 * @param {string} fileName
 * @param {ArrayBufferLike} buffer
 */
async function runScript(fileName, buffer) {
    const thisStopSignal = new StopSignal();
    if (lastStopSignal != null)
        await lastStopSignal.stop();
    lastStopSignal = thisStopSignal;

    clearError();
    clearInput();
    consoleClear();

    try {
        const module = readNeutronBuffer(buffer);
        bindNatives(module);

        const context = new ExecutionContext(module);
        context.stack.push(Value.fromList([ Value.fromString(fileName) ]));
        context.callFunctionByName("main");

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
    $console = document.getElementById("console");
    $errorReport = document.getElementById("error-report");

    const $clearIO = document.getElementById("clear-io");
    $clearIO.addEventListener("click", () => {
        clearInput();
        consoleClear();
    });

    /** @type {HTMLInputElement} */
    const $input = document.getElementById("input");
    $input.addEventListener("keypress", ev => {
        if (ev.key === "Enter") {
            sendInput(ev.target.value);
            consoleWrite(ev.target.value, "\n");
            ev.target.value = "";
        }
    });

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
