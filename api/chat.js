import { decisionResponseSchema, normalizeDecisionResponse } from "./_lib/decision.js";
import { deepseekFetch, extractDeepSeekText } from "./_lib/deepseek.js";
import { errorResponse, HttpError, json, readJson } from "./_lib/http.js";
import { checkRateLimit, clientIp } from "./_lib/rate-limit.js";

const PUBLIC_KNOWLEDGE = `
《女帝职场决策原则》：先判断闲聊、追问或可决策；关键信息不足只追问一轮，之后基于明确假设给临时方案。决策必须呈现投入、收益、机会成本、推荐路径和可选备选路径，并拆成 1-4 个今天可执行的小任务。优先选择低风险、可验证、可退出的行动。任务分类：main 为岗位胜任和核心交付；daily 为例行协作；explore 为低风险试探；delay 为长期搁置事项；mystic 为休息恢复。普通任务精力 2-20、金币 5-40；恢复任务使用 restore 5-50。不得虚构公司制度、薪资或项目背景；医疗、法律、财务问题提示咨询专业人士。
`.trim();

const SYSTEM_PROMPT = `
你是“女帝职场决策系统”的御前决策大臣，帮助初入职场的用户把真实困境转化为可执行的下一步。

成功标准：
- 普通闲聊返回 dialogue；信息不足且会影响判断时返回 question；信息足够时返回 decision。
- 最多追问一轮，每次给 2-3 个短选项；若历史里已经追问过，必须给出带合理假设的临时决策。
- 决策必须说明投入、收益、机会成本，并给一个推荐方案和一个可为空的备选方案。
- 推荐方案拆成 1-4 个今天可以执行的任务。任务分类只能是 main、daily、explore、delay、mystic。
- energy 表示精力消耗，通常 2-20；恢复任务用 restore 5-50，energy 可为负数；gold 通常 5-40。
- 使用提供的典籍片段时，把实际使用的典籍名放入 sources；没有使用则返回空数组。
- 不虚构用户公司制度、薪资、医疗或法律事实；证据不足时明确假设，并给可逆的小步验证。

表达风格由请求中的 minister 决定：直臣先结论再证据，顺臣先承接情绪再建议，卦师优先寻找可试探且可退出的第三条路。
只返回一个合法 JSON 对象，不要 Markdown、代码围栏或额外说明。JSON 必须符合此 Schema：
${JSON.stringify(decisionResponseSchema)}
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

function cleanKnowledge(knowledge) {
  let remaining = 18000;
  const documents = [];
  for (const item of Array.isArray(knowledge) ? knowledge.slice(0, 6) : []) {
    if (remaining <= 0) break;
    const title = String(item?.title || item?.fileName || "用户典籍").trim().slice(0, 80);
    const content = String(item?.content || "").trim().slice(0, Math.min(remaining, 5000));
    if (!content) continue;
    documents.push({ title, content });
    remaining -= content.length;
  }
  return documents;
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
      const knowledge = cleanKnowledge(body?.knowledge);
      const knowledgeBlock = [
        "公共典籍《女帝职场决策原则》：\n" + PUBLIC_KNOWLEDGE,
        ...knowledge.map((item) => `用户典籍《${item.title}》：\n${item.content}`)
      ].join("\n\n---\n\n");
      const contextMessage = [
        "当前大臣：" + String(body?.minister || "顺臣").slice(0, 20),
        "本轮是否已经追问过：" + (body?.probed ? "是；请直接给临时决策，不再追问" : "否"),
        "当前应用状态：" + JSON.stringify(appState),
        "本轮可用典籍：\n" + knowledgeBlock,
        "用户本轮输入：" + message
      ].join("\n\n");

      const messages = [{ role: "system", content: SYSTEM_PROMPT }, ...cleanHistory(body?.history)];
      messages.push({ role: "user", content: contextMessage });
      const payload = {
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-pro",
        messages,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        max_tokens: 2600,
        stream: false
      };

      const response = await deepseekFetch("/chat/completions", { method: "POST", body: JSON.stringify(payload) });
      const outputText = extractDeepSeekText(response);
      if (!outputText) throw new HttpError(502, "AI 未返回可读取的奏折", "EMPTY_AI_RESPONSE");
      let parsed;
      try { parsed = JSON.parse(outputText); }
      catch { throw new HttpError(502, "AI 奏折格式异常，请再试一次", "INVALID_AI_RESPONSE"); }

      return json({
        result: normalizeDecisionResponse(parsed),
        meta: {
          mode: "deepseek",
          model: response.model || payload.model,
          usedKnowledgeBase: true,
          userKnowledgeDocuments: knowledge.length,
          responseId: response.id || null
        }
      });
    } catch (error) {
      return errorResponse(error);
    }
  }
};
