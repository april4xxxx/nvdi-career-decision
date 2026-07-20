import { HttpError } from "./http.js";

const API_BASE = "https://api.deepseek.com";

export function requireDeepSeekApiKey() {
  // 兼容已经在 Vercel 中创建的变量名 deepseek；推荐名称仍为 DEEPSEEK_API_KEY。
  const key = process.env.DEEPSEEK_API_KEY || process.env.deepseek;
  if (!key) throw new HttpError(503, "尚未配置 AI 服务，已可使用本地演示模式", "AI_NOT_CONFIGURED");
  return key;
}

export async function deepseekFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("authorization", "Bearer " + requireDeepSeekApiKey());
  if (options.body && !headers.has("content-type")) headers.set("content-type", "application/json");

  const response = await fetch(API_BASE + path, { ...options, headers });
  const raw = await response.text();
  let data;
  try { data = raw ? JSON.parse(raw) : {}; }
  catch { data = { raw }; }

  if (!response.ok) {
    const upstreamCode = data?.error?.code || data?.error?.type || "unknown";
    console.error("[deepseek] request failed", response.status, upstreamCode);
    const message = response.status === 401
      ? "DeepSeek API Key 无效，请检查 Vercel 环境变量"
      : response.status === 402
        ? "DeepSeek 账户余额不足，请充值后再试"
        : response.status === 429
          ? "DeepSeek 当前请求较多，请稍后再试"
          : "AI 服务暂时没有响应，请稍后再试";
    throw new HttpError(502, message, "DEEPSEEK_UPSTREAM_ERROR");
  }
  return data;
}

export function extractDeepSeekText(response) {
  const content = response?.choices?.[0]?.message?.content;
  return typeof content === "string" ? content.trim() : "";
}
