/* =============================================================
   conversation-rules.js —— 对话状态与知识检索的纯逻辑
   window.App.conversationRules
   ============================================================= */
(function () {
  "use strict";
  window.App = window.App || {};

  // 待批奏折时，空输入才表示直接同意；有文字则表示补充信息。
  function sendAction(mode, hasPendingDecision, text) {
    if (mode === "stamp" && hasPendingDecision && !String(text || "").trim()) return "approve";
    return "submit";
  }

  // 只有真正的决策追问才消耗一轮追问机会，闲聊不改变状态。
  function nextProbed(current, responseType) {
    return !!current || responseType === "question";
  }

  // 开启新对话前需要保护的未完成状态，按风险从高到低返回。
  function newConversationRisks(state) {
    var value = state || {};
    var risks = [];
    if (value.pendingDecision) risks.push("pending");
    if (value.activeQuestion) risks.push("question");
    if (String(value.draft || "").trim()) risks.push("draft");
    return risks;
  }

  function sceneConversationTopic(sceneName) {
    var value = String(sceneName || "").trim();
    return value ? value + "议事" : "宫廷议事";
  }

  function stagesForChunk(text) {
    var value = String(text || "");
    var stages = [];
    function add(stage) { if (stages.indexOf(stage) < 0) stages.push(stage); }
    if (/1\s*[-–—至到]\s*7\s*天|第\s*1\s*周|第一周|入职第一天|入职第\s*[1-7]\s*天/.test(value)) add("DAY_1_7");
    if (/0\s*[-–—至到]\s*30\s*天|前\s*30\s*天|首月|第一个月/.test(value)) {
      add("DAY_1_7");
      add("DAY_8_30");
    }
    if (/8\s*[-–—至到]\s*30\s*天/.test(value)) add("DAY_8_30");
    if (/31\s*[-–—至到]\s*60\s*天|第二个月|入职两个月/.test(value)) add("DAY_31_60");
    if (/31\s*[-–—至到]\s*90\s*天/.test(value)) {
      add("DAY_31_60");
      add("DAY_61_90");
    }
    if (/61\s*[-–—至到]\s*90\s*天|转正答辩|90\s*天阶段/.test(value)) add("DAY_61_90");
    return stages;
  }

  function queryTerms(text) {
    var value = String(text || "").toLowerCase();
    var terms = value.match(/[a-z0-9]{2,}/g) || [];
    var chineseRuns = value.match(/[\u3400-\u9fff]+/g) || [];
    chineseRuns.forEach(function (run) {
      if (run.length === 1) terms.push(run);
      for (var i = 0; i < run.length - 1; i++) terms.push(run.slice(i, i + 2));
    });
    return terms.filter(function (term, index) { return terms.indexOf(term) === index; }).slice(0, 30);
  }

  // 以问题词法和用户当前入职阶段排序，但绝不发送总分为零或负分的无关片段。
  function selectKnowledge(documents, text, currentStage) {
    var terms = queryTerms(text);
    var asksForCurrentStage = /现在.{0,8}(应该|该做|注意)|当前阶段|这个阶段|现阶段|接下来.{0,8}(做什么|怎么做)/.test(String(text || ""));
    var candidates = [];
    (Array.isArray(documents) ? documents : []).slice(0, 12).forEach(function (document) {
      var content = String(document.content || "");
      for (var start = 0; start < content.length; start += 2100) {
        var chunk = content.slice(start, start + 2400);
        if (!chunk) continue;
        var haystack = (String(document.title || "") + " " + chunk).toLowerCase();
        var lexicalScore = terms.reduce(function (sum, term) {
          return sum + (haystack.indexOf(term) >= 0 ? (term.length > 1 ? 3 : 1) : 0);
        }, 0);
        var score = lexicalScore;
        var chunkStages = stagesForChunk(chunk);
        if (lexicalScore > 0 && currentStage && chunkStages.indexOf(currentStage) >= 0) score += 12;
        else if (lexicalScore > 0 && currentStage && chunkStages.length) score -= 6;
        else if (lexicalScore === 0 && asksForCurrentStage && currentStage && chunkStages.indexOf(currentStage) >= 0) score = 12;
        if (score > 0 && (lexicalScore > 0 || asksForCurrentStage)) {
          candidates.push({
            title: document.title || document.fileName || "用户典籍",
            content: chunk,
            journeyStages: chunkStages,
            score: score,
            order: start
          });
        }
      }
    });
    candidates.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    return candidates.slice(0, 4).map(function (item) {
      return { title: item.title, content: item.content, journeyStages: item.journeyStages };
    });
  }

  window.App.conversationRules = {
    sendAction: sendAction,
    nextProbed: nextProbed,
    newConversationRisks: newConversationRisks,
    sceneConversationTopic: sceneConversationTopic,
    selectKnowledge: selectKnowledge
  };
})();
