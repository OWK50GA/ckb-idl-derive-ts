import { decodeWireBytes } from "./decoder.js";
import { MissingLockFieldError } from "./errors.js";
import { syncSha256 } from "./hash.js";
import { buildIdl, canonicalJsonBytes } from "./idl.js";
import { lookupType } from "./registry.js";
import {
  FieldDescriptor,
  IdlTypeName,
  WitnessConfig,
  WitnessSchema,
  WitnessValues,
} from "./types.js";

export function field(
  type: IdlTypeName,
  options?: { required?: boolean; description?: string },
): FieldDescriptor {
  return {
    type,
    required: options?.required,
    description: options?.description,
  };
}

export function defineWitness<F extends Record<string, FieldDescriptor>>(
  config: WitnessConfig<F>,
): WitnessSchema<F> {
  for (const [fieldName, descriptor] of Object.entries(config.fields)) {
    lookupType(fieldName, descriptor.type);
  }

  const idl = buildIdl(config);

  const _canonicalBytes = canonicalJsonBytes(idl);
  const _hashCache = syncSha256(_canonicalBytes);

  return {
    idl,
    fromWitnessArgs(index, source): WitnessValues<F> {
      const { HighLevel } = require("@ckb-js-std/core");
      const witnessArgs = HighLevel.loadWitnessArgs(index, source);
      const lockBuf: ArrayBuffer | undefined = witnessArgs.lock;
      if (lockBuf === undefined || lockBuf === null) {
        throw new MissingLockFieldError();
      }
      const raw = new Uint8Array(lockBuf);
      return decodeWireBytes(idl.witness, raw) as WitnessValues<F>;
    },
    idlHash(): Uint8Array {
      return _hashCache.slice(); // defensive copy to prevent external mutation
    },
  };
}
