import { describe, it, expect } from "vitest"
import { decodeWireBytes } from "../src/decoder.js"
import { FieldTooShortError, TrailingBytesError, UnknownTypeError } from "../src/errors.js"
import type { WitnessField } from "../src/types.js"

// Helper: build a WitnessField inline
function f(name: string, type: string, required = true): WitnessField {
  return { name, type, required }
}

// Helper: build a little-endian u32 length-prefixed bytes buffer
function varBytesWire(payload: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + payload.length)
  new DataView(out.buffer).setUint32(0, payload.length, true)
  out.set(payload, 4)
  return out
}

describe("decodeWireBytes — uint8", () => {
  it("decodes a single uint8 field", () => {
    const result = decodeWireBytes([f("val", "uint8")], new Uint8Array([42]))
    expect(result["val"]).toBe(42)
  })

  it("throws FieldTooShortError when buffer is empty", () => {
    expect(() => decodeWireBytes([f("val", "uint8")], new Uint8Array([])))
      .toThrow(FieldTooShortError)
  })

  it("FieldTooShortError carries correct expected/got", () => {
    expect.assertions(3)
    try {
      decodeWireBytes([f("val", "uint8")], new Uint8Array([]))
    } catch (e) {
      const err = e as FieldTooShortError
      expect(err.fieldName).toBe("val")
      expect(err.expected).toBe(1)
      expect(err.got).toBe(0)
    }
  })
})

describe("decodeWireBytes — uint32", () => {
  it("decodes 0xDEADBEEF little-endian", () => {
    const buf = new Uint8Array([0xef, 0xbe, 0xad, 0xde])
    const result = decodeWireBytes([f("nonce", "uint32")], buf)
    expect(result["nonce"]).toBe(0xdeadbeef)
  })

  it("throws FieldTooShortError when only 3 bytes available", () => {
    const err = (() => {
      try { decodeWireBytes([f("nonce", "uint32")], new Uint8Array([1, 2, 3])) }
      catch (e) { return e as FieldTooShortError }
    })()!
    expect(err).toBeInstanceOf(FieldTooShortError)
    expect(err.expected).toBe(4)
    expect(err.got).toBe(3)
  })
})

describe("decodeWireBytes — uint64", () => {
  it("returns a bigint", () => {
    // 1700000000000 = 0x18BCFE56800 in little-endian: 00 68 e5 cf 8b 01 00 00
    const buf = new Uint8Array([0x00, 0x68, 0xe5, 0xcf, 0x8b, 0x01, 0x00, 0x00])
    const result = decodeWireBytes([f("ts", "uint64")], buf)
    expect(typeof result["ts"]).toBe("bigint")
    expect(result["ts"]).toBe(1700000000000n)
  })

  it("throws FieldTooShortError when only 4 bytes available", () => {
    const err = (() => {
      try { decodeWireBytes([f("ts", "uint64")], new Uint8Array(4)) }
      catch (e) { return e as FieldTooShortError }
    })()!
    expect(err.expected).toBe(8)
    expect(err.got).toBe(4)
  })
})

describe("decodeWireBytes — secp256k1_sig", () => {
  it("decodes 65 zero bytes", () => {
    const buf = new Uint8Array(65)
    const result = decodeWireBytes([f("sig", "secp256k1_sig")], buf)
    expect(result["sig"]).toBeInstanceOf(Uint8Array)
    expect((result["sig"] as Uint8Array).length).toBe(65)
  })

  it("throws FieldTooShortError when only 10 bytes available", () => {
    const err = (() => {
      try { decodeWireBytes([f("sig", "secp256k1_sig")], new Uint8Array(10)) }
      catch (e) { return e as FieldTooShortError }
    })()!
    expect(err.fieldName).toBe("sig")
    expect(err.expected).toBe(65)
    expect(err.got).toBe(10)
  })
})

describe("decodeWireBytes — secp256k1_pubkey", () => {
  it("decodes 33 bytes", () => {
    const result = decodeWireBytes([f("pk", "secp256k1_pubkey")], new Uint8Array(33))
    expect((result["pk"] as Uint8Array).length).toBe(33)
  })
})

