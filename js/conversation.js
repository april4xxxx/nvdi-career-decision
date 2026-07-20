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
  var data = App.data, store = App.store, ui = App.ui, rules = App.conversationRules;

  var els = {};
  var expanded = false;          // 是否已展开完整对话
  var ministerKey = "顺臣";      // 当前对话大臣
  var topic = "如何治国";        // 顶部主题
  var ctx = { probed: false };   // 追问上下文
  var pendingDecision = null;    // 当前待朱批的决策 { decision, pathKey }
  var activeQuestion = null;     // 当前待回答的追问
  var aiHistory = [];            // 仅保存当前议事会话，发送最近若干轮给服务端
  var transcript = [];           // 可持久化的消息记录
  var activeSceneId = null;      // 会话所属场景，避免切换后串写
  var restoring = false;
  var busy = false;
  var fallbackAnnounced = false;

  /* ---------- 小工具 ---------- */
  function minister() { return data.MINISTERS[ministerKey] || data.MINISTERS["顺臣"]; }
  function scrollDown() { els.scroll.scrollTop = els.scroll.scrollHeight; }

  function pushMsg(role, who, text, skipRecord) {
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
    if (!skipRecord && !restoring) {
      transcript.push({ role: role, who: who || "", text: String(text || "") });
      saveSession();
    }
    return m;
  }

  function saveSession(sceneId) {
    if (!els.convo || restoring) return;
    store.saveConversation(sceneId || activeSceneId || store.get().scene, {
      expanded: expanded,
      ministerKey: ministerKey,
      topic: topic,
      ctx: ctx,
      pendingDecision: pendingDecision,
      activeQuestion: activeQuestion,
      aiHistory: aiHistory,
      transcript: transcript,
      draft: els.text ? els.text.value : ""
    });
  }

  function renderTranscript() {
    els.scroll.innerHTML = "";
    transcript.forEach(function (message) {
      pushMsg(message.role, message.who, message.text, true);
    });
  }

  /* ---------- 折叠态 ↔ 完整态 ---------- */
  function setGalLine(text) {
    els.galName.textContent = minister().role;
    els.galText.textContent = text;
  }

  function renderCollapsedSummary() {
    var line = minister().say;
    var needsAttention = false;
    if (pendingDecision) {
      line = "「" + topic + "」有一份奏折待批，展开后可继续批阅。";
      needsAttention = true;
    } else if (activeQuestion) {
      line = "「" + topic + "」还有一个问题等待陛下作答。";
      needsAttention = true;
    } else if (transcript.length) {
      line = "「" + topic + "」已收起，之前的商讨仍完整保留。";
    }
    setGalLine(line);
    els.galBox.classList.toggle("attention", needsAttention);
  }

  function refreshSendLabel() {
    if (!els.send) return;
    var mode = els.send.getAttribute("data-mode") || "normal";
    var hasDraft = !!String(els.text && els.text.value || "").trim();
    els.send.classList.toggle("stamp", mode === "stamp" && expanded && !hasDraft);
    if (expanded) {
      if (mode === "stamp") els.send.textContent = hasDraft ? "重新拟策" : "同意";
      else els.send.textContent = "探讨国事";
    }
    else if (hasDraft) els.send.textContent = "发送";
    else if (pendingDecision) els.send.textContent = "继续批阅";
    else els.send.textContent = transcript.length ? "继续对话" : "开始对话";
  }

  // 折叠态：只有一句大臣招呼 + 输入框
  function collapse() {
    expanded = false;
    els.convo.classList.remove("expanded");
    renderCollapsedSummary();
    refreshSendLabel();
    refreshPetitionBadge();
    saveSession();
  }

  // 展开完整对话
  function expand(skipGreeting) {
    if (expanded) return;
    expanded = true;
    els.convo.classList.add("expanded");
    // 新会话才写入招呼；收起后再展开应继续原会话。
    if (!skipGreeting && !transcript.length) pushMsg("npc", minister().role, minister().say);
    renderTop();
    refreshSendLabel();
    saveSession();
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
    els.send.setAttribute("data-mode", mode);
    refreshSendLabel();
  }

  /* ---------- 用户发送输入 ---------- */
  function onSend() {
    if (busy) return;
    var mode = els.send.getAttribute("data-mode");
    var text = (els.text.value || "").trim();
    // 收起态的空按钮只负责恢复界面，不能在用户看不见奏折时误触同意。
    if (!expanded && !text) { expand(); return; }
    // 印章态下，空输入点「同意」才采纳；已填补充内容则重新拟策。
    if (rules.sendAction(mode, !!pendingDecision, text) === "approve") { doPizhu("agree"); return; }

    if (!text) return;
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
      ctx.probed = rules.nextProbed(ctx.probed, r.type);
      var dialogueText = r.message || chatReply(text);
      pushMsg("npc", minister().role, dialogueText);
      aiHistory.push({ role: "assistant", content: dialogueText });
      return;
    }
    if (r.type === "question") {
      ctx.probed = rules.nextProbed(ctx.probed, r.type);
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
      careerPhase: "posthire",
      day: st.day,
      journeyStage: journeyStageForDay(st.day),
      energy: st.energy,
      gold: st.gold,
      scene: st.scene,
      pendingTasks: (st.mapTasks || []).filter(function (t) { return !t.done; }).slice(0, 8).map(function (t) { return t.title; }),
      recentJournals: (st.journals || []).slice(0, 5).map(function (j) { return j.title + "：" + j.text; }),
      books: (st.books || []).slice(0, 12).map(function (b) { return b.title; })
    };
  }

  function journeyStageForDay(day) {
    var value = Math.max(1, Number(day) || 1);
    if (value <= 7) return "DAY_1_7";
    if (value <= 30) return "DAY_8_30";
    if (value <= 60) return "DAY_31_60";
    if (value <= 90) return "DAY_61_90";
    if (value <= 180) return "MONTH_4_6";
    return "MONTH_7_12";
  }

  // 在浏览器内做轻量词法检索，只把最相关的少量片段随本轮对话发给服务端。
  function knowledgeForApi(text) {
    var st = store.get();
    var currentStage = journeyStageForDay(st.day);
    var documents = st.knowledge && Array.isArray(st.knowledge.documents) ? st.knowledge.documents : [];
    return rules.selectKnowledge(documents, text, currentStage);
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
        console.warn("[DEBUG-local-api]", error && error.status, error && error.code, error && error.message);
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
  function askQuestion(q, restoreOnly) {
    activeQuestion = q;
    if (!restoreOnly) {
      pushMsg("npc", minister().role, q.q);
      aiHistory.push({ role: "assistant", content: q.q });
    }
    var html = '<div class="opt-list">' + q.options.map(function (o, i) {
      return '<button class="opt-btn" data-i="' + i + '">' + ui.esc(o.text) + '</button>';
    }).join("") +
    '<div class="opt-hint">— 也可直接在下方输入框补充其他信息 —</div></div>';
    els.reply.innerHTML = html;
    Array.prototype.forEach.call(els.reply.querySelectorAll(".opt-btn"), function (b) {
      b.addEventListener("click", function () {
        var o = q.options[+b.getAttribute("data-i")];
        els.reply.innerHTML = "";
        activeQuestion = null;
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
    saveSession();
  }

  /* ---------- 决策奏折（黄色祥云卡，内含 再议 / 大胆） ---------- */
  function presentDecision(decision, restoreState) {
    pendingDecision = restoreState || { decision: decision, pathKey: "recommend" };
    activeQuestion = null;
    els.convo.classList.add("decision-pending");
    els.reply.innerHTML = "";
    if (!restoreState) {
      // 大臣按风格说一句引出奏折
      pushMsg("npc", minister().role, data.brain.ministerLine(ministerKey, "decision", decision));
      aiHistory.push({ role: "assistant", content: "决策奏折：" + decision.title + "。" + decision.summary });
    }

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
      '<div class="ds-overlap" hidden></div>' +
      sourcesHtml(d.sources) +
      '<div class="ds-actions">' +
        '<span class="ds-hint">采纳请按下方「同意」印玺 · 或于此再议 / 大胆</span>' +
        '<button class="pizhu-btn again" data-k="again">再议</button>' +
        '<button class="pizhu-btn bold" data-k="bold">大胆</button>' +
      '</div>';
    els.reply.appendChild(card);
    renderOverlapHint(card, d, pendingDecision.pathKey);
    els.galBox.scrollTop = 0;
    scrollDown();

    // 选择推荐/备选路径
    Array.prototype.forEach.call(card.querySelectorAll(".path-row"), function (row) {
      row.addEventListener("click", function () {
        Array.prototype.forEach.call(card.querySelectorAll(".path-row"), function (r) { r.classList.remove("chosen"); });
        row.classList.add("chosen");
        pendingDecision.pathKey = row.getAttribute("data-p");
        renderOverlapHint(card, d, pendingDecision.pathKey);
        saveSession();
      });
    });
    var chosenRow = card.querySelector('[data-p="' + pendingDecision.pathKey + '"]') || card.querySelector(".path-row");
    if (chosenRow) chosenRow.classList.add("chosen");

    // 卡内 再议 / 大胆
    Array.prototype.forEach.call(card.querySelectorAll(".pizhu-btn"), function (b) {
      b.addEventListener("click", function () { doPizhu(b.getAttribute("data-k")); });
    });

    // 底部输入区主按钮变「同意」印章
    setSendMode("stamp");

    // 首个决策解锁成就（初落朱批在同意时触发；此处提示）
    refreshPetitionBadge();
    saveSession();
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

  function renderOverlapHint(card, decision, pathKey) {
    var box = card.querySelector(".ds-overlap");
    if (!box || !store.previewTaskOverlaps) return;
    var overlaps = store.previewTaskOverlaps(data.brain.tasksFromPath(decision, pathKey || "recommend"));
    box.hidden = !overlaps.length;
    if (!overlaps.length) { box.innerHTML = ""; return; }
    var titles = overlaps.slice(0, 2).map(function (item) { return "「" + ui.esc(item.task.title) + "」"; }).join("、");
    box.innerHTML = '<span>已有待办 ' + titles + '，同意后将关联原任务，不会重复创建。</span>' +
      '<button type="button" class="ds-overlap-go">查看原任务 ▸</button>';
    box.querySelector(".ds-overlap-go").addEventListener("click", function () {
      if (App.drawer) App.drawer.open("petition");
    });
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
      els.convo.classList.remove("decision-pending");
      els.reply.innerHTML = "";
      setSendMode("normal");
      ctx = { probed: false };
      announceDeploy(created);
      saveSession();
      if (firstEver) setTimeout(function () { /* 成就通知由 store 触发 */ }, 300);
      return;
    }

    if (kind === "again") {
      pushMsg("me", store.get().profile.nickname || "陛下", "朱批 · 再议");
      store.applyPizhu("again", decision);
      pushMsg("sys", "", "已记入起居注。请在下方补充信息，臣据此重拟此策。");
      // 保留奏折待批，等待用户补充文本触发 regenerate
      saveSession();
      return;
    }

    if (kind === "bold") {
      pushMsg("me", store.get().profile.nickname || "陛下", "朱批 · 大胆（此判断太武断）");
      store.applyPizhu("bold", decision);
      // 大臣道歉并重新追问
      pendingDecision = null;
      els.convo.classList.remove("decision-pending");
      els.reply.innerHTML = "";
      setSendMode("normal");
      ctx.probed = false;
      saveSession();
      think(function () {
        pushMsg("npc", minister().role, data.brain.ministerLine(ministerKey, "bold-apology", decision));
        pushMsg("npc", minister().role, "臣方才漏问了一处：这件事对陛下而言，是「必须做成」，还是「做了更好」？请陛下明示，臣再拟。");
      });
      return;
    }
  }

  function announceDeploy(created) {
    var merged = created && created.merged ? created.merged : [];
    if ((!created || !created.length) && !merged.length) { pushMsg("sys", "", "已采纳。"); return; }
    if (merged.length) {
      pushMsg("sys", "", "检测到 " + merged.length + " 项与现有待办重合，已关联原奏折，未重复创建。");
    }
    if (!created || !created.length) {
      pushMsg("sys", "", "已同意·本次没有新增重复任务。");
      return;
    }
    var byScene = {};
    created.forEach(function (t) { (byScene[t.scene] = byScene[t.scene] || []).push(t); });
    var parts = Object.keys(byScene).map(function (sid) {
      var sc = data.sceneById(sid);
      return byScene[sid].length + " 桩投往「" + (sc ? sc.name : sid) + "」";
    });
    pushMsg("sys", "", "已同意 · 新生成 " + created.length + " 项任务，" + parts.join("、") + "。");
    created.forEach(function (t) {
      pushMsg("sys", "", "· " + t.title + "（约 " + t.durationMinutes + " 分钟 · " +
        (t.restore ? "恢复精力 +" + t.restore + " · 无金币奖励" :
          "耗精力 " + Math.abs(t.energy) + " · 赏 " + t.gold + " 金") + "）");
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
    saveSession();
  }

  /* ---------- 进入某场景时的开场（对话区） ---------- */
  function defaultMinisterFor(sceneId) {
    if (sceneId === "observatory") return "卦师";
    if (sceneId === "folk" || sceneId === "court") return "直臣";
    return "顺臣";
  }

  function beginNewConversation() {
    var sceneId = activeSceneId || store.get().scene;
    var journal = store.archiveConversation(sceneId);
    startSceneSession(sceneId);
    expand(true);
    if (journal) pushMsg("sys", "", "上一段商讨已归入起居注，现已开启新对话。");
    pushMsg("npc", minister().role, minister().say);
    els.text.focus();
  }

  function requestNewConversation() {
    if (busy) return;
    var risks = rules.newConversationRisks({
      pendingDecision: pendingDecision,
      activeQuestion: activeQuestion,
      draft: els.text.value
    });
    if (!risks.length) { beginNewConversation(); return; }

    var rows = [];
    if (risks.indexOf("pending") >= 0) rows.push("待批奏折不会生成任务");
    if (risks.indexOf("question") >= 0) rows.push("尚未回答的追问会随本次商讨归档");
    if (risks.indexOf("draft") >= 0) rows.push("输入框中的未发送内容不会带入新对话");
    ui.openModal(
      '<div class="conversation-reset" role="alertdialog" aria-labelledby="conversationResetTitle" aria-describedby="conversationResetDesc">' +
        '<div class="reset-kicker">另 起 新 议</div>' +
        '<h3 id="conversationResetTitle">归档当前商讨并开启新对话？</h3>' +
        '<p id="conversationResetDesc">当前还有未完成内容：</p>' +
        '<ul>' + rows.map(function (row) { return '<li>' + ui.esc(row) + '</li>'; }).join("") + '</ul>' +
        '<div class="reset-actions">' +
          '<button class="btn" id="conversationResetCancel">继续当前对话</button>' +
          '<button class="btn btn-verm" id="conversationResetConfirm">归档并新建</button>' +
        '</div>' +
      '</div>'
    );
    ui.$("#conversationResetCancel").onclick = ui.closeModal;
    ui.$("#conversationResetConfirm").onclick = function () {
      ui.closeModal();
      beginNewConversation();
    };
    ui.$("#conversationResetCancel").focus();
  }

  function startSceneSession(sceneId) {
    var sc = data.sceneById(sceneId);
    expanded = false;
    ministerKey = defaultMinisterFor(sceneId);
    topic = rules.sceneConversationTopic(sc && sc.name);
    ctx = { probed: false };
    pendingDecision = null;
    activeQuestion = null;
    aiHistory = [];
    transcript = [];
    els.scroll.innerHTML = "";
    els.reply.innerHTML = "";
    els.text.value = "";
    els.convo.classList.remove("expanded");
    els.convo.classList.remove("decision-pending");
    setSendMode("normal");
    renderCollapsedSummary();
    refreshPetitionBadge();
    saveSession(sceneId);
  }

  function restoreSceneSession(sceneId, session) {
    restoring = true;
    expanded = !!session.expanded;
    ministerKey = data.MINISTERS[session.ministerKey] ? session.ministerKey : defaultMinisterFor(sceneId);
    var scene = data.sceneById(sceneId);
    var savedTopic = session.topic || rules.sceneConversationTopic(scene && scene.name);
    if (savedTopic === "新对话") savedTopic = rules.sceneConversationTopic(scene && scene.name);
    topic = savedTopic;
    ctx = session.ctx || { probed: false };
    pendingDecision = session.pendingDecision || null;
    activeQuestion = session.activeQuestion || null;
    aiHistory = Array.isArray(session.aiHistory) ? session.aiHistory : [];
    transcript = Array.isArray(session.transcript) ? session.transcript : [];
    renderTranscript();
    els.reply.innerHTML = "";
    els.text.value = session.draft || "";
    els.convo.classList.toggle("expanded", expanded);
    els.convo.classList.toggle("decision-pending", !!pendingDecision);
    if (activeQuestion) askQuestion(activeQuestion, true);
    else if (pendingDecision) presentDecision(pendingDecision.decision, pendingDecision);
    else setSendMode("normal");
    if (expanded) renderTop();
    else renderCollapsedSummary();
    refreshSendLabel();
    refreshPetitionBadge();
    restoring = false;
    scrollDown();
  }

  function openingFor(sceneId, discardCurrent) {
    var sc = data.sceneById(sceneId);
    if (!sc) return;
    if (!discardCurrent && activeSceneId && activeSceneId !== sceneId) saveSession(activeSceneId);
    activeSceneId = sceneId;
    var saved = store.getConversation(sceneId);
    if (saved) restoreSceneSession(sceneId, saved);
    else startSceneSession(sceneId);
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
    els.ctNew = ui.$("#ctNew");
    els.continueBtn = ui.$("#convoContinue");
    els.newBtn = ui.$("#convoNew");

    els.send.addEventListener("click", onSend);
    els.text.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); onSend(); }
    });
    els.text.addEventListener("input", function () { refreshSendLabel(); saveSession(); });
    els.ctMinister.addEventListener("click", switchMinister);
    els.ctClose.addEventListener("click", collapse);
    els.ctNew.addEventListener("click", requestNewConversation);
    els.continueBtn.addEventListener("click", function () { expand(); });
    els.newBtn.addEventListener("click", requestNewConversation);
    els.ctPetition.addEventListener("click", function () {
      if (App.drawer) App.drawer.open("petition");
    });

    store.on("task", refreshPetitionBadge);
    store.on("scene", function () { openingFor(store.get().scene); });
    store.on("day", function () { openingFor(store.get().scene, true); });

    openingFor(store.get().scene);
  }

  App.conversation = {
    init: init,
    openingFor: openingFor,
    ask: ask,
    expand: expand,
    collapse: collapse,
    newConversation: requestNewConversation,
    pushMsg: pushMsg,
    setMinister: function (k) { if (data.MINISTERS[k]) { ministerKey = k; if (expanded) renderTop(); saveSession(); } },
    getState: function () { return { expanded: expanded, ministerKey: ministerKey, pending: !!pendingDecision }; }
  };
})();
