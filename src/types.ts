export type IdlTypeName =
  | "uint8"
  | "uint32"
  | "uint64"
  | "secp256k1_sig"
  | "secp256k1_pubkey"
  | "schnorr_sig"
  | "bytes";

export interface FieldDescriptor {
  type: IdlTypeName;
  required?: boolean;
  description?: string;
}

export interface WitnessConfig<F extends Record<string, FieldDescriptor>> {
  name: string;
  idl_version?: string;
  fields: F;
}

export interface WitnessField {
  name: string;
  type: string;
  required: boolean;
  description?: string;
}

export interface IdlDocument {
  idl_version: string;
  name: string;
  witness: WitnessField[];
}

export type WitnessValueType<T extends IdlTypeName> = T extends
  "uint8" | "uint32"
  ? number
  : T extends "uint64"
    ? bigint
    : Uint8Array;

export type WitnessValues<F extends Record<string, FieldDescriptor>> = {
  [K in keyof F]: WitnessValueType<F[K]["type"]>;
};

export interface WitnessSchema<F extends Record<string, FieldDescriptor>> {
  readonly idl: IdlDocument;
  fromWitnessArgs(index: number, source: number): WitnessValues<F>;
  idlHash(): Uint8Array;
}
