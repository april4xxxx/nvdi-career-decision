import { createReadStream } from "node:fs";
import { existsSync, readFileSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";
import { Readable } from "node:stream";
import chatHandler from "./api/chat.js";
import uploadHandler from "./api/knowledge/upload.js";

const root = resolve(".");
const envFile = process.env.ENV_FILE || ".env.production";

function loadEnvFile(filePath) {
  const resolved = resolve(filePath);
  if (!existsSync(resolved)) return;
  const lines = readFileSync(resolved, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    const rawValue = trimmed.slice(index + 1).trim();
    const value = rawValue.replace(/^(['"])(.*)\1$/, "$2");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvFile(envFile);

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "0.0.0.0";

const apiRoutes = new Map([
  ["/api/chat", chatHandler],
  ["/api/knowledge/upload", uploadHandler],
]);

const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".m4a", "audio/mp4"],
  [".md", "text/markdown; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
]);

function requestUrl(req) {
  return new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
}

function toWebRequest(req, url) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) {
      for (const item of value) headers.append(key, item);
    } else if (typeof value === "string") {
      headers.set(key, value);
    }
  }
  const hasBody = !["GET", "HEAD"].includes(req.method || "GET");
  return new Request(url, {
    method: req.method,
    headers,
    body: hasBody ? Readable.toWeb(req) : undefined,
    duplex: hasBody ? "half" : undefined,
  });
}

async function sendWebResponse(res, response) {
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  if (!response.body) {
    res.end();
    return;
  }
  Readable.fromWeb(response.body).pipe(res);
}

function safePath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const normalized = normalize(decoded).replace(/^(\.\.(\/|\\|$))+/, "");
  return join(root, normalized === "/" ? "index.html" : normalized);
}

async function sendStatic(req, res, pathname) {
  let filePath = safePath(pathname);
  if (!filePath.startsWith(root)) {
    res.writeHead(403).end("Forbidden");
    return;
  }
  let fileStat;
  try {
    fileStat = await stat(filePath);
    if (fileStat.isDirectory()) filePath = join(filePath, "index.html");
    fileStat = await stat(filePath);
  } catch {
    filePath = join(root, "index.html");
    fileStat = await stat(filePath);
  }
  const type = mimeTypes.get(extname(filePath).toLowerCase()) || "application/octet-stream";
  res.writeHead(200, {
    "content-length": fileStat.size,
    "content-type": type,
    "cache-control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=31536000, immutable",
  });
  if (req.method === "HEAD") {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

const server = createServer(async (req, res) => {
  try {
    const url = requestUrl(req);
    const handler = apiRoutes.get(url.pathname);
    if (handler) {
      const request = toWebRequest(req, url);
      const response = await handler.fetch(request);
      await sendWebResponse(res, response);
      return;
    }
    await sendStatic(req, res, url.pathname);
  } catch (error) {
    console.error("[server] request failed", error);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Internal Server Error");
  }
});

server.on("error", (error) => {
  console.error("[server] failed to start", error);
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log(`女帝职场决策系统 listening on http://${host}:${port}`);
});
