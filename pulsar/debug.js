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
 * @typedef {object} SourceViewLine
 * @property {number} line
 * @property {string} text
 */

/**
 * @param {string} source
 * @param {SourcePosition} sourcePosition
 * @returns {SourceViewLine[]}
 */
export function getSourceView(source, sourcePosition) {
    // FIXME: this is really bad (splitting the whole source code), find a better way to handle this
    const lines = source.split(/\r\n|\r|\n/g);

    const view = [];
    for (let lineOffset = -2; lineOffset <= 0; ++lineOffset) {
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
 * @param {SourceDebugSymbol} sourceDebugSymbol
 * @param {SourcePosition} sourcePosition
 * @returns {SourceDebugData}
 */
export function getSourceDebugData(sourceDebugSymbol, sourcePosition) {
    /** @type {SourceDebugData} */
    return {
        path: sourceDebugSymbol.path,
        source: sourceDebugSymbol.source,
        sourcePosition,
        view: getSourceView(sourceDebugSymbol.source, sourcePosition),
        cursor: createSourcePositionCursor(sourcePosition),
    };
}

/**
 * @param {FunctionDebugSymbol} [functionDebugSymbol]
 * @returns {SourceDebugData|undefined}
 */
export function getFunctionSourceDebugData(functionDebugSymbol) {
    if (functionDebugSymbol == null || functionDebugSymbol.resolvedSource == null)
        return undefined;
    return getSourceDebugData(functionDebugSymbol.resolvedSource, functionDebugSymbol.token.sourcePosition);
}

/**
 * @param {BlockDebugSymbol[]} [codeDebugSymbols]
 * @param {number} instructionIndex
 * @returns {SourceDebugData|undefined}
 */
export function getCodeSourceDebugData(codeDebugSymbols, instructionIndex) {
    if (codeDebugSymbols == null)
        return undefined;
    let debugSymbol;
    for (const blockDebugSymbol of codeDebugSymbols) {
        if (blockDebugSymbol.startIndex < instructionIndex)
            debugSymbol = blockDebugSymbol;
        else break;
    }
    if (debugSymbol == null || debugSymbol.resolvedSource == null)
        return undefined;
    return getSourceDebugData(debugSymbol.resolvedSource, debugSymbol.token.sourcePosition);
}

/**
 * @param {GlobalDebugSymbol} [globalDebugSymbol]
 * @returns {SourceDebugData|undefined}
 */
export function getGlobalSourceDebugData(globalDebugSymbol) {
    if (globalDebugSymbol == null || globalDebugSymbol.resolvedSource == null)
        return undefined;
    return getSourceDebugData(globalDebugSymbol.resolvedSource, globalDebugSymbol.token.sourcePosition);
}
