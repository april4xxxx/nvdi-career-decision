import { decisionResponseSchema, normalizeDecisionResponse } from "./_lib/decision.js";
import { errorResponse, HttpError, json, readJson } from "./_lib/http.js";
import { extractOutputText, openaiFetch } from "./_lib/openai.js";
import { checkRateLimit, clientIp } from "./_lib/rate-limit.js";
import { verifyVectorStoreToken } from "./_lib/session.js";

const SYSTEM_PROMPT = `
你是“女帝职场决策系统”的御前决策大臣，帮助初入职场的用户把真实困境转化为可执行的下一步。

成功标准：
- 普通闲聊返回 dialogue；信息不足且会影响判断时返回 question；信息足够时返回 decision。
- 最多追问一轮，每次给 2-3 个短选项；若历史里已经追问过，必须给出带合理假设的临时决策。
- 决策必须说明投入、收益、机会成本，并给一个推荐方案和一个可为空的备选方案。
- 推荐方案拆成 1-4 个今天可以执行的任务。任务分类只能是 main、daily、explore、delay、mystic。
- main 是职业主线，daily 是例行事务，explore 是低风险试探，delay 是拖延事项，mystic 是休息恢复。
- energy 表示精力消耗，通常 2-20；恢复任务用 restore 5-50，energy 可为负数；gold 通常 5-40。
- 使用检索到的典籍时，把实际使用的文件名或典籍名放入 sources；没有使用则返回空数组。
- 不虚构用户公司制度、薪资、医疗或法律事实；证据不足时明确假设，并给可逆的小步验证。

表达风格由请求中的 minister 决定：直臣先结论再证据，顺臣先承接情绪再建议，卦师优先寻找可试探且可退出的第三条路。
只返回规定结构，不要额外输出 Markdown。
`.trim();

function cleanHistory(history) {
  return (Array.isArray(history) ? history : []).slice(-12).map((item) => ({
    role: item?.role === "assistant" ? "assistant" : "user",
    content: String(item?.content || "").slice(0, 1600)
  })).filter((item) => item.content);
}

function cleanState(state) {
  return {
    nickname: String(state?.nickname || "陛下").slice(0, 20),
    empressType: String(state?.empressType || "").slice(0, 30),
    energy: Number(state?.energy) || 0,
    gold: Number(state?.gold) || 0,
    scene: String(state?.scene || "court").slice(0, 30),
    pendingTasks: (Array.isArray(state?.pendingTasks) ? state.pendingTasks : []).slice(0, 8).map((v) => String(v).slice(0, 100)),
    recentJournals: (Array.isArray(state?.recentJournals) ? state.recentJournals : []).slice(0, 5).map((v) => String(v).slice(0, 160)),
    books: (Array.isArray(state?.books) ? state.books : []).slice(0, 12).map((v) => String(v).slice(0, 80))
  };
}

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ error: "仅支持 POST", code: "METHOD_NOT_ALLOWED" }, 405, { allow: "POST" });
    try {
      const limit = Math.max(1, Number(process.env.CHAT_RATE_LIMIT) || 24);
      const rate = checkRateLimit("chat:" + clientIp(request), limit);
      if (!rate.allowed) {
        return json({ error: "今日议事过于频繁，请稍后再试", code: "RATE_LIMITED" }, 429, { "retry-after": String(rate.retryAfter) });
      }

      const body = await readJson(request);
      const message = String(body?.message || "").trim().slice(0, 2000);
      if (!message) throw new HttpError(400, "请输入想商议的事情", "EMPTY_MESSAGE");

      const appState = cleanState(body?.state);
      const contextMessage = [
        "当前大臣：" + String(body?.minister || "顺臣").slice(0, 20),
        "本轮是否已经追问过：" + (body?.probed ? "是；请直接给临时决策，不再追问" : "否"),
        "当前应用状态：" + JSON.stringify(appState),
        "用户本轮输入：" + message
      ].join("\n");
      const input = cleanHistory(body?.history);
      input.push({ role: "user", content: contextMessage });

      const vectorStoreIds = [];
      if (process.env.OPENAI_VECTOR_STORE_ID) vectorStoreIds.push(process.env.OPENAI_VECTOR_STORE_ID);
      const userVectorStoreId = verifyVectorStoreToken(body?.knowledgeToken);
      if (userVectorStoreId && !vectorStoreIds.includes(userVectorStoreId)) vectorStoreIds.push(userVectorStoreId);

      const payload = {
        model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
        instructions: SYSTEM_PROMPT,
        input,
        reasoning: { effort: "low" },
        max_output_tokens: 2600,
        store: false,
        text: {
          verbosity: "low",
          format: {
            type: "json_schema",
            name: "career_decision",
            strict: true,
            schema: decisionResponseSchema
          }
        }
      };
      if (vectorStoreIds.length) {
        payload.tools = [{ type: "file_search", vector_store_ids: vectorStoreIds, max_num_results: 5 }];
        payload.include = ["file_search_call.results"];
      }

      const response = await openaiFetch("/responses", { method: "POST", body: JSON.stringify(payload) });
      const outputText = extractOutputText(response);
      if (!outputText) throw new HttpError(502, "AI 未返回可读取的奏折", "EMPTY_AI_RESPONSE");
      let parsed;
      try { parsed = JSON.parse(outputText); }
      catch { throw new HttpError(502, "AI 奏折格式异常，请再试一次", "INVALID_AI_RESPONSE"); }

      return json({
        result: normalizeDecisionResponse(parsed),
        meta: {
          mode: "openai",
          model: response.model || payload.model,
          usedKnowledgeBase: vectorStoreIds.length > 0,
          responseId: response.id || null
        }
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
};
