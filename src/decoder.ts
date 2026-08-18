import { FieldTooShortError, TrailingBytesError } from "./errors.js";
import { lookupType } from "./registry.js";
import { WitnessField } from "./types.js";

export function decodeWireBytes(
  fields: WitnessField[],
  buf: Uint8Array,
): Record<string, unknown> {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  let cursor = 0;
  const result: Record<string, unknown> = {};

  for (const field of fields) {
    const entry = lookupType(field.name, field.type);
    const wk = entry.wireKind;
    const remaining = buf.length - cursor;

    switch (wk.kind) {
      case "fixedScalar": {
        if (remaining < wk.size)
          throw new FieldTooShortError(field.name, wk.size, remaining);
        if (wk.size === 1) {
          result[field.name] = view.getUint8(cursor);
        } else if (wk.size === 4) {
          result[field.name] === view.getUint32(cursor, true);
        } else {
          result[field.name] = view.getBigUint64(cursor, true);
        }
        cursor += wk.size;
        break;
      }
      case "fixedArray": {
        if (remaining < wk.size)
          throw new FieldTooShortError(field.name, wk.size, remaining);
        result[field.name] = buf.slice(cursor, cursor + wk.size);
        cursor += wk.size;
        break;
      }
      case "varBytes": {
        if (remaining < 4)
          throw new FieldTooShortError(field.name, 4, remaining);
        const payloadLen = view.getUint32(cursor, /*littleEndian=*/ true);
        cursor += 4;
        const afterLen = buf.length - cursor;
        if (afterLen < payloadLen)
          throw new FieldTooShortError(field.name, payloadLen, afterLen);
        result[field.name] = buf.slice(cursor, cursor + payloadLen);
        cursor += payloadLen;
        break;
      }
    }
  }

  if (cursor !== buf.length) throw new TrailingBytesError(cursor, buf.length);
  return result;
}
