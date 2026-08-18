import { describe, it, expect } from "vitest"
import { sha256, syncSha256 } from "../src/hash.js"

// Known SHA-256 test vectors (FIPS 180-4 examples)
const VECTORS: Array<{ input: string | Uint8Array; hex: string }> = [
  {
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    input: "",
    hex: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
  },
  {
    // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
    input: "abc",
    hex: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  },
  {
    // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    input: "hello",
    hex: "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
  },
]

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function encode(s: string): Uint8Array {
  return new TextEncoder().encode(s)
}

describe("sha256 (pure-TS implementation)", () => {
  for (const { input, hex } of VECTORS) {
    it(`sha256("${typeof input === "string" ? input : "<bytes>"}") matches known vector`, () => {
      // sha256 accepts string | Uint8Array directly
      expect(toHex(sha256(input))).toBe(hex)
    })
  }

  it("returns a 32-byte Uint8Array", () => {
    expect(sha256("test")).toBeInstanceOf(Uint8Array)
    expect(sha256("test").length).toBe(32)
  })

  it("is deterministic — two calls with same input produce identical output", () => {
    expect(toHex(sha256("determinism check"))).toBe(toHex(sha256("determinism check")))
  })
})

describe("syncSha256", () => {
  for (const { input, hex } of VECTORS) {
    it(`syncSha256("${typeof input === "string" ? input : "<bytes>"}") matches known vector`, () => {
      const data = typeof input === "string" ? encode(input) : input
      expect(toHex(syncSha256(data))).toBe(hex)
    })
  }

  it("returns a 32-byte Uint8Array", () => {
    expect(syncSha256(encode("test")).length).toBe(32)
  })

  it("agrees with sha256() for the same input", () => {
    const data = encode("cross-check")
    expect(toHex(syncSha256(data))).toBe(toHex(sha256(data)))
  })
})
