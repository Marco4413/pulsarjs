import { Reader } from "./reader.js";
import { Module } from "./runtime.js";

import * as v0 from "./neutron/v0.js"

const NEUTRON_MAGIC   = 0x58544E00; // "\0NTX"
const NEUTRON_READERS = [v0.NeutronReader];

export class InvalidFormatError extends Error{}
export class UnsupportedVersionError extends Error{}

/**
 * @param {Reader} r
 * @returns {Module}
 */
export function readNeutron(r) {
    const magic = r.readU32();
    if (magic !== NEUTRON_MAGIC)
        throw new InvalidFormatError("given buffer does not contain Neutron data");

    const version = r.readU32();
    if (version < 0 || version >= NEUTRON_READERS.length)
        throw new UnsupportedVersionError(`unsupported Neutron format v${version}`);

    const NeutronReader = NEUTRON_READERS[version];
    const neutronReader = new NeutronReader();
    return neutronReader.readModule(r);
}

/**
 * @param {ArrayBufferLike} buffer
 * @returns {Module}
 */
export function readNeutronBuffer(buffer) {
    return readNeutron(new Reader(buffer));
}
