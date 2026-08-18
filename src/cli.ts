#!/usr/bin/env node
/**
 * ckb-idl-derive CLI
 *
 * Usage:
 *   ckb-idl-derive [options] <schema-file> [output-path]
 *
 * Arguments:
 *   schema-file   Path to a .js / .mjs / .cjs module that exports a
 *                 WitnessSchema as its default export.
 *   output-path   Where to write idl.json  (default: ./idl.json)
 *
 * Options:
 *   --help        Print this message and exit 0
 *   --version     Print the package version and exit 0
 */

import { writeIdl } from "./io.js";
import type { FieldDescriptor, WitnessSchema } from "./types.js";

const USAGE = `\
Usage: ckb-idl-derive [options] <schema-file> [output-path]

Arguments:
  schema-file   Path to a JS/MJS/CJS module with a WitnessSchema default export
  output-path   Where to write idl.json (default: ./idl.json)

Options:
  --help        Print this message and exit 0
  --version     Print the package version and exit 0

Example:
  ckb-idl-derive src/witness.js idl.json
  ckb-idl-derive dist/witness.mjs ./idl.json
`;

async function main(argv: string[]): Promise<void> {
  const args = argv.slice(2); // drop "node" and script path

  // --help takes priority over everything else
  if (args.includes("--help")) {
    process.stdout.write(USAGE);
    process.exit(0);
  }

  // --version
  if (args.includes("--version")) {
    const { createRequire } = await import("node:module");
    const req = createRequire(import.meta.url);
    const pkg = req("../package.json") as { version: string };
    process.stdout.write(pkg.version + "\n");
    process.exit(0);
  }

  const positional = args.filter((a) => !a.startsWith("--"));
  const schemaFile = positional[0];
  const outputPath = positional[1] ?? "./idl.json";

  if (!schemaFile) {
    process.stderr.write("Error: <schema-file> argument is required\n\n" + USAGE);
    process.exit(1);
  }

  // Resolve to an absolute path so dynamic import works from any cwd
  const { resolve } = await import("node:path");
  const absolutePath = resolve(process.cwd(), schemaFile);

  let schema: WitnessSchema<Record<string, FieldDescriptor>>;

  try {
    const mod = await import(absolutePath);
    schema = mod.default ?? mod;
    if (!schema || typeof schema.idlHash !== "function") {
      throw new Error(
        "The module's default export does not look like a WitnessSchema. " +
          "Make sure you export the result of defineWitness() as the default export."
      );
    }
  } catch (err) {
    process.stderr.write(`Error loading schema from "${schemaFile}": ${(err as Error).message}\n`);
    process.exit(1);
  }

  try {
    await writeIdl(schema, outputPath);
    process.stdout.write(`✓ Wrote IDL to ${outputPath}\n`);
  } catch (err) {
    process.stderr.write(`Error writing IDL to "${outputPath}": ${(err as Error).message}\n`);
    process.exit(1);
  }
}

main(process.argv).catch((err: unknown) => {
  process.stderr.write(`Unexpected error: ${(err as Error).message}\n`);
  process.exit(1);
});
