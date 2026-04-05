import { readNeutronBuffer } from "./pulsar/neutron.js";
import { ExecutionContext, Module, Value } from "./pulsar/runtime.js";

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

/** @type {HTMLPreElement} */
let $errorReport;
function reportError(error) {
    console.error(error);
    $errorReport.innerText = `${error.constructor.name}: ${error.message}`;
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
        consoleWrite(context.currentFrame.locals[0].value);
    });
    module.bindNativeByName("println!", context => {
        consoleWrite(context.currentFrame.locals[0].value, "\n");
    });
}

/**
 * @param {string} fileName
 * @param {ArrayBufferLike} buffer
 */
async function runScript(fileName, buffer) {
    clearError();
    clearInput();
    consoleClear();

    try {
        const module = readNeutronBuffer(buffer);
        bindNatives(module);

        const context = new ExecutionContext(module);
        context.stack.push(Value.fromList([ Value.fromString(fileName) ]));
        context.callFunctionByName("main");

        await context.runAsync();
    } catch (error) {
        reportError(error);
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
