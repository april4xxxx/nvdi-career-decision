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
    if (!def || !data.CAT_META[def.cat]) return;   // 无 payload 的刷新型 emit 不弹 toast
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
  var GUIDE_GATE_KEY = "nvdi-newcomer-guide-gate-pending";

  function setGuideGatePending(marker) {
    try { localStorage.setItem(GUIDE_GATE_KEY, String(marker || "pending")); } catch (error) {}
  }

  function hasGuideGatePending() {
    try { return !!localStorage.getItem(GUIDE_GATE_KEY); } catch (error) { return false; }
  }

  function clearGuideGatePending() {
    try { localStorage.removeItem(GUIDE_GATE_KEY); } catch (error) {}
  }

  function stepsBar(active) {
    var dots = "", n = data.QUIZ.length;
    for (var i = 1; i <= n; i++) dots += '<span class="dot' + (i <= active ? " on" : "") + '"></span>';
    return '<div class="onb-steps">' + dots + '</div>';
  }

  /* 开屏封面：满屏米黄 + 顶部横向纹样条 + 中部随机女帝像与主文案御印 + 底部滚动场景图 */
  // 底部轮播用场景素材（竖版卡片横向滚动；跳过 cg / 预言底图等非场景图）
  var COVER_STRIP = [
    "上朝.png", "书房.png", "御花园.png", "民间.png",
    "珍宝阁.png", "藏书阁.png", "起居殿.png", "钦天监.png"
  ];
  function renderCover() {
    // 固定使用女皇2 立绘（米黄袍红缘金纹），不再随机
    var heroSrc = data.ASSET_BASE + "人物/女皇2.png";
    var ornSrc = data.ASSET_BASE + "svg图标/装饰svg/" + encodeURIComponent("中式宫廷边框41") + ".svg";
    // 底部滚动条：素材复制两份以实现无缝循环
    function stripImgs() {
      return COVER_STRIP.map(function (f) {
        var src = data.ASSET_BASE + "场景/" + encodeURIComponent(f);
        return '<img src="' + src + '" alt="" onerror="this.style.display=\'none\'" />';
      }).join("");
    }
    wrap.innerHTML =
      '<div class="onb-cover cover-full" id="onbCover">' +
      '<div class="cover-orn" style="background-image:url(\'' + ornSrc + '\')"></div>' +
      '<div class="cover-main">' +
      '<div class="cover-hero"><img src="' + heroSrc + '" alt="女帝" onerror="this.style.display=\'none\'" /></div>' +
      '<div class="cover-inner">' +
      '<div class="cover-kicker">真正的少女心事</div>' +
      '<h1 class="cover-title">是渴望建功立业</h1>' +
      '<button class="cover-seal" id="coverSeal" aria-label="盖下印章，开启皇帝生活">' +
      '<img src="' + data.ASSET_BASE + '物品/印章.png" alt="御印" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'no-img\')" />' +
      '</button>' +
      '<div class="cover-hint" id="coverHint">盖下印章，开启皇帝生活</div>' +
      '</div></div>' +
      '<div class="cover-marquee"><div class="marquee-track">' + stripImgs() + stripImgs() + '</div></div>' +
      '</div>';
    document.getElementById("screen-onboarding").classList.add("cover-mode");
    // 印章静置 3 秒后浮现提示（若已存在则立即显示）
    var hint = $("#coverHint");
    hint.classList.remove("show");
    setTimeout(function () { if (hint) hint.classList.add("show"); }, 3000);
    var enter = function () {
      document.getElementById("screen-onboarding").classList.remove("cover-mode");
      step = 0; renderWelcome();
    };
    $("#coverSeal").addEventListener("click", enter);
  }

  function renderWelcome() {
    wrap.innerHTML =
      '<div class="onb-head"><div class="kicker">旨 意 下 发</div>' +
      '<h1>诏书已至，只等陛下临朝</h1>' +
      '<p>老臣今日前来辅佐，须先探明——陛下是哪一种君王</p></div>' +
      '<div class="onb-hero onb-hero-split">' +
      '<div class="hero-figure"><img src="' + data.ASSET_BASE + '人物/卦师.png" alt="卦师" onerror="this.style.display=\'none\'" /></div>' +
      '<div class="hero-side">' +
      '<div class="say">「陛下，这纸诏书刚落到您手上，往后要走的路还没定。老臣愿随您左右、为您分忧——只是得先问您三件事，好知道陛下心里最看重的到底是什么。」</div>' +
      '<div class="onb-nick"><label>请陛下先定下尊号</label>' +
      '<input id="onbNick" maxlength="8" placeholder="请输入你的称号" value="" /></div>' +
      '<button class="btn btn-gold" id="onbStart" style="margin-top:8px;padding:12px 40px;font-size:16px;">领旨 · 御前推演 ▸</button>' +
      '</div></div>';
    $("#onbStart").addEventListener("click", function () {
      var v = $("#onbNick").value.trim();
      // 空或纯数字（如「1」）都不作尊号，回退默认「陛下」，避免过场文案首句显示成「1，你接过了…」
      if (v && !/^\d+$/.test(v)) nickname = v;
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
      '<div class="onb-head"><div class="kicker">第 ' + step + ' 问 / 共 ' + data.QUIZ.length + ' 问 · ' + esc(q.stem) + '</div></div>' +
      '<div class="onb-q"><div class="npc">' +
      '<img src="' + esc(q.portrait) + '" alt="" onerror="this.style.display=\'none\'" />' +
      '<div class="stem">' + esc(q.stem) + (q.sub ? '<span class="stem-sub">' + esc(q.sub) + '</span>' : '') + '</div></div>' +
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
          if (step < data.QUIZ.length) { step++; renderQuestion(); }
          else { step = data.QUIZ.length + 1; renderResult(); }
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

  var TYPE_KEYS = ["铁腕", "仁厚", "谋略", "革新"];

  function tallyType() {
    // 仅统计画像题（w 落在四类型内）；偏好题（如「愿听何谏」）不计入
    var typeAnswers = answers.filter(function (w) { return TYPE_KEYS.indexOf(w) >= 0; });
    var count = {};
    typeAnswers.forEach(function (w) { count[w] = (count[w] || 0) + 1; });
    // 最高票数
    var maxN = 0;
    TYPE_KEYS.forEach(function (k) {
      if ((count[k] || 0) > maxN) maxN = count[k] || 0;
    });
    // 平票由陛下最近一次抉择定夺（越靠后的题越贴近当下心意），
    // 不再固定偏向铁腕——三题皆异（1:1:1）时以最后一题为准，
    // 使四类女帝在随机作答下分布均衡（各约 25%）。
    for (var i = typeAnswers.length - 1; i >= 0; i--) {
      if ((count[typeAnswers[i]] || 0) === maxN) return typeAnswers[i];
    }
    return "铁腕";
  }

  // 偏好题选择的大臣（默认议事大臣）；无则回退顺臣
  function preferredMinister() {
    for (var i = 0; i < data.QUIZ.length; i++) {
      if (data.QUIZ[i].pref === "minister") {
        var w = answers[i];
        if (w && data.MINISTERS && data.MINISTERS[w]) return w;
      }
    }
    return null;
  }

  function renderResult() {
    var typeKey = tallyType();
    var t = data.EMPRESS_TYPES[typeKey];
    var traits = t.trait.map(function (x) { return '<span class="tag">' + esc(x) + '</span>'; }).join("");
    wrap.innerHTML =
      '<div class="onb-result onb-result-split">' +
      '<div class="inner">' +
      '<div class="left">' +
      '<div class="crown">推 演 已 成</div>' +
      '<div class="onb-omen">卦象既成，祥瑞显现</div>' +
      '<img class="portrait" src="' + esc(t.portrait) + '" alt="" onerror="this.style.display=\'none\'" />' +
      '</div>' +
      '<div class="right">' +
      '<h2>' + esc(t.title) + '</h2>' +
      '<div class="say">「' + esc(t.say) + '」</div>' +
      '<div class="desc">' + esc(t.desc) + '</div>' +
      '<div class="onb-traits">' + traits + '</div>' +
      '<div class="onb-advice">卦师谏言：' + esc(t.advice) + '</div>' +
      '<div class="onb-actions">' +
      '<button class="btn btn-ghost" id="onbRetry">◂ 重新推演</button>' +
      '<button class="btn btn-verm" id="onbEnthrone">登 基 即 位 ▸</button>' +
      '</div>' +
      '</div>' +
      '</div>' +
      '</div>';
    $("#onbRetry").addEventListener("click", function () {
      answers = []; step = 1; renderQuestion();
    });
    $("#onbEnthrone").addEventListener("click", function () {
      var startedAt = new Date().toISOString();
      setGuideGatePending(startedAt);
      store.finishOnboarding({
        nickname: nickname,
        answers: answers.slice(),
        preferredMinister: preferredMinister()
      }, typeKey, startedAt);
      playTransition(t);
    });
  }

  /* ---------- 登基过场 CG ----------
     单幕「登基大典」：公主初始 CG 铺底，标题与正文分段、逐段自中央浮现。
     （PRD 01：CG 用公主初始那张、字放大居中、做好分段、删去「朝堂初临」第二幕） */
  function playTransition(t) {
    showScreen("screen-transition");
    var stage = $("#cgStage");
    stage.classList.remove("choice-open");
    // 清除旧图文与选择区（保留右上角略过动画按钮）
    Array.prototype.forEach.call(stage.querySelectorAll("img.cg-frame, .cg-text, .cg-guide-choice"), function (n) { n.remove(); });

    var img = document.createElement("img");
    img.className = "cg-frame";
    img.src = data.ASSET_BASE + "场景/公主初始cg.png";
    img.onerror = function () { img.style.background = "#1f2830"; };
    stage.appendChild(img);

    // 正文分段：一句一段，逐段浮现，读起来有停顿感
    var lines = [
      esc(nickname) + "，你接过了这纸传位诏书。",
      "职场之路困难重重，",
      "好在满朝文武愿与你一同披荆斩棘。",
      "自今日起，你便要守好自己的疆土，成就一方事业。"
    ];
    var paras = lines.map(function (s, i) {
      return '<p style="animation-delay:' + (0.6 + i * 0.55) + 's">' + s + '</p>';
    }).join("");
    var txt = document.createElement("div");
    txt.className = "cg-text";
    txt.innerHTML = '<h2>登 基 大 典</h2><div class="cg-body">' + paras + '</div>';
    stage.appendChild(txt);

    var choice = document.createElement("div");
    choice.className = "cg-guide-choice";
    choice.setAttribute("role", "group");
    choice.setAttribute("aria-label", "选择是否进入新手引导");
    choice.innerHTML =
      '<div class="cg-guide-choice-copy"><strong>初临朝堂</strong><span>是否请大臣陪你走完第一封奏折？</span></div>' +
      '<div class="cg-guide-choice-actions">' +
        '<button type="button" class="cg-guide-enter" id="cgEnterGuide">进入新手引导</button>' +
        '<button type="button" class="cg-guide-skip" id="cgSkipGuide">跳过新手引导</button>' +
      '</div>';
    stage.appendChild(choice);

    setTimeout(function () { img.classList.add("show"); }, 60);

    var done = false;
    var choiceShown = false;

    function enter(withGuide) {
      if (done) return; done = true;
      clearGuideGatePending();
      if (App.guide) {
        if (withGuide && App.guide.reset) App.guide.reset();
        if (!withGuide && App.guide.skip) App.guide.skip();
      }
      showScreen("screen-app");
      App.emitReady && App.emitReady();
      store.emit("enterApp");
    }

    function revealChoice() {
      if (choiceShown || done) return;
      choiceShown = true;
      stage.classList.add("choice-open");
      choice.classList.add("show");
      var primary = $("#cgEnterGuide");
      if (primary) primary.focus({ preventScroll: true });
    }

    $("#cgEnterGuide").onclick = function () { enter(true); };
    $("#cgSkipGuide").onclick = function () { enter(false); };

    // 末段浮现后只展示选择区，不再自动进入主界面。
    var timer = setTimeout(revealChoice, 5200);
    $("#cgSkip").onclick = function () {
      clearTimeout(timer);
      Array.prototype.forEach.call(txt.querySelectorAll("h2, p"), function (node) {
        node.style.animation = "none";
        node.style.opacity = "1";
      });
      revealChoice();
    };
  }

  /* ---------- 入口 ---------- */
  function start() {
    wrap = $("#onbWrap");
    step = 0; answers = []; nickname = store.get().profile.nickname || "陛下";
    renderCover();
    showScreen("screen-onboarding");
  }
  // 若已完成 onboarding，直接进入 app
  function boot() {
    var state = store.get();
    if (state.onboarded && hasGuideGatePending()) {
      nickname = state.profile && state.profile.nickname || "陛下";
      playTransition(data.EMPRESS_TYPES[state.empressType] || data.EMPRESS_TYPES["铁腕"]);
    } else if (state.onboarded) {
      showScreen("screen-app");
      store.emit("enterApp");
    } else {
      start();
    }
  }

  App.onboarding = { start: start, boot: boot, playTransition: playTransition };
})();
