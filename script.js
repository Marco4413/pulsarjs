import { getCodeSourceDebugData, getFunctionSourceDebugData } from "./pulsar/debug.js";
import { readNeutronBuffer } from "./pulsar/neutron.js";
import { ExecutionContext, Module, Value, ValueTypeError, valueTypeToString } from "./pulsar/runtime.js";

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
        } else {
            $console.lastChild.innerText += span;
        }
    }

    while ($console.children.length > MAX_LINES) {
        $console.children.item(0).remove();
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

async function getInput() {
    while (inputBuffer.length <= 0) {
        await new Promise(res => requestAnimationFrame(res));
    }
    return inputBuffer.shift();
}

function getErrorReport(error, frame) {
    function getFullViewWithPositionTag(debugData) {
        const positionTag = `${debugData.sourcePosition.line+1}:${debugData.sourcePosition.char+1} |`;
        return `${positionTag} ${debugData.view}\n${"|".padStart(positionTag.length)} ${debugData.cursor}`;
    }

    let report = `${error.constructor.name}: ${error.message}`;
    if (frame == null) return report;

    report += `\ninside function '${frame.function.name}'`;

    let debugData;

    debugData = getFunctionSourceDebugData(frame.function.debugSymbol);
    if (debugData != null && debugData.view != null) {
        report += ` (${debugData.path})\ndefined at:\n${getFullViewWithPositionTag(debugData)}`;
    }

    debugData = getCodeSourceDebugData(frame.function.codeDebugSymbols, frame.instructionIndex);
    if (debugData != null && debugData.view != null) {
        report += `\nduring execution of:\n${getFullViewWithPositionTag(debugData)}`;
    }

    return report;
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
        context.currentStack.push(Value.fromString(await getInput()));
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

// HACK: allow for proper script termination
let isScriptRunning = false;

/**
 * @param {string} fileName
 * @param {ArrayBufferLike} buffer
 */
async function runScript(fileName, buffer) {
    if (isScriptRunning) {
        window.alert("A script is already running. Currently a script cannot be forcefully stopped. Please complete any previously running script before trying to run a new one.");
        return;
    }

    isScriptRunning = true;
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
            await context.runAsync();
        } catch (error) {
            reportError(error, context);
        }
    } catch (error) {
        reportError(error, undefined);
    } finally {
        isScriptRunning = false;
    }
}

window.addEventListener("load", async () => {
    $console = document.getElementById("console");
    $errorReport = document.getElementById("error-report");

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
    $examplePicker.addEventListener("change", async ev => {
        const filePath  = ev.target.value;
        if (filePath.length <= 0) return;
        const file      = await fetch(filePath);
        const fileBytes = await file.bytes();
        await runScript(filePath, fileBytes.buffer);
    });

    /** @type {HTMLLabelElement} */
    const $scriptLabel = document.getElementById("script-label");
    const NO_SCRIPT_TEXT = $scriptLabel.innerText;
    /** @type {HTMLInputElement} */
    const $scriptPicker = document.getElementById("script-picker");
    $scriptPicker.addEventListener("input", async () => {
        if ($scriptPicker.files.length <= 0) {
            $scriptLabel.innerText = NO_SCRIPT_TEXT;
            return;
        }

        const scriptFile  = $scriptPicker.files[0];
        const scriptBytes = await scriptFile.bytes();
        $scriptLabel.innerText = `Script: '${scriptFile.name}'`;
        await runScript(scriptFile.name, scriptBytes.buffer);
    });
});
