import * as esbuild from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { indexHtml } from "./html.mjs";

await mkdir("dist", { recursive: true });
await esbuild.build({
  absWorkingDir: process.cwd(),
  entryPoints: ["src/main.ts"],
  bundle: true,
  outdir: "dist",
  format: "esm",
  minify: true,
  target: ["es2022"],
  logLevel: "info",
  loader: { ".json": "json" },
});
await writeFile("dist/index.html", indexHtml);
