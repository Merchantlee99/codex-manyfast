import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
await mkdir(path.join(root, "dist"), { recursive: true });
const outputFile = path.join(root, "dist/server.mjs");
await build({
  entryPoints: [path.join(root, "src/server.mjs")],
  outfile: outputFile,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node20",
  legalComments: "none",
});
const bundled = await readFile(outputFile, "utf8");
await writeFile(outputFile, bundled.replace(/[ \t]+$/gm, ""));
process.stdout.write("Built dist/server.mjs\n");
