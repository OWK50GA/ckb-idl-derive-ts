import {
  FieldDescriptor,
  IdlDocument,
  WitnessConfig,
  WitnessField,
} from "./types.js";

export function buildIdl<F extends Record<string, FieldDescriptor>>(
  config: WitnessConfig<F>,
): IdlDocument {
  const witness: WitnessField[] = Object.entries(config.fields).map(
    ([name, descriptor]) => {
      const f: WitnessField = {
        name,
        type: descriptor.type,
        required: descriptor.required ?? true,
      };
      if (descriptor.description !== undefined) {
        f.description = descriptor.description;
      }
      return f;
    },
  );
  return {
    idl_version: config.idl_version ?? "1",
    name: config.name,
    witness,
  };
}

export function canonicalJson(idl: IdlDocument): string {
  const doc = {
    idl_version: idl.idl_version,
    name: idl.name,
    witness: idl.witness.map((f) => {
      const obj: Record<string, unknown> = {
        name: f.name,
        type: f.type,
        required: f.required,
      };
      if (f.description !== undefined) obj.description = f.description;
      return obj;
    }),
  };
  return JSON.stringify(doc);
}

export function canonicalJsonBytes(idl: IdlDocument): Uint8Array {
  return new TextEncoder().encode(canonicalJson(idl));
}
