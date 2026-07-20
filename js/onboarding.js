/* =============================================================
   onboarding.js —— 御前推演（欢迎 → 6 题 → 结果）+ 登基过场 CG
   window.App.onboarding
   同时提供共享 UI 工具 window.App.ui（弹层/toast/转屏/HTML 转义）
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store;

  /* ---------- 共享 UI 工具 ---------- */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function showScreen(id) {
    ["screen-onboarding", "screen-transition", "screen-app"].forEach(function (s) {
      var el = document.getElementById(s);
      if (el) el.classList.toggle("active", s === id);
    });
  }
  function openModal(html, className) {
    var ov = $("#overlay"), m = $("#modal");
    m.className = "modal" + (className ? " " + className : "");
    m.innerHTML = html; ov.classList.add("active");
  }
  function closeModal() { $("#overlay").classList.remove("active"); }
  function achToast(def) {
    var layer = $("#achToastLayer");
    var el = document.createElement("div");
    el.className = "ach-toast";
    el.innerHTML =
      '<img src="' + esc(data.achImg(def)) + '" alt="" onerror="this.style.opacity=.2" />' +
      '<div><div class="tt">成就解锁 · ' + esc(data.CAT_META[def.cat].label) + '</div>' +
      '<div class="nm">' + esc(def.name) + '</div>' +
      '<div class="muted" style="font-size:11px">' + esc(def.reward) + ' · 已自动到账</div></div>';
    layer.appendChild(el);
    setTimeout(function () { el.remove(); }, 3000);
  }
  App.ui = { esc: esc, $: $, showScreen: showScreen, openModal: openModal, closeModal: closeModal, achToast: achToast };

  /* ---------- Onboarding 状态 ---------- */
  var step = 0;              // 0=欢迎, 1..6=题目, 7=结果
  var answers = [];          // 每题选择的 weight
  var nickname = "陛下";
  var wrap;

  function stepsBar(active) {
    var dots = "";
    for (var i = 1; i <= 6; i++) dots += '<span class="dot' + (i <= active ? " on" : "") + '"></span>';
    return '<div class="onb-steps">' + dots + '</div>';
  }

  function renderWelcome() {
    wrap.innerHTML =
      '<div class="onb-head"><div class="kicker">御 前 推 演</div>' +
      '<h1>女帝职场决策系统</h1>' +
      '<p>入朝之前，先由卦师为你推演帝王之相</p></div>' +
      '<div class="onb-hero">' +
      '<img src="' + data.ASSET_BASE + '人物/卦师onboarding.png" alt="卦师" onerror="this.style.display=\'none\'" />' +
      '<div class="say">「陛下初临，命数未定。请答六问，臣好为陛下卜算这一朝的帝王之道。」</div>' +
      '<div class="onb-nick"><label>陛下尊号</label>' +
      '<input id="onbNick" maxlength="8" placeholder="请输入你的称号" value="" /></div>' +
      '<button class="btn btn-gold" id="onbStart" style="margin-top:8px;padding:12px 40px;font-size:16px;">开始推演 ▸</button>' +
      '</div>';
    $("#onbStart").addEventListener("click", function () {
      var v = $("#onbNick").value.trim();
      if (v) nickname = v;
      step = 1; renderQuestion();
    });
    $("#onbNick").addEventListener("keydown", function (e) { if (e.key === "Enter") $("#onbStart").click(); });
  }

  function renderQuestion() {
    var q = data.QUIZ[step - 1];
    var opts = q.options.map(function (o, i) {
      return '<button class="onb-opt" data-i="' + i + '">' + esc(o.text) + '</button>';
    }).join("");
    wrap.innerHTML =
      stepsBar(step) +
      '<div class="onb-head"><div class="kicker">第 ' + step + ' 问 / 共 6 问</div></div>' +
      '<div class="onb-q"><div class="npc">' +
      '<img src="' + esc(q.portrait) + '" alt="" onerror="this.style.display=\'none\'" />' +
      '<div class="stem">' + esc(q.stem) + '</div></div>' +
      '<div class="onb-opts">' + opts + '</div>' +
      '<div class="onb-nav">' +
      '<button class="btn btn-ghost" id="onbBack">◂ 上一问</button>' +
      '<span class="muted" style="align-self:center;font-size:13px;">择一而答</span>' +
      '</div></div>';

    Array.prototype.forEach.call(wrap.querySelectorAll(".onb-opt"), function (btn) {
      btn.addEventListener("click", function () {
        var i = +btn.getAttribute("data-i");
        answers[step - 1] = q.options[i].w;
        Array.prototype.forEach.call(wrap.querySelectorAll(".onb-opt"), function (b) { b.classList.remove("picked"); });
        btn.classList.add("picked");
        setTimeout(function () {
          if (step < 6) { step++; renderQuestion(); }
          else { step = 7; renderResult(); }
        }, 240);
      });
    });
    $("#onbBack").addEventListener("click", function () {
      if (step > 1) { step--; renderQuestion(); } else { step = 0; renderWelcome(); }
    });
    // 回显已选
    if (answers[step - 1]) {
      var idx = q.options.map(function (o) { return o.w; }).indexOf(answers[step - 1]);
      if (idx >= 0) wrap.querySelectorAll(".onb-opt")[idx].classList.add("picked");
    }
  }

  function tallyType() {
    var count = {};
    answers.forEach(function (w) { count[w] = (count[w] || 0) + 1; });
    var best = null, bestN = -1;
    // 保持 QUIZ 定义顺序的优先级：铁腕/仁厚/谋略/革新
    ["铁腕", "仁厚", "谋略", "革新"].forEach(function (k) {
      if ((count[k] || 0) > bestN) { bestN = count[k] || 0; best = k; }
    });
    return best;
  }

  function renderResult() {
    var typeKey = tallyType();
    var t = data.EMPRESS_TYPES[typeKey];
    var traits = t.trait.map(function (x) { return '<span class="tag">' + esc(x) + '</span>'; }).join("");
    wrap.innerHTML =
      '<div class="onb-result">' +
      '<div class="crown">推 演 已 成</div>' +
      '<img class="portrait" src="' + esc(t.portrait) + '" alt="" onerror="this.style.display=\'none\'" />' +
      '<h2>' + esc(t.title) + '</h2>' +
      '<div class="say">「' + esc(t.say) + '」</div>' +
      '<div class="desc">' + esc(t.desc) + '</div>' +
      '<div class="onb-traits">' + traits + '</div>' +
      '<div class="onb-advice">卦师谏言：' + esc(t.advice) + '</div>' +
      '<button class="btn btn-verm" id="onbEnthrone" style="padding:13px 46px;font-size:17px;">登 基 即 位 ▸</button>' +
      '</div>';
    $("#onbEnthrone").addEventListener("click", function () {
      store.finishOnboarding({ nickname: nickname, answers: answers.slice() }, typeKey, new Date().toISOString());
      playTransition(t);
    });
  }

  /* ---------- 登基过场 CG ---------- */
  function playTransition(t) {
    showScreen("screen-transition");
    var stage = $("#cgStage");
    // 清除旧图文（保留 skip 按钮）
    Array.prototype.forEach.call(stage.querySelectorAll("img.cg-frame, .cg-text"), function (n) { n.remove(); });

    var frames = [data.ASSET_BASE + "场景/女皇初始cg.png", data.ASSET_BASE + "场景/上朝.png"];
    frames.forEach(function (src) {
      var img = document.createElement("img");
      img.className = "cg-frame"; img.src = src;
      img.onerror = function () { img.style.background = "#1f2830"; };
      stage.appendChild(img);
    });
    var txt = document.createElement("div");
    txt.className = "cg-text";
    txt.innerHTML = '<h2>登 基 大 典</h2><p>' + esc(nickname) + '，自今日起，你便是这一朝的' + esc(t.title.replace("型女帝", "")) + '女帝。</p>';
    stage.appendChild(txt);

    var imgs = stage.querySelectorAll("img.cg-frame");
    setTimeout(function () { if (imgs[0]) imgs[0].classList.add("show"); }, 60);
    setTimeout(function () {
      if (imgs[1]) imgs[1].classList.add("show");
      txt.innerHTML = '<h2>朝 堂 初 临</h2><p>百官已候，奏折待批。愿陛下开创一代新政。</p>';
    }, 2600);

    var done = false;
    function enter() {
      if (done) return; done = true;
      showScreen("screen-app");
      App.emitReady && App.emitReady();
      store.emit("enterApp");
    }
    var timer = setTimeout(enter, 5200);
    $("#cgSkip").onclick = function () { clearTimeout(timer); enter(); };
  }

  /* ---------- 入口 ---------- */
  function start() {
    wrap = $("#onbWrap");
    step = 0; answers = []; nickname = store.get().profile.nickname || "陛下";
    renderWelcome();
    showScreen("screen-onboarding");
  }
  // 若已完成 onboarding，直接进入 app
  function boot() {
    if (store.get().onboarded) {
      showScreen("screen-app");
      store.emit("enterApp");
    } else {
      start();
    }
  }

  App.onboarding = { start: start, boot: boot, playTransition: playTransition };
})();
