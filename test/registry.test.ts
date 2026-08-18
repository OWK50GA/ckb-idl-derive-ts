import { describe, it, expect } from "vitest"
import { REGISTRY, lookupType } from "../src/registry.js"
import { UnknownTypeError } from "../src/errors.js"

describe("REGISTRY", () => {
  it("has exactly 7 entries", () => {
    expect(REGISTRY.size).toBe(7)
  })

  it("uint8 → fixedScalar size 1", () => {
    const entry = REGISTRY.get("uint8")!
    expect(entry.wireKind.kind).toBe("fixedScalar")
    expect((entry.wireKind as { kind: "fixedScalar"; size: number }).size).toBe(1)
  })

  it("uint32 → fixedScalar size 4", () => {
    const entry = REGISTRY.get("uint32")!
    expect(entry.wireKind.kind).toBe("fixedScalar")
    expect((entry.wireKind as { kind: "fixedScalar"; size: number }).size).toBe(4)
  })

  it("uint64 → fixedScalar size 8", () => {
    const entry = REGISTRY.get("uint64")!
    expect(entry.wireKind.kind).toBe("fixedScalar")
    expect((entry.wireKind as { kind: "fixedScalar"; size: number }).size).toBe(8)
  })

  it("secp256k1_sig → fixedArray size 65", () => {
    const entry = REGISTRY.get("secp256k1_sig")!
    expect(entry.wireKind.kind).toBe("fixedArray")
    expect((entry.wireKind as { kind: "fixedArray"; size: number }).size).toBe(65)
  })

  it("secp256k1_pubkey → fixedArray size 33", () => {
    const entry = REGISTRY.get("secp256k1_pubkey")!
    expect(entry.wireKind.kind).toBe("fixedArray")
    expect((entry.wireKind as { kind: "fixedArray"; size: number }).size).toBe(33)
  })

  it("schnorr_sig → fixedArray size 64", () => {
    const entry = REGISTRY.get("schnorr_sig")!
    expect(entry.wireKind.kind).toBe("fixedArray")
    expect((entry.wireKind as { kind: "fixedArray"; size: number }).size).toBe(64)
  })

  it("bytes → varBytes", () => {
    const entry = REGISTRY.get("bytes")!
    expect(entry.wireKind.kind).toBe("varBytes")
  })
})

describe("lookupType", () => {
  it("returns entry for a known type", () => {
    const entry = lookupType("myField", "uint8")
    expect(entry.wireKind.kind).toBe("fixedScalar")
  })

  it("throws UnknownTypeError for an unknown type", () => {
    expect(() => lookupType("myField", "molecule_bytes")).toThrow(UnknownTypeError)
  })

  it("UnknownTypeError carries fieldName and typeName", () => {
    try {
      lookupType("myField", "bad_type")
    } catch (e) {
      expect(e).toBeInstanceOf(UnknownTypeError)
      const err = e as UnknownTypeError
      expect(err.fieldName).toBe("myField")
      expect(err.typeName).toBe("bad_type")
    }
  })

  it("throws for empty string type", () => {
    expect(() => lookupType("x", "")).toThrow(UnknownTypeError)
  })
})
