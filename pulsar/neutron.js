import { Reader } from "./reader.js";
import {
    ValueType,
    Value,
    InstructionCode,
    instructionCodeToString,
    Module
} from "./runtime.js";

/**
 * @import {
 *     Instruction,
 *     FunctionDefinition,
 *     GlobalDefinition,
 * } from './runtime.js';
 */

/**
 * @import {
 *     SourcePosition,
 *     Token,
 *     FunctionDebugSymbol,
 *     BlockDebugSymbol,
 *     GlobalDebugSymbol,
 *     SourceDebugSymbol,
 * } from './debug.js';
 */

const ChunkType = Object.freeze({
    EndOfModule:        0x00,
    Functions:          0x01,
    NativeBindings:     0x02,
    Globals:            0x03,
    Constants:          0x04,
    SourceDebugSymbols: 0x80,
});

/* function chunkTypeToString(chunkType) {
    switch (chunkType) {
    case ChunkType.EndOfModule:        return "EndOfModule";
    case ChunkType.Functions:          return "Functions";
    case ChunkType.NativeBindings:     return "NativeBindings";
    case ChunkType.Globals:            return "Globals";
    case ChunkType.Constants:          return "Constants";
    case ChunkType.SourceDebugSymbols: return "SourceDebugSymbols";
    }
    throw new Error(`unknown chunk type ${chunkType}`);
} */

function isOptionalChunkType(chunkType) {
    return chunkType >= 0x80;
}

/**
 * @param {Reader} r
 * @returns {SourcePosition}
 */
function readSourcePosition(r) {
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
function readToken(r) {
    const tokenType      = r.readU16();
    const sourcePosition = readSourcePosition(r);
    return {tokenType, sourcePosition};
}

/**
 * @param {Reader} r
 * @returns {FunctionDebugSymbol}
 */
function readFunctionDebugSymbol(r) {
    const token       = readToken(r);
    const sourceIndex = r.readU64();
    return {token, sourceIndex};
}

/**
 * @param {Reader} r
 * @returns {BlockDebugSymbol}
 */
function readBlockDebugSymbol(r) {
    const token      = readToken(r);
    const startIndex = r.readU64();
    return {token, startIndex};
}

/**
 * @param {Reader} r
 * @returns {GlobalDebugSymbol}
 */
function readGlobalDebugSymbol(r) {
    const token       = readToken(r);
    const sourceIndex = r.readU64();
    return {token, sourceIndex};
}

/**
 * @param {Reader} r
 * @returns {SourceDebugSymbol}
 */
function readSourceDebugSymbol(r) {
    const path   = r.readString();
    const source = r.readString();
    return {path, source};
}

/**
 * @param {Reader} r
 * @returns {Instruction}
 */
function readInstruction(r) {
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
function readCode(r) {
    return r.readList(readInstruction);
}

/**
 * @param {Reader} r
 * @returns {FunctionDefinition}
 */
function readFunctionDefinition(r) {
    const name    = r.readString();
    const arity   = r.readU64();
    const returns = r.readU64();
    const stackArity  = r.readU64();
    const localsCount = r.readU64();
    const code = r.readSized(readCode);
    const [debugSymbol, codeDebugSymbols] = r.readSized(r => {
        if (r.remainingBytes <= 0) return [undefined, undefined];
        const debugSymbol      = readFunctionDebugSymbol(r);
        const codeDebugSymbols = r.readList(readBlockDebugSymbol);
        return [debugSymbol, codeDebugSymbols];
    });
    return {name, arity, returns, stackArity, localsCount, code, debugSymbol, codeDebugSymbols};
}

/**
 * @param {Reader} r
 * @returns {FunctionDefinition}
 */
function readNativeBinding(r) {
    const name    = r.readString();
    const arity   = r.readU64();
    const returns = r.readU64();
    const stackArity  = r.readU64();
    const localsCount = r.readU64();
    /* code: ignored because of binding */ r.readSized(() => {});
    const [debugSymbol, /* ignore code debug symbols */ _] = r.readSized(r => {
        if (r.remainingBytes <= 0) return [undefined, undefined];
        const debugSymbol      = readFunctionDebugSymbol(r);
        const codeDebugSymbols = r.readList(readBlockDebugSymbol);
        return [debugSymbol, codeDebugSymbols];
    });
    return {name, arity, returns, stackArity, localsCount, debugSymbol};
}

/**
 * @param {Reader} r
 * @returns {Value}
 */
function readValue(r) {
    const valueType = r.readU8();
    return r.readSized(r => {
        switch (valueType) {
        case ValueType.Void:    return new Value();
        case ValueType.Integer: return Value.fromInteger(r.readI64());
        case ValueType.Double:  return Value.fromDouble(r.readF64());
        case ValueType.FunctionReference:       return Value.fromFunctionReference(r.readI64());
        case ValueType.NativeFunctionReference: return Value.fromNativeFunctionReference(r.readI64());
        case ValueType.List:   return Value.fromList(r.readList(readValue));
        case ValueType.String: return Value.fromString(r.readString());
        case ValueType.Custom:
        default:
            throw new Error(`unknown/not implemented value type ${valueType}`);
        }
    });
}

const GlobalFlag = Object.freeze({
    IsConstant: 0x01,
});

/**
 * @param {Reader} r
 * @returns {GlobalDefinition}
 */
function readGlobalDefinition(r) {
    const name         = r.readString();
    const flags        = r.readU8();
    const initialValue = readValue(r);
    const debugSymbol  = r.readSized(r => {
        if (r.remainingBytes <= 0) return undefined;
        const debugSymbol = readGlobalDebugSymbol(r);
        return debugSymbol;
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
function readModule(r) {
    const module = new Module();

    /* const size = */ r.readU64();
    let chunkType;
    while (chunkType !== ChunkType.EndOfModule) {
        chunkType = r.readU8();
        r.readSized(r => {
            switch (chunkType) {
            case ChunkType.EndOfModule: break;
            case ChunkType.Functions:      module.addFunctions      (...r.readList(readFunctionDefinition)); break;
            case ChunkType.NativeBindings: module.addNativeBindings (...r.readList(readNativeBinding));      break;
            case ChunkType.Globals:        module.addGlobals        (...r.readList(readGlobalDefinition));   break;
            case ChunkType.Constants:      module.addConstants      (...r.readList(readValue));              break;
            case ChunkType.SourceDebugSymbols: module.addSourceDebugSymbols(...r.readList(readSourceDebugSymbol)); break;
            default:
                if (isOptionalChunkType(chunkType)) {
                    console.warn(`ignored optional chunk type ${chunkType}`);
                } else {
                    throw new Error(`unknown/not implemented chunk type ${chunkType}`);
                }
            }
        });
    }

    module.resolveDebugSymbols();
    return module;
}

/**
 * @param {Reader} r
 * @returns {Module}
 */
export function readNeutron(r) {
    const MAGIC   = 0x58544E00; // "\0NTX"
    const VERSION = 0;

    const magic = r.readU32();
    if (magic !== MAGIC)
        throw new Error("invalid format");

    const version = r.readU32();
    if (version !== VERSION)
        throw new Error("unsupported version");

    return readModule(r);
}

/**
 * @param {ArrayBufferLike} buffer
 * @returns {Module}
 */
export function readNeutronBuffer(buffer) {
    return readNeutron(new Reader(buffer));
}
