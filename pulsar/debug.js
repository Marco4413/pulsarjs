/**
 * @typedef {object} SourcePosition
 * @property {number} line
 * @property {number} char
 * @property {number} index
 * @property {number} charSpan
 */

/**
 * @typedef {object} Token
 * @property {number} tokenType
 * @property {SourcePosition} sourcePosition
 */

/**
 * @typedef {object} FunctionDebugSymbol
 * @property {Token} token
 * @property {number} sourceIndex
 * @property {SourceDebugSymbol} [resolvedSource]
 */

/**
 * @typedef {object} BlockDebugSymbol
 * @property {Token} token
 * @property {number} startIndex
 * @property {SourceDebugSymbol} [resolvedSource]
 */

/**
 * @typedef {object} GlobalDebugSymbol
 * @property {Token} token
 * @property {number} sourceIndex
 * @property {SourceDebugSymbol} [resolvedSource]
 */

/**
 * @typedef {object} SourceDebugSymbol
 * @property {string} path
 * @property {string} source
 */

/**
 * @param {SourcePosition} sourcePosition
 * @returns {string}
 */
export function createSourcePositionCursor(sourcePosition) {
    return " ".repeat(Math.max(0, sourcePosition.char)) + "^" + "~".repeat(Math.max(0, sourcePosition.charSpan-1));
}

/**
 * @typedef {object} SourceViewOptions
 * @property {number} [linesBefore]
 * @property {number} [linesAfter]
 */

/**
 * @typedef {object} SourceViewLine
 * @property {number} line
 * @property {string} text
 */

/**
 * @param {string} source
 * @param {SourcePosition} sourcePosition
 * @param {SourceViewOptions} [options]
 * @returns {SourceViewLine[]}
 */
export function getSourceView(source, sourcePosition, options) {
    // FIXME: this is really bad (splitting the whole source code), find a better way to handle this
    const lines = source.split(/\r\n|\r|\n/g);

    const linesBefore = options?.linesBefore ?? 2;
    const linesAfter  = options?.linesAfter  ?? 0;

    const view = [];
    for (let lineOffset = -linesBefore; lineOffset <= linesAfter; ++lineOffset) {
        const lineIndex = sourcePosition.line + lineOffset;
        if (lineIndex >= 0 && lineIndex < lines.length) {
            view.push({ line: lineIndex, text: lines[lineIndex] });
        }
    }
    return view;
}

/**
 * @typedef {object} SourceDebugData
 * @property {string} path
 * @property {string} source
 * @property {SourcePosition} sourcePosition
 * @property {SourceViewLine[]} view
 * @property {string} cursor
 */

/**
 * @typedef {SourceViewOptions} SourceDebugDataOptions
 */

/**
 * @param {SourceDebugSymbol} sourceDebugSymbol
 * @param {SourcePosition} sourcePosition
 * @param {SourceDebugDataOptions} [options]
 * @returns {SourceDebugData}
 */
export function getSourceDebugData(sourceDebugSymbol, sourcePosition, options) {
    /** @type {SourceDebugData} */
    return {
        path: sourceDebugSymbol.path,
        source: sourceDebugSymbol.source,
        sourcePosition,
        view: getSourceView(sourceDebugSymbol.source, sourcePosition, options),
        cursor: createSourcePositionCursor(sourcePosition),
    };
}

/**
 * @param {FunctionDebugSymbol} [functionDebugSymbol]
 * @param {SourceDebugDataOptions} [options]
 * @returns {SourceDebugData|undefined}
 */
export function getFunctionSourceDebugData(functionDebugSymbol, options) {
    if (functionDebugSymbol == null || functionDebugSymbol.resolvedSource == null)
        return undefined;
    return getSourceDebugData(functionDebugSymbol.resolvedSource, functionDebugSymbol.token.sourcePosition, options);
}

/**
 * @param {BlockDebugSymbol[]} codeDebugSymbols
 * @param {number} instructionIndex
 * @returns {BlockDebugSymbol|undefined}
 */
export function findCodeDebugSymbol(codeDebugSymbols, instructionIndex) {
    // TODO: codeDebugSymbols is sorted by the definition of the format,
    //  we could apply a binary search to speed things up
    let debugSymbol;
    for (const blockDebugSymbol of codeDebugSymbols) {
        if (blockDebugSymbol.startIndex < instructionIndex)
            debugSymbol = blockDebugSymbol;
        else break;
    }
    return debugSymbol;
}

/**
 * @param {BlockDebugSymbol[]} [codeDebugSymbols]
 * @param {number} instructionIndex
 * @param {CodeSourceDebugDataOptions} [options]
 * @returns {SourceDebugData|undefined}
 */
export function getCodeSourceDebugData(codeDebugSymbols, instructionIndex, options) {
    if (codeDebugSymbols == null)
        return undefined;
    const debugSymbol = findCodeDebugSymbol(codeDebugSymbols, instructionIndex);
    if (debugSymbol == null || debugSymbol.resolvedSource == null)
        return undefined;
    return getSourceDebugData(debugSymbol.resolvedSource, debugSymbol.token.sourcePosition, options);
}

/**
 * @param {GlobalDebugSymbol} [globalDebugSymbol]
 * @param {SourceDebugDataOptions} [options]
 * @returns {SourceDebugData|undefined}
 */
export function getGlobalSourceDebugData(globalDebugSymbol, options) {
    if (globalDebugSymbol == null || globalDebugSymbol.resolvedSource == null)
        return undefined;
    return getSourceDebugData(globalDebugSymbol.resolvedSource, globalDebugSymbol.token.sourcePosition, options);
}
