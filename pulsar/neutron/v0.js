import { Reader } from "../reader.js";
import {
    ValueType,
    Value,
    InstructionCode,
    instructionCodeToString,
    Module
} from "../runtime.js";

/**
 * @import {
 *     Instruction,
 *     FunctionDefinition,
 *     GlobalDefinition,
 * } from '../runtime.js';
 */

/**
 * @import {
 *     SourcePosition,
 *     Token,
 *     FunctionDebugSymbol,
 *     BlockDebugSymbol,
 *     GlobalDebugSymbol,
 *     SourceDebugSymbol,
 * } from '../debug.js';
 */

export const ChunkType = Object.freeze({
    EndOfModule:        0x00,
    Functions:          0x01,
    NativeBindings:     0x02,
    Globals:            0x03,
    Constants:          0x04,
    SourceDebugSymbols: 0x80,
});

export function isOptionalChunkType(chunkType) {
    return chunkType >= 0x80;
}

export const GlobalFlag = Object.freeze({
    IsConstant: 0x01,
});

/** this class can be extended to implement a newer version of the format */
export class NeutronReader {
    constructor() {
        this.loadDebugSymbols = true;
    }

    /**
     * @param {Reader} r
     * @returns {SourcePosition}
     */
    readSourcePosition(r) {
        const line     = r.readU64();
        const char     = r.readU64();
        const index    = r.readU64();
        const charSpan = r.readU64();
        return {line, char, index, charSpan};
    }

    /**
     * @param {Reader} r
     * @returns {Token}
     */
    readToken(r) {
        const tokenType      = r.readU16();
        const sourcePosition = this.readSourcePosition(r);
        return {tokenType, sourcePosition};
    }

    /**
     * @param {Reader} r
     * @returns {FunctionDebugSymbol}
     */
    readFunctionDebugSymbol(r) {
        const token       = this.readToken(r);
        const sourceIndex = r.readU64();
        return {token, sourceIndex};
    }

    /**
     * @param {Reader} r
     * @returns {BlockDebugSymbol}
     */
    readBlockDebugSymbol(r) {
        const token      = this.readToken(r);
        const startIndex = r.readU64();
        return {token, startIndex};
    }

    /**
     * @param {Reader} r
     * @returns {GlobalDebugSymbol}
     */
    readGlobalDebugSymbol(r) {
        const token       = this.readToken(r);
        const sourceIndex = r.readU64();
        return {token, sourceIndex};
    }

    /**
     * @param {Reader} r
     * @returns {SourceDebugSymbol}
     */
    readSourceDebugSymbol(r) {
        const path   = r.readString();
        const source = r.readString();
        return {path, source};
    }

    /**
     * @param {Reader} r
     * @returns {Instruction}
     */
    readInstruction(r) {
        const code = r.readU8();
        let arg0;
        if (code === InstructionCode.PushDbl) {
            arg0 = r.readF64SLEB();
        } else {
            arg0 = r.readI64();
        }
        return {sCode: instructionCodeToString(code), code, arg0};
    }

    /**
     * @param {Reader} r
     * @returns {Instruction[]}
     */
    readCode(r) {
        return r.readList(this.readInstruction);
    }

    /**
     * @param {Reader} r
     * @returns {FunctionDefinition}
     */
    readFunctionDefinition(r) {
        const name    = r.readString();
        const arity   = r.readU64();
        const returns = r.readU64();
        const stackArity  = r.readU64();
        const localsCount = r.readU64();
        const code = r.readSized(r => this.readCode(r));
        const [debugSymbol, codeDebugSymbols] = r.readSized(r => {
            if (!this.loadDebugSymbols || r.remainingBytes <= 0) return [undefined, undefined];
            const debugSymbol      = this.readFunctionDebugSymbol(r);
            const codeDebugSymbols = r.readList(r => this.readBlockDebugSymbol(r));
            return [debugSymbol, codeDebugSymbols];
        });
        return {name, arity, returns, stackArity, localsCount, code, debugSymbol, codeDebugSymbols};
    }

    /**
     * @param {Reader} r
     * @returns {FunctionDefinition}
     */
    readNativeBinding(r) {
        const name    = r.readString();
        const arity   = r.readU64();
        const returns = r.readU64();
        const stackArity  = r.readU64();
        const localsCount = r.readU64();
        /* code: ignored because of binding */ r.readSized(() => {});
        const debugSymbol = r.readSized(r => {
            if (!this.loadDebugSymbols || r.remainingBytes <= 0) return undefined;
            return this.readFunctionDebugSymbol(r);
        });
        return {name, arity, returns, stackArity, localsCount, debugSymbol};
    }

    /**
     * @param {Reader} r
     * @returns {Value}
     */
    readValue(r) {
        const valueType = r.readU8();
        return r.readSized(r => {
            switch (valueType) {
            case ValueType.Void:    return new Value();
            case ValueType.Integer: return Value.fromInteger(r.readI64());
            case ValueType.Double:  return Value.fromDouble(r.readF64());
            case ValueType.FunctionReference:       return Value.fromFunctionReference(r.readI64());
            case ValueType.NativeFunctionReference: return Value.fromNativeFunctionReference(r.readI64());
            case ValueType.List:   return Value.fromList(r.readList(r => this.readValue(r)));
            case ValueType.String: return Value.fromString(r.readString());
            case ValueType.Custom:
            default:
                throw new Error(`unknown/not implemented value type ${valueType}`);
            }
        });
    }

    /**
     * @param {Reader} r
     * @returns {GlobalDefinition}
     */
    readGlobalDefinition(r) {
        const name         = r.readString();
        const flags        = r.readU8();
        const initialValue = this.readValue(r);
        const debugSymbol  = r.readSized(r => {
            if (!this.loadDebugSymbols || r.remainingBytes <= 0) return undefined;
            return this.readGlobalDebugSymbol(r);
        });
        return {
            name, initialValue,
            isConstant: (flags & GlobalFlag.IsConstant) !== 0,
            debugSymbol,
        };
    }

    /**
     * @param {Reader} r
     * @returns {Module}
     */
    readModule(r) {
        const module = new Module();

        /* const size = */ r.readU64();
        let chunkType;
        while (chunkType !== ChunkType.EndOfModule) {
            chunkType = r.readU8();
            r.readSized(r => {
                switch (chunkType) {
                case ChunkType.EndOfModule: break;
                case ChunkType.Functions:      module.addFunctions      (...r.readList(r => this.readFunctionDefinition(r))); break;
                case ChunkType.NativeBindings: module.addNativeBindings (...r.readList(r => this.readNativeBinding(r)));      break;
                case ChunkType.Globals:        module.addGlobals        (...r.readList(r => this.readGlobalDefinition(r)));   break;
                case ChunkType.Constants:      module.addConstants      (...r.readList(r => this.readValue(r)));              break;
                case ChunkType.SourceDebugSymbols: {
                    if (this.loadDebugSymbols) {
                        module.addSourceDebugSymbols(...r.readList(r => this.readSourceDebugSymbol(r)));
                    }
                } break;
                default:
                    if (isOptionalChunkType(chunkType)) {
                        console.warn(`ignored optional chunk type ${chunkType}`);
                    } else {
                        throw new Error(`unknown/not implemented chunk type ${chunkType}`);
                    }
                }
            });
        }

        if (this.loadDebugSymbols)
            module.resolveDebugSymbols();

        return module;
    }
}
