import { getFunctionSourceDebugData, getCodeSourceDebugData } from "./debug.js";

/**
 * @import {
 *     FunctionDebugSymbol,
 *     BlockDebugSymbol,
 *     GlobalDebugSymbol,
 *     SourceDebugSymbol,
 *     SourceDebugData,
 * } from './debug.js';
 */

/** @enum {number} */
export const ValueType = Object.freeze({
    Void:                    0x00,
    Integer:                 0x01,
    Double:                  0x02,
    FunctionReference:       0x03,
    NativeFunctionReference: 0x04,
    List:                    0x05,
    String:                  0x06,
    Custom:                  0xFF,
});

/**
 * @typedef {object} Value
 * @property {ValueType} type
 * @property {number|string} [value]
 */

/**
 * @param {ValueType} valueType
 * @returns {string}
 */
export function valueTypeToString(valueType) {
    switch (valueType) {
    case ValueType.Void:                    return "Void";
    case ValueType.Integer:                 return "Integer";
    case ValueType.Double:                  return "Double";
    case ValueType.FunctionReference:       return "FunctionReference";
    case ValueType.NativeFunctionReference: return "NativeFunctionReference";
    case ValueType.List:                    return "List";
    case ValueType.String:                  return "String";
    case ValueType.Custom:                  return "Custom";
    }
    throw new Error(`unknown value type ${valueType}`);
}

/** @enum {number} */
export const InstructionCode = Object.freeze({
    PushInt:                     0x01,
    PushDbl:                     0x02,
    PushFunctionReference:       0x03,
    PushNativeFunctionReference: 0x04,
    PushEmptyList:               0x05,
    Pack:                        0x06,
    Pop:                         0x0D,
    Swap:                        0x0E,
    Dup:                         0x0F,
    PushConst:                   0x10,
    PushLocal:                   0x11,
    MoveLocal:                   0x12,
    PopIntoLocal:                0x13,
    CopyIntoLocal:               0x14,
    PushGlobal:                  0x15,
    MoveGlobal:                  0x16,
    PopIntoGlobal:               0x17,
    CopyIntoGlobal:              0x18,
    Return:                      0x20,
    Call:                        0x21,
    CallNative:                  0x22,
    ICall:                       0x2F,
    DynSum:                      0x30,
    DynSub:                      0x31,
    DynMul:                      0x32,
    DynDiv:                      0x33,
    Mod:                         0x34,
    BitAnd:                      0x38,
    BitOr:                       0x39,
    BitNot:                      0x3A,
    BitXor:                      0x3B,
    BitShiftLeft:                0x3C,
    BitShiftRight:               0x3D,
    Floor:                       0x40,
    Ceil:                        0x41,
    Compare:                     0x50,
    Equals:                      0x51,
    J:                           0x60,
    JZ:                          0x61,
    JNZ:                         0x62,
    JGZ:                         0x63,
    JGEZ:                        0x64,
    JLZ:                         0x65,
    JLEZ:                        0x66,
    IsEmpty:                     0x70,
    Length:                      0x71,
    Prepend:                     0x72,
    Append:                      0x73,
    Index:                       0x74,
    Concat:                      0x78,
    Head:                        0x79,
    Tail:                        0x7A,
    Unpack:                      0x7B,
    Prefix:                      0x7C,
    Suffix:                      0x7D,
    Substr:                      0x7E,
    IsVoid:                      0x80,
    IsInteger:                   0x81,
    IsDouble:                    0x82,
    IsFunctionReference:         0x83,
    IsNativeFunctionReference:   0x84,
    IsList:                      0x85,
    IsString:                    0x86,
    IsCustom:                    0x8F,
    IsNumber:                    0x90,
    IsAnyFunctionReference:      0x91,
});

/**
 * @param {InstructionCode} instructionCode
 * @param {bigint|number} value
 * @returns {boolean}
 */
export function shouldJump(instructionCode, value) {
    switch (instructionCode) {
    case InstructionCode.J:    return true;
    case InstructionCode.JZ:   return value == 0;
    case InstructionCode.JNZ:  return value != 0;
    case InstructionCode.JGZ:  return value >  0;
    case InstructionCode.JGEZ: return value >= 0;
    case InstructionCode.JLZ:  return value <  0;
    case InstructionCode.JLEZ: return value <= 0;
    }
    return false;
}

/**
 * @param {InstructionCode} instructionCode
 * @param {Value} value
 * @returns {boolean}
 */
export function typeCheckValue(instructionCode, value) {
    switch (instructionCode) {
    case InstructionCode.IsVoid:                    return value.isVoid();
    case InstructionCode.IsInteger:                 return value.isInteger();
    case InstructionCode.IsDouble:                  return value.isDouble();
    case InstructionCode.IsFunctionReference:       return value.isFunctionReference();
    case InstructionCode.IsNativeFunctionReference: return value.isNativeFunctionReference();
    case InstructionCode.IsList:                    return value.isList();
    case InstructionCode.IsString:                  return value.isString();
    case InstructionCode.IsCustom:                  return value.isCustom();
    case InstructionCode.IsNumber:                  return value.isNumber();
    case InstructionCode.IsAnyFunctionReference:    return value.isFunctionReference() || value.isNativeFunctionReference();
    }
    return false;
}

/**
 * @param {InstructionCode} instructionCode
 * @returns {string}
 */
