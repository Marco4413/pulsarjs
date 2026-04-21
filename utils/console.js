export class StdOut {
    /** @type {HTMLElement} */
    #$element;

    #cursorX;
    #cursorY;

    constructor() {
        const $stdout = document.createElement("div");
        $stdout.classList.add("stdout");

        this.#$element = $stdout;
        this.#cursorX  = 0;
        this.#cursorY  = 0;
    }

    get $element() { return this.#$element; }

    setCursor(x, y) {
        this.#cursorX = Math.max(0, x);
        this.#cursorY = Math.max(0, y);
    }

    clear() {
        const $console = this.#$element;
        $console.innerHTML = "";
        this.setCursor(0, 0);
    }

    write(...data) {
        const $console = this.#$element;

        const text  = data.map(datum => new String(datum)).join(" ");
        const spans = text.split(/(\x1B\[[\d;]*[A-Z]|\n)/gi);

        let scrollToBottom = false;
        for (const span of spans) {
            if (span.startsWith("\x1B")) {
                let match;
                if (span === "\x1B[2J") {
                    this.clear();
                } else if ((match = (/^\x1B\[(\d+);(\d+)H$/g).exec(span)) != null) {
                    const [_, sCursorX, sCursorY] = match;
                    this.setCursor(Number(sCursorY)-1, Number(sCursorX)-1);
                } else {
                    console.warn(`unhandled escape sequence: ^${span.slice(1)}`);
                }
            } else if (span === "\n") {
                this.setCursor(0, this.#cursorY+1);
                scrollToBottom = true;
            } else {
                this.#insertText(span);
            }
        }

        if (scrollToBottom) {
            $console.scrollTop = $console.scrollHeight;
        }
    }

    #insertText(text) {
        this.#createMissingLines();
        const $line = this.#getCurrentLine();
        if (this.#cursorX > $line.innerText.length) {
            $line.innerText += " ".repeat(this.#cursorX - $line.innerText.length);
            $line.innerText += text;
        } else if (this.#cursorX < $line.innerText.length) {
            const prefix = $line.innerText.slice(0, this.#cursorX);
            const suffix = $line.innerText.slice(this.#cursorX + text.length);
            $line.innerText = `${prefix}${text}${suffix}`;
        } else {
            $line.innerText += text;
        }
        this.#cursorX += text.length;
    }

    /** @returns {HTMLPreElement} */
    #getCurrentLine() {
        return this.#$element.children.item(this.#cursorY);
    }

    #createMissingLines() {
        const $console = this.#$element;
        while ($console.children.length <= this.#cursorY) {
            const $line = document.createElement("pre");
            $console.appendChild($line);
        }
    }
}

export class StdIn {
    /** @type {HTMLElement} */
    #$element;

    #inputBuffer;
    #inputListeners;

    constructor() {
        this.#inputBuffer = [];
        this.#inputListeners = [];

        const $stdinContainer = document.createElement("div");
        $stdinContainer.classList.add("stdin-container");

        const $stdin = document.createElement("input");
        $stdin.classList.add("stdin");
        $stdin.type = "text";
        $stdin.addEventListener("keypress", ev => {
            if (ev.key === "Enter") {
                this.#sendInput(ev.target.value);
                ev.target.value = "";
            }
        });

        $stdinContainer.appendChild($stdin);
        this.#$element = $stdinContainer;
    }

    get $element() { return this.#$element; }

    onInput(callback) {
        this.#inputListeners.push(callback);
    }

    clear() {
        this.#inputBuffer = [];
    }

    async read(stopSignal) {
        // TODO: hook into onInput
        while (this.#inputBuffer.length <= 0) {
            if (stopSignal != null) stopSignal.handleRequest();
            await new Promise(resolve => requestAnimationFrame(resolve));
        }
        return this.#inputBuffer.shift();
    }

    #sendInput(text) {
        this.#inputBuffer.push(text);
        this.#inputListeners.forEach(listener => listener(text));
    }
}

export class Console {
    #stdout;
    #stdin;

    #$element;

    constructor() {
        this.#stdout = new StdOut();
        this.#stdin  = new StdIn();

        this.#stdin.onInput(text => {
            this.write(text, "\n");
        });

        const $clearAll = document.createElement("button");
        $clearAll.innerText = "Clear";
        $clearAll.classList.add("console-clear");
        $clearAll.addEventListener("click", () => {
            this.clearAll();
        });

        const $stdout = this.#stdout.$element;
        const $stdin  = this.#stdin.$element;
        $stdin.insertBefore($clearAll, $stdin.firstChild);

        const $resizeBar = document.createElement("div");
        $resizeBar.classList.add("resize-bar");

        let capturedPointerId;
        $resizeBar.addEventListener("pointerdown", ev => {
            if (capturedPointerId == null) {
                capturedPointerId = ev.pointerId;
                ev.target.setPointerCapture(capturedPointerId);
                $resizeBar.classList.add("resize-bar-drag");
            }
        });
        $resizeBar.addEventListener("pointerup", ev => {
            if (ev.pointerId === capturedPointerId) {
                ev.target.releasePointerCapture(capturedPointerId);
                capturedPointerId = undefined;
                $resizeBar.classList.remove("resize-bar-drag");
            }
        });
        $resizeBar.addEventListener("pointermove", ev => {
            if (ev.pointerId === capturedPointerId) {
                const newHeight = $stdout.clientHeight + ev.offsetY;
                $stdout.style.height = `${newHeight}px`;
            }
        });

        const $console = document.createElement("div");
        $console.classList.add("console");
        $console.appendChild($stdout);
        $console.appendChild($resizeBar);
        $console.appendChild($stdin);
        this.#$element = $console;
    }

    get $element() { return this.#$element; }

    clearAll() {
        this.#stdin.clear();
        this.#stdout.clear();
    }

    write(...data) {
        this.#stdout.write(...data);
    }

    read(stopSignal) {
        return this.#stdin.read(stopSignal);
    }
}
