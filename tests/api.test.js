import test from "node:test";
import assert from "node:assert/strict";
import chatHandler from "../api/chat.js";
import uploadHandler from "../api/knowledge/upload.js";

test("chat function sends a JSON DeepSeek-V4-Pro request with knowledge", async () => {
  const originalFetch = globalThis.fetch;
  process.env.deepseek = "test-key";
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.DEEPSEEK_MODEL;
  globalThis.fetch = async (url, options) => {
    assert.equal(url, "https://api.deepseek.com/chat/completions");
    const body = JSON.parse(options.body);
    assert.equal(body.model, "deepseek-v4-pro");
    assert.equal(body.response_format.type, "json_object");
    assert.equal(body.thinking.type, "disabled");
    assert.match(body.messages.at(-1).content, /我的复盘/);
    assert.match(body.messages.at(-1).content, /DAY_31_60/);
    return new Response(JSON.stringify({
      id: "chatcmpl_test",
      model: "deepseek-v4-pro",
      choices: [{ message: { content: JSON.stringify({
        type: "dialogue", topic: "复盘", message: "臣已参考典籍。", question: null, decision: null
      }) } }]
    }), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    const response = await chatHandler.fetch(new Request("http://local/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json", "x-forwarded-for": "127.0.0.2" },
      body: JSON.stringify({
        message: "今天有点累",
        minister: "顺臣",
        state: { day: 45 },
        knowledge: [{ title: "我的复盘", content: "每周五先总结阻塞，再约负责人对齐。", journeyStages: ["DAY_31_60"] }]
      })
    }));
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.result.type, "dialogue");
    assert.equal(payload.meta.mode, "deepseek");
    assert.equal(payload.meta.responseId, "chatcmpl_test");
    assert.equal(payload.meta.userKnowledgeDocuments, 1);
    assert.deepEqual(payload.meta.publishedSopCandidates, []);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("knowledge upload extracts real Markdown text for browser-local retrieval", async () => {
  const form = new FormData();
  form.set("title", "我的复盘");
  form.set("file", new File(["# 项目复盘\n\n先确认阻塞，再约负责人对齐。"], "复盘.md", { type: "text/markdown" }));
  const response = await uploadHandler.fetch(new Request("http://local/api/knowledge/upload", {
    method: "POST",
    headers: { "x-forwarded-for": "127.0.0.3" },
    body: form
  }));
  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.book.status, "completed");
  assert.equal(payload.knowledgeDocument.title, "我的复盘");
  assert.match(payload.knowledgeDocument.content, /先确认阻塞/);
});