export function instructionCodeToString(instructionCode) {
    switch (instructionCode) {
    case InstructionCode.PushInt:                     return "PushInt";
    case InstructionCode.PushDbl:                     return "PushDbl";
    case InstructionCode.PushFunctionReference:       return "PushFunctionReference";
    case InstructionCode.PushNativeFunctionReference: return "PushNativeFunctionReference";
    case InstructionCode.PushEmptyList:               return "PushEmptyList";
    case InstructionCode.Pack:                        return "Pack";
    case InstructionCode.Pop:                         return "Pop";
    case InstructionCode.Swap:                        return "Swap";
    case InstructionCode.Dup:                         return "Dup";
    case InstructionCode.PushConst:                   return "PushConst";
    case InstructionCode.PushLocal:                   return "PushLocal";
    case InstructionCode.MoveLocal:                   return "MoveLocal";
    case InstructionCode.PopIntoLocal:                return "PopIntoLocal";
    case InstructionCode.CopyIntoLocal:               return "CopyIntoLocal";
    case InstructionCode.PushGlobal:                  return "PushGlobal";
    case InstructionCode.MoveGlobal:                  return "MoveGlobal";
    case InstructionCode.PopIntoGlobal:               return "PopIntoGlobal";
    case InstructionCode.CopyIntoGlobal:              return "CopyIntoGlobal";
    case InstructionCode.Return:                      return "Return";
    case InstructionCode.Call:                        return "Call";
    case InstructionCode.CallNative:                  return "CallNative";
    case InstructionCode.ICall:                       return "ICall";
    case InstructionCode.DynSum:                      return "DynSum";
    case InstructionCode.DynSub:                      return "DynSub";
    case InstructionCode.DynMul:                      return "DynMul";
    case InstructionCode.DynDiv:                      return "DynDiv";
    case InstructionCode.Mod:                         return "Mod";
    case InstructionCode.BitAnd:                      return "BitAnd";
    case InstructionCode.BitOr:                       return "BitOr";
    case InstructionCode.BitNot:                      return "BitNot";
    case InstructionCode.BitXor:                      return "BitXor";
    case InstructionCode.BitShiftLeft:                return "BitShiftLeft";
    case InstructionCode.BitShiftRight:               return "BitShiftRight";
    case InstructionCode.Floor:                       return "Floor";
    case InstructionCode.Ceil:                        return "Ceil";
    case InstructionCode.Compare:                     return "Compare";
    case InstructionCode.Equals:                      return "Equals";
    case InstructionCode.J:                           return "J";
    case InstructionCode.JZ:                          return "JZ";
    case InstructionCode.JNZ:                         return "JNZ";
    case InstructionCode.JGZ:                         return "JGZ";
    case InstructionCode.JGEZ:                        return "JGEZ";
    case InstructionCode.JLZ:                         return "JLZ";
    case InstructionCode.JLEZ:                        return "JLEZ";
    case InstructionCode.IsEmpty:                     return "IsEmpty";
    case InstructionCode.Length:                      return "Length";
    case InstructionCode.Prepend:                     return "Prepend";
    case InstructionCode.Append:                      return "Append";
    case InstructionCode.Index:                       return "Index";
    case InstructionCode.Concat:                      return "Concat";
    case InstructionCode.Head:                        return "Head";
    case InstructionCode.Tail:                        return "Tail";
    case InstructionCode.Unpack:                      return "Unpack";
    case InstructionCode.Prefix:                      return "Prefix";
    case InstructionCode.Suffix:                      return "Suffix";
    case InstructionCode.Substr:                      return "Substr";
    case InstructionCode.IsVoid:                      return "IsVoid";
    case InstructionCode.IsInteger:                   return "IsInteger";
    case InstructionCode.IsDouble:                    return "IsDouble";
    case InstructionCode.IsFunctionReference:         return "IsFunctionReference";
    case InstructionCode.IsNativeFunctionReference:   return "IsNativeFunctionReference";
    case InstructionCode.IsList:                      return "IsList";
    case InstructionCode.IsString:                    return "IsString";
    case InstructionCode.IsCustom:                    return "IsCustom";
    case InstructionCode.IsNumber:                    return "IsNumber";
    case InstructionCode.IsAnyFunctionReference:      return "IsAnyFunctionReference";
    }
    throw new Error(`unknown instruction code ${instructionCode}`);
}

/**
 * @typedef {object} Instruction
 * @property {InstructionCode} code
 * @property {bigint|number} arg0
 */

/**
 * @typedef {object} FunctionDefinition
 * @property {string} name
 * @property {number} arity
 * @property {number} returns
 * @property {number} stackArity
 * @property {number} localsCount
 * @property {Instruction[]} [code] if undefined, same as empty array
 * @property {FunctionDebugSymbol} [debugSymbol]
 * @property {BlockDebugSymbol[]} [codeDebugSymbols]
 */

export class StopSignalError extends Error{}
export class StopSignal {
    #isStopping;
    #stopPromise;
    #stop;
    #completePromise;
    #complete;

