import { errorResponse, HttpError, json } from "../_lib/http.js";
import { openaiFetch, requireApiKey } from "../_lib/openai.js";
import { checkRateLimit, clientIp } from "../_lib/rate-limit.js";
import { signVectorStoreId, verifyVectorStoreToken } from "../_lib/session.js";

// Vercel Functions 请求体上限为 4.5MB；保留 multipart 开销后限制为 4MB。
const MAX_FILE_SIZE = 4 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".txt", ".md", ".pdf"];

function extensionOf(name) {
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index).toLowerCase() : "";
}

async function waitForIndex(vectorStoreId, fileId) {
  let status = "in_progress";
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const record = await openaiFetch(`/vector_stores/${encodeURIComponent(vectorStoreId)}/files/${encodeURIComponent(fileId)}`);
    status = record.status || status;
    if (["completed", "failed", "cancelled"].includes(status)) return status;
    await new Promise((resolve) => setTimeout(resolve, 900));
  }
  return status;
}

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "仅支持 POST", code: "METHOD_NOT_ALLOWED" }, 405, { allow: "POST" });
    try {
      requireApiKey();
      if (!process.env.APP_SESSION_SECRET) {
        throw new HttpError(503, "尚未配置用户知识库签名密钥", "KNOWLEDGE_NOT_CONFIGURED");
      }
      const rate = checkRateLimit("upload:" + clientIp(request), 8);
      if (!rate.allowed) throw new HttpError(429, "典籍上传过于频繁，请稍后再试", "RATE_LIMITED");

      const form = await request.formData();
      const file = form.get("file");
      if (!(file instanceof File)) throw new HttpError(400, "请选择要上传的典籍", "FILE_REQUIRED");
      if (!file.size || file.size > MAX_FILE_SIZE) throw new HttpError(413, "典籍需小于 4MB", "FILE_TOO_LARGE");
      if (!ALLOWED_EXTENSIONS.includes(extensionOf(file.name))) {
        throw new HttpError(415, "当前仅支持 TXT、Markdown 和 PDF", "UNSUPPORTED_FILE_TYPE");
      }

      let vectorStoreId = verifyVectorStoreToken(form.get("knowledgeToken"));
      if (!vectorStoreId) {
        const store = await openaiFetch("/vector_stores", {
          method: "POST",
          body: JSON.stringify({ name: "女帝职场决策系统·用户典籍" })
        });
        vectorStoreId = store.id;
      }

      const uploadForm = new FormData();
      uploadForm.set("purpose", "assistants");
      uploadForm.set("file", file, file.name);
      const uploaded = await openaiFetch("/files", { method: "POST", body: uploadForm });
      await openaiFetch(`/vector_stores/${encodeURIComponent(vectorStoreId)}/files`, {
        method: "POST",
        body: JSON.stringify({ file_id: uploaded.id })
      });
      const status = await waitForIndex(vectorStoreId, uploaded.id);
      if (status === "failed" || status === "cancelled") {
        throw new HttpError(502, "典籍上传成功，但建立索引失败", "INDEX_FAILED");
      }

      return json({
        book: { fileName: file.name, bytes: file.size, status },
        knowledgeToken: signVectorStoreId(vectorStoreId)
      }, status === "completed" ? 200 : 202);
    } catch (error) {
      return errorResponse(error);
    }
  }
};
