import { describe, it, expect } from "vitest"
import { defineWitness, field } from "../src/schema.js"
import { UnknownTypeError } from "../src/errors.js"

describe("field()", () => {
  it("returns a FieldDescriptor with the given type", () => {
    const f = field("uint8")
    expect(f.type).toBe("uint8")
  })

  it("defaults required to undefined (defineWitness will default to true)", () => {
    const f = field("bytes")
    expect(f.required).toBeUndefined()
  })

  it("passes required: false through", () => {
    const f = field("bytes", { required: false })
    expect(f.required).toBe(false)
  })

  it("passes description through", () => {
    const f = field("secp256k1_sig", { description: "the sig" })
    expect(f.description).toBe("the sig")
  })

  it("omits description when not provided", () => {
    const f = field("uint32")
    expect(f.description).toBeUndefined()
  })
})

describe("defineWitness()", () => {
  it("returns a WitnessSchema with an idl property", () => {
    const schema = defineWitness({ name: "test", fields: { v: field("uint8") } })
    expect(schema.idl).toBeDefined()
    expect(schema.idl.name).toBe("test")
  })

  it("idl.witness has one entry per field", () => {
    const schema = defineWitness({
      name: "test",
      fields: {
        sig: field("secp256k1_sig"),
        ts: field("uint64"),
        extra: field("bytes", { required: false }),
      },
    })
    expect(schema.idl.witness).toHaveLength(3)
  })

  it("idl.witness preserves declaration order", () => {
    const schema = defineWitness({
      name: "test",
      fields: {
        first: field("uint8"),
        second: field("uint32"),
        third: field("bytes"),
      },
    })
    expect(schema.idl.witness[0].name).toBe("first")
    expect(schema.idl.witness[1].name).toBe("second")
    expect(schema.idl.witness[2].name).toBe("third")
  })

  it("defaults idl_version to '1'", () => {
    const schema = defineWitness({ name: "test", fields: {} })
    expect(schema.idl.idl_version).toBe("1")
  })

  it("throws UnknownTypeError at call time for an unrecognised type", () => {
    expect(() =>
      defineWitness({
        name: "test",
        fields: { bad: { type: "molecule_bytes" as any } },
      })
    ).toThrow(UnknownTypeError)
  })

  it("UnknownTypeError is thrown before the schema is returned", () => {
    let threw = false
    try {
      defineWitness({ name: "test", fields: { x: { type: "invalid" as any } } })
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
  })

  it("idlHash() returns a 32-byte Uint8Array", () => {
    const schema = defineWitness({ name: "test", fields: { v: field("uint8") } })
    const hash = schema.idlHash()
    expect(hash).toBeInstanceOf(Uint8Array)
    expect(hash.length).toBe(32)
  })

  it("idlHash() is stable — same value on repeated calls", () => {
    const schema = defineWitness({ name: "test", fields: { v: field("uint8") } })
    const h1 = schema.idlHash()
    const h2 = schema.idlHash()
    expect(h1).toEqual(h2)
  })

  it("idlHash() returns a copy — mutating the result doesn't affect subsequent calls", () => {
    const schema = defineWitness({ name: "test", fields: { v: field("uint8") } })
    const h1 = schema.idlHash()
    h1[0] = 0xff
    const h2 = schema.idlHash()
    expect(h2[0]).not.toBe(0xff)
  })

  it("two schemas with identical configs produce the same idlHash", () => {
    const config = { name: "test", fields: { v: field("uint32") } }
    const h1 = defineWitness(config).idlHash()
    const h2 = defineWitness(config).idlHash()
    expect(h1).toEqual(h2)
  })

  it("two schemas with different names produce different idlHashes", () => {
    const h1 = defineWitness({ name: "lock-a", fields: { v: field("uint8") } }).idlHash()
    const h2 = defineWitness({ name: "lock-b", fields: { v: field("uint8") } }).idlHash()
    expect(h1).not.toEqual(h2)
  })
})
