/* =============================================================
   lingyan.js —— 凌烟阁面板：人物图鉴（五分区 / 关系推测 / 关联待办）
   以全屏面板形式覆盖舞台，仿 treasury.js
   window.App.lingyan
   ============================================================= */
(function () {
  "use strict";
  var App = window.App;
  var data = App.data, store = App.store, ui = App.ui;

  var panel;
  var A = (data.ASSET_BASE || "assets/") + "人物/";

  /* 同僚 / 亲近之人多为 AI 从对话识别，暂无立绘：借市井数字立绘补位（按 id 稳定散列，避免每次换脸）。 */
  var FOLK_PORTRAITS = (data.COMMONERS || [])
    .filter(function (c) { return c.enabled !== false; })
    .map(function (c) { return c.portraitAsset; });
  function fallbackFolkPortrait(seed) {
    if (!FOLK_PORTRAITS.length) return null;
    var h = 0, s = String(seed || "");
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return FOLK_PORTRAITS[h % FOLK_PORTRAITS.length];
  }
  var LOCK = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 0 1 6 0v3H9z"/></svg>';

  /* 关系推测 7 档（PRD §5.2 NPCStance）→ 中文标签 + 语义色变量 */
  var STANCE = {
    ally:     { label: "盟友", cssvar: "--st-ally" },
    friendly: { label: "友好", cssvar: "--st-friendly" },
    neutral:  { label: "中立", cssvar: "--st-neutral" },
    cold:     { label: "冷淡", cssvar: "--st-cold" },
    rival:    { label: "竞争", cssvar: "--st-rival" },
    hostile:  { label: "敌对", cssvar: "--st-hostile" },
    unknown:  { label: "未知", cssvar: "--st-unknown" }
  };

  /* 关联关系 relation（PRD §6.4）→ 中文 */
  var RELATION = {
    owner: "主责", stakeholder: "相关方", approver: "待批准",
    blocker: "阻塞方", recipient: "接收方", mentioned: "提及"
  };

  /* 五大分区（名臣异士置顶） */
  var CATEGORIES = [
    { key: "legend",   label: "名臣异士", note: "偶遇的名臣与神仙" },
    { key: "minister", label: "辅国大臣", note: "随剧情登场的固定辅臣，未遇见者呈未解锁之态" },
    { key: "work",     label: "朝中同僚", note: "工作相关人员" },
    { key: "kin",      label: "亲近之人", note: "非工作相关的亲友" },
    { key: "folk",     label: "市井之人", note: "于市井之间偶遇之人" }
  ];

  /* 名臣异士的展示元数据（立绘 / 关系 / 别号 / 技能图标）——名录本体源自 data.LEGENDS，
     招募态由 store.folkTalk().recruitedLegends 决定，见 legendRoster()。 */
  var LEGEND_META = {
    legend_shangguan_waner:      { aliases: ["巾帼宰相"], stance: "friendly", skillIcon: "coin",  skillTone: "gold" },
    legend_silver_chrysanthemum: { aliases: ["菊隐仙子"], stance: "ally",     skillIcon: "energy", skillTone: "jade" },
    legend_rabbit_spirit:        { aliases: ["月宫捣药兔"], stance: "friendly", skillIcon: "luck",  skillTone: "verm" },
    legend_diviner:              { aliases: ["观星人"],   stance: "neutral",  skillIcon: "time",  skillTone: "gold" }
  };

  /* 辅国大臣（随剧情登场的固定辅臣，立绘皆已录入；PRD §19.3：仅保留唯一 legend 卦师，
     此处不再有 minister 版卦师重复项，但保留观星师·钦天监正） */
  var DEMO_NPCS = [
    { cat: "minister", displayName: "史官", title: "起居舍人", aliases: ["太史令"],
      portrait: { assetId: "史官.png" }, relationship: { stance: "friendly" },
      interaction: { title: "录陛下今日临朝之决断", relation: "recipient" } },
    { cat: "minister", displayName: "直臣", title: "谏议大夫", aliases: ["魏征"],
      portrait: { assetId: "直臣.png" }, relationship: { stance: "ally" },
      interaction: { title: "直谏本周最该推进的一桩要务", relation: "owner" } },
    { cat: "minister", displayName: "顺臣", title: "随侍中官",
      portrait: { assetId: "顺臣.png" }, relationship: { stance: "friendly" },
      interaction: { title: "为陛下打理六部日常庶务", relation: "owner" } },
    { cat: "minister", displayName: "观星师", title: "钦天监正", aliases: ["观星人"],
      portrait: { assetId: "观星师.png" }, relationship: { stance: "neutral" },
      interaction: { title: "夜观天象，卜今日宜行之事", relation: "mentioned" } },
    { cat: "minister", displayName: "翰林", title: "翰林学士",
      portrait: { assetId: "翰林.png" }, relationship: { stance: "friendly" },
      interaction: { title: "于藏书阁伴陛下论道典籍", relation: "stakeholder" } },
    { cat: "minister", displayName: "宫女", title: "侍奉尚宫", aliases: ["侍女"],
      portrait: { assetId: "宫女.png" }, relationship: { stance: "friendly" },
      interaction: { title: "起居殿中为陛下理清烦心事", relation: "recipient" } },

    /* ===== 朝中同僚 / 亲近之人：默认空态。
       真实人物由 AI 从对话中识别后经 store.npcs 录入，见 liveNpcs()。 ===== */
  ];

  /* 空态分区：尚无真实人物时给出「陛下所提及之人，会被记录在案」的占位。 */
  var EMPTY_STATE = {
    work: { icon: "💬", line: "陛下于议事间所提及的同僚，会被一一记录在案。" },
    kin:  { icon: "🏮", line: "陛下于议事间所提及的亲近之人，会被一一记录在案。" }
  };

  function open() { render(); panel.classList.add("active"); }
  function close() { panel.classList.remove("active"); }

  function stanceBadge(st) {
    var s = STANCE[st] || STANCE.unknown;
    return '<span class="pc-stance"><i></i>' + s.label + '</span>';
  }

  function todoBtn(it) {
    if (!it) return '<div class="pc-todo empty"><div class="pt-lbl">暂无关联待办</div></div>';
    var rel = RELATION[it.relation] || "";
    return '<button class="pc-todo">' +
      '<div class="pt-lbl">关联待办' + (rel ? ' · ' + rel : "") +
        '<span class="arw">›</span></div>' +
      '<div class="pt-tt">' + ui.esc(it.title) + '</div>' +
    '</button>';
  }

  /* 名臣异士的增益技能块（替代关联待办条） */
  var SKILL_ICON = {
    coin:   '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 3.6v12.8M8.4 8.6h5.6M8.4 12h7.2" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
    energy: '<path d="M13.5 2 5 13.2h5.2L9.2 22 19 9.6h-5.6z" fill="currentColor"/>',
    luck:   '<path d="M12 21s-7-4.4-9.2-9C1.3 8.6 3 5 6.4 5c2 0 3.2 1.1 3.9 2.2h.9C11.9 6.1 13.1 5 15.1 5c3.4 0 5.1 3.6 3.6 7-2.2 4.6-6.7 9-6.7 9z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>',
    time:   '<path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
  };
  function skillBlock(sk) {
    var path = SKILL_ICON[sk.icon] || SKILL_ICON.luck;
    return '<div class="pc-skill tone-' + (sk.tone || "gold") + '">' +
      '<div class="ps-hd">' +
        '<svg class="ps-ic" viewBox="0 0 24 24" aria-hidden="true">' + path + '</svg>' +
        '<span class="ps-nm">' + ui.esc(sk.name) + '</span>' +
        '<span class="ps-tag">技能</span></div>' +
      '<div class="ps-desc">' + ui.esc(sk.desc) + '</div>' +
    '</div>';
  }

  function liveNpcs() {
    var st = store.get();
    var interactions = Array.isArray(st.npcInteractions) ? st.npcInteractions : [];
    var links = Array.isArray(st.npcTaskCardLinks) ? st.npcTaskCardLinks : [];
    return (Array.isArray(st.npcs) ? st.npcs : []).map(function (npc) {
      var relatedLinks = links.filter(function (link) { return link.npcId === npc.id; });
      var latestLink = relatedLinks.length ? relatedLinks[relatedLinks.length - 1] : null;
      var interaction = latestLink
        ? interactions.filter(function (item) { return item.id === latestLink.interactionId; })[0]
        : null;
      return Object.assign({}, npc, {
        cat: npc.cat || "work",
        interaction: interaction ? { title: interaction.title, relation: latestLink.relation } : null
      });
    });
  }

  /* 名臣异士名录：全员登记，未招募者呈 locked 之态，已招募者显真身 + 增益技能。
     招募态源自 store.folkTalk().recruitedLegends（PRD §19.3 唯一 legend 卦师）。 */
  function legendRoster() {
    var ft = store.folkTalk ? store.folkTalk() : {};
    var recruited = (ft && ft.recruitedLegends) || {};
    return (data.LEGENDS || []).filter(function (l) { return l.enabled !== false; }).map(function (l) {
      var meta = LEGEND_META[l.id] || {};
      var asset = (l.portraitAsset || "").replace(/^人物\//, "");
      if (!recruited[l.id]) {
        return { cat: "legend", locked: true, portrait: { assetId: asset }, title: l.title,
          cond: "前往民间，于市井偶遇名臣并招募后解锁" };
      }
      return {
        cat: "legend", displayName: l.displayName, title: l.title, aliases: meta.aliases || [],
        portrait: { assetId: asset }, relationship: { stance: meta.stance || "friendly" },
        skill: { name: l.buff.name, icon: meta.skillIcon || "luck", tone: meta.skillTone || "gold",
          desc: l.buff.description }
      };
    });
  }

  /* 市井名录：全员登记，未偶遇者呈 locked 之态，已偶遇者显真身。
     名录源自 data.COMMONERS，偶遇态由 store.folkTalk().unlockedCommoners 决定。 */
  function folkRoster() {
    var ft = store.folkTalk ? store.folkTalk() : {};
    var unlocked = (ft && ft.unlockedCommoners) || {};
    return (data.COMMONERS || []).filter(function (c) { return c.enabled !== false; }).map(function (c) {
      // 市井立绘位于 人物/ 目录（市井N.png），portraitPath 前缀已含「人物/」
      var portrait = { assetId: c.portraitAsset };
      if (unlocked[c.id]) {
        return { cat: "folk", displayName: c.displayName, title: "市井来客",
          portrait: portrait, relationship: { stance: "neutral" } };
      }
      return { cat: "folk", locked: true, portrait: portrait, cond: "前往民间，于市井偶遇后解锁" };
    });
  }

  function rosterNpcs() {
    var live = liveNpcs();
    return legendRoster().concat(DEMO_NPCS).concat(folkRoster()).concat(live);
  }

  function cardHtml(n) {
    var img = n.portrait && n.portrait.imageUrl
      ? n.portrait.imageUrl
      : (n.portrait && n.portrait.assetId ? A + n.portrait.assetId : "");
    // 同僚 / 亲近之人无立绘时，借市井立绘补位（其余分区仍走「立绘待补」占位）
    if (!img && (n.cat === "work" || n.cat === "kin")) {
      var fb = fallbackFolkPortrait(n.id || n.displayName);
      if (fb) img = A + fb;
    }
    var art = img
      ? '<img src="' + ui.esc(img) + '" alt="" onerror="this.style.visibility=\'hidden\'" />'
      : '<div class="pc-art-empty"><span>立绘待补</span></div>';

    // 未解锁 / 未遇见
    if (n.locked) {
      return '<div class="pc locked">' +
        '<div class="pc-art">' + art + '<div class="pc-lock">' + LOCK + '</div></div>' +
        '<div class="pc-info"><div class="pc-name">？ ？ ？</div>' +
          (n.title ? '<div class="pc-title">' + ui.esc(n.title) + '</div>' : "") + '</div>' +
        '<div class="pc-cond">' + ui.esc(n.cond || "尚未遇见") + '</div>' +
      '</div>';
    }

    var st = n.relationship ? n.relationship.stance : "unknown";
    var stVar = (STANCE[st] || STANCE.unknown).cssvar;
    var ambiguous = n.identityStatus === "ambiguous";
    var alias = (n.aliases && n.aliases.length) ? '<div class="pc-alias">又称 ' + ui.esc(n.aliases.join(" / ")) + '</div>' : "";

    return '<div class="pc' + (ambiguous ? " ambiguous" : "") + '" style="--stance:var(' + stVar + ')">' +
      '<div class="pc-art">' +
        (ambiguous ? '<span class="pc-ask">? 待确认</span>' : "") +
        stanceBadge(st) +
        art +
      '</div>' +
      '<div class="pc-info">' +
        '<div class="pc-name">' + ui.esc(n.displayName) + '</div>' +
        (n.title ? '<div class="pc-title">' + ui.esc(n.title) + '</div>' : "") +
        alias +
      '</div>' +
      (n.skill ? skillBlock(n.skill) : todoBtn(n.interaction)) +
    '</div>';
  }

  function render() {
    var npcs = rosterNpcs();
    var total = npcs.filter(function (n) { return !n.locked; }).length;

    var legend = Object.keys(STANCE).map(function (k) {
      var s = STANCE[k];
      return '<span class="lg"><i style="background:var(' + s.cssvar + ')"></i>' + s.label + '</span>';
    }).join("");

    var body = CATEGORIES.map(function (c) {
      var list = npcs.filter(function (n) { return n.cat === c.key; });
      var met = list.filter(function (n) { return !n.locked; }).length;
      // 同僚 / 亲近之人：尚无真实人物时给出「所提及之人，会被记录在案」的空态。
      if (!list.length && EMPTY_STATE[c.key]) {
        var es = EMPTY_STATE[c.key];
        return '<div class="ly-sec"><span class="st">' + c.label + '</span>' +
            '<span class="sn">' + c.note + '</span>' +
            '<span class="sc">尚无</span></div>' +
          '<div class="ly-empty"><span class="lye-ic" aria-hidden="true">' + es.icon + '</span>' +
            '<span class="lye-line">' + es.line + '</span></div>';
      }
      if (!list.length) return "";
      return '<div class="ly-sec"><span class="st">' + c.label + '</span>' +
          '<span class="sn">' + c.note + '</span>' +
          '<span class="sc">已遇 ' + met + ' / ' + list.length + '</span></div>' +
        '<div class="ly-grid">' + list.map(cardHtml).join("") + '</div>';
    }).join("");

    panel.innerHTML =
      '<div class="panel-head">' +
        '<img class="picon" src="' + ui.esc((data.ASSET_BASE || "assets/") + "svg图标/六部.svg") + '" alt="" onerror="this.style.display=\'none\'" />' +
        '<div><h2>凌烟阁</h2><div class="psub">群臣关系与待办关联 · 已录 ' + total + ' 人</div></div>' +
        '<div class="spacer"></div>' +
        '<button class="panel-close" id="lyClose">×</button>' +
      '</div>' +
      '<div class="ly-legend">' + legend + '</div>' +
      '<div class="ly-body">' + body + '</div>';

    ui.$("#lyClose").onclick = function () { close(); App.nav.goScene("court"); };
  }

  function init() {
    panel = ui.$("#lingyanPanel");
    function refreshIfOpen() { if (panel && panel.classList.contains("active")) render(); }
    store.on("npc", refreshIfOpen);
    // 市井偶遇解锁市井之人 / 招募名臣 → 若图鉴打开则刷新名录
    store.on("commoner-unlocked", refreshIfOpen);
    store.on("legend-recruited", refreshIfOpen);
  }

  App.lingyan = { init: init, open: open, close: close };
})();
