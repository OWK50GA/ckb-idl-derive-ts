import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    index: "src/index.ts",
    cli: "src/cli.ts",
  },
  external: ["@ckb-js-std/core", "@ckb-js-std/bindings"],
  format: ["esm", "cjs"],
  dts: true,
  target: "node20",
  splitting: false,
  clean: true,
  sourcemap: true,
});
