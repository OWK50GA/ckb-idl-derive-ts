import { describe, it, expect } from "vitest"
import { buildIdl, canonicalJson, canonicalJsonBytes } from "../src/idl.js"
import type { WitnessConfig, FieldDescriptor } from "../src/types.js"

describe("buildIdl", () => {
  it("preserves field declaration order", () => {
    const config: WitnessConfig<Record<string, FieldDescriptor>> = {
      name: "test",
      fields: {
        first: { type: "uint8" },
        second: { type: "uint64" },
        third: { type: "bytes" },
      },
    }
    const idl = buildIdl(config)
    expect(idl.witness[0].name).toBe("first")
    expect(idl.witness[1].name).toBe("second")
    expect(idl.witness[2].name).toBe("third")
  })

  it("defaults required to true when omitted", () => {
    const config: WitnessConfig<Record<string, FieldDescriptor>> = {
      name: "test",
      fields: { sig: { type: "secp256k1_sig" } },
    }
    const idl = buildIdl(config)
    expect(idl.witness[0].required).toBe(true)
  })

  it("respects required = false", () => {
    const config: WitnessConfig<Record<string, FieldDescriptor>> = {
      name: "test",
      fields: { extra: { type: "bytes", required: false } },
    }
    const idl = buildIdl(config)
    expect(idl.witness[0].required).toBe(false)
  })

  it("includes description when provided", () => {
    const config: WitnessConfig<Record<string, FieldDescriptor>> = {
      name: "test",
      fields: { sig: { type: "secp256k1_sig", description: "the signature" } },
    }
    const idl = buildIdl(config)
    expect(idl.witness[0].description).toBe("the signature")
  })

  it("omits description key entirely when not provided — not null, not undefined", () => {
    const config: WitnessConfig<Record<string, FieldDescriptor>> = {
      name: "test",
      fields: { sig: { type: "secp256k1_sig" } },
    }
    const idl = buildIdl(config)
    expect("description" in idl.witness[0]).toBe(false)
  })

  it("defaults idl_version to '1'", () => {
    const config: WitnessConfig<Record<string, FieldDescriptor>> = {
      name: "test",
      fields: {},
    }
    expect(buildIdl(config).idl_version).toBe("1")
  })

  it("uses provided idl_version", () => {
    const config: WitnessConfig<Record<string, FieldDescriptor>> = {
      name: "test",
      idl_version: "2",
      fields: {},
    }
    expect(buildIdl(config).idl_version).toBe("2")
  })

  it("sets name from config", () => {
    const config: WitnessConfig<Record<string, FieldDescriptor>> = {
      name: "simple-lock",
      fields: {},
    }
    expect(buildIdl(config).name).toBe("simple-lock")
  })

  it("produces empty witness array for empty fields", () => {
    const config: WitnessConfig<Record<string, FieldDescriptor>> = {
      name: "test",
      fields: {},
    }
    expect(buildIdl(config).witness).toHaveLength(0)
  })
})

describe("canonicalJson", () => {
  it("top-level key order is idl_version → name → witness", () => {
    const idl = buildIdl({ name: "test", fields: {} })
    const json = canonicalJson(idl)
    const keys = Object.keys(JSON.parse(json))
    expect(keys).toEqual(["idl_version", "name", "witness"])
  })

  it("per-field key order is name → type → required (→ description)", () => {
    const idl = buildIdl({
      name: "test",
      fields: { sig: { type: "secp256k1_sig", description: "desc" } },
    })
    const json = canonicalJson(idl)
    const parsed = JSON.parse(json)
    const fieldKeys = Object.keys(parsed.witness[0])
    expect(fieldKeys).toEqual(["name", "type", "required", "description"])
  })

  it("description key absent in JSON when not provided", () => {
    const idl = buildIdl({
      name: "test",
      fields: { nonce: { type: "uint32" } },
    })
    const json = canonicalJson(idl)
    const parsed = JSON.parse(json)
    expect("description" in parsed.witness[0]).toBe(false)
  })

  it("produces identical output on two calls with the same idl", () => {
    const idl = buildIdl({ name: "test", fields: { v: { type: "uint8" } } })
    expect(canonicalJson(idl)).toBe(canonicalJson(idl))
  })

  it("serialises a real example correctly", () => {
    const idl = buildIdl({
      name: "simple-lock",
      fields: {
        preimage: { type: "bytes", description: "Preimage whose blake2b-256 hash must match" },
      },
    })
    const expected = JSON.stringify({
      idl_version: "1",
      name: "simple-lock",
      witness: [
        { name: "preimage", type: "bytes", required: true, description: "Preimage whose blake2b-256 hash must match" },
      ],
    })
    expect(canonicalJson(idl)).toBe(expected)
  })
})

describe("canonicalJsonBytes", () => {
  it("returns a Uint8Array", () => {
    const idl = buildIdl({ name: "test", fields: {} })
    expect(canonicalJsonBytes(idl)).toBeInstanceOf(Uint8Array)
  })

  it("UTF-8 encodes the canonical JSON string", () => {
    const idl = buildIdl({ name: "test", fields: {} })
    const json = canonicalJson(idl)
    const expected = new TextEncoder().encode(json)
    expect(canonicalJsonBytes(idl)).toEqual(expected)
  })
})
