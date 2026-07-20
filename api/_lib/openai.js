import { HttpError } from "./http.js";

const API_BASE = "https://api.openai.com/v1";

export function requireApiKey() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new HttpError(503, "尚未配置 AI 服务，已可使用本地演示模式", "AI_NOT_CONFIGURED");
  return key;
}

export async function openaiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("authorization", "Bearer " + requireApiKey());
  if (options.body && !(options.body instanceof FormData) && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const response = await fetch(API_BASE + path, { ...options, headers });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : {}; } catch { data = { raw }; }
  if (!response.ok) {
    console.error("[openai] request failed", response.status, data?.error?.code || "unknown");
    throw new HttpError(502, "AI 服务暂时没有响应，请稍后再试", "OPENAI_UPSTREAM_ERROR");
  }
  return data;
}

export function extractOutputText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) {
      if (part.type === "output_text" && typeof part.text === "string") return part.text;
    }
  }
  return "";
}
