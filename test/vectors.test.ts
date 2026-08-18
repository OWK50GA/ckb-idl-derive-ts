/**
 * Cross-language test vector runner.
 *
 * Loads all 16 cases from ckb-idl-client/test-vectors.json and validates
 * that decodeWireBytes produces identical results to the Rust from_witness_args
 * implementation.
 *
 * NOTE: We call decodeWireBytes directly rather than fromWitnessArgs because
 * HighLevel.loadWitnessArgs (from @ckb-js-std/core) is only available inside
 * ckb-js-vm at script runtime, not in Node.js test environments.
 */

import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { decodeWireBytes } from "../src/decoder.js"
import { lookupType } from "../src/registry.js"
import { FieldTooShortError, TrailingBytesError, UnknownTypeError } from "../src/errors.js"
import type { WitnessField } from "../src/types.js"

// Resolve path relative to this file, going up to the ckb-idl-client sibling repo
const __dirname = dirname(fileURLToPath(import.meta.url))
const vectorsPath = resolve(__dirname, "../../ckb-idl-client/test-vectors.json")

interface VectorField {
  name: string
  type: string
  required: boolean
  description?: string
}

interface DecodedEntry {
  name: string
  type: string
  value_hex?: string
  value_u64?: number
}

interface ErrorDetail {
  field?: string
  expected?: number
  got?: number
  trailing?: number
  type?: string
}

interface TestVector {
  id: string
  description: string
  fields: VectorField[]
  wire_hex: string
  expect: "valid" | "error"
  decoded?: DecodedEntry[]
  error?: "FieldTooShort" | "TrailingBytes" | "UnknownType"
  error_detail?: ErrorDetail
}

interface VectorsFile {
  vectors: TestVector[]
}

// Parse hex string (spaces allowed as separators, as in the test vectors file)
function fromHex(hex: string): Uint8Array {
  const clean = hex.replace(/\s+/g, "")
  if (clean.length === 0) return new Uint8Array(0)
  const buf = new Uint8Array(clean.length / 2)
  for (let i = 0; i < buf.length; i++) {
    buf[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return buf
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

let vectors: TestVector[]
try {
  const raw = readFileSync(vectorsPath, "utf8")
  vectors = (JSON.parse(raw) as VectorsFile).vectors
} catch {
  throw new Error(
    `Could not load test-vectors.json from ${vectorsPath}. ` +
    `Make sure ckb-idl-client is checked out as a sibling of idl-derive-ts.`
  )
}

describe("Cross-language test vectors", () => {
  for (const vec of vectors) {
    const { id, description, fields: rawFields, wire_hex, expect: expectation } = vec

    // Convert vector fields to WitnessField[]
    const fields: WitnessField[] = rawFields.map((f) => ({
      name: f.name,
      type: f.type,
      required: f.required,
      description: f.description,
    }))

    if (expectation === "valid") {
      it(`[${id}] ${description}`, () => {
        const buf = fromHex(wire_hex)
        const result = decodeWireBytes(fields, buf)

        // Assert each decoded field value
        for (const entry of vec.decoded ?? []) {
          if ("value_hex" in entry && entry.value_hex !== undefined) {
            const actual = result[entry.name] as Uint8Array
            expect(actual).toBeInstanceOf(Uint8Array)
            expect(toHex(actual)).toBe(entry.value_hex.replace(/\s+/g, ""))
          } else if ("value_u64" in entry && entry.value_u64 !== undefined) {
            // Numeric fields: uint8/uint32 return number, uint64 returns bigint
            const fieldDef = fields.find((f) => f.name === entry.name)!
            if (fieldDef.type === "uint64") {
              expect(result[entry.name]).toBe(BigInt(entry.value_u64))
            } else {
              expect(result[entry.name]).toBe(entry.value_u64)
            }
          }
        }
      })
    } else if (expectation === "error") {
      it(`[${id}] ${description} — expects ${vec.error}`, () => {
        const buf = fromHex(wire_hex)

        if (vec.error === "UnknownType") {
          // UnknownType is raised by lookupType during decoding
          let thrown: Error | undefined
          try { decodeWireBytes(fields, buf) } catch (e) { thrown = e as Error }
          expect(thrown).toBeInstanceOf(UnknownTypeError)
          if (vec.error_detail?.field && vec.error_detail?.type) {
            const err = thrown as UnknownTypeError
            expect(err.fieldName).toBe(vec.error_detail.field)
            expect(err.typeName).toBe(vec.error_detail.type)
          }
        } else if (vec.error === "FieldTooShort") {
          let thrown: Error | undefined
          try { decodeWireBytes(fields, buf) } catch (e) { thrown = e as Error }
          expect(thrown).toBeInstanceOf(FieldTooShortError)
          if (vec.error_detail) {
            const err = thrown as FieldTooShortError
            if (vec.error_detail.field) expect(err.fieldName).toBe(vec.error_detail.field)
            if (vec.error_detail.expected !== undefined) expect(err.expected).toBe(vec.error_detail.expected)
            if (vec.error_detail.got !== undefined) expect(err.got).toBe(vec.error_detail.got)
          }
        } else if (vec.error === "TrailingBytes") {
          let thrown: Error | undefined
          try { decodeWireBytes(fields, buf) } catch (e) { thrown = e as Error }
          expect(thrown).toBeInstanceOf(TrailingBytesError)
          if (vec.error_detail?.trailing !== undefined) {
            const err = thrown as TrailingBytesError
            expect(err.total - err.consumed).toBe(vec.error_detail.trailing)
          }
        }
      })
    }
  }
})
