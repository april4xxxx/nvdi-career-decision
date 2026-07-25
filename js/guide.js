/* =============================================================
   guide.js —— 首次登基后的遮罩式新手引导
   不改主界面文案，通过聚光、短札与真实操作走通：
   大臣 → 输入 → 追问 → 取舍 → 方案 → 朱批 → 任务
   window.App.guide
   ============================================================= */
(function () {
  "use strict";

  var App = window.App = window.App || {};
  var store = App.store;
  var GUIDE_KEY = "nvdi-first-login-guide-v1";
  var GUIDE_SCENARIO_ID = "newcomer-coffee-chat";
  var GUIDE_SAMPLE = "我刚入职，leader 让我下周一在周会上讲 10 分钟竞品调研，还想约技术组同事做一次 coffee chat，请教技术实现的部分。但周末还想和妈妈一起去爬山，怎么安排比较好？";
  var GUIDE_SCENARIO = {
    id: GUIDE_SCENARIO_ID,
    topic: "如何兼顾竞品汇报、coffee chat 和陪妈妈爬山",
    keywords: ["coffee chat", "和妈妈一起去爬山", "10 分钟竞品调研"],
    probe: {
      q: "陛下这周最不能被挤掉的是哪一件事？",
      options: [
        { text: "下周一的 10 分钟竞品汇报必须能交付", tag: "先保交付" },
        { text: "要留出和技术同事 coffee chat 的时间", tag: "建立求教关系" },
        { text: "周末和妈妈爬山的约定不能被工作占掉", tag: "守住周末边界" }
      ]
    },
    decision: {
      category: "main",
      title: "竞品调研、Coffee Chat 与周末边界",
      summary: "下周一要完成 10 分钟竞品调研汇报，技术实现部分需要通过 coffee chat 向技术组同事求证；周末已与妈妈约好爬山，不应被临时工作吞掉。",
      mirror: {
        invest: "工作日约 100 分钟 + 30 分钟 coffee chat",
        reward: "交付首份汇报 · 建立技术求教关系 · 守住家庭时间",
        cost: "工作日需主动收口，不再追求面面俱到"
      },
      recommend: {
        label: "工作日收口汇报，周末照常陪妈妈爬山",
        text: "先整理 3 个技术问题并发出 coffee chat 邀请；再完成 10 分钟汇报的最小可交付版，周五下班前冻结内容。周末不再追加工作，照常陪妈妈爬山。",
        tasks: [
          { title: "整理 3 个技术问题，发出 coffee chat 邀请", cat: "daily", durationMinutes: 20 },
          { title: "完成 10 分钟竞品调研汇报最小可交付版", cat: "main", durationMinutes: 60 },
          { title: "周末陪妈妈爬山，不处理工作", cat: "mystic", durationMinutes: 90 }
        ]
      },
      alt: {
        label: "缩小技术部分，只讲已经验证的发现",
        text: "若技术同事本周无暇 coffee chat，就在汇报中标明待确认项，只讲已有证据，不为补齐细节占用周末。",
        tasks: [
          { title: "向技术组发出问题并标记待确认项", cat: "daily", durationMinutes: 10 },
          { title: "冻结竞品汇报，只保留已验证内容", cat: "main", durationMinutes: 45 },
          { title: "周末陪妈妈爬山，不处理工作", cat: "mystic", durationMinutes: 90 }
        ]
      }
    }
  };
  var TOTAL_STEPS = 7;
  var root, veilDefs, veilMaskHoles, portraitGlowLayer, focusLayer, card, skipButton, waiting;
  var active = false;
  var currentKey = "";
  var currentSelectors = [];
  var currentTargets = [];
  var currentAnchorSelectors = [];
  var currentAnchorTargets = [];
  var allowedSelectors = [];
  var pendingObserver = null;
  var pendingTimer = null;
  var lastGeneratedTaskIds = [];

  function ensureGuideScenario() {
    var scenarios = App.data && App.data.SCENARIOS;
    if (!Array.isArray(scenarios)) return;
    var exists = scenarios.some(function (scenario) { return scenario.id === GUIDE_SCENARIO_ID; });
    if (!exists) scenarios.unshift(GUIDE_SCENARIO);
  }

  function removeGuideScenario() {
    var scenarios = App.data && App.data.SCENARIOS;
    if (!Array.isArray(scenarios)) return;
    for (var i = scenarios.length - 1; i >= 0; i--) {
      if (scenarios[i].id === GUIDE_SCENARIO_ID) scenarios.splice(i, 1);
    }
  }

  function memoryKey() {
    var state = store && store.get ? store.get() : {};
    var accountMarker = state.startedAt || (state.profile && state.profile.nickname) || "anonymous";
    return GUIDE_KEY + "::" + String(accountMarker);
  }

  function readMemory() {
    try {
      return JSON.parse(localStorage.getItem(memoryKey()) || "{}");
    } catch (error) {
      return {};
    }
  }

  function writeMemory(patch) {
    var next = Object.assign({}, readMemory(), patch || {});
    try { localStorage.setItem(memoryKey(), JSON.stringify(next)); } catch (error) {}
    return next;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function el(tag, className, attrs) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    Object.keys(attrs || {}).forEach(function (key) {
      if (key === "text") node.textContent = attrs[key];
      else node.setAttribute(key, attrs[key]);
    });
    return node;
  }

  function buildUi() {
    if (root) return;

    var ns = "http://www.w3.org/2000/svg";
    root = el("div", "guide-root", { id: "guideRoot", hidden: "hidden" });
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "guide-veil-svg");
    svg.setAttribute("aria-hidden", "true");
    var defs = document.createElementNS(ns, "defs");
    veilDefs = defs;
    var portraitHoleFilter = document.createElementNS(ns, "filter");
    portraitHoleFilter.setAttribute("id", "guidePortraitHole");
    portraitHoleFilter.setAttribute("x", "-8%");
    portraitHoleFilter.setAttribute("y", "-8%");
    portraitHoleFilter.setAttribute("width", "116%");
    portraitHoleFilter.setAttribute("height", "116%");
    var portraitHoleMatrix = document.createElementNS(ns, "feColorMatrix");
    portraitHoleMatrix.setAttribute("type", "matrix");
    portraitHoleMatrix.setAttribute("values", [
      "0 0 0 0 0",
      "0 0 0 0 0",
      "0 0 0 0 0",
      "0 0 0 1 0"
    ].join(" "));
    portraitHoleFilter.appendChild(portraitHoleMatrix);
    defs.appendChild(portraitHoleFilter);

    var portraitGlowFilter = document.createElementNS(ns, "filter");
    portraitGlowFilter.setAttribute("id", "guidePortraitGlow");
    portraitGlowFilter.setAttribute("x", "-18%");
    portraitGlowFilter.setAttribute("y", "-18%");
    portraitGlowFilter.setAttribute("width", "136%");
    portraitGlowFilter.setAttribute("height", "136%");
    portraitGlowFilter.innerHTML =
      '<feMorphology in="SourceAlpha" operator="dilate" radius="2.4" result="expanded"></feMorphology>' +
      '<feComposite in="expanded" in2="SourceAlpha" operator="out" result="edge"></feComposite>' +
      '<feGaussianBlur in="edge" stdDeviation="2.8" result="softEdge"></feGaussianBlur>' +
      '<feFlood flood-color="#f2d58d" flood-opacity=".95" result="gold"></feFlood>' +
      '<feComposite in="gold" in2="softEdge" operator="in"></feComposite>';
    defs.appendChild(portraitGlowFilter);

    var mask = document.createElementNS(ns, "mask");
    mask.setAttribute("id", "guideSpotlightMask");
    mask.setAttribute("maskUnits", "userSpaceOnUse");
    mask.setAttribute("maskContentUnits", "userSpaceOnUse");
    var white = document.createElementNS(ns, "rect");
    white.setAttribute("x", "0");
    white.setAttribute("y", "0");
    white.setAttribute("width", "100%");
    white.setAttribute("height", "100%");
    white.setAttribute("fill", "white");
    veilMaskHoles = document.createElementNS(ns, "g");
    mask.appendChild(white);
    mask.appendChild(veilMaskHoles);
    defs.appendChild(mask);
    svg.appendChild(defs);
    var veil = document.createElementNS(ns, "rect");
    veil.setAttribute("class", "guide-veil-fill");
    veil.setAttribute("x", "0");
    veil.setAttribute("y", "0");
    veil.setAttribute("width", "100%");
    veil.setAttribute("height", "100%");
    veil.setAttribute("mask", "url(#guideSpotlightMask)");
    svg.appendChild(veil);
    portraitGlowLayer = document.createElementNS(ns, "g");
    portraitGlowLayer.setAttribute("class", "guide-portrait-glow-layer");
    svg.appendChild(portraitGlowLayer);

    focusLayer = el("div", "guide-focus-layer", { "aria-hidden": "true" });
    card = el("aside", "guide-card", {
      id: "guideCard",
      role: "dialog",
      "aria-modal": "true",
      "aria-live": "polite"
    });
    skipButton = el("button", "guide-skip", { type: "button", text: "跳过引导" });
    waiting = el("div", "guide-waiting", { text: "大臣正在为你梳理关键问题" });
    waiting.hidden = true;

    root.appendChild(svg);
    root.appendChild(focusLayer);
    root.appendChild(card);
    root.appendChild(skipButton);
    root.appendChild(waiting);
    document.body.appendChild(root);

    skipButton.addEventListener("click", skip);
    document.addEventListener("click", guardPageClick, true);
    window.addEventListener("resize", positionCurrent);
    window.addEventListener("scroll", positionCurrent, true);

  }

  function getTargets(selectors) {
    var result = [];
    (selectors || []).forEach(function (selector) {
      var nodes = document.querySelectorAll(selector);
      Array.prototype.forEach.call(nodes, function (node) {
        var rect = node.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) result.push(node);
      });
    });
    return result;
  }

  function portraitAlphaBounds(node) {
    var source = String(node && node.getAttribute("src") || "");
    if (source.indexOf("顺臣") >= 0) return [0.1435, 0.0449, 0.8243, 0.968];
    if (source.indexOf("卦师") >= 0) return [0.0976, 0.041, 0.8897, 1];
    return [0.0625, 0.0234, 0.8448, 1];
  }

  function paddedRect(node, padding) {
    var rect = node.getBoundingClientRect();
    var pad = padding == null ? 9 : padding;
    var rawLeft = rect.left;
    var rawTop = rect.top;
    var rawRight = rect.right;
    var rawBottom = rect.bottom;

    if (node.id === "npcPortrait") {
      var bounds = portraitAlphaBounds(node);
      var galBox = document.querySelector("#galBox");
      var galTop = galBox ? galBox.getBoundingClientRect().top : window.innerHeight;
      rawLeft = rect.left + rect.width * bounds[0];
      rawTop = rect.top + rect.height * bounds[1];
      rawRight = rect.left + rect.width * bounds[2];
      rawBottom = Math.min(rect.top + rect.height * bounds[3], galTop - 18);
      pad = 4;
    } else if (node.id === "galBox" || node.id === "convoInput" || node.classList.contains("decision-sheet")) {
      pad = node.classList.contains("decision-sheet") ? 4 : 2;
    }

    var left = Math.max(4, rawLeft - pad);
    var top = Math.max(4, rawTop - pad);
    var right = Math.min(window.innerWidth - 4, rawRight + pad);
    var bottom = Math.min(window.innerHeight - 4, rawBottom + pad);
    return {
      left: left,
      top: top,
      right: right,
      bottom: bottom,
      width: Math.max(0, right - left),
      height: Math.max(0, bottom - top)
    };
  }

  function unionRect(nodes, padding) {
    if (!nodes.length) return null;
    var rects = nodes.map(function (node) { return paddedRect(node, padding); });
    var left = Math.min.apply(Math, rects.map(function (r) { return r.left; }));
    var top = Math.min.apply(Math, rects.map(function (r) { return r.top; }));
    var right = Math.max.apply(Math, rects.map(function (r) { return r.right; }));
    var bottom = Math.max.apply(Math, rects.map(function (r) { return r.bottom; }));
    return { left: left, top: top, right: right, bottom: bottom, width: right - left, height: bottom - top };
  }

  function galCompositeOutline() {
    var box = document.querySelector("#galBox");
    var name = document.querySelector("#galName");
    if (!box || !name) return null;
    var boxRect = box.getBoundingClientRect();
    var nameRect = name.getBoundingClientRect();
    if (!boxRect.width || !boxRect.height || !nameRect.width || !nameRect.height) return null;

    var boxPad = 3;
    var namePad = 4;
    var left = Math.max(4, boxRect.left - boxPad);
    var top = Math.max(4, boxRect.top - boxPad);
    var right = Math.min(window.innerWidth - 4, boxRect.right + boxPad);
    var bottom = Math.min(window.innerHeight - 4, boxRect.bottom + boxPad);
    var nameLeft = Math.max(left + 8, nameRect.left - namePad);
    var nameTop = Math.max(4, nameRect.top - namePad);
    var nameRight = Math.min(right - 8, nameRect.right + namePad);
    var boxRadius = 15;
    var nameRadius = Math.min(12, Math.max(6, (nameRect.height + namePad * 2) / 2));

    return {
      top: Math.min(top, nameTop),
      path: [
        "M", left + boxRadius, top,
        "L", nameLeft, top,
        "L", nameLeft, nameTop + nameRadius,
        "Q", nameLeft, nameTop, nameLeft + nameRadius, nameTop,
        "L", nameRight - nameRadius, nameTop,
        "Q", nameRight, nameTop, nameRight, nameTop + nameRadius,
        "L", nameRight, top,
        "L", right - boxRadius, top,
        "Q", right, top, right, top + boxRadius,
        "L", right, bottom - boxRadius,
        "Q", right, bottom, right - boxRadius, bottom,
        "L", left + boxRadius, bottom,
        "Q", left, bottom, left, bottom - boxRadius,
        "L", left, top + boxRadius,
        "Q", left, top, left + boxRadius, top,
        "Z"
      ].join(" ")
    };
  }

  function renderHoles() {
    if (!veilMaskHoles || !portraitGlowLayer || !focusLayer) return;
    veilMaskHoles.innerHTML = "";
    portraitGlowLayer.innerHTML = "";
    focusLayer.innerHTML = "";
    Array.prototype.forEach.call(veilDefs.querySelectorAll(".guide-dynamic-clip"), function (node) {
      node.remove();
    });
    var ns = "http://www.w3.org/2000/svg";
    var regularFrameRects = [];
    currentTargets.forEach(function (target, index) {
      if (target.id === "npcPortrait") {
        var portraitRect = target.getBoundingClientRect();
        var galBox = document.querySelector("#galBox");
        var visibleBottom = galBox
          ? Math.min(portraitRect.bottom, galBox.getBoundingClientRect().top - 9)
          : portraitRect.bottom;
        var clipId = "guidePortraitClip" + index;
        var clip = document.createElementNS(ns, "clipPath");
        clip.setAttribute("id", clipId);
        clip.setAttribute("class", "guide-dynamic-clip");
        clip.setAttribute("clipPathUnits", "userSpaceOnUse");
        var clipRect = document.createElementNS(ns, "rect");
        clipRect.setAttribute("x", portraitRect.left);
        clipRect.setAttribute("y", portraitRect.top);
        clipRect.setAttribute("width", portraitRect.width);
        clipRect.setAttribute("height", Math.max(0, visibleBottom - portraitRect.top));
        clip.appendChild(clipRect);
        veilDefs.appendChild(clip);

        var source = target.currentSrc || target.getAttribute("src");
        var portraitHole = document.createElementNS(ns, "image");
        portraitHole.setAttribute("href", source);
        portraitHole.setAttribute("x", portraitRect.left);
        portraitHole.setAttribute("y", portraitRect.top);
        portraitHole.setAttribute("width", portraitRect.width);
        portraitHole.setAttribute("height", portraitRect.height);
        portraitHole.setAttribute("preserveAspectRatio", "none");
        portraitHole.setAttribute("filter", "url(#guidePortraitHole)");
        portraitHole.setAttribute("clip-path", "url(#" + clipId + ")");
        veilMaskHoles.appendChild(portraitHole);

        var portraitGlow = document.createElementNS(ns, "image");
        portraitGlow.setAttribute("href", source);
        portraitGlow.setAttribute("x", portraitRect.left);
        portraitGlow.setAttribute("y", portraitRect.top);
        portraitGlow.setAttribute("width", portraitRect.width);
        portraitGlow.setAttribute("height", portraitRect.height);
        portraitGlow.setAttribute("preserveAspectRatio", "none");
        portraitGlow.setAttribute("filter", "url(#guidePortraitGlow)");
        portraitGlow.setAttribute("clip-path", "url(#" + clipId + ")");
        portraitGlowLayer.appendChild(portraitGlow);
        return;
      }

      if (currentKey === "minister" && target.id === "galBox") {
        var galOutline = galCompositeOutline();
        if (galOutline) {
          var galHole = document.createElementNS(ns, "path");
          galHole.setAttribute("d", galOutline.path);
          galHole.setAttribute("fill", "black");
          veilMaskHoles.appendChild(galHole);

          var galGlow = document.createElementNS(ns, "path");
          galGlow.setAttribute("d", galOutline.path);
          galGlow.setAttribute("fill", "none");
          galGlow.setAttribute("stroke", "#f2d58d");
          galGlow.setAttribute("stroke-width", "2.4");
          galGlow.setAttribute("vector-effect", "non-scaling-stroke");
          galGlow.setAttribute("filter", "url(#guidePortraitGlow)");
          portraitGlowLayer.appendChild(galGlow);

          var galEdge = document.createElementNS(ns, "path");
          galEdge.setAttribute("d", galOutline.path);
          galEdge.setAttribute("fill", "none");
          galEdge.setAttribute("stroke", "rgba(242, 213, 141, .86)");
          galEdge.setAttribute("stroke-width", "1.5");
          galEdge.setAttribute("vector-effect", "non-scaling-stroke");
          portraitGlowLayer.appendChild(galEdge);
        }
        return;
      }

      var rect = paddedRect(target, 9);
      var hole = document.createElementNS(ns, "rect");
      hole.setAttribute("x", rect.left);
      hole.setAttribute("y", rect.top);
      hole.setAttribute("width", rect.width);
      hole.setAttribute("height", rect.height);
      hole.setAttribute("rx", "14");
      hole.setAttribute("fill", "black");
      veilMaskHoles.appendChild(hole);
      regularFrameRects.push(rect);
    });

    var mergedFrameRects = [];
    regularFrameRects.forEach(function (rect) {
      var match = mergedFrameRects.find(function (candidate) {
        return rect.left < candidate.right &&
          rect.right > candidate.left &&
          rect.top < candidate.bottom &&
          rect.bottom > candidate.top;
      });
      if (!match) {
        mergedFrameRects.push(Object.assign({}, rect));
        return;
      }
      match.left = Math.min(match.left, rect.left);
      match.top = Math.min(match.top, rect.top);
      match.right = Math.max(match.right, rect.right);
      match.bottom = Math.max(match.bottom, rect.bottom);
      match.width = match.right - match.left;
      match.height = match.bottom - match.top;
    });

    mergedFrameRects.forEach(function (rect) {
      var frame = el("div", "guide-focus-frame");
      frame.style.left = rect.left + "px";
      frame.style.top = rect.top + "px";
      frame.style.width = rect.width + "px";
      frame.style.height = rect.height + "px";
      focusLayer.appendChild(frame);
    });
  }

  function placeCard(anchorNodes, placement) {
    if (!card) return;
    var anchor = unionRect(anchorNodes, 12) || {
      left: window.innerWidth / 2 - 20,
      right: window.innerWidth / 2 + 20,
      top: window.innerHeight / 2 - 20,
      bottom: window.innerHeight / 2 + 20,
      width: 40,
      height: 40
    };
    var cardRect = card.getBoundingClientRect();
    var gap = 18;
    var left;
    var top;
    var mode = placement || "auto";

    if (window.innerWidth <= 760) {
      left = mode === "screen-top-left" ? 12 : 16;
      top = Math.max(54, anchor.top - cardRect.height - 12);
    } else if (mode === "minister") {
      var sidebar = document.querySelector("#sidebar");
      var sidebarRect = sidebar ? sidebar.getBoundingClientRect() : null;
      var galOutline = galCompositeOutline();
      var equalGap = 18;
      left = Math.max(equalGap, Math.min(
        (sidebarRect ? sidebarRect.right : anchor.left) + equalGap,
        window.innerWidth - cardRect.width - equalGap
      ));
      top = Math.max(72, Math.min(
        (galOutline ? galOutline.top : anchor.top) - cardRect.height - equalGap,
        window.innerHeight - cardRect.height - equalGap
      ));
    } else if (mode === "screen-top-left") {
      left = Math.max(18, Math.min(anchor.left, window.innerWidth - cardRect.width - 18));
      var compactTop = currentKey === "stamp" ? 8 : 16;
      top = Math.max(window.innerHeight < 800 ? compactTop : 44, anchor.top - cardRect.height - gap);
    } else if (mode === "upper-left") {
      left = Math.max(18, Math.min(anchor.left, window.innerWidth - cardRect.width - 18));
      top = Math.max(72, anchor.top - cardRect.height - gap);
    } else if (mode === "left") {
      left = Math.max(18, anchor.left - cardRect.width - gap);
      top = Math.max(72, Math.min(anchor.top, window.innerHeight - cardRect.height - 18));
    } else if (mode === "right") {
      left = Math.min(window.innerWidth - cardRect.width - 18, anchor.right + gap);
      top = Math.max(72, Math.min(anchor.top, window.innerHeight - cardRect.height - 18));
    } else if (mode === "above") {
      left = Math.max(18, Math.min(anchor.right - cardRect.width, window.innerWidth - cardRect.width - 18));
      top = Math.max(72, anchor.top - cardRect.height - gap);
    } else if (anchor.right + cardRect.width + gap < window.innerWidth) {
      left = anchor.right + gap;
      top = Math.max(72, Math.min(anchor.top, window.innerHeight - cardRect.height - 18));
    } else if (anchor.left - cardRect.width - gap > 0) {
      left = anchor.left - cardRect.width - gap;
      top = Math.max(72, Math.min(anchor.top, window.innerHeight - cardRect.height - 18));
    } else {
      left = Math.max(18, Math.min(anchor.left, window.innerWidth - cardRect.width - 18));
      top = Math.max(72, anchor.top - cardRect.height - gap);
    }

    card.style.left = Math.round(left) + "px";
    card.style.top = Math.round(top) + "px";
  }

  function positionCurrent() {
    if (!active || root.hidden || root.classList.contains("is-transitioning")) return;
    currentTargets = getTargets(currentSelectors);
    currentAnchorTargets = getTargets(currentAnchorSelectors);
    renderHoles();
    var anchorNodes = currentAnchorTargets.length ? currentAnchorTargets : currentTargets;
    placeCard(anchorNodes, card.getAttribute("data-placement") || "auto");
  }

  function setCard(config) {
    var body = config.body || "";
    if (config.example) body += '<span class="guide-card-example">' + esc(config.example) + "</span>";
    card.innerHTML =
      '<div class="guide-card-kicker">' + esc(config.kicker || "御前引路") + "</div>" +
      "<h3>" + esc(config.title) + "</h3>" +
      '<div class="guide-card-body">' + body + "</div>" +
      '<div class="guide-card-actions">' +
        '<span class="guide-step-seal">' + esc(config.stepLabel || "") + "</span>" +
        (config.button ? '<button class="guide-next" type="button">' + esc(config.button) + "</button>" : "") +
      "</div>";
    card.setAttribute("data-placement", config.placement || "auto");
    var next = card.querySelector(".guide-next");
    if (next && config.onNext) next.addEventListener("click", config.onNext);
  }

  function show(config) {
    clearPendingWatch();
    active = true;
    currentKey = config.key;
    document.body.classList.add("guide-walkthrough");
    document.body.classList.toggle("guide-reading-decision", ["mirror", "paths", "stamp"].indexOf(currentKey) >= 0);
    root.setAttribute("data-step", currentKey);
    allowedSelectors = (config.allowed || []).slice();
    currentSelectors = (config.targets || []).slice();
    currentAnchorSelectors = (config.anchorTargets || config.targets || []).slice();
    currentTargets = getTargets(currentSelectors);
    currentAnchorTargets = getTargets(currentAnchorSelectors);
    var isResuming = root.classList.contains("is-transitioning");
    root.hidden = false;
    waiting.hidden = true;
    card.hidden = false;
    skipButton.hidden = false;
    setCard(config);
    renderHoles();
    requestAnimationFrame(function () {
      placeCard(currentAnchorTargets.length ? currentAnchorTargets : currentTargets, config.placement);
      if (isResuming) {
        requestAnimationFrame(function () {
          root.classList.remove("is-transitioning");
        });
      }
    });
    setTimeout(function () {
      if (active && currentKey === config.key) positionCurrent();
    }, 460);
    writeMemory({ current: currentKey, started: true });
  }

  function hideForWait(message) {
    root.hidden = false;
    root.classList.add("is-transitioning");
    card.hidden = false;
    currentTargets = [];
    currentAnchorTargets = [];
    renderHoles();
    waiting.textContent = message || "大臣正在为你梳理关键问题";
    waiting.hidden = false;
    document.body.appendChild(waiting);
  }

  function clearPendingWatch() {
    if (pendingObserver) pendingObserver.disconnect();
    pendingObserver = null;
    if (pendingTimer) clearTimeout(pendingTimer);
    pendingTimer = null;
  }

  function waitForConversationResult(minimumMs, answeredProbe) {
    clearPendingWatch();
    hideForWait("大臣正在为你梳理关键问题");
    var startedAt = Date.now();
    var resolved = false;

    function reveal(next) {
      if (resolved) return true;
      resolved = true;
      clearPendingWatch();
      pendingTimer = setTimeout(function () {
        pendingTimer = null;
        waiting.hidden = true;
        next();
      }, Math.max(0, (minimumMs || 0) - (Date.now() - startedAt)));
      return true;
    }

    function check() {
      var probe = document.querySelector("#replyZone .opt-btn");
      var decision = document.querySelector("#replyZone .decision-sheet");
      if (probe) return reveal(showProbe);
      if (decision) return reveal(answeredProbe ? showMirror : showDecisionBridge);
      return false;
    }

    if (check()) return;
    pendingObserver = new MutationObserver(check);
    var reply = document.querySelector("#replyZone");
    var convo = document.querySelector("#convoScroll");
    if (reply) pendingObserver.observe(reply, { childList: true, subtree: true });
    if (convo) pendingObserver.observe(convo, { childList: true, subtree: true });
    pendingTimer = setTimeout(function () {
      clearPendingWatch();
      waiting.hidden = true;
      showRecovery("还没有生成决策", "可以换一种说法，或直接使用输入框里准备好的例子。");
    }, 12000);
  }

  function prepareTaskStep() {
    var state = store.get();
    var task = null;
    for (var i = 0; i < lastGeneratedTaskIds.length; i++) {
      task = state.mapTasks.find(function (candidate) {
        return candidate.id === lastGeneratedTaskIds[i] && !candidate.done;
      });
      if (task) break;
    }
    if (!task) task = state.mapTasks.find(function (candidate) { return !candidate.done; });

    if (task && task.scene && state.scene !== task.scene && App.nav && App.nav.goScene) {
      App.nav.goScene(task.scene, { recordVisit: false });
    }
    if (App.conversation && App.conversation.collapse) App.conversation.collapse();
    setTimeout(showTask, 260);
  }

  function waitForTask(beforeIds) {
    clearPendingWatch();
    hideForWait("正在把决定化为行动");
    var before = Array.isArray(beforeIds) ? beforeIds : [];

    function check() {
      var tasks = store.get().mapTasks.filter(function (task) {
        return !task.done && before.indexOf(task.id) < 0;
      });
      if (!tasks.length) return false;
      lastGeneratedTaskIds = tasks.map(function (task) { return task.id; });
      clearPendingWatch();
      waiting.hidden = true;
      prepareTaskStep();
      return true;
    }

    if (check()) return;
    pendingObserver = new MutationObserver(check);
    var field = document.querySelector("#taskField");
    if (field) pendingObserver.observe(field, { childList: true, subtree: true });
    pendingTimer = setTimeout(function () {
      clearPendingWatch();
      waiting.hidden = true;
      prepareTaskStep();
    }, 3000);
  }

  function ministerName() {
    if (App.conversation && App.conversation.getState && App.data && App.data.MINISTERS) {
      var conversationState = App.conversation.getState();
      var ministerDef = conversationState && App.data.MINISTERS[conversationState.ministerKey];
      if (ministerDef && (ministerDef.role || ministerDef.name)) return ministerDef.role || ministerDef.name;
    }
    var node = document.querySelector("#galName");
    return node && node.textContent.trim() ? node.textContent.trim() : "首位辅臣";
  }

  function showMinister() {
    show({
      key: "minister",
      targets: ["#npcPortrait", "#galBox", "#convoInput"],
      anchorTargets: ["#npcPortrait"],
      allowed: [],
      placement: "minister",
      stepLabel: "1 / " + TOTAL_STEPS,
      title: "这是你的首位辅臣",
      body: "你正在和<strong>【" + esc(ministerName()) + "】</strong>商议。大臣负责辅佐，最后决定始终由你作出。",
      button: "我知道了",
      onNext: function () { showInput(); }
    });
  }

  function showInput(customTitle, customBody) {
    show({
      key: "input",
      targets: ["#convoInput"],
      allowed: ["#convoText", "#convoSend"],
      placement: "above",
      stepLabel: "2 / " + TOTAL_STEPS,
      title: customTitle || "从一件真实小事开始",
      body: customBody || "在这里说出正在困扰你的<strong>真实职场问题</strong>。不用组织得很完整，像发消息一样就好。",
      example: customTitle ? "" : "示例已填入。你可以直接发送。",
      button: ""
    });
    var input = document.querySelector("#convoText");
    if (input) {
      if (!customTitle) {
        input.value = GUIDE_SAMPLE;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
      input.focus();
    }
  }

  function showProbe() {
    show({
      key: "probe",
      targets: ["#replyZone .opt-list"],
      allowed: ["#replyZone .opt-btn"],
      placement: "screen-top-left",
      stepLabel: "3 / " + TOTAL_STEPS,
      title: "大臣会先问清关键处",
      body: "它不会急着给答案。请选择最接近真实情况的一项，帮助它找到真正影响判断的变量。",
      button: ""
    });
  }

  function showDecisionBridge() {
    show({
      key: "probe",
      targets: ["#convoScroll"],
      allowed: [],
      placement: "screen-top-left",
      stepLabel: "3 / " + TOTAL_STEPS,
      title: "大臣先抓住真正的变量",
      body: "它先识别<strong>期限、协作依赖和生活边界</strong>。情况已经足够清楚时，会直接拟成奏折；仍有缺口时，才会继续追问。",
      button: "查看奏折",
      onNext: showMirror
    });
  }

  function showMirror() {
    var galBox = document.querySelector("#galBox");
    if (galBox) galBox.scrollTop = 0;
    show({
      key: "mirror",
      targets: [".decision-sheet"],
      allowed: [],
      placement: "screen-top-left",
      stepLabel: "4 / " + TOTAL_STEPS,
      title: "先看这件事值不值得",
      body: "大臣会把<strong>投入、可能收益和机会成本</strong>放在一起，帮你看清真正的取舍。",
      button: "继续看方案",
      onNext: showPaths
    });
  }

  function showPaths() {
    var galBox = document.querySelector("#galBox");
    if (galBox) galBox.scrollTop = 0;
    show({
      key: "paths",
      targets: [".decision-sheet"],
      allowed: [".decision-sheet .path-row"],
      placement: "screen-top-left",
      stepLabel: "5 / " + TOTAL_STEPS,
      title: "方案不只有一个",
      body: "“推荐”是大臣当前的判断，“备选”是另一条可行路径。你可以点击任一方案切换。",
      button: "我看懂了",
      onNext: showStamp
    });
  }

  function showStamp() {
    var galBox = document.querySelector("#galBox");
    if (galBox) galBox.scrollTop = 0;
    show({
      key: "stamp",
      targets: [".decision-sheet", "#convoInput"],
      allowed: [".decision-sheet .pizhu-btn.again", ".decision-sheet .pizhu-btn.bold", '#convoSend[data-mode="stamp"]'],
      placement: "screen-top-left",
      stepLabel: "6 / " + TOTAL_STEPS,
      title: "最后一笔，由你来落",
      body: "<strong>同意</strong>：按当前方案执行<br><strong>再议</strong>：补充信息，请大臣重拟<br><strong>大胆</strong>：这个判断不对，换个方向<br><br>大臣给建议，女皇作决定。",
      button: ""
    });
  }

  function showTask() {
    var target = "";
    for (var i = 0; i < lastGeneratedTaskIds.length; i++) {
      if (document.querySelector('.task-card[data-task="' + lastGeneratedTaskIds[i] + '"]')) {
        target = '.task-card[data-task="' + lastGeneratedTaskIds[i] + '"]';
        break;
      }
    }
    if (!target) target = "#taskField .task-card:not(.done)";
    show({
      key: "task",
      targets: [target],
      allowed: [target],
      placement: "right",
      stepLabel: "7 / " + TOTAL_STEPS,
      title: "决定已经变成第一步",
      body: "奏折已拆成现实行动，并自动来到对应场景。做完以后，点击任务卡即可呈报完成。",
      button: "完成引导",
      onNext: finish
    });
  }

  function showRecovery(title, body) {
    showInput(title || "补充一句，继续商议", body || "请在输入框补充真实情况，大臣会据此重新拟策。");
  }

  function guardPageClick(event) {
    if (!active || root.hidden) return;
    var target = event.target;
    if (target.closest("#guideCard") || target.closest(".guide-skip")) return;

    var allowed = allowedSelectors.some(function (selector) {
      return !!target.closest(selector);
    });
    if (!allowed) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (currentKey === "input" && target.closest("#convoSend")) {
      var input = document.querySelector("#convoText");
      if (!input || !input.value.trim()) return;
      setTimeout(function () { waitForConversationResult(1100, false); }, 0);
      return;
    }

    if (currentKey === "probe" && target.closest("#replyZone .opt-btn")) {
      setTimeout(function () { waitForConversationResult(1500, true); }, 0);
      return;
    }

    if (currentKey === "stamp") {
      if (target.closest('#convoSend[data-mode="stamp"]')) {
        var beforeTaskIds = store.get().mapTasks.map(function (task) { return task.id; });
        if (App.demo) App.demo.active = false;
        setTimeout(function () { waitForTask(beforeTaskIds); }, 0);
      } else if (target.closest(".pizhu-btn.again")) {
        setTimeout(function () {
          showRecovery("补充信息，请大臣重拟", "在输入框补充你认为还缺少的情况，再次发送即可回到决策奏折。");
        }, 80);
      } else if (target.closest(".pizhu-btn.bold")) {
        setTimeout(function () {
          showRecovery("指出问题，换个方向", "告诉大臣你的底线或真正目标，它会换一种思路重新拟策。");
        }, 520);
      }
      return;
    }

    if (currentKey === "task" && target.closest(".task-card")) {
      finish();
    }
  }

  function start(force) {
    buildUi();
    var memory = readMemory();
    if (active && !force) return;
    if (!force && (memory.done || memory.skipped)) return;
    if (!document.querySelector("#screen-app.active")) return;
    clearPendingWatch();
    ensureGuideScenario();
    if (App.demo && App.demo.isRunning && App.demo.isRunning()) App.demo.stop();
    if (App.demo) App.demo.active = true;
    currentKey = "";
    lastGeneratedTaskIds = [];
    if (App.ui && App.ui.closeModal) App.ui.closeModal();
    setTimeout(showMinister, 80);
  }

  function finish() {
    clearPendingWatch();
    active = false;
    currentKey = "";
    currentSelectors = [];
    currentAnchorSelectors = [];
    currentAnchorTargets = [];
    allowedSelectors = [];
    document.body.classList.remove("guide-walkthrough");
    document.body.classList.remove("guide-reading-decision");
    document.body.style.removeProperty("--guide-petition-offset");
    root.classList.remove("is-transitioning");
    root.hidden = true;
    waiting.hidden = true;
    if (App.demo) App.demo.active = false;
    removeGuideScenario();
    writeMemory({ done: true, skipped: false, current: "", completedAt: new Date().toISOString() });
    showEndToast();
  }

  function skip() {
    clearPendingWatch();
    active = false;
    currentKey = "";
    currentSelectors = [];
    currentAnchorSelectors = [];
    currentAnchorTargets = [];
    allowedSelectors = [];
    document.body.classList.remove("guide-walkthrough");
    document.body.classList.remove("guide-reading-decision");
    document.body.style.removeProperty("--guide-petition-offset");
    root.classList.remove("is-transitioning");
    root.hidden = true;
    waiting.hidden = true;
    if (App.demo) App.demo.active = false;
    removeGuideScenario();
    writeMemory({ skipped: true, current: "" });
  }

  function showEndToast() {
    var toast = el("div", "guide-waiting", {
      text: "你已完成第一次决策。接下来，只需要从这一小步开始。"
    });
    toast.style.bottom = "28px";
    document.body.appendChild(toast);
    setTimeout(function () { toast.remove(); }, 3200);
  }

  function showCompletionCoach() {
    var memory = readMemory();
    if (memory.firstCompletionSeen) return;
    var target = document.querySelector("#drawerTab");
    if (!target) return;
    writeMemory({ firstCompletionSeen: true });
    var rect = target.getBoundingClientRect();
    var mini = el("div", "guide-mini-card");
    mini.innerHTML =
      "<strong>每一次完成都会留下证据</strong>" +
      "<p>金币和成就奖励真实行动；完整过程会记入起居注，方便你以后复盘。</p>" +
      '<button type="button" class="guide-next">查看起居注</button>';
    mini.style.right = Math.max(16, window.innerWidth - rect.left + 12) + "px";
    mini.style.top = Math.max(80, rect.top - 40) + "px";
    document.body.appendChild(mini);
    mini.querySelector("button").onclick = function () {
      mini.remove();
      if (App.drawer) App.drawer.open("journal");
    };
    setTimeout(function () { if (mini.isConnected) mini.remove(); }, 12000);
  }

  function init() {
    buildUi();
    store.on("enterApp", function () {
      setTimeout(function () { start(false); }, 720);
    });
    store.on("taskDone", showCompletionCoach);
  }

  App.guide = {
    init: init,
    start: start,
    skip: skip,
    finish: finish,
    reset: function () {
      try { localStorage.removeItem(memoryKey()); } catch (error) {}
    },
    isActive: function () { return active; }
  };

  init();
})();
