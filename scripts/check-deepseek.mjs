import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

function parseEnv(text) {
  const values = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
    values[key] = value;
  }
  return values;
}

const envFile = resolve(process.argv[2] || ".env.local");
const localEnv = parseEnv(await readFile(envFile, "utf8"));
const apiKey = process.env.DEEPSEEK_API_KEY || process.env.deepseek || localEnv.DEEPSEEK_API_KEY || localEnv.deepseek;
if (!apiKey) throw new Error("DeepSeek key is missing");

const response = await fetch("https://api.deepseek.com/chat/completions", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "authorization": `Bearer ${apiKey}`
  },
  body: JSON.stringify({
    model: process.env.DEEPSEEK_MODEL || "deepseek-v4-pro",
    messages: [{ role: "user", content: "Return only this JSON object: {\"ok\":true}" }],
    response_format: { type: "json_object" },
    thinking: { type: "disabled" },
    max_tokens: 30,
    stream: false
  })
});

const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  const code = payload?.error?.code || `HTTP_${response.status}`;
  const message = String(payload?.error?.message || "unknown error").slice(0, 300);
  throw new Error(`DeepSeek connection failed: ${code}: ${message}`);
}

process.stdout.write(JSON.stringify({
  ok: true,
  status: response.status,
  model: payload.model || null,
  response_id_present: Boolean(payload.id)
}) + "\n");
