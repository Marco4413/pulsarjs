import { Binding } from "../binding.js";
import { Value, ValueTypeError, valueTypeToString } from "../runtime.js";

/** @import { ClickEvent, KeyboardEvent } from '../binding.js'; */
/** @import { ExecutionContext, Module } from '../runtime.js'; */

/** @type {Map<string, number>} */
const KEY_MAP = new Map([
    [ " ", 32 ], [ "!", 33 ], [ "\"", 34 ], [ "#", 35 ],
    [ "$", 36 ], [ "%", 37 ], [ "&",  38 ], [ "'", 39 ],
    [ "(", 40 ], [ ")", 41 ], [ "*",  42 ], [ "+", 43 ],
    [ ",", 44 ], [ "-", 45 ], [ ".",  46 ], [ "/", 47 ],
    [ "0", 48 ], [ "1", 49 ], [ "2",  50 ], [ "3", 51 ],
    [ "4", 52 ], [ "5", 53 ], [ "6",  54 ], [ "7", 55 ],
    [ "8", 56 ], [ "9", 57 ], [ ":",  58 ], [ ";", 59 ],
    [ "=", 61 ], [ ">", 62 ], [ "?",  63 ], [ "@", 64 ],

    [ "a", 65 ], [ "b", 66 ], [ "c", 67 ], [ "d", 68 ],
    [ "e", 69 ], [ "f", 70 ], [ "g", 71 ], [ "h", 72 ],
    [ "i", 73 ], [ "j", 74 ], [ "k", 75 ], [ "l", 76 ],
    [ "m", 77 ], [ "n", 78 ], [ "o", 79 ], [ "p", 80 ],
    [ "q", 81 ], [ "r", 82 ], [ "s", 83 ], [ "t", 84 ],
    [ "u", 85 ], [ "v", 86 ], [ "w", 87 ], [ "x", 88 ],
    [ "y", 89 ], [ "z", 90 ],

    [ "[", 91 ], [ "\\", 92 ], [ "]",  93 ], [ "^",  94 ], [ "_",  95 ],
    [ "`", 96 ], [ "{", 123 ], [ "|", 124 ], [ "}", 125 ], [ "~", 126 ],

    [ "escape",    256 ], [ "enter",  257 ], [ "tab",    258 ],
    [ "backspace", 259 ], [ "insert", 260 ], [ "delete", 261 ],

    [ "arrowright", 262 ], [ "arrowleft", 263 ],
    [ "arrowdown",  264 ], [ "arrowup",   265 ],

    [ "pageup", 266 ], [ "pagedown", 267 ],
    [ "home",   268 ], [ "end",      269 ],

    [ "capslock", 280 ], [ "pause", 284 ],

    [ "f1", 290 ], [ "f2",  291 ], [ "f3",  292 ], [ "f4",  293 ],
    [ "f5", 294 ], [ "f6",  295 ], [ "f7",  296 ], [ "f8",  297 ],
    [ "f9", 298 ], [ "f10", 299 ], [ "f11", 300 ], [ "f12", 301 ],

    [ "shift", 340 ], [ "control", 341 ], [ "alt", 342 ],
]);

export class RaylibBindings extends Binding {
    #$window;
    #$title;
    #$screen;

    #screenContext;
    #renderContext;

    #lastFrameTime;
    #nextFrameDelta;
    #deltaTime;

    /** @type {Set<number>} */
    #keysDown1;
    /** @type {Set<number>} */
    #keysDown2;
    /** @type {Set<number>} */
    #keysDownN;

    #windowFocus;