describe("decodeWireBytes — schnorr_sig", () => {
  it("decodes 64 bytes", () => {
    const buf = new Uint8Array(64).fill(0xab)
    const result = decodeWireBytes([f("sig", "schnorr_sig")], buf)
    const decoded = result["sig"] as Uint8Array
    expect(decoded.length).toBe(64)
    expect(decoded[0]).toBe(0xab)
  })
})

describe("decodeWireBytes — bytes (varBytes)", () => {
  it("decodes a non-empty payload", () => {
    const payload = new TextEncoder().encode("hello")
    const buf = varBytesWire(payload)
    const result = decodeWireBytes([f("data", "bytes")], buf)
    expect(result["data"]).toEqual(payload)
  })

  it("decodes a zero-length payload", () => {
    const buf = new Uint8Array([0, 0, 0, 0]) // length prefix = 0
    const result = decodeWireBytes([f("data", "bytes")], buf)
    expect((result["data"] as Uint8Array).length).toBe(0)
  })

  it("throws FieldTooShortError(expected=4) when buffer has fewer than 4 bytes", () => {
    const err = (() => {
      try { decodeWireBytes([f("data", "bytes")], new Uint8Array([1, 2, 3])) }
      catch (e) { return e as FieldTooShortError }
    })()!
    expect(err).toBeInstanceOf(FieldTooShortError)
    expect(err.fieldName).toBe("data")
    expect(err.expected).toBe(4)
    expect(err.got).toBe(3)
  })

  it("throws FieldTooShortError(expected=payloadLen) when payload is truncated", () => {
    // length prefix says 10 bytes but buffer only has 2 after the prefix
    const buf = new Uint8Array(6)
    new DataView(buf.buffer).setUint32(0, 10, true) // claim 10 bytes
    buf[4] = 0xaa
    buf[5] = 0xbb
    const err = (() => {
      try { decodeWireBytes([f("data", "bytes")], buf) }
      catch (e) { return e as FieldTooShortError }
    })()!
    expect(err.expected).toBe(10)
    expect(err.got).toBe(2)
  })
})

describe("decodeWireBytes — TrailingBytesError", () => {
  it("throws when extra bytes remain after all fields decoded", () => {
    const buf = new Uint8Array([42, 0xff]) // uint8 = 42, then 1 extra byte
    expect(() => decodeWireBytes([f("val", "uint8")], buf)).toThrow(TrailingBytesError)
  })

  it("TrailingBytesError carries consumed and total", () => {
    expect.assertions(2)
    try {
      decodeWireBytes([f("val", "uint8")], new Uint8Array([42, 0xff, 0xee]))
    } catch (e) {
      const err = e as TrailingBytesError
      expect(err.consumed).toBe(1)
      expect(err.total).toBe(3)
    }
  })
})

describe("decodeWireBytes — UnknownTypeError", () => {
  it("throws for a field with an unrecognised type", () => {
    expect(() =>
      decodeWireBytes([f("x", "molecule_bytes")], new Uint8Array(8))
    ).toThrow(UnknownTypeError)
  })
})

describe("decodeWireBytes — multi-field", () => {
  it("decodes multiple fields in declaration order", () => {
    // sig (65 bytes) + unlock_after_ms (uint64, 8 bytes) + extra (varBytes, 0 payload)
    const sig = new Uint8Array(65).fill(0x01)
    const ts = new Uint8Array(8) // 0n
    const extra = new Uint8Array([0, 0, 0, 0]) // empty varBytes

    const buf = new Uint8Array(65 + 8 + 4)
    buf.set(sig, 0)
    buf.set(ts, 65)
    buf.set(extra, 73)

    const fields: WitnessField[] = [
      f("signature", "secp256k1_sig"),
      f("unlock_after_ms", "uint64"),
      f("extra", "bytes", false),
    ]

    const result = decodeWireBytes(fields, buf)
    expect((result["signature"] as Uint8Array).length).toBe(65)
    expect(result["unlock_after_ms"]).toBe(0n)
    expect((result["extra"] as Uint8Array).length).toBe(0)
  })
})