    constructor() {
        this.#isStopping = false;
        this.#stopPromise = new Promise(resolve => {
            this.#stop = resolve;
        });
        this.#completePromise = new Promise(resolve => {
            this.#complete = resolve;
        });
    }

    get isStopping() { return this.#isStopping; }

    stop() {
        this.#isStopping = true;
        this.#stop();
        return this.waitComplete();
    }

    raise()    { throw new StopSignalError("stop requested"); }
    complete() { this.#complete(); }

    waitStop()     { return this.#stopPromise; }
    waitComplete() { return this.#completePromise; }

    handleRequest() {
        if (this.#isStopping) throw new StopSignalError("stop requested");
    }
}

/**
 * @typedef {(context: ExecutionContext) => Promise<void>|void} NativeFunction
 */

/**
 * @typedef {object} GlobalDefinition
 * @property {string} name
 * @property {Value} initialValue
 * @property {boolean} isConstant
 * @property {GlobalDebugSymbol} debugSymbol
 */

/**
 * @typedef {object} GlobalInstance
 * @property {string} name
 * @property {Value} value
 * @property {boolean} isConstant
 * @property {GlobalDebugSymbol} debugSymbol
 */

export class IndexOutOfBoundsError extends Error{}
export class FunctionNotFoundError extends Error{}
export class UnboundNativeError    extends Error{}
export class StackUnderflowError   extends Error{}
export class ValueTypeError        extends Error{}

/**
 * @typedef {object} CustomType
 * @property {string} name
 * @property {() => any} globalDataFactory
 */

export class Module {
    /** @type {FunctionDefinition[]}    */ #functions;
    /** @type {FunctionDefinition[]}    */ #nativeBindings;
    /** @type {GlobalDefinition[]}      */ #globals;
    /** @type {Value[]}                 */ #constants;
    /** @type {SourceDebugSymbol[]}     */ #sourceDebugSymbols;

    /** @type {(NativeFunction|null)[]} */ #nativeFunctions;
    /** @type {Map<number, CustomType>} */ #customTypes;
    #lastCustomTypeId;

    constructor() {
        this.#functions       = [];
        this.#nativeBindings  = [];
        this.#globals         = [];
        this.#constants       = [];
        this.#sourceDebugSymbols = [];

        this.#nativeFunctions  = [];
        this.#customTypes      = new Map();
        this.#lastCustomTypeId = 0;
    }

    /** @param  {...FunctionDefinition} functionDefinitions */
    addFunctions(...functionDefinitions) {
        this.#functions.push(...functionDefinitions);
    }

    /** @param  {...FunctionDefinition} nativeBindings */
    addNativeBindings(...nativeBindings) {
        this.#nativeBindings.push(...nativeBindings);
        for (let i = 0; i < nativeBindings.length; ++i) {
            this.#nativeFunctions.push(null);
        }
    }

    /** @param  {...GlobalDefinition} globalDefinitions */
    addGlobals(...globalDefinitions) {
        this.#globals.push(...globalDefinitions);
    }

    /** @param  {...Value} values */
    addConstants(...values) {
        this.#constants.push(...values);
    }

    /** @param  {...SourceDebugSymbol} sourceDebugSymbols */
    addSourceDebugSymbols(...sourceDebugSymbols) {
        this.#sourceDebugSymbols.push(...sourceDebugSymbols);
    }

    /**
     * @throws {IndexOutOfBoundsError}
     * @param {number} index
     * @returns {FunctionDefinition}
     */
    getFunctionByIndex(index) {
        if (index < 0 || index >= this.#functions.length)
            throw new IndexOutOfBoundsError(`function index ${index} out of bounds [0;${this.#functions.length})`);
        return this.#functions[index];
    }

    /**
     * @param {string} name
     * @returns {FunctionDefinition|undefined}
     */
    searchFunctionByName(name) {
        for (let i = this.#functions.length-1; i >= 0; --i) {
            const fn = this.#functions[i];
            if (fn.name === name)
                return fn;
        }
        return undefined;
    }

    /**
     * @throws {IndexOutOfBoundsError}
     * @param {number} index
     * @returns {[FunctionDefinition, NativeFunction|null]}
     */
    getNativeByIndex(index) {
        if (index < 0 || index >= this.#nativeBindings.length)
            throw new IndexOutOfBoundsError(`native function index ${index} out of bounds [0;${this.#nativeBindings.length})`);
        return [ this.#nativeBindings[index], this.#nativeFunctions[index] ];
    }

    /** @returns {GlobalInstance[]} */
    createGlobals() {
        return this.#globals.map(definition => ({
            name: definition.name,
            value: definition.initialValue.clone(),
            isConstant: definition.isConstant,
            debugSymbol: definition.debugSymbol,
        }));
    }

    /**
     * @throws {IndexOutOfBoundsError}
     * @param {number} index
     * @returns {Value}
     */
    createConstantByIndex(index) {
        if (index < 0 || index >= this.#constants.length)
            throw new IndexOutOfBoundsError(`constant index ${index} out of bounds [0;${this.#constants.length})`);
        return this.#constants[index].clone();
    }

    /** @returns {Map<number, any>} */
    createCustomTypeGlobalData() {
        const globalTypeData = new Map();
        for (const [typeId, type] of this.#customTypes.entries()) {
            globalTypeData.set(typeId, type.globalDataFactory != null ? type.globalDataFactory() : null);
        }
        return globalTypeData;
    }

    /**
     * @param {string} name
     * @param {NativeFunction} nativeFunction
     * @returns {boolean}
     */
    bindNativeByName(name, nativeFunction) {
        for (let i = this.#nativeBindings.length-1; i >= 0; --i) {
            const fn = this.#nativeBindings[i];
            if (fn.name === name) {
                this.#nativeFunctions[i] = nativeFunction;
                return true;
            }
        }
        return false;
    }

    /**
     * @param {string} name
     * @param {() => object} [globalDataFactory]
     * @returns {number} typeId
     */
    bindCustomType(name, globalDataFactory) {
        const typeId = ++this.#lastCustomTypeId;
        this.#customTypes.set(typeId, { name, globalDataFactory });
        return typeId;
    }

    /**
     * @param {number} index
     * @returns {SourceDebugSymbol|undefined}
     */
    getSourceDebugSymbolByIndex(index) {
        if (index < 0 && index >= this.#sourceDebugSymbols.length)
            return undefined;
        return this.#sourceDebugSymbols[index];
    }

    resolveDebugSymbols() {
        if (this.#sourceDebugSymbols.length <= 0) return;
        for (const fn of this.#functions)      this.#resolveFunctionDebugSymbols(fn);
        for (const fn of this.#nativeBindings) this.#resolveFunctionDebugSymbols(fn);
        for (const global of this.#globals)    this.#resolveGlobalDebugSymbols(global);
    }

    /** @param {FunctionDefinition} fn */
    #resolveFunctionDebugSymbols(fn) {
        if (fn.debugSymbol != null) {
            const resolvedSource = this.getSourceDebugSymbolByIndex(fn.debugSymbol.sourceIndex);
            fn.debugSymbol.resolvedSource = resolvedSource;
            if (fn.codeDebugSymbols != null) {
                for (const blockDebugSymbol of fn.codeDebugSymbols) {
                    blockDebugSymbol.resolvedSource = resolvedSource;
                }
            }
        }
    }

    /** @param {GlobalDefinition} global */
    #resolveGlobalDebugSymbols(global) {
        if (global.debugSymbol != null) {
            global.debugSymbol.resolvedSource = this.getSourceDebugSymbolByIndex(global.debugSymbol.sourceIndex);
        }
    }
}

/**
 * @typedef {object} Frame
 * @property {FunctionDefinition} function
 * @property {number} instructionIndex
 * @property {Value[]} stack
 * @property {Value[]} locals
 */

/**
 * generates a pretty error report using debug information if available
 * @param {Error} error
 * @param {Frame} [frame]
 * @returns {string}
 */
export function getErrorReport(error, frame) {
    /** @param {SourceDebugData} debugData */
    function getFullViewWithPositionTag(debugData) {
        const positionTag = `${debugData.sourcePosition.line+1}:${debugData.sourcePosition.char+1} |`;
        const emptyTag    = "|".padStart(positionTag.length);

        let viewWithTag = "";
        for (const view of debugData.view) {
            if (view.line === debugData.sourcePosition.line) {
                viewWithTag += `${positionTag} ${view.text}\n`;
                viewWithTag += `${emptyTag} ${debugData.cursor}\n`;
            } else {
                viewWithTag += `${emptyTag} ${view.text}\n`;
            }
        }
        return viewWithTag.trimEnd();
    }

    let report = `${error.constructor.name}: ${error.message}`;
    if (frame == null) return report;

    report += `\ninside function '${frame.function.name}'`;

    let debugData;

    debugData = getFunctionSourceDebugData(frame.function.debugSymbol);
    if (debugData != null && debugData.view.length > 0) {
        report += ` (${debugData.path})\ndefined at:\n${getFullViewWithPositionTag(debugData)}`;
    }

    debugData = getCodeSourceDebugData(frame.function.codeDebugSymbols, frame.instructionIndex);
    if (debugData != null && debugData.view.length > 0) {
        report += `\nduring execution of:\n${getFullViewWithPositionTag(debugData)}`;
    }

    return report;
}

function cloneValueList(list) {
    const cloned = new Array(list.length);
    for (let i = 0; i < cloned.length; ++i) {
        cloned[i] = list[i].clone();
    }
    return cloned;
}

/**
 * @typedef {object} CustomValue
 * @property {number} typeId
 * @property {any} data
 */

export class Value {
    /** @type {ValueType} */ #type;
    /** @type {undefined|number|string|Value[]|CustomValue} */ #value;

    /** @param {Value} [other] if specified, it is copied */
    constructor(other) {
        if (other == null) {
            this.setVoid();
        } else {
            switch (other.type) {
            case ValueType.Void:                    this.setVoid();                               break;
            case ValueType.Integer:                 this.setInteger(other.value);                 break;
            case ValueType.Double:                  this.setDouble(other.value);                  break;
            case ValueType.FunctionReference:       this.setFunctionReference(other.value);       break;
            case ValueType.NativeFunctionReference: this.setNativeFunctionReference(other.value); break;
            case ValueType.List:                    this.setList(other.value);                    break;
            case ValueType.String:                  this.setString(other.value);                  break;
            case ValueType.Custom:                  this.setCustom(other.value);                  break;
            default:
                throw new Error(`copy not implemented for ${other.type} (${valueTypeToString(other.type)})`);
            }
        }
    }

    get type()   { return this.#type;  }
    get value()  { return this.#value; }
    get sValue() { return valueTypeToString(this.value); }

    setVoid() {
        this.#type  = ValueType.Void;
        this.#value = undefined;
        return this;
    }

    /** @throws {ValueTypeError} @param {bigint|number} value */
    setInteger(value) {
        if (Number.isInteger(value)) {
            value = BigInt(value);
        } else if (typeof value !== "bigint")
            throw new ValueTypeError(`${value} is not a bigint or integer`);
        this.#type  = ValueType.Integer;
        // TODO: clamp to 64 bits if bugs are found
        // BigInt.asIntN(64, value);
        this.#value = value;
        return this;
    }

    /** @param {number} value */
    setDouble(value) {
        this.#type  = ValueType.Double;
        this.#value = value;
        return this;
    }

    /** @param {bigint|number} value */
    setNumber(value) {
        return Number.isInteger(value) || typeof value === "bigint"
            ? this.setInteger(value)
            : this.setDouble(value);
    }

    /** @throws {ValueTypeError} @param {number} value */
    setFunctionReference(value) {
        if (!Number.isInteger(value))
            throw new ValueTypeError(`${value} is not a function reference`);
        this.#type  = ValueType.FunctionReference;
        this.#value = value;
        return this;
    }

    /** @throws {ValueTypeError} @param {number} value */
    setNativeFunctionReference(value) {
        if (!Number.isInteger(value))
            throw new ValueTypeError(`${value} is not a native function reference`);
        this.#type  = ValueType.NativeFunctionReference;
        this.#value = value;
        return this;
    }

    /** @param {Value[]} value */
    setList(value) {
        this.#type  = ValueType.List;
        this.#value = cloneValueList(value);
        return this;
    }

    /** @param {string} value */
    setString(value) {
        this.#type  = ValueType.String;
        this.#value = value;
        return this;
    }

    /** @throws {ValueTypeError} @param {{ typeId: number? }|CustomValue} value */
    setCustom(value) {
        if (value.typeId == null)
            throw new ValueTypeError("given typeId is null");
        this.#type  = ValueType.Custom;
        this.#value = { typeId: value.typeId, data: value.data };
        return this;
    }

    isVoid()                    { return this.#type === ValueType.Void;                    }
    isInteger()                 { return this.#type === ValueType.Integer;                 }
    isDouble()                  { return this.#type === ValueType.Double;                  }
    isNumber()                  { return this.isInteger() || this.isDouble();              }
    isFunctionReference()       { return this.#type === ValueType.FunctionReference;       }
    isNativeFunctionReference() { return this.#type === ValueType.NativeFunctionReference; }
    isList()                    { return this.#type === ValueType.List;                    }
    isString()                  { return this.#type === ValueType.String;                  }
    isCustom()                  { return this.#type === ValueType.Custom;                  }
    isCustomOf(typeId)          { return this.isCustom() && this.#value.typeId === typeId; }

    /** @throws {ValueTypeError} @param {bigint|number} value */
    static fromInteger(value)                 { return new Value().setInteger(value);                 }
    /** @param {number} value */
    static fromDouble(value)                  { return new Value().setDouble(value);                  }
    /** @param {bigint|number} value */
    static fromNumber(value)                  { return new Value().setNumber(value);                  }
    /** @throws {ValueTypeError} @param {number} value */
    static fromFunctionReference(value)       { return new Value().setFunctionReference(value);       }
    /** @throws {ValueTypeError} @param {number} value */
    static fromNativeFunctionReference(value) { return new Value().setNativeFunctionReference(value); }
    /** @param {Value[]} value */
    static fromList(value)                    { return new Value().setList(value);                    }
    /** @param {string} value */
    static fromString(value)                  { return new Value().setString(value);                  }
    /** @param {CustomValue} value */
    static fromCustom(value)                  { return new Value().setCustom(value);                  }

    /** @returns {Value} */
    clone() { return new Value(this); }

    /** @param {Value} other */
    equals(other) {
        if (this.type !== other.type && !(this.isNumber() && other.isNumber())) {
            return false;
        }

        switch (this.type) {
        case ValueType.List:
            if (this.value.length !== other.value.length)
                return false;
            for (let i = 0; i < this.value.length; ++i) {
                const a = this.value[i];
                const b = other.value[i];
                if (!a.equals(b))
                    return false;
            }
            return true;
        case ValueType.Custom:
            return this.value.typeId === other.value.typeId
                && this.value.data   === other.value.data;
        default:
            // using == because we're sure that types are the same.
            // equality may happen between number and bigint so === won't work
            return this.value == other.value;
        }
    }
}

/**
 * @throws {StackUnderflowError}
 * @param {Value[]} stack
 * @param {InstructionCode} instructionCode
 * @param {number} valuesToGet
 * @returns {Value[]}
 */
function getValuesFromStack(stack, instructionCode, valuesToGet) {
    if (stack.length < valuesToGet) {
        throw new StackUnderflowError(`${instructionCodeToString(instructionCode)} requires ${valuesToGet} values, got ${stack.length}`);
    }
    const values = new Array(valuesToGet);
    for (let i = 0; i < values.length; ++i) {
        values[values.length-i-1] = stack[stack.length-i-1];
    }
    return values;
}

/**
 * @throws {StackUnderflowError}
 * @param {Value[]} stack
 * @param {InstructionCode} instructionCode
 * @param {number} valuesToPop
 * @returns {Value[]}
 */
function popValuesFromStack(stack, instructionCode, valuesToPop) {
    if (stack.length < valuesToPop) {
        throw new StackUnderflowError(`${instructionCodeToString(instructionCode)} requires ${valuesToPop} values, got ${stack.length}`);
    }
    const values = new Array(valuesToPop);
    for (let i = 0; i < values.length; ++i) {
        values[values.length-i-1] = stack.pop();
    }
    return values;
}

export class ExecutionContext {
    #module;
    /** @type {Value[]} */
    #globals;
    /** @type {Map<number, object>} */
    #globalTypeData;
    /** @type {Value[]} */
    #stack;
    /** @type {Frame[]} */
    #callStack;
    /** @type {StopSignal|undefined} if undefined, context is not running */
    #stopSignal;

    /**
     * @param {Module} module
     */
    constructor(module) {
        this.#module         = module;
        this.#globals        = module.createGlobals();
        this.#globalTypeData = module.createCustomTypeGlobalData();
        this.#stack          = [];
        this.#callStack      = [];
        this.#stopSignal     = undefined;
    }

    get module() { return this.#module; }
    get stack()  { return this.#stack;  }

    get stopSignal() { return this.#stopSignal; }

    get currentStack() { return this.#callStack.length > 0 ? this.currentFrame.stack : this.#stack; }
    get currentFrame() { return this.#callStack[this.#callStack.length-1]; }

    get isDone() { return this.#callStack.length <= 0; }

    /**
     * @throws {FunctionNotFoundError}
     * @param {string} name
     */
    callFunctionByName(name) {
        const fn = this.#module.searchFunctionByName(name);
        if (fn == null) throw new FunctionNotFoundError(`function '${name}' not found`);
        return this.callFunction(fn);
    }

    /**
     * @throws {StackUnderflowError}
     * @param {FunctionDefinition} fn
     */
    callFunction(fn) {
        const callerStack = this.currentStack;
        const totalArgsCount = fn.stackArity + fn.arity;
        if (callerStack.length < totalArgsCount)
            throw new StackUnderflowError(`not enough arguments to call '${fn.name}' required ${totalArgsCount}, got ${callerStack.length}`);

        const calleeFrame = {
            function: fn,
            instructionIndex: 0,
            stack:  new Array(fn.stackArity),
            locals: new Array(fn.localsCount),
        };

        for (let i = fn.arity-1; i >= 0; --i) {
            calleeFrame.locals[i] = callerStack.pop();
        }

        for (let i = fn.arity; i < calleeFrame.locals.length; ++i) {
            calleeFrame.locals[i] = new Value();
        }

        for (let i = calleeFrame.stack.length-1; i >= 0; --i) {
            calleeFrame.stack[i] = callerStack.pop();
        }

        this.#callStack.push(calleeFrame);
    }

    /**
     * @throws {IndexOutOfBoundsError}
     * @param {number} index
     * @returns {GlobalInstance}
     */
    getGlobalByIndex(index) {
        if (index < 0 || index >= this.#globals.length)
            throw new IndexOutOfBoundsError(`global index ${index} out of bounds [0;${this.#globals.length})`);
        return this.#globals[index];
    }

    /**
     * @param {number?} typeId
     * @returns {any}
     */
    getCustomTypeGlobalData(typeId) {
        if (typeId == null) return null;
        return this.#globalTypeData.get(typeId) ?? null;
    }

    /**
     * @param {number} [callsToReport]
     * @param {string} [tracePrefix]
     * @returns {string}
     */
    getCallStackReport(callsToReport, tracePrefix="  ") {
        /** @param {Frame} frame */
        function getCallTrace(frame, prefix) {
            const callTag = frame.function.code == null ? "*" : "";
            let trace = `${prefix}(${callTag}${frame.function.name})`;
            const debugSymbol = frame.function.debugSymbol;
            if (debugSymbol != null && debugSymbol.resolvedSource != null) {
                trace += ` '${debugSymbol.resolvedSource.path}:${debugSymbol.token.sourcePosition.line+1}:${debugSymbol.token.sourcePosition.char+1}'`;
            }
            return trace;
        }

        const callStack = this.#callStack;
        callsToReport = Math.min(callStack.length, Math.max(0, callsToReport ?? callStack.length));

        const lowCallsCount  = Math.floor(callsToReport / 2);
        const highCallsCount = callsToReport - lowCallsCount;
        const midCallsCount  = callStack.length - callsToReport;

        let report = "";
        for (let i = callStack.length-1; i >= callStack.length-highCallsCount; --i) {
            const frame = callStack[i];
            report += `${getCallTrace(frame, tracePrefix)}\n`;
        }
        if (midCallsCount > 0) {
            report += `${tracePrefix}... other ${midCallsCount} calls\n`;
        }
        for (let i = lowCallsCount-1; i >= 0; --i) {
            const frame = callStack[i];
            report += `${getCallTrace(frame, tracePrefix)}\n`;
        }
        return report.trimEnd();
    }

    /**
     * async to support async native functions.
     * calls `stopSignal.complete()` only when the step terminates execution
     * @throws any runtime error
     * @param {StopSignal} [stopSignal]
     */
    async step(stopSignal) {
        if (this.isDone) return;
        if (this.#stopSignal != null) return;
        this.#setStopSignal(stopSignal);

        try {
            await this.#step();
            if (this.isDone) {
                this.#stopSignal.complete();
            }
        } catch (error) {
            this.#stopSignal.complete();
            throw error;
        } finally {
            this.#stopSignal = undefined;
        }
    }

    /**
     * @throws any runtime error
     * @param {StopSignal} [stopSignal]
     */
    async run(stopSignal) {
        if (this.#stopSignal != null) return;
        this.#setStopSignal(stopSignal);

        try {
            while (!this.isDone) {
                await this.#step();
                this.#stopSignal.handleRequest();
            }
        } finally {
            this.#completeStopSignal();
        }
    }

    /**
     * runs the context asynchronously so that the browser may tick during execution
     * @throws any runtime error
     * @param {StopSignal} [stopSignal]
     * @param {number} [stepsPerFrame] steps to take before giving control back to the browser. must be > 0
     */
    async runAsync(stopSignal, stepsPerFrame=2048) {
        if (stepsPerFrame <= 0)
            throw new RangeError(`stepsPerFrame must be > 0, got ${stepsPerFrame}`);

        if (this.#stopSignal != null) return;
        this.#setStopSignal(stopSignal);

        try {
            let frameStep = 0;
            while (!this.isDone) {
                await this.#step();
                this.#stopSignal.handleRequest();

                ++frameStep;
                if (frameStep >= stepsPerFrame) {
                    await new Promise(res => setTimeout(res));
                    frameStep = 0;
                }
            }
        } finally {
            this.#completeStopSignal();
        }
    }

    /** @param {StopSignal} [stopSignal] */
    #setStopSignal(stopSignal) {
        this.#stopSignal = this.#stopSignal ?? stopSignal ?? new StopSignal();
        return this.#stopSignal;
    }

    #completeStopSignal() {
        if (this.#stopSignal != null) {
            this.#stopSignal.complete();
            this.#stopSignal = undefined;
        }
    }

    /**
     * async to support async native functions
     * @throws any runtime error
     */
    async #step() {
        const calleeFrame = this.currentFrame;
        if (calleeFrame.function.code != null && calleeFrame.instructionIndex < calleeFrame.function.code.length) {
            await this.#executeInstruction(calleeFrame);
            return;
        }

        if (calleeFrame.stack.length < calleeFrame.function.returns)
            throw new StackUnderflowError("not enough values on the stack to return");

        this.#callStack.pop();
        const calleeStackBase = calleeFrame.stack.length-calleeFrame.function.returns;
        const callerStack = this.currentStack;
        for (let i = 0; i < calleeFrame.function.returns; ++i) {
            callerStack.push(calleeFrame.stack[calleeStackBase+i]);
        }
    }

    /**
     * async to support async native functions
     * @throws any runtime error
     * @param {Frame} frame
     */
    async #executeInstruction(frame) {
        const instruction = frame.function.code[frame.instructionIndex++];
        switch (instruction.code) {
        case InstructionCode.PushInt: {
            frame.stack.push(Value.fromInteger(instruction.arg0));
        } break;
        case InstructionCode.PushDbl: {
            frame.stack.push(Value.fromDouble(instruction.arg0));
        } break;
        case InstructionCode.PushFunctionReference: {
            frame.stack.push(Value.fromFunctionReference(instruction.arg0));
        } break;
        case InstructionCode.PushNativeFunctionReference: {
            frame.stack.push(Value.fromNativeFunctionReference(instruction.arg0));
        } break;
        case InstructionCode.PushEmptyList: {
            frame.stack.push(Value.fromList([]));
        } break;
        case InstructionCode.Pack: {
            const packCount  = Math.max(0, instruction.arg0);
            const valueArray = popValuesFromStack(frame.stack, instruction.code, packCount);
            frame.stack.push(Value.fromList(valueArray));
        } break;
        case InstructionCode.Pop: {
            const popCount = Math.max(1, instruction.arg0);
            popValuesFromStack(frame.stack, instruction.code, popCount)
        } break;
        case InstructionCode.Swap: {
            const [a, b] = popValuesFromStack(frame.stack, instruction.code, 2);
            frame.stack.push(b, a);
        } break;
        case InstructionCode.Dup: {
            const [value]  = getValuesFromStack(frame.stack, instruction.code, 1)
            const dupCount = Math.max(1, instruction.arg0);
            for (let i = 0; i < dupCount; ++i) {
                frame.stack.push(value.clone());
            }
        } break;
        case InstructionCode.PushConst: {
            const value = this.#module.createConstantByIndex(instruction.arg0);
            frame.stack.push(value);
        } break;
        case InstructionCode.PushLocal: {
            const localIndex = instruction.arg0;
            if (localIndex < 0 || localIndex >= frame.locals.length)
                throw new IndexOutOfBoundsError(`local index ${localIndex} out of bounds [0;${frame.locals.length})`);
            const value = frame.locals[localIndex];
            frame.stack.push(value.clone());
        } break;
        case InstructionCode.MoveLocal: {
            const localIndex = instruction.arg0;
            if (localIndex < 0 || localIndex >= frame.locals.length)
                throw new IndexOutOfBoundsError(`local index ${localIndex} out of bounds [0;${frame.locals.length})`);
            const value = frame.locals[localIndex];
            frame.locals[localIndex] = new Value();
            frame.stack.push(value);
        } break;
        case InstructionCode.PopIntoLocal: {
            const [ value ] = popValuesFromStack(frame.stack, instruction.code, 1);
            const localIndex = instruction.arg0;
            if (localIndex < 0 || localIndex >= frame.locals.length)
                throw new IndexOutOfBoundsError(`local index ${localIndex} out of bounds [0;${frame.locals.length})`);
            frame.locals[localIndex] = value;
        } break;
        case InstructionCode.CopyIntoLocal: {
            const [ value ] = getValuesFromStack(frame.stack, instruction.code, 1);
            const localIndex = instruction.arg0;
            if (localIndex < 0 || localIndex >= frame.locals.length)
                throw new IndexOutOfBoundsError(`local index ${localIndex} out of bounds [0;${frame.locals.length})`);
            frame.locals[localIndex] = value.clone();
        } break;
        case InstructionCode.PushGlobal: {
            const global = this.getGlobalByIndex(instruction.arg0);
            frame.stack.push(global.value.clone());
        } break;
        case InstructionCode.MoveGlobal: {
            const global = this.getGlobalByIndex(instruction.arg0);
            const value  = global.value;
            global.value = new Value();
            frame.stack.push(value);
        } break;
        case InstructionCode.PopIntoGlobal: {
            const [ value ] = popValuesFromStack(frame.stack, instruction.code, 1);
            const global = this.getGlobalByIndex(instruction.arg0);
            global.value = value;
        } break;
        case InstructionCode.CopyIntoGlobal: {
            const [ value ] = getValuesFromStack(frame.stack, instruction.code, 1);
            const global = this.getGlobalByIndex(instruction.arg0);
            global.value = value.clone();
        } break;
        case InstructionCode.Return: {
            frame.instructionIndex = frame.function.code.length;
        } break;
        case InstructionCode.Call: {
            const functionDefinition = this.#module.getFunctionByIndex(instruction.arg0);
            this.callFunction(functionDefinition);
        } break;
        case InstructionCode.CallNative: {
            const [nativeBinding, nativeFunction] = this.#module.getNativeByIndex(instruction.arg0);
            if (nativeFunction == null)
                throw new UnboundNativeError(`native function '${nativeBinding.name}' (${instruction.arg0}) not bound`);
            this.callFunction(nativeBinding);
            await nativeFunction(this);
        } break;
        case InstructionCode.ICall: {
            const [ functionReference ] = popValuesFromStack(frame.stack, instruction.code, 1);
            if (functionReference.isFunctionReference()) {
                const functionDefinition = this.#module.getFunctionByIndex(functionReference.value);
                this.callFunction(functionDefinition);
            } else if (functionReference.isNativeFunctionReference()) {
                const [nativeBinding, nativeFunction] = this.#module.getNativeByIndex(functionReference.value);
                if (nativeFunction == null)
                    throw new UnboundNativeError(`native function '${nativeBinding.name}' (${functionReference.value}) not bound`);
                this.callFunction(nativeBinding);
                await nativeFunction(this);
            } else throw new ValueTypeError(`expected FunctionReference or NativeFunctionReference, got ${valueTypeToString(functionReference.type)}`);
        } break;
        case InstructionCode.DynSum: {
            const [a, b] = popValuesFromStack(frame.stack, instruction.code, 2);
            if (!a.isNumber() || !b.isNumber())
                throw new ValueTypeError("cannot perform addition between non-numeric values");
            if (a.isInteger() && b.isInteger()) {
                frame.stack.push(Value.fromInteger(a.value + b.value));
            } else {
                frame.stack.push(Value.fromDouble(Number(a.value) + Number(b.value)));
            }
        } break;
        case InstructionCode.DynSub: {
            const [a, b] = popValuesFromStack(frame.stack, instruction.code, 2);
            if (!a.isNumber() || !b.isNumber())
                throw new ValueTypeError("cannot perform subtraction between non-numeric values");
            if (a.isInteger() && b.isInteger()) {
                frame.stack.push(Value.fromInteger(a.value - b.value));
            } else {
                frame.stack.push(Value.fromDouble(Number(a.value) - Number(b.value)));
            }
        } break;
        case InstructionCode.DynMul: {
            const [a, b] = popValuesFromStack(frame.stack, instruction.code, 2);
            if (!a.isNumber() || !b.isNumber())
                throw new ValueTypeError("cannot perform multiplication between non-numeric values");
            if (a.isInteger() && b.isInteger()) {
                frame.stack.push(Value.fromInteger(a.value * b.value));
            } else {
                frame.stack.push(Value.fromDouble(Number(a.value) * Number(b.value)));
            }
        } break;
        case InstructionCode.DynDiv: {
            const [a, b] = popValuesFromStack(frame.stack, instruction.code, 2);
            if (!a.isNumber() || !b.isNumber())
                throw new ValueTypeError("cannot perform division between non-numeric values");
            if (a.isInteger() && b.isInteger()) {
                // both a and b are bigints
                frame.stack.push(Value.fromInteger(a.value / b.value));
            } else {
                frame.stack.push(Value.fromDouble(Number(a.value) / Number(b.value)));
            }
        } break;
        case InstructionCode.Mod: {
            const [a, b] = popValuesFromStack(frame.stack, instruction.code, 2);
            if (!a.isInteger() || !b.isInteger())
                throw new ValueTypeError("cannot perform modulus between non-integer values");
            frame.stack.push(Value.fromInteger(a.value % b.value));
        } break;
        // TODO: clamp to 64 bits if bugs are found within bit operations
        case InstructionCode.BitAnd: {
            const [a, b] = popValuesFromStack(frame.stack, instruction.code, 2);
            if (!a.isInteger() || !b.isInteger())
                throw new ValueTypeError("cannot perform bit operations between non-integer values");
            frame.stack.push(Value.fromInteger(a.value & b.value));
        } break;
        case InstructionCode.BitOr: {
            const [a, b] = popValuesFromStack(frame.stack, instruction.code, 2);
            if (!a.isInteger() || !b.isInteger())
                throw new ValueTypeError("cannot perform bit operations between non-integer values");
            frame.stack.push(Value.fromInteger(a.value | b.value));
        } break;
        case InstructionCode.BitNot: {
            const [value] = popValuesFromStack(frame.stack, instruction.code, 1);
            if (!value.isInteger())
                throw new ValueTypeError("cannot perform bit operations on non-integer values");
            frame.stack.push(Value.fromInteger(~value.value));
        } break;
        case InstructionCode.BitXor: {
            const [a, b] = popValuesFromStack(frame.stack, instruction.code, 2);
            if (!a.isInteger() || !b.isInteger())
                throw new ValueTypeError("cannot perform bit operations between non-integer values");
            frame.stack.push(Value.fromInteger(a.value ^ b.value));
        } break;
        case InstructionCode.BitShiftLeft: {
            const [a, b] = popValuesFromStack(frame.stack, instruction.code, 2);
            if (!a.isInteger() || !b.isInteger())
                throw new ValueTypeError("cannot perform bit operations between non-integer values");
            frame.stack.push(Value.fromInteger(a.value << b.value));
        } break;
        case InstructionCode.BitShiftRight: {
            const [a, b] = popValuesFromStack(frame.stack, instruction.code, 2);
            if (!a.isInteger() || !b.isInteger())
                throw new ValueTypeError("cannot perform bit operations between non-integer values");
            frame.stack.push(Value.fromInteger(a.value >> b.value));
        } break;
        case InstructionCode.Floor: {
            const [value] = getValuesFromStack(frame.stack, instruction.code, 1);
            if (value.isInteger()) {
                // do nothing, already integer
            } else if (value.isDouble()) {
                value.setInteger(Math.floor(value.value));
            } else throw new ValueType("cannot floor a non-numeric value");
        } break;
        case InstructionCode.Ceil: {
            const [value] = getValuesFromStack(frame.stack, instruction.code, 1);
            if (value.isInteger()) {
                // do nothing, already integer
            } else if (value.isDouble()) {
                value.setInteger(Math.ceil(value.value));
            } else throw new ValueType("cannot floor a non-numeric value");
        } break;
        case InstructionCode.Compare: {
            const [a, b] = popValuesFromStack(frame.stack, instruction.code, 2);
            if (a.isInteger() && b.isInteger()) {
                frame.stack.push(Value.fromInteger(a.value - b.value));
            } else if (a.isNumber() && b.isNumber()) {
                frame.stack.push(Value.fromDouble(Number(a.value) - Number(b.value)));
            } else if (a.isString() && b.isString()) {
                if (a.value === b.value) {
                    frame.stack.push(Value.fromInteger(0));
                } else if (a.value > b.value) {
                    frame.stack.push(Value.fromInteger(1));
                } else {
                    frame.stack.push(Value.fromInteger(-1));
                }
            } else throw new ValueTypeError("comparison allowed only between numbers or strings");
        } break;
        case InstructionCode.Equals: {
            const [a, b] = popValuesFromStack(frame.stack, instruction.code, 2);
            frame.stack.push(Value.fromInteger(a.equals(b) ? 1 : 0));
        } break;
        case InstructionCode.J:
            frame.instructionIndex -= 1;
            frame.instructionIndex += instruction.arg0;
            break;
        case InstructionCode.JZ:
        case InstructionCode.JNZ:
        case InstructionCode.JGZ:
        case InstructionCode.JGEZ:
        case InstructionCode.JLZ:
        case InstructionCode.JLEZ: {
            const [value] = popValuesFromStack(frame.stack, instruction.code, 1);
            if (!value.isNumber())
                throw new ValueTypeError("can only branch on numbers");
            if (shouldJump(instruction.code, value.value)) {
                frame.instructionIndex -= 1;
                frame.instructionIndex += instruction.arg0;
            }
        } break;
        case InstructionCode.IsEmpty: {
            const [listOrString] = getValuesFromStack(frame.stack, instruction.code, 1);
            if (!listOrString.isList() && !listOrString.isString())
                throw new ValueTypeError("cannot check for emptiness of non-list/string value");
            frame.stack.push(Value.fromInteger(listOrString.value.length > 0 ? 0 : 1));
        } break;
        case InstructionCode.Length: {
            const [listOrString] = getValuesFromStack(frame.stack, instruction.code, 1);
            if (!listOrString.isList() && !listOrString.isString())
                throw new ValueTypeError("cannot take length of non-list/string value");
            frame.stack.push(Value.fromInteger(listOrString.value.length));
        } break;
        case InstructionCode.Prepend: {
            const [listOrString, head] = getValuesFromStack(frame.stack, instruction.code, 2);
            frame.stack.pop(); // head
            if (listOrString.isList()) {
                listOrString.value.unshift(head)
            } else if (listOrString.isString()) {
                if (head.isInteger()) {
                    const nHead = Number(head.value);
                    const newString = String.fromCodePoint(nHead) + listOrString.value;
                    listOrString.setString(newString);
                } else if (head.isString()) {
                    const newString = head.value + listOrString.value;
                    listOrString.setString(newString);
                } else throw new ValueTypeError("cannot prepend to a string a non-integer/string value");
            } else throw new ValueTypeError("cannot prepend to a non-list/string value");
        } break;
        case InstructionCode.Append: {
            const [listOrString, back] = getValuesFromStack(frame.stack, instruction.code, 2);
            frame.stack.pop(); // back
            if (listOrString.isList()) {
                listOrString.value.push(back)
            } else if (listOrString.isString()) {
                if (back.isInteger()) {
                    const nBack = Number(back.value);
                    const newString = listOrString.value + String.fromCodePoint(nBack);
                    listOrString.setString(newString);
                } else if (back.isString()) {
                    const newString = listOrString.value + back.value;
                    listOrString.setString(newString);
                } else throw new ValueTypeError("cannot append to a string a non-integer/string value");
            } else throw new ValueTypeError("cannot append to a non-list/string value");
        } break;
        case InstructionCode.Index: {
            const [listOrString, index] = getValuesFromStack(frame.stack, instruction.code, 2);
            frame.stack.pop(); // index

            if (!index.isInteger())
                throw new ValueTypeError("index must be an integer");

            const nIndex = Number(index.value);
            if (listOrString.isList()) {
                const list = listOrString.value;
                if (nIndex < 0 || nIndex >= list.length)
                    throw new IndexOutOfBoundsError(`list index ${nIndex} out of bounds [0;${list.length})`);
                frame.stack.push(list[nIndex]);
            } else if (listOrString.isString()) {
                const str = listOrString.value;
                if (nIndex < 0 || nIndex >= str.length)
                    throw new IndexOutOfBoundsError(`string index ${nIndex} out of bounds [0;${str.length})`);
                // FIXME: does not follow Pulsar's spec (index by byte)
                frame.stack.push(Value.fromInteger(str.codePointAt(nIndex)));
            } else throw new ValueTypeError("cannot index a non-list/string value");
        } break;
        case InstructionCode.Concat: {
            const [listA, listB] = getValuesFromStack(frame.stack, instruction.code, 2);
            frame.stack.pop(); // listB
            listA.value.push(...listB.value);
        } break;
        case InstructionCode.Head: {
            const [list] = getValuesFromStack(frame.stack, instruction.code, 1);
            if (!list.isList())
                throw new ValueTypeError("cannot take head of a non-list value");
            if (list.value.length <= 0)
                throw new IndexOutOfBoundsError("cannot take head of an empty list");
            const head = list.value.shift();
            frame.stack.push(head);
        } break;
        case InstructionCode.Tail: {
            const [list] = getValuesFromStack(frame.stack, instruction.code, 1);
            if (!list.isList())
                throw new ValueTypeError("cannot take tail of a non-list value");
            if (list.value.length <= 0)
                throw new IndexOutOfBoundsError("cannot take tail of an empty list");
            list.value.shift();
        } break;
        case InstructionCode.Unpack: {
            const [list] = popValuesFromStack(frame.stack, instruction.code, 1);
            if (!list.isList())
                throw new ValueTypeError("cannot unpack a non-list value");

            const unpackCount = instruction.arg0;
            if (unpackCount > 0) {
                if (unpackCount > list.value.length)
                    throw new IndexOutOfBoundsError("list index out of bounds");
                const unpacked = popValuesFromStack(list.value, instruction.code, unpackCount);
                frame.stack.push(...unpacked);
            }
        } break;
        case InstructionCode.Prefix: {
            const [str, length] = getValuesFromStack(frame.stack, instruction.code, 2);
            frame.stack.pop(); // length

            if (!str.isString())
                throw new ValueTypeError("cannot take prefix of a non-string value");
            if (!length.isInteger())
                throw new ValueTypeError("prefix length must be an integer");

            const nLength = Number(length.value);
            if (nLength < 0 || nLength >= str.length)
                throw new IndexOutOfBoundsError("out of bounds prefix length");
            const actualStrValue = str.value;
            str.setString(actualStrValue.slice(nLength));
            frame.stack.push(Value.fromString(actualStrValue.slice(0, nLength)));
        } break;
        case InstructionCode.Suffix: {
            const [str, length] = getValuesFromStack(frame.stack, instruction.code, 2);
            frame.stack.pop(); // length

            if (!str.isString())
                throw new ValueTypeError("cannot take suffix of a non-string value");
            if (!length.isInteger())
                throw new ValueTypeError("suffix length must be an integer");

            const nLength = Number(length.value);
            if (nLength < 0 || nLength >= str.length)
                throw new IndexOutOfBoundsError("out of bounds suffix length");
            const actualStrValue = str.value;
            str.setString(actualStrValue.slice(0, actualStrValue.length-nLength));
            frame.stack.push(Value.fromString(actualStrValue.slice(actualStrValue.length-nLength)));
        } break;
        case InstructionCode.Substr: {
            const [str, startIndex, endIndex] = getValuesFromStack(frame.stack, instruction.code, 3);
            frame.stack.pop(); // endIndex
            frame.stack.pop(); // startIndex

            if (!str.isString())
                throw new ValueTypeError("cannot take substr of a non-string value");
            if (!startIndex.isInteger() || !endIndex.isInteger())
                throw new ValueTypeError("substr indices must be integers");

            if (startIndex.value >= endIndex.value || startIndex.value >= str.value.length) {
                frame.stack.push(Value.fromString(""));
            } else {
                const nStartIndex = Number(startIndex.value);
                const nEndIndex   = Number(endIndex.value);
                frame.stack.push(Value.fromString(str.value.slice(nStartIndex, nEndIndex)));
            }
        } break;
        case InstructionCode.IsVoid:
        case InstructionCode.IsInteger:
        case InstructionCode.IsDouble:
        case InstructionCode.IsFunctionReference:
        case InstructionCode.IsNativeFunctionReference:
        case InstructionCode.IsList:
        case InstructionCode.IsString:
        case InstructionCode.IsCustom:
        case InstructionCode.IsNumber:
        case InstructionCode.IsAnyFunctionReference: {
            const [value] = getValuesFromStack(frame.stack, instruction.code, 1);
            frame.stack.push(Value.fromInteger(typeCheckValue(instruction.code, value) ? 1 : 0));
        } break;
        default:
            throw new Error(`instruction ${instruction.code} (${instructionCodeToString(instruction.code)}) not implemented`);
        }
    }
}
