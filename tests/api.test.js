import test from "node:test";
import assert from "node:assert/strict";
import chatHandler from "../api/chat.js";
import uploadHandler from "../api/knowledge/upload.js";
import { verifyVectorStoreToken } from "../api/_lib/session.js";

test("chat function sends a structured Responses API request", async () => {
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_MODEL = "gpt-5.6-terra";
  delete process.env.OPENAI_VECTOR_STORE_ID;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.openai.com/v1/responses");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "gpt-5.6-terra");
    assert.equal(body.text.format.type, "json_schema");
    assert.equal(body.text.format.strict, true);
    return new Response(JSON.stringify({
      id: "resp_test",
      model: "gpt-5.6-terra",
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: JSON.stringify({
            type: "dialogue", topic: "闲话", message: "臣听着。", question: null, decision: null
          })
        }]
      }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const response = await chatHandler.fetch(new Request("http://local/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.2" },
      body: JSON.stringify({ message: "今天有点累", minister: "顺臣" })
    }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.result.type, "dialogue");
    assert.equal(payload.meta.responseId, "resp_test");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("knowledge upload creates an isolated signed vector store", async () => {
  const originalFetch = globalThis.fetch;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.APP_SESSION_SECRET = "test-secret-that-is-long-enough-for-api-tests";
  globalThis.fetch = async (url, options = {}) => {
    const path = new URL(url).pathname;
    if (path === "/v1/vector_stores" && options.method === "POST") {
      return Response.json({ id: "vs_user_test" });
    }
    if (path === "/v1/files" && options.method === "POST") {
      assert.ok(options.body instanceof FormData);
      return Response.json({ id: "file_test" });
    }
    if (path === "/v1/vector_stores/vs_user_test/files" && options.method === "POST") {
      return Response.json({ id: "vsfile_test", status: "in_progress" });
    }
    if (path === "/v1/vector_stores/vs_user_test/files/file_test") {
      return Response.json({ id: "file_test", status: "completed" });
    }
    throw new Error("unexpected mock request: " + path);
  };
  try {
    const form = new FormData();
    form.set("file", new File(["项目复盘原则"], "复盘.md", { type: "text/markdown" }));
    const response = await uploadHandler.fetch(new Request("http://local/api/knowledge/upload", {
      method: "POST",
      headers: { "x-forwarded-for": "127.0.0.3" },
      body: form
    }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.book.status, "completed");
    assert.equal(verifyVectorStoreToken(payload.knowledgeToken), "vs_user_test");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
