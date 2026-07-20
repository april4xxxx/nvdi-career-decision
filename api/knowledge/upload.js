import { DOMMatrix, ImageData, Path2D } from "@napi-rs/canvas";
import { errorResponse, HttpError, json } from "../_lib/http.js";
import { checkRateLimit, clientIp } from "../_lib/rate-limit.js";

// Vercel Functions 请求体上限为 4.5MB；保留 multipart 开销后限制为 4MB。
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 60000;
const ALLOWED_EXTENSIONS = [".txt", ".md", ".pdf"];

function extensionOf(name) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

function normalizeText(value) {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+\n/g, "\n")
    .replace(/\n{4,}/g, "\n\n\n")
    .trim();
}

async function extractPdf(file) {
  // pdfjs 在 Node/Vercel 中需要这些 Web 图形全局对象；显式导入也让 Vercel
  // Node File Trace 把对应的 Linux 原生二进制一并打包。
  if (!globalThis.DOMMatrix) globalThis.DOMMatrix = DOMMatrix;
  if (!globalThis.ImageData) globalThis.ImageData = ImageData;
  if (!globalThis.Path2D) globalThis.Path2D = Path2D;
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(await file.arrayBuffer()) });
  try {
    const result = await parser.getText();
    return result.text || "";
  } finally {
    await parser.destroy();
  }
}

async function extractText(file, extension) {
  if (extension === ".pdf") return extractPdf(file);
  return file.text();
}

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "仅支持 POST", code: "METHOD_NOT_ALLOWED" }, 405, { allow: "POST" });
    try {
      const rate = checkRateLimit("upload:" + clientIp(request), 8);
      if (!rate.allowed) throw new HttpError(429, "典籍上传过于频繁，请稍后再试", "RATE_LIMITED");

      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(400, "请选择要上传的典籍", "FILE_REQUIRED");
      if (!file.size || file.size > MAX_FILE_SIZE) throw new HttpError(413, "典籍需小于 4MB", "FILE_TOO_LARGE");
      const extension = extensionOf(file.name);
      if (!ALLOWED_EXTENSIONS.includes(extension)) {
        throw new HttpError(415, "当前仅支持 TXT、Markdown 和 PDF", "UNSUPPORTED_FILE_TYPE");
      }

      let text;
      try { text = normalizeText(await extractText(file, extension)); }
      catch (error) {
        console.error("[knowledge] extraction failed", extension, error?.message || error);
        throw new HttpError(422, "无法读取这份典籍；扫描版 PDF 请先转为可选择文字的 PDF 或 TXT", "EXTRACTION_FAILED");
      }
      if (!text) throw new HttpError(422, "典籍中没有可读取的文字", "NO_EXTRACTABLE_TEXT");

      const truncated = text.length > MAX_EXTRACTED_CHARS;
      const content = text.slice(0, MAX_EXTRACTED_CHARS);
      return json({
        book: {
          fileName: file.name,
          bytes: file.size,
          status: "completed",
          chars: content.length,
          truncated
        },
        knowledgeDocument: {
          title: String(form.get("title") || file.name).slice(0, 80),
          fileName: file.name,
          content
        }
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
};
