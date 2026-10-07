import * as esbuild from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
import { indexHtml } from "./html.mjs";

await mkdir("dist", { recursive: true });
await writeFile("dist/index.html", indexHtml);

const ctx = await esbuild.context({
  absWorkingDir: process.cwd(),
  entryPoints: ["src/main.ts"],
  bundle: true,
  outdir: "dist",
  format: "esm",
  sourcemap: true,
  target: ["es2022"],
  logLevel: "info",
  loader: { ".json": "json" },
});

await ctx.watch();
const server = await ctx.serve({ servedir: "dist", host: "127.0.0.1", port: 5173 });
console.log(`Imposter Who?  http://127.0.0.1:${server.port}`);
