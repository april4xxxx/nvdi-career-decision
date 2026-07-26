/* =============================================================
   library.js —— 藏书阁面板：主线任务 / 起居注 / 治国之策(藏书+上传)
   window.App.library
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store, ui = App.ui;

  var panel, tab = "milestone";

  function open() { render(); panel.classList.add("active"); }
  function close() { panel.classList.remove("active"); }

  function render() {
    var sc = data.sceneById("library");
    panel.innerHTML =
      '<div class="panel-head">' +
        '<img class="picon" src="' + ui.esc(sc.icon) + '" alt="" onerror="this.style.display=\'none\'" />' +
        '<div><h2>藏书阁</h2><div class="psub">主线功业 · 起居注 · 治国之策</div></div>' +
        '<div class="spacer"></div>' +
        '<button class="panel-close" id="libClose">×</button>' +
      '</div>' +
      '<div class="lib-tabs" id="libTabs">' +
        tabBtn("milestone", "主线任务") + tabBtn("journal", "起居注") + tabBtn("books", "治国之策") +
      '</div>' +
      '<div class="lib-body" id="libBody"></div>' +
      '<img class="panel-figure lib-figure" src="' + ui.esc(data.ASSET_BASE + "人物/史官.png") + '" alt="史官" onerror="this.style.display=\'none\'" />';
    ui.$("#libClose").onclick = function () { close(); App.nav.goScene("court"); };
    Array.prototype.forEach.call(panel.querySelectorAll(".lib-tab"), function (b) {
      b.addEventListener("click", function () { tab = b.getAttribute("data-t"); render(); });
    });
    renderBody();
    store.readArchive();
  }

  function tabBtn(key, label) {
    return '<button class="lib-tab' + (tab === key ? " active" : "") + '" data-t="' + key + '">' + label + '</button>';
  }

  function renderBody() {
    var el = ui.$("#libBody");
    if (tab === "milestone") el.innerHTML = milestoneHtml();
    else if (tab === "journal") el.innerHTML = journalHtml();
    else { el.innerHTML = booksHtml(); bindBooks(); }
  }

  /* 主线任务时间线（30/60/90 天里程碑） */
  function milestoneHtml() {
    var st = store.get();
    var nodes = data.MILESTONES.map(function (m, i) {
      var a = store.achState(m.achId);
      var done = a.unlocked;
      var reached = st.day >= m.day;
      return '<div class="tl-node' + (done ? " done" : "") + '" style="animation-delay:' + (i * 100) + 'ms">' +
        '<div class="dot"></div>' +
        '<div class="card"><div class="day">登基第 ' + m.day + ' 天 · 里程碑</div>' +
        '<h4>' + ui.esc(m.name) + '</h4>' +
        '<p>' + ui.esc(m.desc) + '</p>' +
        '<div class="status">' + (done
          ? '<span class="seal-mini">已 落 印</span>'
          : reached
            ? '<span class="tag">条件将成 · 进度 ' + a.cur + '/' + a.target + '</span>'
            : '<span class="muted">尚未解锁（当前第 ' + st.day + ' 天）</span>') +
        '</div></div></div>';
    }).join("");
    return '<div class="timeline">' + nodes + '</div>';
  }

  function journalHtml() {
    var st = store.get();
    if (!st.journals.length) return '<div class="empty-hint">起居注尚白，功业待书。</div>';
    return '<div class="journal-feed">' + st.journals.map(function (j, i) {
      return '<div class="jf-item" style="animation-delay:' + (i * 50) + 'ms">' +
        '<div class="d">登基第 ' + j.day + ' 天</div>' +
        '<h4>' + ui.esc(j.title) + '</h4>' +
        '<p>' + ui.esc(j.text) + '</p></div>';
    }).join("") + '</div>';
  }

  function booksHtml() {
    var st = store.get();
    var cards = st.books.map(function (b, i) {
      var isFolk = b.origin === "folk-encounter";
      var title = isFolk ? ("《" + b.title + "》") : b.title;
      // 市井闲谈书：卡面不铺正文（正文在详情弹窗里看），只显示出处标签，避免卡片被长文撑高
      var noteHtml = isFolk
        ? (b.sourceLabel ? '<div class="bn bn-src">' + ui.esc(b.sourceLabel) + '</div>' : '')
        : '<div class="bn">' + ui.esc(b.note || "") + '</div>';
      return '<div class="book-card' + (isFolk ? " folk-book" : "") + '" data-book="' + ui.esc(b.id) + '" style="animation-delay:' + (i * 50) + 'ms">' +
        '<div class="cover">' + (b.cover
          ? '<img src="' + ui.esc(b.cover) + '" alt="" onerror="this.parentNode.textContent=\'📖\'" />'
          : '📖') + '</div>' +
        '<div class="info"><div class="bt">' + ui.esc(title) + '</div>' +
        '<div class="ba">' + ui.esc(b.author || "佚名") + '</div>' +
        noteHtml +
        (isFolk ? '<div class="bk-status folk">市井闲谈</div>' : '') +
        (b.remote ? '<div class="bk-status ready">AI 决策知识已就绪</div>' : '') +
        '</div></div>';
    }).join("");
    var uploadCard = '<div class="book-card upload" id="bookUpload"><div class="plus">+</div><span>上传典籍</span>' +
      '<small class="upload-tip">呈入典籍，大臣议事时会取来参详，让决策更贴合陛下。</small></div>';
    return '<div class="book-toolbar"><h3>治国之策 · 藏书 ' + st.books.length + ' 卷</h3></div>' +
      '<div class="shelf">' + cards + uploadCard + '</div>';
  }

  function bindBooks() {
    var up = ui.$("#bookUpload");
    if (up) up.addEventListener("click", openUpload);
    Array.prototype.forEach.call(panel.querySelectorAll(".book-card[data-book]"), function (c) {
      c.addEventListener("click", function () {
        var b = store.get().books.filter(function (x) { return x.id === c.getAttribute("data-book"); })[0];
        if (b) showBook(b);
      });
    });
  }

  function showBook(b) {
    var isFolk = b.origin === "folk-encounter";
    var tagText = isFolk ? "治国之策 · 市井闲谈" : "治国之策";
    // 标题带书名号；市井闲谈书存储不含《》，此处补上
    var displayTitle = isFolk ? ("《" + b.title + "》") : b.title;
    var srcHtml = "";
    if (isFolk && (b.sourceLabel || b.sourceUrl)) {
      var label = b.sourceLabel || "";
      srcHtml =
        '<div class="bk-source">' +
          '<span class="tag">出处</span> ' +
          (b.sourceUrl
            ? '<a href="' + ui.esc(b.sourceUrl) + '" target="_blank" rel="noopener">' + ui.esc(label || b.sourceUrl) + '</a>'
            : '<span class="muted">' + ui.esc(label) + '</span>') +
        '</div>';
    }
    ui.openModal(
      '<div style="padding:26px 30px">' +
      '<div style="display:flex;gap:16px;align-items:center;margin-bottom:14px">' +
      (b.cover ? '<img src="' + ui.esc(b.cover) + '" style="width:80px;height:110px;object-fit:contain;border-radius:8px;background:var(--paper-3)" onerror="this.style.display=\'none\'"/>' : '') +
      '<div><div class="tag">' + ui.esc(tagText) + '</div><h3 style="font-size:22px;margin:6px 0">' + ui.esc(displayTitle) + '</h3>' +
      '<div class="muted">' + ui.esc(b.author || "佚名") + (b.fileName ? ' · ' + ui.esc(b.fileName) : '') + '</div></div></div>' +
      '<p style="line-height:1.9;color:var(--ink-soft)">' + ui.esc(b.note || b.content || "一部来历不明的典籍，不知从何处得来，内文尚待陛下细读。") + '</p>' +
      srcHtml +
      (b.remote ? '<p class="knowledge-note">此卷已存入藏书阁。往后大臣与陛下议事时，会翻阅其中相关章句，据此进言。</p>' : '') +
      '<div style="text-align:right;margin-top:18px"><button class="btn btn-gold" id="bkClose">合卷</button></div></div>'
    );
    ui.$("#bkClose").onclick = ui.closeModal;
  }

  function openUpload() {
    ui.openModal(
      '<div class="upload-form">' +
      '<h3>藏经纳典 · 上传典籍</h3>' +
      '<label>书名</label><input id="upTitle" maxlength="20" placeholder="如：我的项目复盘" />' +
      '<label>著者</label><input id="upAuthor" maxlength="16" placeholder="陛下亲撰" />' +
      '<label>摘要 / 心得</label><textarea id="upNote" placeholder="记下这份典籍的要旨…"></textarea>' +
      '<label>典籍文件</label>' +
      '<div class="drop-zone"><input type="file" id="upFile" accept=".txt,.md,.pdf,text/plain,text/markdown,application/pdf" />' +
      '<span>支持 TXT、Markdown、PDF，单份不超过 4MB。若不选文件，将把上方心得制成 TXT 典籍。</span></div>' +
      '<div class="upload-status" id="upStatus">服务端只提取文字并立即返回，不长期保存文件；提取结果保存在当前浏览器。</div>' +
      '<div class="actions"><button class="btn" id="upCancel">取消</button>' +
      '<button class="btn btn-gold" id="upOk">呈入藏书阁</button></div></div>'
    );
    ui.$("#upCancel").onclick = ui.closeModal;
    ui.$("#upOk").onclick = async function () {
      var countsForAchievements = !(App.demo && App.demo.active === true);
      var title = ui.$("#upTitle").value.trim() || "无名典籍";
      var author = ui.$("#upAuthor").value.trim() || "陛下亲撰";
      var rawNote = ui.$("#upNote").value.trim();
      var note = rawNote || "陛下新纳之典。";
      var fileInput = ui.$("#upFile");
      var file = fileInput.files && fileInput.files[0];
      var statusEl = ui.$("#upStatus");
      var submit = ui.$("#upOk");
      if (!file && !rawNote) {
        statusEl.className = "upload-status error";
        statusEl.textContent = "请选择文件，或先填写一段可作为知识的心得。";
        return;
      }
      if (!file) {
        var safeName = title.replace(/[\\/:*?\"<>|]/g, "-").slice(0, 40) || "无名典籍";
        file = new File([rawNote], safeName + ".txt", { type: "text/plain;charset=utf-8" });
      }
      submit.disabled = true;
      submit.textContent = "翰林院正在抄录典籍…";
      statusEl.className = "upload-status loading";
      statusEl.textContent = "翰林正誊录卷中文字，以备日后大臣参详，请陛下稍候。";
      try {
        if (!App.api || !App.api.uploadKnowledge) throw new Error("知识库服务未载入");
        var result = await App.api.uploadKnowledge(file, title);
        store.addKnowledgeDocument(result.knowledgeDocument);
        var covers = [data.ASSET_BASE + "物品/书1.png", data.ASSET_BASE + "物品/书2.png", data.ASSET_BASE + "物品/书3.png"];
        store.addBook({
          title: title, author: author, note: note,
          cover: covers[store.get().books.length % 3],
          remote: true, fileName: result.book.fileName, status: result.book.status
        }, { countsForAchievements: countsForAchievements });
        store.addJournal("藏经纳典", "陛下亲纳《" + title + "》入藏书阁。往后大臣议事，便可翻阅此典参详。" );
        ui.closeModal();
        if (tab === "books") renderBody();
      } catch (error) {
        statusEl.className = "upload-status error";
        statusEl.textContent = (error && error.message) || "典籍上传失败，请稍后再试。";
        submit.disabled = false;
        submit.textContent = "重新呈入藏书阁";
      }
    };
  }

  // 打开藏书阁并定位到某本书（收书成功弹窗「前往藏书阁」用）：切到治国之策 tab、高亮该卡
  var pendingHighlightId = null;
  function openToBook(bookId) {
    tab = "books";
    pendingHighlightId = bookId || null;
    open();
    highlightPendingBook();
  }
  function highlightPendingBook() {
    if (!pendingHighlightId) return;
    var card = panel.querySelector('.book-card[data-book="' + (window.CSS && CSS.escape ? CSS.escape(pendingHighlightId) : pendingHighlightId) + '"]');
    if (card) {
      card.classList.add("book-new-highlight");
      card.scrollIntoView({ block: "center", behavior: "smooth" });
      setTimeout(function () { card.classList.remove("book-new-highlight"); }, 2600);
    }
    pendingHighlightId = null;
  }

  function init() {
    panel = ui.$("#libraryPanel");
    store.on("book", function () { if (panel.classList.contains("active") && tab === "books") renderBody(); });
    // 市井闲谈成书 → 若正看治国之策则刷新（书仍在治国之策 tab，无独立 tab，锁定决策 #1）
    store.on("folk-book-collected", function () { if (panel.classList.contains("active") && tab === "books") renderBody(); });
  }

  App.library = { init: init, open: open, close: close, openUpload: openUpload, openToBook: openToBook };
})();
