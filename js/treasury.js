/* =============================================================
   treasury.js —— 珍宝阁面板：59 成就网格 / 筛选 / 详情
   window.App.treasury
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store, ui = App.ui;

  var panel, stateFilter = "all", catFilter = "all";

  function open() { render(); panel.classList.add("active"); }
  function close() { panel.classList.remove("active"); }

  function lockSvg() {
    return '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z"/></svg>';
  }

  function counts() {
    var total = data.ACHIEVEMENTS.length, unlocked = 0;
    data.ACHIEVEMENTS.forEach(function (a) { if (store.achState(a.id).unlocked) unlocked++; });
    return { total: total, unlocked: unlocked };
  }

  function render() {
    var sc = data.sceneById("treasury");
    var c = counts();
    var stateChips = [["all", "全部"], ["unlocked", "已解锁"], ["locked", "未解锁"]].map(function (p) {
      return '<button class="tr-chip' + (stateFilter === p[0] ? " active" : "") + '" data-st="' + p[0] + '">' + p[1] + '</button>';
    }).join("");
    var catChips = '<button class="tr-cat' + (catFilter === "all" ? " active" : "") + '" data-cat="all" ' +
      (catFilter === "all" ? 'style="background:var(--ink);color:#fff"' : '') + '>全部材质</button>' +
      data.CAT_ORDER.map(function (cat) {
        var m = data.CAT_META[cat];
        var on = catFilter === cat;
        return '<button class="tr-cat' + (on ? " active" : "") + '" data-cat="' + cat + '"' +
          (on ? ' style="background:' + m.color + '"' : '') + '>' +
          '<span class="swatch" style="background:' + m.color + '"></span>' + m.label + '</button>';
      }).join("");

    panel.innerHTML =
      '<div class="panel-head">' +
        '<img class="picon" src="' + ui.esc(sc.icon) + '" alt="" onerror="this.style.display=\'none\'" />' +
        '<div><h2>珍宝阁</h2><div class="psub">五材质 · 五十九珍 · 铭刻功业</div></div>' +
        '<div class="spacer"></div>' +
        '<button class="panel-close" id="trClose">×</button>' +
      '</div>' +
      '<div class="tr-toolbar">' +
        '<div class="tr-filters">' + stateChips + '</div>' +
        '<div class="tr-cats">' + catChips + '</div>' +
        '<div class="tr-summary">已藏 <b>' + c.unlocked + '</b> / ' + c.total + ' 珍</div>' +
      '</div>' +
      '<div class="tr-body" id="trBody"></div>';

    ui.$("#trClose").onclick = function () { close(); App.nav.goScene("court"); };
    Array.prototype.forEach.call(panel.querySelectorAll(".tr-chip"), function (b) {
      b.addEventListener("click", function () { stateFilter = b.getAttribute("data-st"); render(); });
    });
    Array.prototype.forEach.call(panel.querySelectorAll(".tr-cat"), function (b) {
      b.addEventListener("click", function () { catFilter = b.getAttribute("data-cat"); render(); });
    });
    renderGrid();
  }

  function passFilter(a) {
    var s = store.achState(a.id);
    if (stateFilter === "unlocked" && !s.unlocked) return false;
    if (stateFilter === "locked" && s.unlocked) return false;
    if (catFilter !== "all" && a.cat !== catFilter) return false;
    return true;
  }

  function renderGrid() {
    var body = ui.$("#trBody");
    var cats = catFilter === "all" ? data.CAT_ORDER : [catFilter];
    var html = "";
    cats.forEach(function (cat) {
      var m = data.CAT_META[cat];
      var items = data.ACHIEVEMENTS.filter(function (a) { return a.cat === cat && passFilter(a); });
      if (!items.length) return;
      var doneN = items.filter(function (a) { return store.achState(a.id).unlocked; }).length;
      html += '<div class="cat-group">' +
        '<div class="ch" style="border-color:' + m.color + '">' +
        '<span class="cname" style="color:' + m.color + '">' + m.label + '</span>' +
        '<span class="csay">' + ui.esc(m.say) + '</span>' +
        '<span class="ccount">' + doneN + ' / ' + m.total + '</span></div>' +
        '<div class="ach-grid">' +
        items.map(cardHtml).join("") +
        '</div></div>';
    });
    body.innerHTML = html || '<div class="empty-hint">此筛选下暂无珍宝。</div>';

    Array.prototype.forEach.call(body.querySelectorAll(".ach-card"), function (c) {
      c.addEventListener("click", function () { showDetail(c.getAttribute("data-id")); });
    });
  }

  function cardHtml(a, i) {
    var s = store.achState(a.id);
    var locked = !s.unlocked;
    var hasProg = a.target > 1 && s.cur > 0 && s.cur < a.target;
    var dots = "";
    for (var k = 1; k <= 5; k++) dots += '<i class="' + (k <= a.tier ? "on" : "") + '"></i>';
    return '<div class="ach-card ' + (locked ? "locked" : "unlocked") + '" data-id="' + a.id + '" style="animation-delay:' + ((i % 12) * 30) + 'ms">' +
      '<div class="imgwrap">' +
        '<img src="' + ui.esc(data.achImg(a)) + '" alt="" onerror="this.style.visibility=\'hidden\'" />' +
        (locked ? '<div class="lock-badge">' + lockSvg() + '</div>' : '') +
      '</div>' +
      '<div class="nm">' + ui.esc(a.name) + '</div>' +
      '<div class="tierdots">' + dots + '</div>' +
      (hasProg ? '<div class="mini-prog"><div class="f" style="width:' + Math.round(s.cur / a.target * 100) + '%"></div></div>' : '') +
      '</div>';
  }

  /* ---------- 成就详情 ---------- */
  function showDetail(id) {
    var a = data.achById[id];
    var s = store.achState(id);
    var m = data.CAT_META[a.cat];
    var locked = !s.unlocked;
    var pct = Math.min(100, Math.round(s.cur / a.target * 100));
    var refs = (a.journalRefs || []).map(function (r) { return '<span class="tag">' + ui.esc(r) + '</span>'; }).join("") || '<span class="muted">暂无关联起居注</span>';

    ui.openModal(
      '<div class="ach-detail">' +
      '<div class="hero ' + (locked ? "locked" : "") + '">' +
        '<img src="' + ui.esc(data.achImg(a)) + '" alt="" onerror="this.style.visibility=\'hidden\'" />' +
        '<div><div class="cat-lbl">' + ui.esc(m.label) + ' · 第 ' + a.idx + ' 珍</div>' +
        '<h3>' + ui.esc(a.name) + '</h3>' +
        '<div class="flavor">' + ui.esc(a.flavor) + '</div></div>' +
      '</div>' +
      '<div class="dbody">' +
        '<div class="drow"><span class="k">达成条件</span><span class="v">' + ui.esc(a.goal) + '</span></div>' +
        (locked
          ? '<div class="drow"><span class="k">线索</span><span class="v">' + ui.esc(a.hint) + '</span></div>' +
            '<div class="drow"><span class="k">进度</span><span class="v" style="flex:1">' +
              '<div class="prog-big"><div class="f" style="width:' + pct + '%"></div></div>' +
              s.cur + ' / ' + a.target + '（' + pct + '%）</span></div>' +
            '<div class="drow"><span class="k">状态</span><span class="v locked-note">🔒 尚未解锁</span></div>'
          : '<div class="drow"><span class="k">解锁于</span><span class="v">' + ui.esc(s.date || "—") + '</span></div>') +
        '<div class="drow"><span class="k">奖赏</span><span class="v"><span class="reward-chip">' + ui.esc(a.reward) + '</span></span></div>' +
        '<div class="drow"><span class="k">关联</span><span class="v refs">' + refs + '</span></div>' +
        '<div style="text-align:right;margin-top:16px"><button class="btn btn-gold" id="adClose">收 起</button></div>' +
      '</div></div>'
    );
    ui.$("#adClose").onclick = ui.closeModal;
  }

  function init() {
    panel = ui.$("#treasuryPanel");
    // 解锁时若面板开启则刷新，并高亮
    store.on("achievement", function () {
      if (panel.classList.contains("active")) renderGrid();
    });
  }

  App.treasury = { init: init, open: open, close: close, showDetail: showDetail };
})();
