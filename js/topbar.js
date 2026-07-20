/* =============================================================
   topbar.js —— 顶栏：品牌 / 模式切换 tabs / 精力条 / 金币 / 天数
   window.App.topbar
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store, ui = App.ui;

  var bar;
  var MODES = [
    { key: "normal", label: "常规" },
    { key: "flow", label: "心流" },
    { key: "prophecy", label: "预言" }
  ];

  function render() {
    var st = store.get();
    var tabs = MODES.map(function (m) {
      return '<button class="mode-tab' + (st.mode === m.key ? " active" : "") + '" data-mode="' + m.key + '">' + m.label + '</button>';
    }).join("");

    var ecls = "energy-bar";
    if (st.energy >= 120) ecls += " high"; else if (st.energy < 30) ecls += " low";
    var epct = Math.round(st.energy / st.energyCap * 100);

    bar.innerHTML =
      '<div class="brand"><span class="seal">帝</span><span>女帝决策</span></div>' +
      '<div class="mode-tabs">' + tabs + '</div>' +
      '<div class="spacer"></div>' +
      '<div class="res-group">' +
        '<div class="res-item energy-bar-wrap" id="energyWrap" title="点击校准精力">' +
          '<img src="' + data.ASSET_BASE + 'svg图标/精力.svg" alt="精力" onerror="this.style.display=\'none\'" />' +
          '<div class="' + ecls + '"><div class="fill" style="width:' + epct + '%"></div></div>' +
          '<span class="val">' + st.energy + '</span><span class="muted" style="font-size:12px">/' + st.energyCap + '</span>' +
        '</div>' +
        '<div class="res-item" title="金币">' +
          '<img src="' + data.ASSET_BASE + 'svg图标/金币.svg" alt="金币" onerror="this.style.display=\'none\'" />' +
          '<span class="val">' + st.gold + '</span>' +
        '</div>' +
        '<div class="day-chip">' + store.today() + '</div>' +
      '</div>';

    bind();
  }

  function bind() {
    Array.prototype.forEach.call(bar.querySelectorAll(".mode-tab"), function (btn) {
      btn.addEventListener("click", function () {
        var m = btn.getAttribute("data-mode");
        if (App.modes) App.modes.switchTo(m); else store.setMode(m);
      });
    });
    var ew = ui.$("#energyWrap");
    if (ew) ew.addEventListener("click", openCalibrate);
  }

  /* 精力校准弹层（玉雕成就：澄心正气） */
  function openCalibrate() {
    var st = store.get();
    ui.openModal(
      '<div class="calib">' +
      '<h3>澄心正气 · 校准精力</h3>' +
      '<p>亲自校准你此刻的精力，臣子将据此调整进言。</p>' +
      '<div class="valbig" id="calibVal">' + st.energy + '</div>' +
      '<input type="range" id="calibRange" min="0" max="' + st.energyCap + '" value="' + st.energy + '" />' +
      '<div class="note">精力越低，大臣越倾向稳妥；精力越高，越敢放手一搏。</div>' +
      '<div style="display:flex;gap:10px;justify-content:center">' +
      '<button class="btn" id="calibCancel">取消</button>' +
      '<button class="btn btn-jade" id="calibOk">校准完毕</button></div></div>'
    );
    var range = ui.$("#calibRange"), val = ui.$("#calibVal");
    range.addEventListener("input", function () { val.textContent = range.value; });
    ui.$("#calibCancel").onclick = ui.closeModal;
    ui.$("#calibOk").onclick = function () {
      store.setEnergy(+range.value);
      ui.closeModal();
    };
  }

  function init() {
    bar = ui.$("#topbar");
    render();
    store.on("change", render);
  }

  App.topbar = { init: init, render: render, openCalibrate: openCalibrate };
})();
