import { canonicalJson } from "./idl.js";
import { FieldDescriptor, WitnessSchema } from "./types.js";

export async function writeIdl<F extends Record<string, FieldDescriptor>>(
  schema: WitnessSchema<F>,
  outputPath: string,
): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  const json = canonicalJson(schema.idl);
  await writeFile(outputPath, json, "utf8");
}