    /** @param {Module} module */
    constructor(module) {
        super(module);
        const $window     = document.createElement("div");
        const $title      = document.createElement("p");
        const $screenSlot = document.createElement("div");
        const $screen     = document.createElement("canvas");

        $window.classList.add("raylib-closed");
        $window.classList.add("raylib-window");
        $title.classList.add("raylib-title");
        $screenSlot.classList.add("raylib-screen-slot");
        $screen.classList.add("raylib-screen");

        $screenSlot.appendChild($screen);

        $window.appendChild($title);
        $window.appendChild($screenSlot);

        this.#$screen = $screen;
        this.#$title  = $title;
        this.#$window = $window;

        this.#screenContext  = this.#$screen.getContext("2d");
        const renderCanvas   = new OffscreenCanvas(0, 0);
        this.#renderContext  = renderCanvas.getContext("2d");
        this.#lastFrameTime  = null;
        this.#nextFrameDelta = 0;
        this.#deltaTime      = 0.016;

        this.#keysDown1 = new Set();
        this.#keysDown2 = new Set();
        this.#keysDownN = new Set();

        this.#windowFocus = false;
    }

    get $window() { return this.#$window; }
    get windowFocus() { return this.#windowFocus; }

    /** @param {KeyboardEvent} evt */
    receiveKeyDown(evt) {
        const keyCode = KEY_MAP.get(evt.key.toLowerCase());
        if (keyCode != null) {
            this.#keysDownN.add(keyCode);
        } else {
            console.warn(`RaylibBindings: receiveKeyDown('${key}') is not implemented`);
        }
    }

    /** @param {KeyboardEvent} evt */
    receiveKeyUp(evt) {
        const keyCode = KEY_MAP.get(evt.key.toLowerCase());
        if (keyCode != null) {
            this.#keysDownN.delete(keyCode);
        } else {
            console.warn(`RaylibBindings: receiveKeyUp('${key}') is not implemented`);
        }
    }

    /** @param {ClickEvent} evt */
    receiveClick(evt) {
        if (evt.target == null) return;
        /** @type {HTMLElement} */
        const $target  = evt.target;
        const position = this.#$window.compareDocumentPosition($target);
        const windowClicked = position === 0 || (position & Node.DOCUMENT_POSITION_CONTAINED_BY) !== 0;
        this.setWindowFocus(windowClicked);
    }

    /** @param {boolean} focus */
    setWindowFocus(focus) {
        this.#$window.classList.toggle("raylib-focus", focus);
        this.#windowFocus = focus;
    }

    bind() {
        this.module.bindNativeByName("raylib/init-window!",         context => this.#initWindow(context));
        this.module.bindNativeByName("raylib/set-target-fps!",      context => this.#setTargetFps(context));
        this.module.bindNativeByName("raylib/get-frame-time",       context => this.#getFrameTime(context));
        this.module.bindNativeByName("raylib/window-should-close?", context => this.#windowShouldClose(context));
        this.module.bindNativeByName("raylib/close-window!",        context => this.#closeWindow(context));

        this.module.bindNativeByName("raylib/begin-drawing!",    context => this.#beginDrawing(context));
        this.module.bindNativeByName("raylib/get-screen-width",  context => this.#getScreenWidth(context));
        this.module.bindNativeByName("raylib/get-screen-height", context => this.#getScreenHeight(context));
        this.module.bindNativeByName("raylib/clear-background!", context => this.#clearBackground(context));
        this.module.bindNativeByName("raylib/draw-rectangle!",   context => this.#drawRectangle(context));
        this.module.bindNativeByName("raylib/draw-text!",        context => this.#drawText(context));
        this.module.bindNativeByName("raylib/measure-text",      context => this.#measureText(context));
        this.module.bindNativeByName("raylib/end-drawing!",      context => this.#endDrawing(context));

        this.module.bindNativeByName("raylib/is-key-pressed?", context => this.#isKeyPressed(context));
    }

    /** @param {Value} color */
    #getColorFromValueImpl(color) {
        if (!color.isInteger()) throw new ValueTypeError(`expected Integer for color, got ${valueTypeToString(color.type)}`);
        const hex = Number(color.value);
        const rgba = [
            (hex >> 24) & 0xFF,
            (hex >> 16) & 0xFF,
            (hex >>  8) & 0xFF,
            (hex >>  0) & 0xFF,
        ];

        return "#" + rgba.map(comp => comp.toString(16).padStart(2, "0")).join("");
    }

    #isKeyPressedImpl(keyOrKeyCode) {
        if (!Number.isInteger(keyOrKeyCode)) {
            keyOrKeyCode = KEY_MAP.get(keyOrKeyCode.toLowerCase());
        }
        if (keyOrKeyCode == null) return false;
        return !this.#keysDown1.has(keyOrKeyCode) && this.#keysDown2.has(keyOrKeyCode);
    }

    /** @param {ExecutionContext} context */
    #initWindow(context) {
        const frame = context.currentFrame;
        const [ width, height, title ] = frame.locals;
        if (!width.isInteger())  throw new ValueTypeError(`expected Integer for width, got ${valueTypeToString(width.type)}`);
        if (!height.isInteger()) throw new ValueTypeError(`expected Integer for height, got ${valueTypeToString(height.type)}`);
        if (!title.isString())   throw new ValueTypeError(`expected String for title, got ${valueTypeToString(title.type)}`);

        this.#$window.classList.remove("raylib-closed");
        this.#renderContext.canvas.width  = Number(width.value);
        this.#renderContext.canvas.height = Number(height.value);
        this.#$title.innerText = title.value;
    }

    /** @param {ExecutionContext} context */
    #setTargetFps(context) {
        const frame = context.currentFrame;
        const [ fps ] = frame.locals;
        if (!fps.isInteger())  throw new ValueTypeError(`expected Integer for fps, got ${valueTypeToString(fps.type)}`);
        this.#nextFrameDelta = Math.floor(1000 / Number(fps.value));
    }

    /** @param {ExecutionContext} context */
    #getFrameTime(context) {
        context.currentFrame.stack.push(Value.fromDouble(this.#deltaTime));
    }

    /** @param {ExecutionContext} context */
    #windowShouldClose(context) {
        context.currentFrame.stack.push(Value.fromInteger(this.#isKeyPressedImpl("escape") ? 1 : 0));
    }

    /** @param {ExecutionContext} context */
    #closeWindow(context) {
        this.#$window.classList.add("raylib-closed");
    }

    /** @param {ExecutionContext} context */
    #beginDrawing(context) {
        if (this.#lastFrameTime == null) {
            this.#lastFrameTime = performance.now();
        }

        if (this.windowFocus) {
            this.#keysDown1 = this.#keysDown2;
            this.#keysDown2 = this.#keysDownN;
            this.#keysDownN = new Set(this.#keysDownN.keys());
        } else {
            this.#keysDown1.clear();
            this.#keysDown2.clear();
        }
    }

    /** @param {ExecutionContext} context */
    #getScreenWidth(context) {
        context.currentFrame.stack.push(Value.fromInteger(Math.floor(this.#renderContext.canvas.width)));
    }

    /** @param {ExecutionContext} context */
    #getScreenHeight(context) {
        context.currentFrame.stack.push(Value.fromInteger(Math.floor(this.#renderContext.canvas.height)));
    }

    /** @param {ExecutionContext} context */
    #clearBackground(context) {
        const frame = context.currentFrame;
        const [ color ] = frame.locals;
        this.#renderContext.fillStyle = this.#getColorFromValueImpl(color);
        this.#renderContext.fillRect(0, 0, this.#renderContext.canvas.width, this.#renderContext.canvas.height)
    }

    /** @param {ExecutionContext} context */
    #drawRectangle(context) {
        const frame = context.currentFrame;
        const [ x, y, w, h, color ] = frame.locals;
        if (!x.isNumber()) throw new ValueTypeError(`expected Number for x, got ${valueTypeToString(x.type)}`);
        if (!y.isNumber()) throw new ValueTypeError(`expected Number for y, got ${valueTypeToString(y.type)}`);
        if (!w.isNumber()) throw new ValueTypeError(`expected Number for w, got ${valueTypeToString(w.type)}`);
        if (!h.isNumber()) throw new ValueTypeError(`expected Number for h, got ${valueTypeToString(h.type)}`);
        this.#renderContext.fillStyle = this.#getColorFromValueImpl(color);
        this.#renderContext.fillRect(
                Number(x.value),
                Number(y.value),
                Number(w.value),
                Number(h.value));
    }

    /** @param {ExecutionContext} context */
    #drawText(context) {
        const frame = context.currentFrame;
        const [ text, x, y, fontSize, color ] = frame.locals;
        if (!text.isString()) throw new ValueTypeError(`expected String for text, got ${valueTypeToString(text.type)}`);
        if (!x.isNumber()) throw new ValueTypeError(`expected Number for x, got ${valueTypeToString(x.type)}`);
        if (!y.isNumber()) throw new ValueTypeError(`expected Number for y, got ${valueTypeToString(y.type)}`);
        if (!fontSize.isNumber()) throw new ValueTypeError(`expected Number for fontSize, got ${valueTypeToString(fontSize.type)}`);
        this.#renderContext.font = `${Math.floor(Number(fontSize.value))}px 'JetBrains Mono'`;
        this.#renderContext.textBaseline = "top";
        this.#renderContext.fillStyle = this.#getColorFromValueImpl(color);
        this.#renderContext.fillText(
                text.value,
                Number(x.value),
                Number(y.value));
    }

    /** @param {ExecutionContext} context */
    #measureText(context) {
        const frame = context.currentFrame;
        const [ text, fontSize ] = frame.locals;
        if (!text.isString()) throw new ValueTypeError(`expected String for text, got ${valueTypeToString(text.type)}`);
        if (!fontSize.isNumber()) throw new ValueTypeError(`expected Number for fontSize, got ${valueTypeToString(fontSize.type)}`);
        this.#renderContext.font = `${Math.floor(Number(fontSize.value))}px 'JetBrains Mono'`;
        const measure = this.#renderContext.measureText(text.value);
        context.currentFrame.stack.push(Value.fromInteger(Math.floor(measure.width)));
    }

    /** @param {ExecutionContext} context */
    async #endDrawing(context) {
        const framePromise = new Promise((resolve, reject) => {
            requestAnimationFrame(() => {
                try {
                    const $screen = this.#screenContext.canvas;
                    const $render = this.#renderContext.canvas;
                    if ($screen.width  !== $render.width)  $screen.width  = $render.width;
                    if ($screen.height !== $render.height) $screen.height = $render.height;
                    this.#screenContext.drawImage($render, 0, 0);
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        });

        const stopSignal = context.stopSignal;
        await Promise.any([
            framePromise,
            stopSignal.waitStop()
        ]);
        stopSignal.handleRequest();

        const thisFrameTime = performance.now();
        const deltaTime     = thisFrameTime - this.#lastFrameTime;
        this.#lastFrameTime = thisFrameTime;

        this.#deltaTime = deltaTime * 0.001;

        const syncTime = this.#nextFrameDelta - deltaTime;
        if (syncTime > 0) {
            await Promise.any([
                new Promise(res => setTimeout(res, syncTime)),
                stopSignal.waitStop()
            ]);
            stopSignal.handleRequest();
        }
    }

    /**
     * @param {ExecutionContext} context
     */
    #isKeyPressed(context) {
        const frame = context.currentFrame;
        const [ key ] = frame.locals;
        if (!key.isInteger())  throw new ValueTypeError(`expected Integer for key, got ${valueTypeToString(key.type)}`);
        const keyCode = Number(key.value);

        context.currentFrame.stack.push(Value.fromInteger(this.#isKeyPressedImpl(keyCode) ? 1 : 0));
    }
}
