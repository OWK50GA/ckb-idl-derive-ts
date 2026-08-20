# idl-derive-ts

TypeScript counterpart to [`ckb-idl-derive`](../ckb-idl-derive). Lets you declare a CKB lock script's witness layout in TypeScript, produce the same `idl.json` artifact the Rust proc-macro generates, and decode wire-format witnesses at runtime inside [ckb-js-vm](https://github.com/nervosnetwork/ckb-js-vm).

---

## What it does

`defineWitness` is the TypeScript equivalent of `#[derive(CkbWitness)]` in Rust. You describe your lock script's witness fields once; the library gives you back:

- **`schema.idl`** — the `IdlDocument` object (same JSON structure as the Rust `idl.json`)
- **`schema.idlHash()`** — `sha256(canonical_json(idl))` as a 32-byte `Uint8Array`, matching the on-chain commitment
- **`schema.fromWitnessArgs(index, source)`** — decodes the wire-format witness directly from the CKB transaction (inside ckb-js-vm only)
- **`ckb-idl-derive` CLI** — emits `idl.json` to disk from any JS module that exports a schema

---

## Installation

```sh
pnpm add idl-derive-ts
# or
npm install idl-derive-ts
```

---

## Quick start

```ts
import { defineWitness, field } from "idl-derive-ts"

export const schema = defineWitness({
  name: "secp256k1-timelock",
  fields: {
    signature:       field("secp256k1_sig"),
    unlock_after_ms: field("uint64"),
    extra:           field("bytes", { required: false, description: "Optional payload" }),
  },
})

// Inspect the IDL
console.log(schema.idl)
// {
//   idl_version: "1",
//   name: "secp256k1-timelock",
//   witness: [
//     { name: "signature",       type: "secp256k1_sig", required: true },
//     { name: "unlock_after_ms", type: "uint64",        required: true },
//     { name: "extra",           type: "bytes",         required: false, description: "Optional payload" },
//   ]
// }

// Get the 32-byte IDL commitment hash
const hash = schema.idlHash()  // Uint8Array(32)

// Decode a witness inside ckb-js-vm
const values = schema.fromWitnessArgs(0, Source.GroupInput)
values.signature       // Uint8Array(65)
values.unlock_after_ms // bigint
values.extra           // Uint8Array
```

Field values are fully typed: `uint8` / `uint32` → `number`, `uint64` → `bigint`, everything else → `Uint8Array`. TypeScript infers this from the field definitions — no casts needed.

---

## Generating `idl.json`

Use the CLI to write the IDL document to disk. Point it at any JS/MJS/CJS module whose default export is a `WitnessSchema` (i.e. the result of `defineWitness`).

```sh
# Build your schema first
pnpm build

# Generate idl.json
npx ckb-idl-derive dist/witness.js
# ✓ Wrote IDL to ./idl.json

# Custom output path
npx ckb-idl-derive dist/witness.js ./src/idl.json
```

The JSON produced is identical to what `#[derive(CkbWitness)]` produces on the Rust side. The Rust and TypeScript implementations share [canonical test vectors](../ckb-idl-client/test-vectors.json) that verify byte-for-byte compatibility.

---

## Supported types

These are the same types the Rust proc-macro accepts, with the same wire encodings.

| IDL type string    | TypeScript value | Wire encoding                          |
|--------------------|------------------|----------------------------------------|
| `uint8`            | `number`         | 1 byte                                 |
| `uint32`           | `number`         | 4 bytes, little-endian                 |
| `uint64`           | `bigint`         | 8 bytes, little-endian                 |
| `secp256k1_sig`    | `Uint8Array(65)` | 65 bytes, fixed                        |
| `secp256k1_pubkey` | `Uint8Array(33)` | 33 bytes, fixed                        |
| `schnorr_sig`      | `Uint8Array(64)` | 64 bytes, fixed                        |
| `bytes`            | `Uint8Array`     | 4-byte LE length prefix + payload      |

Passing an unrecognised type to `field()` or `defineWitness()` throws `UnknownTypeError` at call time — not later at decode time.

---

## `field()` options

```ts
field(type, options?)
```

| Option        | Type      | Default     | Description                                          |
|---------------|-----------|-------------|------------------------------------------------------|
| `required`    | `boolean` | `true`      | Recorded in the IDL; `false` marks an optional field |
| `description` | `string`  | `undefined` | Human-readable description included in the IDL      |

---

## Decoding raw bytes

`decodeWireBytes` is the lower-level function used by `fromWitnessArgs`. It is also useful for testing, tooling, and environments outside ckb-js-vm.

```ts
import { decodeWireBytes } from "idl-derive-ts"

const fields = schema.idl.witness
const buf = new Uint8Array([/* ... */])

const result = decodeWireBytes(fields, buf)
// result is Record<string, number | bigint | Uint8Array>
```

---

## Errors

All errors extend `IdlDeriveError`.

| Class                | When thrown                                                 | Key properties                                          |
|----------------------|-------------------------------------------------------------|---------------------------------------------------------|
| `UnknownTypeError`   | `defineWitness` / `decodeWireBytes` called with unknown type | `.fieldName`, `.typeName`                              |
| `FieldTooShortError` | Buffer has fewer bytes than the field requires              | `.fieldName`, `.expected`, `.got`                       |
| `TrailingBytesError` | Bytes remain after all fields are decoded                   | `.consumed`, `.total`                                   |
| `MissingLockFieldError` | `WitnessArgs.lock` is absent                             | —                                                       |

```ts
import { FieldTooShortError, UnknownTypeError } from "idl-derive-ts"

try {
  decodeWireBytes(fields, buf)
} catch (e) {
  if (e instanceof FieldTooShortError) {
    console.error(`${e.fieldName}: need ${e.expected} bytes, got ${e.got}`)
  }
}
```

---

## How it fits into the system

```
Script author (Rust)                  Script author (TypeScript / ckb-js-vm)
─────────────────────                 ──────────────────────────────────────
#[derive(CkbWitness)]            ←→   defineWitness({ ... })
  → idl.json                     =      → schema.idl  (same structure)
  → from_witness_args()          ≈      → schema.fromWitnessArgs()

Deployer
────────
code_cell_data = binary || sha256(idl.json)

Wallet / off-chain tooling
──────────────────────────
Reads idl.json from registry → encodes witness → submits tx
```

The IDL is the contract. The Rust macro, this library, and the on-chain commitment all derive from the same field declarations.

---

## Development

```sh
pnpm install
pnpm build       # tsup → dist/
pnpm test        # vitest — 90 tests across 6 suites
```

Tests cover the decoder against the [canonical cross-language test vectors](../ckb-idl-client/test-vectors.json), so any regression that breaks Rust/TypeScript compatibility will be caught.
