/* =============================================================
   flowaudio.js —— 心流模式场景背景音
   window.App.flowAudio
   - 进入心流即按「当前场景」播放对应曲目；退出即停。
   - 心流遮罩右上角挂一个音量调节组件（独立于遮罩重渲染，常驻）。
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store, ui = App.ui;
  var BASE = "assets/audio/";

  // 场景 id → 曲目文件名。无专属曲目的场景回落到「御花园」（最静心）。
  var TRACK_BY_SCENE = {
    ministry: "六部.m4a",
    garden: "御花园.m4a",
    folk: "民间.m4a",
    observatory: "钦天监.m4a",
    library: "藏书阁.m4a",
    treasury: "珍宝阁.m4a"
  };
  var FALLBACK = "御花园.m4a";

  var audio = null;      // 单例 <audio>
  var panel = null;      // 音量组件根节点
  var curTrack = "";     // 当前 src 文件名
  var volume = 0.6;      // 记忆音量（0..1）
  var VOL_KEY = "nvdi-flow-volume";
  var MAX_SECONDS = 25 * 60;  // 心流一节 25 分钟，曲目只放前 25 分钟，不循环

  function loadVolume() {
    try {
      var v = parseFloat(localStorage.getItem(VOL_KEY));
      if (!isNaN(v) && v >= 0 && v <= 1) volume = v;
    } catch (e) {}
  }
  function saveVolume() { try { localStorage.setItem(VOL_KEY, String(volume)); } catch (e) {} }

  function ensureAudio() {
    if (audio) return audio;
    audio = new Audio();
    audio.loop = false;    // 不循环：一节 25 分钟，播到上限即停
    audio.preload = "auto";
    audio.volume = volume;
    // 曲目超过 25 分钟的部分不放：到点暂停并回到开头，供下一节复用。
    audio.addEventListener("timeupdate", function () {
      if (audio.currentTime >= MAX_SECONDS) { audio.pause(); audio.currentTime = 0; }
    });
    return audio;
  }

  function trackForScene() {
    var scene = store.get().scene;
    return TRACK_BY_SCENE[scene] || FALLBACK;
  }

  function sceneName() {
    var sc = data.sceneById(store.get().scene);
    return sc ? sc.name : "宫廷";
  }

  /* ---------- 播放 / 停止 ---------- */
  function start() {
    ensureAudio();
    var file = trackForScene();
    if (curTrack !== file) {
      curTrack = file;
      audio.src = BASE + encodeURIComponent(file);
    }
    try { audio.currentTime = 0; } catch (e) {}   // 每节心流都从曲目开头起播
    audio.volume = volume;
    var p = audio.play();
    // 自动播放被拦截时，首次交互后重试（心流内点开始/入席即触发）。
    if (p && typeof p.catch === "function") {
      p.catch(function () {
        var retry = function () {
          audio.play().catch(function () {});
          document.removeEventListener("pointerdown", retry);
          document.removeEventListener("keydown", retry);
        };
        document.addEventListener("pointerdown", retry, { once: true });
        document.addEventListener("keydown", retry, { once: true });
      });
    }
    mountPanel();
  }

  function stop() {
    if (audio) { audio.pause(); }
    unmountPanel();
  }

  /* ---------- 音量组件 ---------- */
  function mountPanel() {
    if (panel) { refreshPanel(); return; }
    panel = document.createElement("div");
    panel.className = "flow-audio";
    panel.innerHTML =
      '<button class="fa-toggle" id="faToggle" aria-label="静音/播放">' +
        '<span class="fa-ico" id="faIco"></span>' +
      '</button>' +
      '<div class="fa-track">' +
        '<span class="fa-name" id="faName"></span>' +
        '<input class="fa-range" id="faRange" type="range" min="0" max="100" step="1" ' +
          'aria-label="心流背景音音量" />' +
      '</div>';
    document.body.appendChild(panel);

    ui.$("#faRange", panel).addEventListener("input", function (e) {
      volume = Math.max(0, Math.min(1, e.target.value / 100));
      if (audio) audio.volume = volume;
      saveVolume();
      refreshIcon();
    });
    ui.$("#faToggle", panel).addEventListener("click", function () {
      if (!audio) return;
      audio.muted = !audio.muted;
      refreshIcon();
    });
    refreshPanel();
  }

  function refreshPanel() {
    if (!panel) return;
    var name = ui.$("#faName", panel);
    if (name) name.textContent = sceneName() + " · 心流";
    var range = ui.$("#faRange", panel);
    if (range) range.value = Math.round(volume * 100);
    refreshIcon();
  }

  function refreshIcon() {
    var ico = panel && ui.$("#faIco", panel);
    if (!ico) return;
    var muted = audio && (audio.muted || volume === 0);
    ico.textContent = muted ? "🔇" : (volume < 0.45 ? "🔉" : "🔊");
  }

  function unmountPanel() {
    if (panel) { panel.remove(); panel = null; }
  }

  loadVolume();
  App.flowAudio = { start: start, stop: stop };
})();
