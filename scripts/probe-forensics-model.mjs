import { config } from "dotenv";
import OpenAI from "openai";
config({ path: ".env.forensics.local", override: true, quiet: true });
const model = "gpt-6-luna";
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  maxRetries: 0,
  timeout: 30000,
});
try {
  const available = await client.models.retrieve(model);
  const response = await client.responses.create({
    model,
    store: false,
    max_output_tokens: 128,
    reasoning: { effort: "none" },
    input:
      "Return available=true. This is a structured-output capability check with no personal data.",
    text: {
      format: {
        type: "json_schema",
        name: "capability_check",
        strict: true,
        schema: {
          type: "object",
          properties: { available: { type: "boolean" } },
          required: ["available"],
          additionalProperties: false,
        },
      },
    },
  });
  console.log(
    JSON.stringify({
      model: available.id,
      structuredOutput: JSON.parse(response.output_text),
      usage: response.usage,
    }),
  );
} catch (error) {
  console.log(
    JSON.stringify({
      model,
      verified: false,
      status: error.status ?? null,
      errorType: error.constructor.name,
    }),
  );
  process.exitCode = 1;
}
