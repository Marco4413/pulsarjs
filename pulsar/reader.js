export class UnexpectedEndOfBufferError extends Error{}

export class Reader {
    #buffer;
    #cursor;

    /**
     * @param {ArrayBufferLike} buffer
     */
    constructor(buffer) {
        this.#buffer = new Uint8Array(buffer);
        this.#cursor = 0;
    }

    get remainingBytes() {
        return Math.max(0, this.#buffer.length - this.#cursor);
    }

    readU8() {
        if (this.#cursor + 1 > this.#buffer.length)
            throw new UnexpectedEndOfBufferError();
        return this.#buffer[this.#cursor++];
    }

    readSLEB() {
        let value = 0n;
        let shift = 0;
        while (true) {
            const byte = this.readU8();
            value |= BigInt(byte & 0x7F) << BigInt(shift);
            shift += 7;
            if ((byte & 0x80) === 0) {
                if ((byte & 0x40) !== 0)
                    value = BigInt.asIntN(shift, value);
                break;
            }
        }
        return value;
    }

    readULEB() {
        let value = 0n;
        let shift = 0;
        while (true) {
            const byte = this.readU8();
            value |= BigInt(byte & 0x7F) << BigInt(shift);
            if ((byte & 0x80) === 0)
                break;
            shift += 7;
        }
        return value;
    }

    readF64SLEB() {
        const value = this.readSLEB();
        const bytes = new Uint8Array(Float64Array.BYTES_PER_ELEMENT);
        for (let i = 0, shift = 0n; i < bytes.length; ++i, shift += 8n) {
            bytes[i] = Number((value >> shift) & 0xFFn);
        }
        return new Float64Array(bytes.buffer)[0];
    }

    readU16() {
        if (this.#cursor + 2 > this.#buffer.length)
            throw new UnexpectedEndOfBufferError();

        const val = (
            this.#buffer[this.#cursor+0] << 0 |
            this.#buffer[this.#cursor+1] << 8
        );

        this.#cursor += 2;

        return val;
    }

    readU32() {
        if (this.#cursor + 4 > this.#buffer.length)
            throw new UnexpectedEndOfBufferError();

        const val = (
            this.#buffer[this.#cursor+0] <<  0 |
            this.#buffer[this.#cursor+1] <<  8 |
            this.#buffer[this.#cursor+2] << 16 |
            this.#buffer[this.#cursor+3] << 24
        );

        this.#cursor += 4;

        return val;
    }

    readI64() {
        const value = this.readSLEB();
        return Number(value);
    }

    readU64() {
        const value = this.readULEB();
        return Number(value);
    }

    readF64() {
        if (this.#cursor + Float64Array.BYTES_PER_ELEMENT > this.#buffer.length)
            throw new UnexpectedEndOfBufferError();
        const f64Buffer = this.#buffer.buffer.slice(this.#cursor, this.#cursor + Float64Array.BYTES_PER_ELEMENT);
        const f64Array  = new Float64Array(f64Buffer);
        this.#cursor += Float64Array.BYTES_PER_ELEMENT;
        return f64Array[0];
    }

    /**
     * @template T
     * @param {(r: Reader, ...args) => T} chunkReader
     * @param {...any} args
     * @returns {T}
     */
    readSized(chunkReader, ...args) {
        const size = this.readU64();
        if (this.#cursor + size > this.#buffer.length)
            throw new UnexpectedEndOfBufferError();
        const slice = this.#buffer.buffer.slice(this.#cursor, this.#cursor + size);
        const value = chunkReader(new Reader(slice), ...args)
        this.#cursor += size;
        return value;
    }

    /**
     * @template T
     * @param {(r: Reader, ...args) => T} itemReader
     * @param {...any} args
     * @returns {T[]}
     */
    readList(itemReader, ...args) {
        const size = this.readU64();
        const list = new Array(size);
        for (let i = 0; i < size; ++i) {
            list[i] = itemReader(this, ...args);
        }
        return list;
    }

    readString() {
        const size = this.readU64();
        if (this.#cursor + size > this.#buffer.length)
            throw new UnexpectedEndOfBufferError();
        const slice = this.#buffer.buffer.slice(this.#cursor, this.#cursor + size);
        const value = new TextDecoder("UTF8").decode(slice);
        this.#cursor += size;
        return value;
    }
}
