/* =============================================================
   api.js —— 浏览器端服务适配器
   只请求同源 /api；API Key 永远不进入浏览器。
   ============================================================= */
(function () {
  "use strict";
  window.App = window.App || {};

  function apiError(payload, status) {
    var error = new Error((payload && payload.error) || "御前驿站暂时没有回应");
    error.code = (payload && payload.code) || "API_ERROR";
    error.status = status;
    return error;
  }

  async function request(url, options, timeoutMs) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, timeoutMs || 30000);
    try {
      var response = await fetch(url, Object.assign({}, options || {}, { signal: controller.signal }));
      var payload = await response.json().catch(function () { return null; });
      if (!response.ok) throw apiError(payload, response.status);
      return payload;
    } catch (error) {
      if (error && error.name === "AbortError") {
        var timeout = new Error("大臣思虑过久，请稍后再试");
        timeout.code = "TIMEOUT";
        throw timeout;
      }
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  function chat(payload) {
    return request("/api/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload)
    }, 45000);
  }

  function uploadKnowledge(file, knowledgeToken) {
    var form = new FormData();
    form.set("file", file, file.name);
    if (knowledgeToken) form.set("knowledgeToken", knowledgeToken);
    return request("/api/knowledge/upload", { method: "POST", body: form }, 60000);
  }

  window.App.api = { chat: chat, uploadKnowledge: uploadKnowledge };
})();
