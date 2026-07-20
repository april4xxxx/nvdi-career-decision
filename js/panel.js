/* =============================================================
   panel.js —— 个人面板（可折叠左侧卷轴）
   头像 / 类型 / 主副线进度 / 地图导航 / 设置
   window.App.panel
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store, ui = App.ui;

  var sidebar;
  var sidebarScrollTop = 0;

  function rememberSidebarScroll() {
    var inner = sidebar && sidebar.querySelector(".sb-inner");
    if (inner) sidebarScrollTop = inner.scrollTop;
  }

  function restoreSidebarScroll() {
    var inner = sidebar && sidebar.querySelector(".sb-inner");
    if (!inner) return;
    var target = sidebarScrollTop;
    function apply() {
      inner.scrollTop = Math.min(target, Math.max(0, inner.scrollHeight - inner.clientHeight));
    }
    apply();
    requestAnimationFrame(apply);
    inner.addEventListener("scroll", function () {
      sidebarScrollTop = inner.scrollTop;
    }, { passive: true });
  }

  function mapItems() {
    var st = store.get();
    return data.SCENES.map(function (s) {
      var active = st.scene === s.id ? " active" : "";
      var session = store.getConversation(s.id);
      var sessionState = session && session.pendingDecision ? "pending" : (session && session.activeQuestion ? "question" : "");
      var sessionLabel = sessionState === "pending" ? "待批" : "待答";
      return '<button class="sb-map-item' + active + '" data-scene="' + s.id + '" title="' + ui.esc(s.name) + '">' +
        '<img src="' + ui.esc(s.icon) + '" alt="" onerror="this.style.visibility=\'hidden\'" />' +
        '<div class="mtext"><div class="mt">' + ui.esc(s.name) + '</div>' +
        '<div class="mr">' + ui.esc(s.role) + '</div></div>' +
        (sessionState ? '<span class="sb-conv-state ' + sessionState + '" title="' + sessionLabel + '">' + sessionLabel + '</span>' : '') +
        '</button>';
    }).join("");
  }

  function render() {
    var st = store.get();
    var t = st.empressType ? data.EMPRESS_TYPES[st.empressType] : null;
    var p = store.progress();
    var mainPct = p.mainTotal ? Math.round(p.mainDone / p.mainTotal * 100) : 0;
    var subPct = p.subTotal ? Math.round(p.subDone / p.subTotal * 100) : 0;

    sidebar.innerHTML =
      '<button class="sb-toggle" id="sbToggle" title="' + (st.sidebarCollapsed ? "展开侧栏" : "收起侧栏") +
        '" aria-label="' + (st.sidebarCollapsed ? "展开侧栏" : "收起侧栏") + '">' +
        (st.sidebarCollapsed ? "&gt;" : "&lt;") + '</button>' +
      '<div class="sb-inner">' +
        '<div class="sb-avatar">' +
          '<img src="' + ui.esc(t ? t.portrait : data.ASSET_BASE + "人物/女皇1.png") + '" alt="" onerror="this.style.display=\'none\'" />' +
          '<div class="nick">' + ui.esc(st.profile.nickname || "陛下") + '</div>' +
          '<div class="type">' + ui.esc(t ? t.title : "") + '</div>' +
        '</div>' +

        '<div class="sb-section-t">功业进度</div>' +
        '<div class="sb-progress main"><div class="lbl"><span>主线 · 青铜</span><span>' + p.mainDone + '/' + p.mainTotal + '</span></div>' +
          '<div class="bar"><div class="fill" style="width:' + mainPct + '%"></div></div></div>' +
        '<div class="sb-progress sub"><div class="lbl"><span>副线 · 其它</span><span>' + p.subDone + '/' + p.subTotal + '</span></div>' +
          '<div class="bar"><div class="fill" style="width:' + subPct + '%"></div></div></div>' +

        '<div class="sb-section-t">宫廷地图</div>' +
        '<div class="sb-map">' + mapItems() + '</div>' +
      '</div>' +

      '<div class="sb-foot">' +
        '<button class="btn btn-ghost" id="sbDemo">▶ 演示</button>' +
        '<button class="btn btn-ghost" id="sbReset">重置</button>' +
      '</div>';

    bind();
    restoreSidebarScroll();
  }

  function bind() {
    ui.$("#sbToggle").addEventListener("click", function () {
      store.toggleSidebar();
    });
    Array.prototype.forEach.call(sidebar.querySelectorAll(".sb-map-item"), function (btn) {
      btn.addEventListener("click", function () {
        rememberSidebarScroll();
        var id = btn.getAttribute("data-scene");
        App.nav ? App.nav.goScene(id) : store.moveScene(id);
      });
    });
    ui.$("#sbReset").addEventListener("click", function () {
      ui.openModal(
        '<div style="padding:26px 30px;text-align:center">' +
        '<h3 style="font-size:20px;letter-spacing:.1em;margin-bottom:8px">重置江山？</h3>' +
        '<p class="muted" style="margin-bottom:20px">将清空全部进度，重新御前推演。</p>' +
        '<div style="display:flex;gap:10px;justify-content:center">' +
        '<button class="btn" id="rsCancel">再想想</button>' +
        '<button class="btn btn-verm" id="rsOk">确认重置</button></div></div>'
      );
      ui.$("#rsCancel").onclick = ui.closeModal;
      ui.$("#rsOk").onclick = function () { ui.closeModal(); store.reset(); location.reload(); };
    });
    ui.$("#sbDemo").addEventListener("click", function () {
      if (App.demo) App.demo.openMenu();
    });
  }

  function applyCollapse() {
    var body = ui.$("#appBody");
    var st = store.get();
    body.classList.toggle("sb-collapsed", st.sidebarCollapsed);
    sidebar.classList.toggle("sb-collapsed", st.sidebarCollapsed);
  }

  function init() {
    sidebar = ui.$("#sidebar");
    render();
    applyCollapse();
    store.on("change", function () { render(); applyCollapse(); });
    store.on("sidebar", applyCollapse);
    store.on("conversation", function () { render(); applyCollapse(); });
  }

  App.panel = { init: init, render: render };
})();
