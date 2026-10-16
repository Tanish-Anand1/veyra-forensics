import { config } from "dotenv";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { importAI } from "../server/import-ai";
config({ path: ".env.forensics.local", override: true, quiet: true });
try {
  const image = await readFile(
    "artifacts/forensics/generated-vision-check.webp",
  );
  const result = await importAI.readScreenshot({
    requestId: randomUUID(),
    consent: true,
    imageId: "img-0000000000000099",
    image: `data:image/webp;base64,${image.toString("base64")}`,
  });
  console.log(
    JSON.stringify({ verified: true, messages: result.messages.length }),
  );
} catch (error) {
  const diagnostic = error as {
    name?: string;
    status?: number;
    code?: string;
    message?: string;
  };
  console.log(
    JSON.stringify({
      verified: false,
      type: diagnostic.name,
      status: diagnostic.status,
      code: diagnostic.code,
      diagnostic: diagnostic.message
        ?.replace(/sk-[A-Za-z0-9_-]+/g, "[REDACTED]")
        .slice(0, 500),
    }),
  );
  process.exitCode = 1;
}
