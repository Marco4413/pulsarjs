export class DomConsole {
    /** @type {HTMLElement} */
    #$element;

    #cursorX;
    #cursorY;

    constructor() {
        const $console = document.createElement("div");
        $console.classList.add("console");

        this.#$element = $console;
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
