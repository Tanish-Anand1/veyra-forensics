import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { zipSync } from "fflate";
import { checkSourceFile } from "./source-policy.mjs";

const directories = [
  ".github",
  "src",
  "server",
  "shared",
  "api",
  "migrations",
  "public",
  "tests",
  "scripts",
  "docs",
];
const topLevel = [
  "package.json",
  "package-lock.json",
  "README.md",
  "THIRD_PARTY_NOTICES.md",
  ".env.example",
  ".gitignore",
  ".gitattributes",
  ".vercelignore",
  "index.html",
  "tsconfig.json",
  "vite.config.ts",
  "vercel.json",
  "eslint.config.js",
  "playwright.config.ts",
];
const files = new Map();

async function include(path) {
  const bytes = await readFile(path);
  checkSourceFile(path, bytes);
  files.set(`veyra-forensics/${path}`, bytes);
}

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink())
      throw new Error(`Symbolic link excluded: ${directory}/${entry.name}`);
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await walk(path);
    else if (entry.isFile()) await include(path);
  }
}

for (const directory of directories) await walk(directory);
for (const file of topLevel) await include(file);

const archive = zipSync(Object.fromEntries(files), { level: 9 });
const result = {
  archive: "artifacts/delivery/veyra-forensics-source.zip",
  files: files.size,
  bytes: archive.byteLength,
  sha256: createHash("sha256").update(archive).digest("hex"),
  credentialScanPassed: true,
  excluded: [
    "environment secrets",
    "deployment credentials",
    "dependencies",
    "build output",
    "screenshots",
    "runtime artifacts",
  ],
};
await mkdir("artifacts/delivery", { recursive: true });
await writeFile(result.archive, archive);
await writeFile(
  "artifacts/delivery/source-manifest.json",
  JSON.stringify(result, null, 2),
);
console.log(JSON.stringify(result));
