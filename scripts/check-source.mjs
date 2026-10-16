import { execFileSync } from "node:child_process";
import { checkSourceFile } from "./source-policy.mjs";

const entries = execFileSync("git", ["ls-files", "--stage", "-z"], {
  maxBuffer: 16 * 1024 * 1024,
})
  .toString("utf8")
  .split("\0")
  .filter(Boolean);
if (!entries.length) throw new Error("No indexed source files found.");

for (const entry of entries) {
  const tab = entry.indexOf("\t");
  const [mode, object, stage] = entry.slice(0, tab).split(" ");
  const path = entry.slice(tab + 1);
  if (!["100644", "100755"].includes(mode) || stage !== "0")
    throw new Error(`Unsupported or unresolved source entry: ${path}`);
  const bytes = execFileSync("git", ["cat-file", "blob", object], {
    maxBuffer: 32 * 1024 * 1024,
  });
  checkSourceFile(path, bytes);
}

console.log(
  JSON.stringify({ files: entries.length, credentialScanPassed: true }),
);
