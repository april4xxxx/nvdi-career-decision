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

  /* 演示数据：每条 NPCProfile 内嵌一条代表性 interaction（关联待办）。
     当前凌烟阁只展示演示状态；后续接真实数据时替换为 store.get().npcs。 */
  var DEMO_NPCS = [
    /* ===== 名臣异士（偶遇即赐一门增益技能；立绘部分暂借现有素材，待补专属图） ===== */
    { cat: "legend", displayName: "上官婉儿", title: "掌诏才女", aliases: ["巾帼宰相"],
      portrait: { assetId: "翰林.png" }, relationship: { stance: "friendly" },
      skill: { name: "金笔生花", icon: "coin", tone: "gold",
        desc: "呈报任务时，金币赏赐翻倍。" } },
    { cat: "legend", displayName: "银叶菊仙", title: "疗愈花仙", aliases: ["菊隐仙子"],
      portrait: { assetId: "宫女.png" }, relationship: { stance: "ally" },
      skill: { name: "银叶轻覆", icon: "energy", tone: "jade",
        desc: "办结任务所耗精力减半，四舍五入。" } },
    { cat: "legend", displayName: "兔子精", title: "玉兔机敏", aliases: ["月宫捣药兔"],
      portrait: { assetId: "顺臣.png" }, relationship: { stance: "friendly" },
      skill: { name: "福缘广结", icon: "luck", tone: "verm",
        desc: "此后偶遇名臣异士的概率显著提升。" } },
    { cat: "legend", displayName: "卦师", title: "钦天监正", aliases: ["观星人"],
      portrait: { assetId: "卦师.png" }, relationship: { stance: "neutral" },
      skill: { name: "观星改命", icon: "time", tone: "gold",
        desc: "每日天象签可额外免费重抽一次。" } },

    /* ===== 辅国大臣（固定 NPC，未遇见 → locked） ===== */
    { cat: "minister", displayName: "直臣", title: "谏议大夫", aliases: ["魏征"],
      portrait: { assetId: "直臣.png" }, relationship: { stance: "ally" },
      interaction: { title: "直谏本周最该推进的一桩要务", relation: "owner" } },
    { cat: "minister", displayName: "卦师", title: "钦天监正",
      portrait: { assetId: "卦师.png" }, relationship: { stance: "neutral" },
      interaction: { title: "占卜今日宜行之事", relation: "mentioned" } },
    { cat: "minister", displayName: "翰林", title: "翰林学士", locked: true,
      portrait: { assetId: "翰林.png" }, cond: "于藏书阁与之论道后解锁" },
    { cat: "minister", displayName: "顺臣", title: "随侍中官", locked: true,
      portrait: { assetId: "顺臣.png" }, cond: "朝堂之上初次面圣后解锁" },

    /* ===== 朝中同僚（工作相关人员） ===== */
    { cat: "work", displayName: "Alice", title: "产品经理", aliases: ["产品 Alice"],
      identityStatus: "auto_created", portrait: { assetId: "卦师.png" }, relationship: { stance: "rival" },
      interaction: { title: "给 Alice 发送需求边界确认", relation: "recipient" } },
    { cat: "work", displayName: "李组长", title: "直属上级", aliases: ["组长", "老李"],
      portrait: { assetId: "直臣.png" }, relationship: { stance: "neutral" },
      interaction: { title: "周一晨会同步项目风险与排期", relation: "approver" } },
    { cat: "work", displayName: "王姐", title: "同组同事",
      portrait: { assetId: "顺臣.png" }, relationship: { stance: "ally" },
      interaction: { title: "与王姐对齐接口联调时间", relation: "stakeholder" } },
    { cat: "work", displayName: "陈总", title: "合作方负责人", aliases: ["甲方陈总"],
      portrait: { assetId: "史官.png" }, relationship: { stance: "cold" },
      interaction: { title: "回复陈总关于交付延期的邮件", relation: "blocker" } },

    /* ===== 市井之人（市井偶遇） ===== */
    { cat: "folk", displayName: "茶摊老张", title: "街角茶摊主",
      portrait: { assetId: "顺臣.png" }, relationship: { stance: "friendly" },
      interaction: { title: "路过时向老张打听近日行情", relation: "mentioned" } },
    { cat: "folk", displayName: "“隔壁组 PM”", title: "", identityStatus: "ambiguous",
      portrait: { assetId: "史官.png" }, relationship: { stance: "unknown" },
      interaction: { title: "确认这是否为之前提到的 Alice", relation: "mentioned" } }
  ];

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

  function rosterNpcs() {
    var live = liveNpcs();
    var liveNames = live.map(function (npc) { return String(npc.displayName || "").toLowerCase().replace(/\s+/g, ""); });
    var demos = DEMO_NPCS.filter(function (npc) {
      if (npc.cat !== "work") return true;
      return liveNames.indexOf(String(npc.displayName || "").toLowerCase().replace(/\s+/g, "")) < 0;
    });
    return demos.concat(live);
  }

  function cardHtml(n) {
    var img = n.portrait && n.portrait.imageUrl
      ? n.portrait.imageUrl
      : (n.portrait && n.portrait.assetId ? A + n.portrait.assetId : "");
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
      if (!list.length) return "";
      var met = list.filter(function (n) { return !n.locked; }).length;
      return '<div class="ly-sec"><span class="st">' + c.label + '</span>' +
          '<span class="sn">' + c.note + '</span>' +
          '<span class="sc">已遇 ' + met + ' / ' + list.length + '</span></div>' +
        '<div class="ly-grid">' + list.map(cardHtml).join("") + '</div>';
    }).join("");

    panel.innerHTML =
      '<div class="panel-head">' +
        '<img class="picon" src="' + ui.esc((data.ASSET_BASE || "assets/") + "svg图标/六部.svg") + '" alt="" onerror="this.style.display=\'none\'" />' +
        '<div><h2>凌烟阁</h2><div class="psub">演示数据 · 群臣关系与待办关联 · 已录 ' + total + ' 人</div></div>' +
        '<div class="spacer"></div>' +
        '<button class="panel-close" id="lyClose">×</button>' +
      '</div>' +
      '<div class="ly-legend">' + legend + '</div>' +
      '<div class="ly-body">' + body + '</div>';

    ui.$("#lyClose").onclick = function () { close(); App.nav.goScene("court"); };
  }

  function init() {
    panel = ui.$("#lingyanPanel");
    store.on("npc", function () {
      if (panel && panel.classList.contains("active")) render();
    });
  }

  App.lingyan = { init: init, open: open, close: close };
})();
