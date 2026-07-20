import { createHmac, timingSafeEqual } from "node:crypto";

function base64url(value) {
  return Buffer.from(value).toString("base64url");
}

function secret() {
  return process.env.APP_SESSION_SECRET || "";
}

export function signVectorStoreId(vectorStoreId) {
  if (!secret()) throw new Error("APP_SESSION_SECRET is not configured");
  const payload = base64url(JSON.stringify({ vectorStoreId, issuedAt: Date.now() }));
  const signature = createHmac("sha256", secret()).update(payload).digest("base64url");
  return payload + "." + signature;
}

export function verifyVectorStoreToken(token) {
  if (!token || !secret()) return null;
  const parts = String(token).split(".");
  if (parts.length !== 2) return null;
  const expected = createHmac("sha256", secret()).update(parts[0]).digest("base64url");
  const actualBuffer = Buffer.from(parts[1]);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    return typeof parsed.vectorStoreId === "string" ? parsed.vectorStoreId : null;
  } catch {
    return null;
  }
}
