/* =============================================================
   main.js —— 启动引导 / 模块装配 / 全局事件订阅
   载入顺序最后执行：初始化各模块，绑定成就通知，进入正确屏幕。
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var store = App.store, ui = App.ui;

  var appInited = false;

  // 主应用模块的初始化（仅在进入 app 屏幕后执行一次）
  function initApp() {
    if (appInited) return;
    appInited = true;
    App.topbar.init();
    App.panel.init();
    App.scene.init();
    App.conversation.init();
    App.drawer.init();
    App.modes.init();
    App.library.init();
    App.treasury.init();
    App.demo.init();

    // 若刷新时停留在藏书阁/珍宝阁，恢复面板
    var sc = store.get().scene;
    if (sc === "library") App.library.open();
    else if (sc === "treasury") App.treasury.open();
  }

  // 成就解锁 → 轻量通知（全局，任何屏幕都生效）
  store.on("achievement", function (def) { ui.achToast(def); });

  // 进入 app 屏幕的钩子
  store.on("enterApp", initApp);
  App.emitReady = initApp;

  // 键盘：ESC 关闭弹层/抽屉/面板
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Escape") return;
    var ov = ui.$("#overlay");
    if (ov.classList.contains("active")) { ui.closeModal(); return; }
    var dr = ui.$("#drawer");
    if (dr && dr.classList.contains("open")) { App.drawer.close(); return; }
    if (App.conversation && App.conversation.getState().expanded) App.conversation.collapse();
  });

  // 关闭弹层：点击遮罩空白处
  ui.$("#overlay").addEventListener("click", function (e) {
    if (e.target === ui.$("#overlay")) ui.closeModal();
  });

  // 引导：有存档进 app，否则御前推演
  App.onboarding.boot();

  console.log("[女帝·完整版] 启动完成。8 模块就绪，演示模式可用。");
})();
