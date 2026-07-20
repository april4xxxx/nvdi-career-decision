/* =============================================================
   conversation.js —— 模块 03：对话与任务发布
   交互按线框图：
     · 折叠态：底部 GAL 对话框显示大臣一句话 + 常驻输入框
     · 用户输入 / 点「探讨国事」→ 展开完整对话区（顶部大臣+主题）
     · 优先调用同源服务端 AI；不可用时回退 data.brain.analyze：
         对话(dialogue) / 选项追问(question) / 决策奏折(decision)
     · 决策奏折为黄色祥云暗纹卡，内含「再议 / 大胆」；
       底部输入区主按钮变为「同意」印章 —— 同意后按分类生成任务投放地图。
   window.App.conversation
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store, ui = App.ui;

  var els = {};
  var expanded = false;          // 是否已展开完整对话
  var ministerKey = "顺臣";      // 当前对话大臣
  var topic = "如何治国";        // 顶部主题
  var ctx = { probed: false };   // 追问上下文
  var pendingDecision = null;    // 当前待朱批的决策 { decision, pathKey }
  var aiHistory = [];            // 仅保存当前议事会话，发送最近若干轮给服务端
  var busy = false;
  var fallbackAnnounced = false;

  /* ---------- 小工具 ---------- */
  function minister() { return data.MINISTERS[ministerKey] || data.MINISTERS["顺臣"]; }
  function scrollDown() { els.scroll.scrollTop = els.scroll.scrollHeight; }

  function pushMsg(role, who, text) {
    var m = document.createElement("div");
    m.className = "msg " + role;
    if (role === "sys") {
      m.innerHTML = '<div class="bubble">' + ui.esc(text) + '</div>';
    } else {
      m.innerHTML = '<div class="mwrap"><div class="who">' + ui.esc(who || "") + '</div>' +
        '<div class="bubble">' + ui.esc(text) + '</div></div>';
    }
    els.scroll.appendChild(m);
    scrollDown();
    return m;
  }

  /* ---------- 折叠态 ↔ 完整态 ---------- */
  function setGalLine(text) {
    els.galName.textContent = minister().role;
    els.galText.textContent = text;
  }

  // 折叠态：只有一句大臣招呼 + 输入框
  function collapse() {
    expanded = false;
    els.convo.classList.remove("expanded");
    els.scroll.innerHTML = "";
    els.reply.innerHTML = "";
    pendingDecision = null;
    ctx = { probed: false };
    aiHistory = [];
    setSendMode("normal");
    setGalLine(minister().say);
    refreshPetitionBadge();
  }

  // 展开完整对话
  function expand() {
    if (expanded) return;
    expanded = true;
    els.convo.classList.add("expanded");
    els.scroll.innerHTML = "";
    // 大臣把折叠态那句招呼作为对话首条
    pushMsg("npc", minister().role, minister().say);
    renderTop();
  }

  function renderTop() {
    els.ctMinisterName.textContent = minister().name;
    els.ctTopic.textContent = topic;
    refreshPetitionBadge();
  }

  function refreshPetitionBadge() {
    var n = store.pendingCount();
    if (els.ctPetitionN) els.ctPetitionN.textContent = n;
  }

  /* ---------- 输入区主按钮：normal(探讨国事) / stamp(同意) ---------- */
  function setSendMode(mode) {
    els.send.classList.toggle("stamp", mode === "stamp");
    els.send.textContent = mode === "stamp" ? "同意" : "探讨国事";
    els.send.setAttribute("data-mode", mode);
  }

  /* ---------- 用户发送输入 ---------- */
  function onSend() {
    if (busy) return;
    var mode = els.send.getAttribute("data-mode");
    // 印章态：点「同意」= 采纳当前决策的推荐路径
    if (mode === "stamp" && pendingDecision) { doPizhu("agree"); return; }

    var text = (els.text.value || "").trim();
    if (!text) { if (!expanded) expand(); return; }
    els.text.value = "";
    if (!expanded) expand();
    pushMsg("me", store.get().profile.nickname || "陛下", text);
    aiHistory.push({ role: "user", content: text });
    // 若正处于决策待批，补充文本 = 再议（保留奏折，补充信息后重生成）
    if (pendingDecision) {
      think(function () { regenerate(text); });
      return;
    }
    think(function () { respond(text); });
  }

  // 大臣「思考中…」气泡
  function think(done) {
    busy = true;
    els.send.disabled = true;
    var t = document.createElement("div");
    t.className = "msg npc typing";
    t.innerHTML = '<div class="mwrap"><div class="who">' + ui.esc(minister().role) +
      '</div><div class="bubble"><span class="dots"><i></i><i></i><i></i></span></div></div>';
    els.scroll.appendChild(t); scrollDown();
    Promise.resolve()
      .then(done)
      .catch(function (error) {
        console.error("[conversation] response failed", error);
        pushMsg("sys", "", (error && error.message) || "大臣暂时无法应答，请稍后再试。");
      })
      .finally(function () {
        t.remove();
        busy = false;
        els.send.disabled = false;
        scrollDown();
      });
  }

  /* ---------- 核心：把一句输入交给「大脑」 ---------- */
  async function respond(text) {
    var r = await analyzeWithApi(text);
    topic = r.topic || topic;
    els.ctTopic.textContent = topic;

    if (r.type === "dialogue") {
      ctx.probed = true;
      var dialogueText = r.message || chatReply(text);
      pushMsg("npc", minister().role, dialogueText);
      aiHistory.push({ role: "assistant", content: dialogueText });
      return;
    }
    if (r.type === "question") {
      ctx.probed = true;
      ctx.scenarioId = r.scenarioId;
      askQuestion(r.question);
      return;
    }
    if (r.type === "decision") {
      presentDecision(r.decision);
    }
  }

  // 补充信息后重新生成（再议 / 大胆 之后走这里）
  async function regenerate(text) {
    ctx.probed = true;
    var r = await analyzeWithApi(text);
    if (r.type === "decision") { presentDecision(r.decision); }
    else if (r.type === "question") { askQuestion(r.question); }
    else { pushMsg("npc", minister().role, "臣记下了。陛下可再多说一句，臣好为您拟策。"); }
  }

  function stateForApi() {
    var st = store.get();
    return {
      nickname: st.profile.nickname,
      empressType: st.empressType,
      energy: st.energy,
      gold: st.gold,
      scene: st.scene,
      pendingTasks: (st.mapTasks || []).filter(function (t) { return !t.done; }).slice(0, 8).map(function (t) { return t.title; }),
      recentJournals: (st.journals || []).slice(0, 5).map(function (j) { return j.title + "：" + j.text; }),
      books: (st.books || []).slice(0, 12).map(function (b) { return b.title; })
    };
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

  // 在浏览器内做轻量词法检索，只把最相关的少量片段随本轮对话发给服务端。
  function knowledgeForApi(text) {
    var st = store.get();
    var documents = st.knowledge && Array.isArray(st.knowledge.documents) ? st.knowledge.documents : [];
    var terms = queryTerms(text);
    var candidates = [];
    documents.slice(0, 12).forEach(function (document) {
      var content = String(document.content || "");
      for (var start = 0; start < content.length; start += 2100) {
        var chunk = content.slice(start, start + 2400);
        if (!chunk) continue;
        var haystack = (String(document.title || "") + " " + chunk).toLowerCase();
        var score = terms.reduce(function (sum, term) {
          return sum + (haystack.indexOf(term) >= 0 ? (term.length > 1 ? 3 : 1) : 0);
        }, 0);
        candidates.push({ title: document.title || document.fileName || "用户典籍", content: chunk, score: score, order: start });
      }
    });
    candidates.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
    return candidates.slice(0, 4).map(function (item) { return { title: item.title, content: item.content }; });
  }

  async function analyzeWithApi(text) {
    if (App.api && typeof App.api.chat === "function") {
      try {
        var payload = await App.api.chat({
          message: text,
          minister: ministerKey,
          probed: !!ctx.probed,
          history: aiHistory.slice(0, -1),
          state: stateForApi(),
          knowledge: knowledgeForApi(text)
        });
        return payload.result;
      } catch (error) {
        if (!fallbackAnnounced) {
          fallbackAnnounced = true;
          pushMsg("sys", "", "AI 驿站未连通，已自动切换为本地演示大脑。部署并配置 API Key 后会自动启用真实 AI。");
        }
      }
    }
    return data.brain.analyze(text, ctx);
  }

  function chatReply(text) {
    var m = minister();
    if (m.style === "direct") return "此事臣听着不像要紧决断。陛下若有拿不准的差事，直说，臣替您分个轻重。";
    if (m.style === "gentle") return "陛下这般说，臣听着了。若有烦心的差事，说与臣听，臣陪您一件件理。";
    return "闲话也好。不过陛下若遇到难抉择的岔路，臣最擅长替您寻个巧法子。";
  }

  /* ---------- 选项追问 ---------- */
  function askQuestion(q) {
    pushMsg("npc", minister().role, q.q);
    aiHistory.push({ role: "assistant", content: q.q });
    var html = '<div class="opt-list">' + q.options.map(function (o, i) {
      return '<button class="opt-btn" data-i="' + i + '">' + ui.esc(o.text) + '</button>';
    }).join("") +
    '<div class="opt-hint">— 也可直接在下方输入框补充其他信息 —</div></div>';
    els.reply.innerHTML = html;
    Array.prototype.forEach.call(els.reply.querySelectorAll(".opt-btn"), function (b) {
      b.addEventListener("click", function () {
        var o = q.options[+b.getAttribute("data-i")];
        els.reply.innerHTML = "";
        pushMsg("me", store.get().profile.nickname || "陛下", o.text);
        aiHistory.push({ role: "user", content: o.tag + " " + o.text });
        ctx.probed = true;
        // 追问后直接给决策；真实 AI 不可用时仍使用本地同一情景。
        think(async function () {
          var r = await analyzeWithApi(o.tag + " " + o.text);
          if (r.type === "decision") presentDecision(r.decision);
          else presentDecision(data.brain.genericDecision(o.text));
        });
      });
    });
  }

  /* ---------- 决策奏折（黄色祥云卡，内含 再议 / 大胆） ---------- */
  function presentDecision(decision) {
    pendingDecision = { decision: decision, pathKey: "recommend" };
    els.reply.innerHTML = "";
    // 大臣按风格说一句引出奏折
    pushMsg("npc", minister().role, data.brain.ministerLine(ministerKey, "decision", decision));
    aiHistory.push({ role: "assistant", content: "决策奏折：" + decision.title + "。" + decision.summary });

    var d = decision;
    var cat = data.CATEGORIES[d.category] || data.CATEGORIES.daily;
    var rec = d.recommend, alt = d.alt;

    var card = document.createElement("div");
    card.className = "decision-sheet";
    card.innerHTML =
      cloudDeco() +
      '<div class="ds-head">' +
        '<span class="ds-cat" style="--c:' + cat.color + '">' +
          '<img src="' + ui.esc(cat.icon) + '" alt="" onerror="this.style.display=\'none\'"/>' + cat.label + '任务</span>' +
        '<span class="ds-badge">待 批 奏 折</span>' +
      '</div>' +
      '<h4 class="ds-title">' + ui.esc(d.title) + '</h4>' +
      '<div class="ds-summary">' + ui.esc(d.summary) + '</div>' +
      '<div class="ds-mirror">' +
        mirrorCell("投入", d.mirror.invest) +
        mirrorCell("收益", d.mirror.reward) +
        mirrorCell("机会成本", d.mirror.cost) +
      '</div>' +
      '<div class="ds-paths">' +
        pathRow("recommend", "推荐", rec) +
        (alt ? pathRow("alt", "备选", alt) : "") +
      '</div>' +
      sourcesHtml(d.sources) +
      '<div class="ds-actions">' +
        '<span class="ds-hint">采纳请按下方「同意」印玺 · 或于此再议 / 大胆</span>' +
        '<button class="pizhu-btn again" data-k="again">再议</button>' +
        '<button class="pizhu-btn bold" data-k="bold">大胆</button>' +
      '</div>';
    els.reply.appendChild(card);
    scrollDown();

    // 选择推荐/备选路径
    Array.prototype.forEach.call(card.querySelectorAll(".path-row"), function (row) {
      row.addEventListener("click", function () {
        Array.prototype.forEach.call(card.querySelectorAll(".path-row"), function (r) { r.classList.remove("chosen"); });
        row.classList.add("chosen");
        pendingDecision.pathKey = row.getAttribute("data-p");
      });
    });
    card.querySelector(".path-row").classList.add("chosen");

    // 卡内 再议 / 大胆
    Array.prototype.forEach.call(card.querySelectorAll(".pizhu-btn"), function (b) {
      b.addEventListener("click", function () { doPizhu(b.getAttribute("data-k")); });
    });

    // 底部输入区主按钮变「同意」印章
    setSendMode("stamp");

    // 首个决策解锁成就（初落朱批在同意时触发；此处提示）
    refreshPetitionBadge();
  }

  function mirrorCell(k, v) {
    return '<div class="mc"><span class="mk">' + k + '</span><span class="mv">' + ui.esc(v) + '</span></div>';
  }
  function pathRow(key, tag, path) {
    return '<button class="path-row" data-p="' + key + '">' +
      '<span class="pr-tag ' + key + '">' + tag + '</span>' +
      '<span class="pr-body"><b>' + ui.esc(path.label) + '</b>' +
      '<span class="pr-text">' + ui.esc(path.text) + '</span></span>' +
      '<span class="pr-pick">◦</span></button>';
  }
  function cloudDeco() {
    return '<img class="ds-cloud l" src="' + data.ASSET_BASE + 'svg图标/装饰svg/古风祥云云朵42.svg" alt="" onerror="this.style.display=\'none\'"/>' +
           '<img class="ds-cloud r" src="' + data.ASSET_BASE + 'svg图标/装饰svg/古风祥云云朵2.svg" alt="" onerror="this.style.display=\'none\'"/>';
  }
  function sourcesHtml(sources) {
    if (!sources || !sources.length) return "";
    return '<div class="ds-sources"><b>参考典籍</b> · ' + sources.map(ui.esc).join("、") + '</div>';
  }

  /* ---------- 三种朱批 ---------- */
  function doPizhu(kind) {
    if (!pendingDecision) return;
    var decision = pendingDecision.decision;
    var pathKey = pendingDecision.pathKey || "recommend";
    var firstEver = !store.get().achievements["first-vermilion-brush"].unlocked;

    if (kind === "agree") {
      var chosenPath = decision[pathKey] || decision.recommend;
      var templates = data.brain.tasksFromPath(decision, pathKey);
      pushMsg("me", store.get().profile.nickname || "陛下", "朱批 · 同意：" + chosenPath.label);
      var created = store.applyPizhu("agree", decision, templates);
      pendingDecision = null;
      setSendMode("normal");
      ctx = { probed: false };
      announceDeploy(created);
      if (firstEver) setTimeout(function () { /* 成就通知由 store 触发 */ }, 300);
      return;
    }

    if (kind === "again") {
      pushMsg("me", store.get().profile.nickname || "陛下", "朱批 · 再议");
      store.applyPizhu("again", decision);
      pushMsg("sys", "", "已记入起居注。请在下方补充信息，臣据此重拟此策。");
      // 保留奏折待批，等待用户补充文本触发 regenerate
      return;
    }

    if (kind === "bold") {
      pushMsg("me", store.get().profile.nickname || "陛下", "朱批 · 大胆（此判断太武断）");
      store.applyPizhu("bold", decision);
      // 大臣道歉并重新追问
      pendingDecision = null;
      setSendMode("normal");
      ctx.probed = false;
      think(function () {
        pushMsg("npc", minister().role, data.brain.ministerLine(ministerKey, "bold-apology", decision));
        pushMsg("npc", minister().role, "臣方才漏问了一处：这件事对陛下而言，是「必须做成」，还是「做了更好」？请陛下明示，臣再拟。");
      });
      return;
    }
  }

  function announceDeploy(created) {
    if (!created || !created.length) { pushMsg("sys", "", "已采纳。"); return; }
    var byScene = {};
    created.forEach(function (t) { (byScene[t.scene] = byScene[t.scene] || []).push(t); });
    var parts = Object.keys(byScene).map(function (sid) {
      var sc = data.sceneById(sid);
      return byScene[sid].length + " 桩投往「" + (sc ? sc.name : sid) + "」";
    });
    pushMsg("sys", "", "已同意 · 生成 " + created.length + " 项任务，" + parts.join("、") + "。");
    created.forEach(function (t) {
      pushMsg("sys", "", "· " + t.title + "（耗精力约 " + Math.abs(t.energy) + " · 赏 " + t.gold + " 金）");
    });
    // 通知场景刷新地图任务卡
    if (App.scene) App.scene.render();
  }

  /* ---------- 切换对话大臣 ---------- */
  function switchMinister() {
    var order = data.MINISTER_ORDER;
    var idx = order.indexOf(ministerKey);
    ministerKey = order[(idx + 1) % order.length];
    renderTop();
    pushMsg("sys", "", "— 改由【" + minister().name + "】（" + minister().role + "）为陛下参详 —");
    pushMsg("npc", minister().role, minister().say);
    // 若正有决策待批，用新大臣口吻重述
    if (pendingDecision) pushMsg("npc", minister().role, data.brain.ministerLine(ministerKey, "decision", pendingDecision.decision));
  }

  /* ---------- 进入某场景时的开场（对话区） ---------- */
  function openingFor(sceneId) {
    var sc = data.sceneById(sceneId);
    if (!sc) return;
    // 依场景挑默认大臣：起居殿/主线用顺臣，民间/朝堂用直臣，钦天监用卦师
    if (sceneId === "observatory") ministerKey = "卦师";
    else if (sceneId === "folk" || sceneId === "court") ministerKey = "直臣";
    else ministerKey = "顺臣";
    collapse();
  }

  /* ---------- 供外部（演示/珠串）直接注入一句用户输入 ---------- */
  function ask(text) {
    els.text.value = text;
    onSend();
  }

  function init() {
    els.convo = ui.$("#convo");
    els.scroll = ui.$("#convoScroll");
    els.reply = ui.$("#replyZone");
    els.galBox = ui.$("#galBox");
    els.galName = ui.$("#galName");
    els.galText = ui.$("#galText");
    els.input = ui.$("#convoInput");
    els.text = ui.$("#convoText");
    els.send = ui.$("#convoSend");
    els.top = ui.$("#convoTop");
    els.ctMinister = ui.$("#ctMinister");
    els.ctMinisterName = ui.$("#ctMinisterName");
    els.ctTopic = ui.$("#ctTopic");
    els.ctPetition = ui.$("#ctPetition");
    els.ctPetitionN = ui.$("#ctPetitionN");
    els.ctClose = ui.$("#ctClose");

    els.send.addEventListener("click", onSend);
    els.text.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); onSend(); }
    });
    els.ctMinister.addEventListener("click", switchMinister);
    els.ctClose.addEventListener("click", collapse);
    els.ctPetition.addEventListener("click", function () {
      if (App.drawer) App.drawer.open("petition");
    });

    store.on("task", refreshPetitionBadge);
    store.on("scene", function () { openingFor(store.get().scene); });

    openingFor(store.get().scene);
  }

  App.conversation = {
    init: init,
    openingFor: openingFor,
    ask: ask,
    expand: expand,
    collapse: collapse,
    pushMsg: pushMsg,
    setMinister: function (k) { if (data.MINISTERS[k]) { ministerKey = k; if (expanded) renderTop(); } },
    getState: function () { return { expanded: expanded, ministerKey: ministerKey, pending: !!pendingDecision }; }
  };
})();
