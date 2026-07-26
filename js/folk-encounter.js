/* =============================================================
   folk-encounter.js —— 市井偶遇界面（PRD 09 §5/§7/§8/§9）
   进入民间「有效进入」后，store 已生成 activeEncounter；本模块只负责：
     - 标记展示(markEncounterDisplayed) 并把偶遇卡渲染进 #folkStage
     - 市井卡 / 名臣卡两种形态、按钮态
     - 收书成功弹窗 / 招募成功弹窗（ui.openModal）
   不做抽取、不解析 Markdown、不请求 AI。
   window.App.folkEncounter
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store, ui = App.ui;
  var hostEl;

  function host() {
    if (!hostEl) hostEl = ui.$("#folkStage");
    return hostEl;
  }
  function portraitPath(asset) {
    // 市井立绘存纯文件名（市井N.png）；名臣立绘存「人物/兔子精.png」已含前缀，需剥掉避免重复
    var name = (asset || "").replace(/^人物\//, "");
    return (data.ASSET_BASE || "assets/") + "人物/" + name;
  }
  function contentById(id) {
    return (data.FOLK_CONTENT || []).filter(function (c) { return c.id === id; })[0] || null;
  }
  function commonerById(id) {
    return (data.COMMONERS || []).filter(function (c) { return c.id === id; })[0] || null;
  }
  function legendById(id) {
    return (data.LEGENDS || []).filter(function (l) { return l.id === id; })[0] || null;
  }

  function render() {
    var h = host();
    if (!h) return;
    var ft = store.folkTalk ? store.folkTalk() : null;
    var enc = ft && ft.activeEncounter;
    if (!enc) {
      // 无偶遇（异常兜底）：留空，不阻塞任务区
      h.innerHTML = "";
      h.style.display = "none";
      return;
    }
    // 素材就绪后再展示（§5.2）：标记展示，写入 seen/recent、解锁 commoner
    store.markEncounterDisplayed(enc.encounterId);
    h.style.display = "";
    if (enc.actorType === "legend") renderLegendCard(h, enc);
    else renderCommonerCard(h, enc);
  }

  /* ---------- 市井卡（§7） ---------- */
  function renderCommonerCard(h, enc) {
    var actor = commonerById(enc.actorId) ||
      { id: "commoner_001", displayName: "市井来客", title: "", portraitAsset: "市井1.png" };
    var content = contentById(enc.contentId);
    var kind = content ? content.kind : "praise";
    var text = content ? content.text : "陛下今日气色甚佳。";
    var src = content && content.source;
    var collectible = !!src;                       // 夸赞 source:null → 只听不成书
    var collected = enc.bookCollected;
    var img = portraitPath(actor.portraitAsset);

    var srcHtml = "";
    if (src) {
      var label = src.author ? (src.author + (src.year ? "（" + src.year + "）" : "")) : "";
      var titleLine = "《" + src.bookTitle + "》" + (label ? " · " + label : "");
      srcHtml =
        '<div class="fe-source">' +
          '<span class="fe-src-tag">出处</span>' +
          (src.url
            ? '<a class="fe-src-link" href="' + ui.esc(src.url) + '" target="_blank" rel="noopener">' + ui.esc(titleLine) + '</a>'
            : '<span class="fe-src-text">' + ui.esc(titleLine) + '</span>') +
        '</div>';
    }

    var btns = "";
    if (collectible) {
      btns += collected
        ? '<button class="btn btn-ghost" id="feCollect" disabled>已收入藏书阁</button>'
        : '<button class="btn btn-gold" id="feCollect">收入藏书阁</button>';
    }
    btns += '<button class="btn btn-ghost" id="feClose">继续逛逛</button>';

    h.innerHTML =
      '<img class="fe-portrait" src="' + ui.esc(img) + '" alt="" onerror="this.style.display=\'none\'" />' +
      '<div class="fe-card fe-commoner">' +
        '<div class="fe-body">' +
          '<div class="fe-top"><span class="fe-kicker">市 井 闲 谈</span>' +
            (enc.isFirstMeetCommoner ? '<span class="fe-new">新面孔 · 已录入凌烟阁</span>' : '') +
          '</div>' +
          '<h3 class="fe-name">' + ui.esc(actor.displayName) +
            (actor.title ? '<span class="fe-title">' + ui.esc(actor.title) + '</span>' : '') + '</h3>' +
          '<blockquote class="fe-text fe-kind-' + ui.esc(kind) + '">' + ui.esc(text) + '</blockquote>' +
          srcHtml +
          '<div class="fe-btns">' + btns + '</div>' +
        '</div>' +
      '</div>';

    var collectBtn = ui.$("#feCollect");
    if (collectBtn && collectible && !collected) collectBtn.onclick = function () {
      var res = store.collectFolkSource(enc.encounterId, enc.contentId, src.sourceKey);
      if (res && res.status === "collected") showCollectSuccess(res.book);
      render(); // 就地重渲，按钮变「已收入藏书阁」
    };
    var closeBtn = ui.$("#feClose");
    if (closeBtn) closeBtn.onclick = closeEncounter;
  }

  /* ---------- 名臣卡（§9.1） ---------- */
  function renderLegendCard(h, enc) {
    var legend = legendById(enc.legendId || enc.actorId);
    if (!legend) { renderCommonerCard(h, enc); return; }
    var content = contentById(enc.contentId);
    var text = content ? content.text : "陛下今日气度非凡。";
    var recruited = enc.recruited || (store.folkTalk().recruitedLegends[legend.id]);
    var img = portraitPath(legend.portraitAsset);
    var buff = legend.buff || {};

    var btns = recruited
      ? '<button class="btn btn-ghost" id="feRecruited" disabled>已在麾下</button>' +
        '<button class="btn btn-ghost" id="feRoster">查看凌烟阁</button>'
      : '<button class="btn btn-gold" id="feRecruit">收入麾下</button>' +
        '<button class="btn btn-ghost" id="feClose">暂且别过</button>';

    h.innerHTML =
      '<img class="fe-portrait fe-portrait-legend" src="' + ui.esc(img) + '" alt="" onerror="this.style.display=\'none\'" />' +
      '<div class="fe-card fe-legend">' +
        '<div class="fe-body">' +
          '<div class="fe-top"><span class="fe-kicker fe-kicker-legend">名 臣 异 士</span></div>' +
          '<h3 class="fe-name">' + ui.esc(legend.displayName) +
            (legend.title ? '<span class="fe-title">' + ui.esc(legend.title) + '</span>' : '') + '</h3>' +
          '<blockquote class="fe-text fe-kind-praise">' + ui.esc(text) + '</blockquote>' +
          '<div class="fe-skill">' +
            '<span class="fe-skill-tag">技能</span>' +
            '<span class="fe-skill-name">' + ui.esc(buff.name || "") + '</span>' +
            '<span class="fe-skill-desc">' + ui.esc(buff.description || "") + '</span>' +
          '</div>' +
          '<div class="fe-btns">' + btns + '</div>' +
        '</div>' +
      '</div>';

    var recruitBtn = ui.$("#feRecruit");
    if (recruitBtn && !recruited) recruitBtn.onclick = function () {
      var res = store.recruitLegend(enc.encounterId, legend.id);
      if (res && res.status === "recruited") showRecruitSuccess(legend, res.buff);
      else if (res && res.status === "error") { /* 已回滚，保留偶遇可重试 */ }
      render();
    };
    var rosterBtn = ui.$("#feRoster");
    if (rosterBtn) rosterBtn.onclick = function () { App.nav.goScene("lingyan"); };
    var closeBtn = ui.$("#feClose");
    if (closeBtn) closeBtn.onclick = closeEncounter;
  }

  function closeEncounter() {
    var ft = store.folkTalk();
    var enc = ft.activeEncounter;
    if (enc) store.closeFolkEncounter(enc.encounterId);
    var h = host();
    if (h) {
      h.innerHTML =
        '<div class="fe-card fe-empty">' +
          '<div class="fe-kicker">市 井 之 间</div>' +
          '<p class="fe-empty-line">陛下信步于市井之间。再度踏入民间，又会遇见新的人与事。</p>' +
          '<div class="fe-btns"><button class="btn btn-ghost" id="feRosterEmpty">前往凌烟阁</button></div>' +
        '</div>';
      var r = ui.$("#feRosterEmpty"); if (r) r.onclick = function () { App.nav.goScene("lingyan"); };
    }
  }

  /* ---------- 收书成功弹窗（§8.5） ---------- */
  function showCollectSuccess(book) {
    var title = book && book.title ? book.title : "闲谈";
    ui.openModal(
      '<div class="fe-modal">' +
        '<h3 class="fe-modal-title">已收入藏书阁</h3>' +
        '<p class="fe-modal-body">《' + ui.esc(title) + '》已加入【市井闲谈】。</p>' +
        '<div class="fe-modal-btns">' +
          '<button class="btn btn-gold" id="feGoLibrary">前往藏书阁</button>' +
          '<button class="btn btn-ghost" id="feStay">继续听听</button>' +
        '</div>' +
      '</div>', "fe-success");
    ui.$("#feStay").onclick = ui.closeModal;
    ui.$("#feGoLibrary").onclick = function () {
      ui.closeModal();
      if (App.library && App.library.openToBook) App.library.openToBook(book && book.id);
      else App.nav.goScene("library");
    };
  }

  /* ---------- 招募成功弹窗（§9.4，仅首次成功） ---------- */
  function showRecruitSuccess(legend, buff) {
    ui.openModal(
      '<div class="fe-modal">' +
        '<h3 class="fe-modal-title">名臣入阁</h3>' +
        '<p class="fe-modal-body">' + ui.esc(legend.displayName) + '已收入麾下</p>' +
        '<div class="fe-modal-skill">' +
          '<div class="fe-modal-skill-head">加成已生效：' + ui.esc(buff.name || "") + '</div>' +
          '<div class="fe-modal-skill-desc">' + ui.esc(buff.description || "") + '</div>' +
        '</div>' +
        '<div class="fe-modal-btns">' +
          '<button class="btn btn-gold" id="feGoRoster">查看凌烟阁</button>' +
          '<button class="btn btn-ghost" id="feKeepWalking">继续逛逛</button>' +
        '</div>' +
      '</div>', "fe-success");
    ui.$("#feKeepWalking").onclick = ui.closeModal;
    ui.$("#feGoRoster").onclick = function () { ui.closeModal(); App.nav.goScene("lingyan"); };
  }

  App.folkEncounter = { render: render };
})();
