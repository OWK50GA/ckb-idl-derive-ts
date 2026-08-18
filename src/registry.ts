import { FieldTooShortError, UnknownTypeError } from "./errors.js";
import { IdlTypeName } from "./types.js";

export type WireKind =
  | {
      kind: "fixedScalar";
      size: 1 | 4 | 8;
    }
  | {
      kind: "fixedArray";
      size: number;
    }
  | {
      kind: "varBytes";
    };

export interface TypeEntry {
  wireKind: WireKind;
}

export const REGISTRY: ReadonlyMap<IdlTypeName, TypeEntry> = new Map([
  ["uint8", { wireKind: { kind: "fixedScalar", size: 1 } }],
  ["uint32", { wireKind: { kind: "fixedScalar", size: 4 } }],
  ["uint64", { wireKind: { kind: "fixedScalar", size: 8 } }],
  ["secp256k1_sig", { wireKind: { kind: "fixedArray", size: 65 } }],
  ["secp256k1_pubkey", { wireKind: { kind: "fixedArray", size: 33 } }],
  ["schnorr_sig", { wireKind: { kind: "fixedArray", size: 64 } }],
  ["bytes", { wireKind: { kind: "varBytes" } }],
]);

export function lookupType(fieldName: string, typeName: string): TypeEntry {
  const entry = REGISTRY.get(typeName as IdlTypeName);
  if (!entry) throw new UnknownTypeError(fieldName, typeName);
  return entry;
}
