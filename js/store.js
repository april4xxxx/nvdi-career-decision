/* =============================================================
   store.js —— 全局状态 / 事件总线 / 领域动作
   window.App.store
   状态持久化于 localStorage(STORAGE_KEY)
   模块订阅 'change' 事件重渲染；细粒度事件用于弹窗/动画。
   ============================================================= */
(function () {
  "use strict";
  window.App = window.App || {};
  var data = window.App.data;
  var STORAGE_KEY = "nvdi-full-v1";
  var STATE_VERSION = 11;
  var ENERGY_CAP = 150;
  var DAILY_ENERGY_GAIN = 30;
  var MAX_DAILY_COUNTED_RESTORE = 60;

  function achievementTrackingEnabled() {
    return !(window.App.demo && window.App.demo.active === true);
  }

  function taskCountsForAchievements(task) {
    var sourceKind = String((task && task.sourceKind) || "");
    return achievementTrackingEnabled() && !/^demo(?:-|$)/.test(sourceKind);
  }

  /* ---------- 事件总线 ---------- */
  var listeners = {};
  function on(evt, fn) {
    (listeners[evt] = listeners[evt] || []).push(fn);
    return function () { off(evt, fn); };
  }
  function off(evt, fn) {
    if (!listeners[evt]) return;
    listeners[evt] = listeners[evt].filter(function (f) { return f !== fn; });
  }
  function emit(evt, payload) {
    (listeners[evt] || []).forEach(function (fn) {
      try { fn(payload); } catch (e) { console.error("[store] listener error", evt, e); }
    });
  }

  /* ---------- 初始状态 ---------- */
  function freshAchMap() {
    var m = {};
    data.ACHIEVEMENTS.forEach(function (a) {
      m[a.id] = {
        unlocked: a.unlocked,
        cur: a.cur,
        date: a.date,
        unlockedAt: null,
        rewardGranted: false,
        rewardGrantedAt: null
      };
    });
    return m;
  }

  function pad2(value) { return String(value).padStart(2, "0"); }
  function localDayKey(value) {
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    var date = value ? new Date(value) : new Date();
    if (isNaN(date.getTime())) date = new Date();
    return date.getFullYear() + "-" + pad2(date.getMonth() + 1) + "-" + pad2(date.getDate());
  }
  function dayOrdinal(key) {
    var parts = String(key).split("-").map(Number);
    return Math.floor(Date.UTC(parts[0], parts[1] - 1, parts[2]) / 86400000);
  }
  function shiftDayKey(key, by) {
    var date = new Date((dayOrdinal(key) + by) * 86400000);
    return date.getUTCFullYear() + "-" + pad2(date.getUTCMonth() + 1) + "-" + pad2(date.getUTCDate());
  }
  function freshDailyStats(energy) {
    return {
      startEnergy: energy,
      minEnergy: energy,
      maxEnergy: energy,
      endEnergy: energy,
      passiveRestored: 0,
      actualRestored: 0,
      achievementRestored: 0,
      goldEarned: 0,
      productiveTasks: 0,
      recoveryEvents: 0,
      overdrawn: false,
      calibrated: false
    };
  }

  function freshFolkTalk() {
    return {
      visitSequence: 0,
      activeEncounter: null,
      history: [],
      seenContentIds: [],
      recentContentIds: [],
      unlockedCommoners: {},
      recruitedLegends: {},
      activeBuffs: {},
      actionLedger: {}
    };
  }

  function legacyCommonerId(value) {
    var exact = (data.COMMONERS || []).filter(function (item) { return item.id === value; })[0];
    if (exact) return exact.id;
    var match = String(value || "").match(/(\d{1,3})$/);
    if (!match) return null;
    var id = "commoner_" + String(Number(match[1])).padStart(3, "0");
    return (data.COMMONERS || []).some(function (item) { return item.id === id; }) ? id : null;
  }

  function normalizeFolkTalk(saved, legacy, oldVersion) {
    var base = freshFolkTalk();
    var source = saved && typeof saved === "object" ? saved : {};
    var talk = Object.assign(base, source);
    talk.visitSequence = Math.max(0, Number(talk.visitSequence) || 0);
    talk.activeEncounter = talk.activeEncounter && typeof talk.activeEncounter === "object" ? talk.activeEncounter : null;
    talk.history = Array.isArray(talk.history) ? talk.history.slice(0, 200) : [];
    talk.seenContentIds = Array.isArray(talk.seenContentIds) ? talk.seenContentIds.slice(-500) : [];
    talk.recentContentIds = Array.isArray(talk.recentContentIds) ? talk.recentContentIds.slice(-5) : [];
    talk.unlockedCommoners = talk.unlockedCommoners && typeof talk.unlockedCommoners === "object" ? talk.unlockedCommoners : {};
    talk.recruitedLegends = talk.recruitedLegends && typeof talk.recruitedLegends === "object" ? talk.recruitedLegends : {};
    talk.activeBuffs = talk.activeBuffs && typeof talk.activeBuffs === "object" ? talk.activeBuffs : {};
    talk.actionLedger = talk.actionLedger && typeof talk.actionLedger === "object" ? talk.actionLedger : {};

    // V10 及更早版本的市井角色只有 id 数组；能对应的角色保留已遇见状态。
    if (oldVersion < 11 && legacy && Array.isArray(legacy.folkMet)) {
      legacy.folkMet.forEach(function (oldId) {
        var id = legacyCommonerId(oldId);
        if (!id || talk.unlockedCommoners[id]) return;
        talk.unlockedCommoners[id] = {
          encounterCount: 1,
          firstEncounteredAt: new Date().toISOString(),
          lastEncounteredAt: new Date().toISOString(),
          migrated: true
        };
      });
    }
    return talk;
  }

  function normalizeBooks(savedBooks) {
    return (Array.isArray(savedBooks) ? savedBooks : []).map(function (book, index) {
      var normalized = Object.assign({}, book);
      if (!normalized.shelf) normalized.shelf = normalized.folk ? "folk-talk" : "strategy";
      if (normalized.shelf === "folk-talk") {
        normalized.origin = normalized.origin || "folk-encounter";
        normalized.sourceKey = normalized.sourceKey || ("legacy:folk:" + (normalized.id || index));
        normalized.useInDecision = false;
        normalized.collectedAt = normalized.collectedAt || normalized.createdAt || new Date().toISOString();
      } else {
        normalized.origin = normalized.origin || (normalized.upload || normalized.uploadedAt || normalized.remote ? "upload" : "seed");
        if (normalized.useInDecision == null) normalized.useInDecision = true;
      }
      return normalized;
    });
  }

  function initialState() {
    return {
      version: STATE_VERSION,
      onboarded: false,
      startedAt: null,        // 由 UI 层填入时间字符串
      day: 1,
      profile: { nickname: "陛下", answers: [], preferredMinister: null },
      empressType: null,      // 铁腕/仁厚/谋略/革新
      energy: 100,
      energyCap: ENERGY_CAP,
      totalRestored: 0,
      totalActualRestored: 0,
      totalCountedRestored: 0,
      gold: 0,
      totalGold: 0,
      titles: [],
      settlementLedger: {},
      settlementSequence: 0,
      dayKey: localDayKey(),
      dailyStats: {},
      dailyMystic: {
        dayKey: localDayKey(), status: "idle", taskId: null, cardId: null,
        trigger: null, rerollsUsed: 0
      },
      mysticRecentCards: [],
      mode: "normal",         // normal | flow | prophecy
      scene: "court",
      visitedScenes: [],
      completedTasks: [],     // 已完成 task id（累计计数用）
      mapTasks: [],           // 地图任务 {id,title,cat,scene,durationMinutes,energyTier,energy,gold,restore,from,knowledgeRefs,bg,done,day}
      pendingPetitions: [],   // 奏折匣中待办 {taskId, title, scene, day}
      npcs: [],               // 凌烟阁人物档案；立绘可为空
      npcInteractions: [],    // NPC 与最终待办形成的事件摘要
      npcTaskCardLinks: [],   // NPCInteraction 与最终待办卡片的关联
      folkMet: [],            // [废弃] 旧市井偶遇解锁 id；保留声明兼容旧存档，新流程改用 folkTalk
      folkBooks: [],          // [废弃] 旧成卷市井之人 id；同上
      folkCurrentId: null,    // [废弃] 旧当前照面者 id；同上
      // 市井偶遇 / 凌烟阁招募（PRD 09 §12.3）——共享内容池、名臣招募、加成
      folkTalk: freshFolkTalk(),
      npcSequence: 1,
      npcInteractionSequence: 1,
      npcLinkSequence: 1,
      journals: [],           // 起居注 {id,day,title,text}
      conversationSessions: {}, // 当日会话，按场景 id 隔离
      books: [],              // 治国之策藏书
      knowledge: { documents: [] }, // 浏览器本地保存的用户典籍文本
      achievements: freshAchMap(),
      counters: {
        tasksDone: 0,
        goldSources: [],      // 去重的来源 scene
        approvals: 0,         // 朱批同意/大胆 次数
        approvalGold: 0,      // 朱批累计获得金币
        pizhuAgain: 0,
        pizhuBold: 0,
        astroDone: 0,
        flowMinutes: 0,
        prophecyUses: 0,
        prophecyByDecision: {},
        uploads: 0,
        archiveReads: 0,
        fogReturnPending: false,
        aboveFiftyStreak: 0,
        noZeroStreak: 0,
        endAbove120Streak: 0,
        dailyGoldStreak: 0
      },
      sidebarCollapsed: false
    };
  }

  function cleanTaskTitle(value) {
    return data.cleanTaskTitle ? data.cleanTaskTitle(value) : String(value || "").trim();
  }

  function cleanTaskMarkersInSystemText(value) {
    return String(value || "").replace(
      /(^|[·•]\s*)[\[【]\s*(?:main|daily|explore|delay|mystic)\s*[\]】]\s*[:：\-–—]?\s*/gi,
      "$1"
    );
  }

  function cleanMinisterSpeech(value) {
    return data.cleanMinisterSpeech ? data.cleanMinisterSpeech(value) : String(value || "").replace(/朕/g, "臣");
  }

  function cleanSavedDecisionTaskTitles(decision) {
    if (!decision || typeof decision !== "object") return decision;
    ["recommend", "alt"].forEach(function (key) {
      var path = decision[key];
      if (!path || !Array.isArray(path.tasks)) return;
      path.tasks = path.tasks.map(function (task) {
        return Object.assign({}, task, { title: cleanTaskTitle(task.title) || "推进此事的第一步" });
      });
    });
    decision.title = cleanTaskTitle(decision.title) || decision.title;
    return decision;
  }

  function cleanSavedConversationSession(session) {
    if (!session || typeof session !== "object") return session;
    var cleaned = Object.assign({}, session);
    cleaned.transcript = (Array.isArray(session.transcript) ? session.transcript : []).map(function (message) {
      if (!message) return message;
      if (message.role === "sys") return Object.assign({}, message, { text: cleanTaskMarkersInSystemText(message.text) });
      if (message.role === "npc") return Object.assign({}, message, { text: cleanMinisterSpeech(message.text) });
      return message;
    });
    cleaned.aiHistory = (Array.isArray(session.aiHistory) ? session.aiHistory : []).map(function (message) {
      if (!message || message.role !== "assistant") return message;
      return Object.assign({}, message, { content: cleanMinisterSpeech(message.content) });
    });
    if (cleaned.activeQuestion && cleaned.activeQuestion.q) {
      cleaned.activeQuestion = Object.assign({}, cleaned.activeQuestion, {
        q: cleanMinisterSpeech(cleaned.activeQuestion.q)
      });
    }
    if (cleaned.pendingDecision && cleaned.pendingDecision.decision) {
      cleaned.pendingDecision = Object.assign({}, cleaned.pendingDecision, {
        decision: cleanSavedDecisionTaskTitles(cleaned.pendingDecision.decision)
      });
    }
    return cleaned;
  }

  function normalizedConversationText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function isMinisterGreeting(text) {
    var value = normalizedConversationText(text);
    return Object.keys(data.MINISTERS || {}).some(function (key) {
      return normalizedConversationText(data.MINISTERS[key] && data.MINISTERS[key].say) === value;
    });
  }

  function conversationSummaryParts(transcript) {
    var seen = {};
    return (Array.isArray(transcript) ? transcript : []).map(function (message) {
      var text = normalizedConversationText(message && message.text);
      if (!text || message.role === "sys" || isMinisterGreeting(text)) return null;
      var key = String(message.role || "") + "\n" + text;
      if (seen[key]) return null;
      seen[key] = true;
      return (message.who ? normalizedConversationText(message.who) + "：" : "") + text;
    }).filter(Boolean);
  }

  function conversationJournalTitle(scene, topic) {
    var sceneName = String(scene && scene.name || "宫廷");
    var value = normalizedConversationText(topic || "对话归档");
    if (value === sceneName + "议事") return value;
    return sceneName + "·" + value;
  }

  // v6 之前的归档可能把“切换大臣＋开场白”连续写入起居注。
  function cleanLegacyConversationJournal(journal) {
    var text = String(journal && journal.text || "");
    var title = String(journal && journal.title || "");
    var isConversation = journal && journal.type === "conversation" || (data.SCENES || []).some(function (scene) {
      return title.indexOf(scene.name + "·") === 0;
    });
    if (!isConversation) return journal;
    var seen = {};
    var parts = text.split(/[；\n]+/).map(function (part) { return normalizedConversationText(part); }).filter(function (part) {
      if (!part || /改由【[^】]*】.*为陛下参详/.test(part)) return false;
      var plain = part.replace(/^[^：]{1,16}：/, "");
      if (isMinisterGreeting(plain) ||
          /^(上一段商讨已归入起居注|AI 驿站未连通|已同意|·\s)/.test(plain) || seen[part]) return false;
      seen[part] = true;
      return true;
    });
    if (!parts.length) return null;
    var cleanedTitle = title;
    (data.SCENES || []).some(function (scene) {
      if (title === scene.name + "·" + scene.name + "议事") {
        cleanedTitle = scene.name + "议事";
        return true;
      }
      return false;
    });
    return Object.assign({}, journal, { title: cleanedTitle, text: parts.join("\n") });
  }

  /* ---------- 加载 / 保存 ---------- */
  var state;
  function load() {
    // 汇报演示态：不读真实存档，直接构造种子态（已登基、谋略型），刷新即重置。
    if (typeof window !== "undefined" && window.APP_DEMO) {
      state = initialState();
      state.onboarded = true;
      state.empressType = "谋略";
      state.profile.nickname = "陛下";
      return;
    }
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        var base = initialState();
        var oldVersion = Number(parsed.version) || 1;
        state = Object.assign(base, parsed);
        state.version = STATE_VERSION;
        state.energyCap = ENERGY_CAP;
        state.energy = Math.max(0, Math.min(ENERGY_CAP, Number(state.energy) || 0));
        state.counters = Object.assign(base.counters, parsed.counters || {});
        state.counters.prophecyByDecision = state.counters.prophecyByDecision && typeof state.counters.prophecyByDecision === "object" ? state.counters.prophecyByDecision : {};
        state.titles = Array.isArray(parsed.titles) ? parsed.titles.slice(0, 100) : [];
        state.settlementLedger = parsed.settlementLedger && typeof parsed.settlementLedger === "object" ? parsed.settlementLedger : {};
        state.settlementSequence = Math.max(0, Number(parsed.settlementSequence) || 0);
        if (oldVersion < 2) {
          state.totalActualRestored = 0;
          state.totalRestored = 0;
          state.totalCountedRestored = 0;
          state.dayKey = localDayKey();
          state.dailyStats = {};
        } else {
          state.totalActualRestored = Number(state.totalActualRestored) || 0;
          state.totalCountedRestored = Number(state.totalCountedRestored != null ? state.totalCountedRestored : state.totalRestored) || 0;
          state.totalRestored = state.totalCountedRestored;
          state.dayKey = state.dayKey || localDayKey();
          state.dailyStats = state.dailyStats && typeof state.dailyStats === "object" ? state.dailyStats : {};
        }
        state.totalGold = Math.max(0, Number(state.totalGold) || Number(state.gold) || 0);
        delete state.taskGoldEarned;
        delete state.achievementGoldEarned;
        // 合并成就 map，兼容新增成就
        var freshMap = freshAchMap();
        state.achievements = Object.assign(freshMap, parsed.achievements || {});
        Object.keys(state.achievements).forEach(function (id) {
          state.achievements[id] = Object.assign({
            unlocked: false, cur: 0, date: null, unlockedAt: null,
            rewardGranted: false, rewardGrantedAt: null
          }, state.achievements[id] || {});
        });
        // v9：旧演示与用户点击曾共用场景切换，无法可靠区分到访来源。
        // 探索进度回到确定无误的朝堂，已发奖励保留且不会重复结算。
        if (oldVersion < 9) {
          state.visitedScenes = state.onboarded ? ["court"] : [];
          state.counters.fogReturnPending = false;
          ["first-explore-step", "garden-stroll", "explore-all-scenes"].forEach(function (id) {
            var rec = state.achievements[id];
            if (!rec) return;
            rec.unlocked = false;
            rec.cur = 0;
            rec.date = null;
            rec.unlockedAt = null;
          });
          state.titles = state.titles.filter(function (title) { return title !== "九重游者"; });
        }
        state.knowledge = Object.assign({ documents: [] }, parsed.knowledge || {});
        if (!Array.isArray(state.knowledge.documents)) state.knowledge.documents = [];
        state.npcs = Array.isArray(parsed.npcs) ? parsed.npcs : [];
        state.npcInteractions = Array.isArray(parsed.npcInteractions) ? parsed.npcInteractions : [];
        state.npcTaskCardLinks = Array.isArray(parsed.npcTaskCardLinks) ? parsed.npcTaskCardLinks : [];
        state.folkMet = Array.isArray(parsed.folkMet) ? parsed.folkMet : [];
        state.folkBooks = Array.isArray(parsed.folkBooks) ? parsed.folkBooks : [];
        state.folkCurrentId = parsed.folkCurrentId || null;
        state.folkTalk = normalizeFolkTalk(parsed.folkTalk, parsed, oldVersion);
        state.books = normalizeBooks(parsed.books);
        state.npcSequence = Math.max(1, Number(parsed.npcSequence) || state.npcs.length + 1);
        state.npcInteractionSequence = Math.max(1, Number(parsed.npcInteractionSequence) || state.npcInteractions.length + 1);
        state.npcLinkSequence = Math.max(1, Number(parsed.npcLinkSequence) || state.npcTaskCardLinks.length + 1);
        state.journals = (Array.isArray(parsed.journals) ? parsed.journals : []).map(cleanLegacyConversationJournal).filter(Boolean);
        state.conversationSessions = state.conversationSessions && typeof state.conversationSessions === "object" ? state.conversationSessions : {};
        Object.keys(state.conversationSessions).forEach(function (sceneId) {
          var session = cleanSavedConversationSession(state.conversationSessions[sceneId]);
          // 早期存档未写入会话日期；视为当前游戏日，避免刷新后被误判为过期而消失。
          if (session && !Number.isFinite(Number(session.day))) session.day = state.day;
          state.conversationSessions[sceneId] = session;
        });
        state.dailyMystic = Object.assign({
          dayKey: state.dayKey || localDayKey(), status: "idle", taskId: null,
          cardId: null, trigger: null, rerollsUsed: 0
        }, parsed.dailyMystic || {});
        state.mysticRecentCards = Array.isArray(parsed.mysticRecentCards) ? parsed.mysticRecentCards.slice(-12) : [];
        // 迁移：旧任务可能保存过模型或旧情景给出的任意数值；统一按时长重新计算。
        state.mapTasks = (Array.isArray(state.mapTasks) ? state.mapTasks : []).map(function (task) {
          var category = data.CATEGORIES[task.cat] ? task.cat : "daily";
          var catDef = data.CATEGORIES[category] || data.CATEGORIES.daily;
          var values = window.App.economy.calculate(task, category);
          return Object.assign({}, task, {
            title: cleanTaskTitle(task.title) || "推进此事的第一步",
            cat: category,
            scene: catDef.scene,
            durationMinutes: values.durationMinutes,
            energyTier: values.energyTier,
            energy: values.energy,
            gold: values.gold,
            restore: values.restore,
            sourceKind: task.sourceKind || "",
            tags: Array.isArray(task.tags) ? task.tags.slice(0, 8) : [],
            independent: !!task.independent,
            knowledgeRefs: Array.isArray(task.knowledgeRefs) ? task.knowledgeRefs.slice(0, 5) : [],
            relatedFrom: Array.isArray(task.relatedFrom) ? task.relatedFrom.slice(0, 8) : (task.from ? [task.from] : [])
          });
        });
        // v8 一次性移除过去自动播种、被模型复制或由旧演示遗留的硬编码任务。
        if (oldVersion < 8) state.mapTasks = state.mapTasks.filter(function (task) { return !data.isLegacySeedTask(task); });
        // 旧版本可能让同一事项因“完成 / 准备 / 的 / 大纲”等措辞差异绕过去重；刷新时合回较早的原任务。
        state.mapTasks = mergeSavedActiveTaskDuplicates(state.mapTasks);
        return;
      }
    } catch (e) { console.warn("[store] load failed, reset", e); }
    state = initialState();
  }
  function save() {
    // 演示态永不落盘，绝不污染访客真实存档。
    if (typeof window !== "undefined" && window.APP_DEMO) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (e) { console.warn("[store] save failed", e); }
  }
  function reset() {
    state = initialState();
    save();
    emit("change", state);
    emit("reset", state);
  }

  /* ---------- 通用 ---------- */
  function get() { return state; }
  function commit(evt) {
    save();
    emit("change", state);
    if (evt) emit(evt, state);
  }
  function today() { return "登基第" + state.day + "天"; }

  function ensureDailyStats(key, startEnergy) {
    state.dailyStats = state.dailyStats || {};
    var seedEnergy = startEnergy == null ? state.energy : startEnergy;
    if (!state.dailyStats[key]) state.dailyStats[key] = freshDailyStats(seedEnergy);
    else {
      var existing = state.dailyStats[key];
      var migratedGold = existing.goldEarned != null ? existing.goldEarned : existing.taskGold;
      var defaults = freshDailyStats(seedEnergy);
      Object.keys(defaults).forEach(function (field) {
        if (existing[field] == null) existing[field] = defaults[field];
      });
      existing.goldEarned = Number(migratedGold) || 0;
    }
    delete state.dailyStats[key].taskGold;
    return state.dailyStats[key];
  }
  function currentDailyStats() { return ensureDailyStats(state.dayKey || localDayKey(), state.energy); }
  function recordEnergySnapshot() {
    var stats = currentDailyStats();
    stats.minEnergy = Math.min(stats.minEnergy, state.energy);
    stats.maxEnergy = Math.max(stats.maxEnergy, state.energy);
    stats.endEnergy = state.energy;
  }
  function trimDailyStats() {
    var keys = Object.keys(state.dailyStats || {}).sort();
    while (keys.length > 120) delete state.dailyStats[keys.shift()];
  }

  /* ---------- 每日天象·微探索 ---------- */
  function freshDailyMystic(key) {
    return { dayKey: key, status: "idle", taskId: null, cardId: null, trigger: null, rerollsUsed: 0 };
  }

  function expireAndResetDailyMystic(key) {
    var current = state.dailyMystic || freshDailyMystic(state.dayKey || key);
    if (current.taskId) {
      var oldTask = state.mapTasks.filter(function (task) { return task.id === current.taskId; })[0];
      if (oldTask) oldTask.expired = true;
    }
    state.dailyMystic = freshDailyMystic(key);
  }

  function ensureMysticDay(key) {
    key = key || state.dayKey || localDayKey();
    if (!state.dailyMystic || state.dailyMystic.dayKey !== key) expireAndResetDailyMystic(key);
    return state.dailyMystic;
  }

  function chooseMysticCard(excludedId) {
    var cards = data.MYSTIC_CARDS || [];
    if (!cards.length) return null;
    var recent = (state.mysticRecentCards || []).slice(-3);
    var candidates = cards.filter(function (card) {
      return card.id !== excludedId && recent.indexOf(card.id) < 0;
    });
    if (!candidates.length) candidates = cards.filter(function (card) { return card.id !== excludedId; });
    if (!candidates.length) return null;
    var seedText = String(state.dayKey || "") + ":" + String(state.day || 1) + ":" + String((state.mysticRecentCards || []).length);
    var seed = 0;
    for (var i = 0; i < seedText.length; i++) seed = (seed * 31 + seedText.charCodeAt(i)) >>> 0;
    return candidates[seed % candidates.length];
  }

  function applyMysticCard(task, card) {
    task.title = card.title;
    task.mysticName = card.name;
    task.mysticSign = card.sign;
    task.mysticCardId = card.id;
    task.durationMinutes = card.durationMinutes;
    task.energyTier = "MICRO";
    task.energy = 0;
    task.gold = 0;
    task.restore = 10;
    return task;
  }

  function offerMysticCard(cardId, trigger) {
    var daily = ensureMysticDay(state.dayKey || localDayKey());
    if (daily.status !== "idle") {
      return daily.taskId
        ? state.mapTasks.filter(function (task) { return task.id === daily.taskId && !task.expired; })[0] || null
        : null;
    }
    if (state.energy >= state.energyCap) return null;
    var card = (data.MYSTIC_CARDS || []).filter(function (item) { return item.id === cardId; })[0];
    if (!card) return null;
    var task = applyMysticCard({
      id: "mystic-daily-" + state.dayKey,
      cat: "mystic",
      scene: "observatory",
      from: "今日天象",
      sourceKind: "daily-mystic",
      tags: ["micro_exploration"],
      independent: true,
      relatedFrom: ["今日天象"],
      knowledgeRefs: [],
      bg: data.brain.taskBg(state.mapTasks.length),
      done: false,
      expired: false,
      day: state.day,
      dayKey: state.dayKey,
      isDailyMystic: true
    }, card);
    state.mapTasks.push(task);
    daily.status = "offered";
    daily.taskId = task.id;
    daily.cardId = card.id;
    daily.trigger = String(trigger || "low-energy");
    state.mysticRecentCards = (state.mysticRecentCards || []).concat(card.id).slice(-12);
    save();
    emit("mysticOffer", task);
    emit("task", state);
    return task;
  }

  function maybeOfferDailyMystic(trigger) {
    var daily = ensureMysticDay(state.dayKey || localDayKey());
    if (daily.status !== "idle" || state.energy > 60) return null;
    var card = chooseMysticCard(null);
    return card ? offerMysticCard(card.id, trigger) : null;
  }

  function dailyRerollCap() { return 1 + Math.max(0, Math.round(sumBuffValue("daily_reroll_add"))); }
  function rerollDailyMystic() {
    var daily = ensureMysticDay(state.dayKey || localDayKey());
    if (daily.status !== "offered" || daily.rerollsUsed >= dailyRerollCap() || !daily.taskId) return null;
    var task = state.mapTasks.filter(function (item) { return item.id === daily.taskId; })[0];
    if (!task || task.done || task.expired) return null;
    var card = chooseMysticCard(daily.cardId);
    if (!card) return null;
    applyMysticCard(task, card);
    daily.cardId = card.id;
    daily.rerollsUsed++;
    state.mysticRecentCards = (state.mysticRecentCards || []).concat(card.id).slice(-12);
    commit("task");
    emit("mysticReroll", task);
    return task;
  }

  /* ---------- 统一资源结算 ---------- */
  function nextSettlementId(prefix) {
    state.settlementSequence = (Number(state.settlementSequence) || 0) + 1;
    return String(prefix || "settlement") + ":" + state.dayKey + ":" + state.settlementSequence;
  }

  function achievementReward(def) {
    var text = String((def && def.reward) || "");
    var goldMatch = text.match(/[+＋]\s*(\d+)\s*金/);
    var titleMatch = text.match(/称号[·・]\s*([^·+＋]+)/);
    return {
      gold: goldMatch ? Math.max(0, Number(goldMatch[1]) || 0) : 0,
      title: titleMatch ? titleMatch[1].trim() : ""
    };
  }

  function evaluateGoldAchievements(delta, source, kind) {
    if (delta <= 0 || !achievementTrackingEnabled()) return;
    if (kind === "task") {
      unlock("first-gold");
      if (source && state.counters.goldSources.indexOf(source) < 0) state.counters.goldSources.push(source);
      setAchProgress("gold-source-diverse", state.counters.goldSources.length);
    }
    setAchProgress("gold-50", state.totalGold);
    setAchProgress("gold-100", state.totalGold);
    setAchProgress("gold-300", state.totalGold);
    setAchProgress("gold-500", state.totalGold);
    setAchProgress("gold-1000", state.totalGold);
    setAchProgress("treasury-peak", state.totalGold);
    setAchProgress("single-day-gold-200", currentDailyStats().goldEarned);
    if (state.gold >= 500 && state.energy >= 100) unlock("gold-and-energy-balance");
  }

  function settleEconomy(transaction) {
    transaction = transaction || {};
    var id = String(transaction.id || "").trim();
    if (!id) throw new Error("结算必须提供稳定 id");
    state.settlementLedger = state.settlementLedger || {};
    if (state.settlementLedger[id]) return state.settlementLedger[id];

    var energyBefore = state.energy;
    var goldBefore = state.gold;
    var requestedEnergy = Number(transaction.energyDelta) || 0;
    if (transaction.energySet != null) {
      state.energy = Math.max(0, Math.min(state.energyCap, Math.round(Number(transaction.energySet) || 0)));
      requestedEnergy = state.energy - energyBefore;
    } else {
      state.energy = Math.max(0, Math.min(state.energyCap, state.energy + requestedEnergy));
    }
    var actualEnergy = state.energy - energyBefore;
    var energyKind = String(transaction.energyKind || (requestedEnergy > 0 ? "recovery" : "spend"));
    var stats = currentDailyStats();
    var countsForAchievements = transaction.countsForAchievements !== false && achievementTrackingEnabled();

    if (countsForAchievements && energyKind === "recovery" && actualEnergy > 0) {
      var countableRoom = Math.max(0, MAX_DAILY_COUNTED_RESTORE - stats.achievementRestored);
      var counted = Math.min(actualEnergy, countableRoom);
      state.totalActualRestored += actualEnergy;
      state.totalCountedRestored += counted;
      state.totalRestored = state.totalCountedRestored;
      stats.actualRestored += actualEnergy;
      stats.achievementRestored += counted;
    } else if (countsForAchievements && energyKind === "passive" && actualEnergy > 0) {
      stats.passiveRestored += actualEnergy;
    } else if (countsForAchievements && energyKind === "calibration") {
      stats.calibrated = true;
    }
    if (countsForAchievements && state.energy === 0 && energyBefore > 0) stats.overdrawn = true;
    if (countsForAchievements) recordEnergySnapshot();

    var requestedGold = Number(transaction.goldDelta) || 0;
    state.gold = Math.max(0, state.gold + requestedGold);
    var actualGold = state.gold - goldBefore;
    var goldKind = String(transaction.goldKind || "none");
    if (countsForAchievements && actualGold > 0) {
      state.totalGold += actualGold;
      stats.goldEarned += actualGold;
    }

    var grantedTitle = String(transaction.title || "").trim();
    if (grantedTitle && state.titles.indexOf(grantedTitle) < 0) state.titles.push(grantedTitle);
    var receipt = {
      id: id,
      type: String(transaction.type || "resource"),
      source: String(transaction.source || ""),
      day: state.day,
      dayKey: state.dayKey,
      settledAt: new Date().toISOString(),
      energyBefore: energyBefore,
      energyAfter: state.energy,
      energyRequested: requestedEnergy,
      energyActual: actualEnergy,
      energyKind: energyKind,
      goldBefore: goldBefore,
      goldAfter: state.gold,
      goldRequested: requestedGold,
      goldActual: actualGold,
      goldKind: goldKind,
      countsForAchievements: countsForAchievements,
      titleGranted: grantedTitle,
      // 名臣加成流水（PRD §10.6.9）：记 appliedBuffIds 及各资源基础/最终值
      appliedBuffIds: Array.isArray(transaction.appliedBuffIds) ? transaction.appliedBuffIds : [],
      baseGold: transaction.baseGold != null ? transaction.baseGold : requestedGold,
      finalGold: transaction.finalGold != null ? transaction.finalGold : requestedGold,
      baseEnergy: transaction.baseEnergy != null ? transaction.baseEnergy : Math.abs(requestedEnergy),
      finalEnergy: transaction.finalEnergy != null ? transaction.finalEnergy : Math.abs(requestedEnergy)
    };
    state.settlementLedger[id] = receipt;
    save();

    if (countsForAchievements && energyKind === "recovery" && actualEnergy > 0) {
      if (state.energy >= 100) unlock("jade-first-restore-hundred");
      if (state.energy >= 150) unlock("jade-full-cap-150");
      setAchProgress("jade-accumulate-500", state.totalRestored);
      setAchProgress("jade-accumulate-2000", state.totalRestored);
      if (energyBefore <= 30 && state.energy >= 60) unlock("jade-single-day-rebound");
      updateGrandHarmony();
    }
    if (countsForAchievements && energyKind === "passive" && state.energy >= 150) unlock("jade-full-cap-150");
    if (countsForAchievements && (energyKind === "recovery" || energyKind === "passive") && state.gold >= 500 && state.energy >= 100) unlock("gold-and-energy-balance");
    if (countsForAchievements && actualGold > 0) evaluateGoldAchievements(actualGold, transaction.source, goldKind);
    if (countsForAchievements && actualGold < 0) unlock("first-spend");

    if ((energyKind === "spend" && actualEnergy < 0 && energyBefore > 60 && state.energy <= 60) ||
        (energyKind === "calibration" && state.energy <= 60)) {
      maybeOfferDailyMystic(energyKind === "calibration" ? "calibration" : "low-energy");
    }

    emit("settlement", receipt);
    if (actualEnergy || transaction.energySet != null) emit("energy", state.energy);
    if (actualGold) emit("gold", state.gold);
    return receipt;
  }

  /* ---------- 成就引擎 ---------- */
  var achievementBatch = null;

  function grantAchievementReward(def, rec) {
    var reward = achievementReward(def);
    var receipt = settleEconomy({
      id: "achievement:" + def.id,
      type: "achievement",
      source: def.id,
      goldDelta: reward.gold,
      goldKind: "achievement",
      title: reward.title
    });
    rec.rewardGranted = true;
    rec.rewardGrantedAt = receipt.settledAt;
    return receipt;
  }

  // 设置成就当前进度（取较大值），到达 target 则解锁
  function setAchProgress(id, cur) {
    if (!achievementTrackingEnabled()) return;
    var def = data.achById[id]; if (!def) return;
    var rec = state.achievements[id] || (state.achievements[id] = { unlocked: false, cur: 0, date: null });
    if (cur > rec.cur) rec.cur = cur;
    if (!rec.unlocked && rec.cur >= def.target) unlock(id);
  }
  function updateGrandHarmony() {
    if (!achievementTrackingEnabled()) return;
    var def = data.achById["jade-grand-harmony"];
    var rec = state.achievements["jade-grand-harmony"];
    if (!def || !rec) return;
    if (state.totalRestored > rec.cur) rec.cur = state.totalRestored;
    if (!rec.unlocked && rec.cur >= def.target && state.counters.noZeroStreak >= 30) unlock(def.id);
  }
  function bumpAch(id, by) {
    if (!achievementTrackingEnabled()) return;
    var def = data.achById[id]; if (!def) return;
    var rec = state.achievements[id] || (state.achievements[id] = { unlocked: false, cur: 0, date: null });
    rec.cur += (by || 1);
    if (!rec.unlocked && rec.cur >= def.target) unlock(id);
  }
  function unlock(id) {
    if (!achievementTrackingEnabled()) return false;
    var def = data.achById[id]; if (!def) return;
    var rec = state.achievements[id] || (state.achievements[id] = { unlocked: false, cur: 0, date: null, rewardGranted: false });
    if (rec.unlocked) {
      if (!rec.rewardGranted) grantAchievementReward(def, rec);
      return false;
    }
    rec.unlocked = true;
    if (rec.cur < def.target) rec.cur = def.target;
    rec.date = localDayKey() + " · " + today();
    rec.unlockedAt = new Date().toISOString();
    var rewardReceipt = grantAchievementReward(def, rec);
    var event = { def: def, receipt: rewardReceipt };
    if (achievementBatch) achievementBatch.push(event);
    else appendJournal(
      "成就达成·" + def.name,
      "解锁「" + def.name + "」 · 奖赏 " + def.reward + " 已自动到账。",
      { type: "achievement", achievementId: def.id, settlementId: rewardReceipt.id }
    );
    save();
    emit("achievement", Object.assign({}, def, { rewardReceipt: rewardReceipt }));
    return true;
  }
  // 演示专用：点哪个成就就点亮哪个。绕过成就总开关，只改内存、发事件，
  // 不结算经济、不写起居注、不落盘（save 在 APP_DEMO 下本就 no-op），演示结束一刷新即还原。
  function demoUnlock(id) {
    var def = data.achById[id]; if (!def) return false;
    var rec = state.achievements[id] || (state.achievements[id] = { unlocked: false, cur: 0, date: null, rewardGranted: false });
    if (rec.unlocked) return false;
    rec.unlocked = true;
    if (rec.cur < def.target) rec.cur = def.target;
    rec.date = localDayKey() + " · " + today();
    rec.unlockedAt = new Date().toISOString();
    rec.rewardGranted = true;   // 演示态视作已到账，详情不显示「正在补发」
    emit("achievement", def);   // 触发解锁 toast + 珍宝阁面板刷新
    return true;
  }
  function achState(id) {
    var def = data.achById[id];
    var rec = state.achievements[id] || { unlocked: false, cur: 0, date: null };
    return {
      def: def, unlocked: rec.unlocked, cur: rec.cur, target: def.target, date: rec.date,
      rewardGranted: !!rec.rewardGranted, rewardGrantedAt: rec.rewardGrantedAt || null
    };
  }
  function progress() {
    // 主线=青铜，副线=其它
    var mainTotal = 0, mainDone = 0, subTotal = 0, subDone = 0;
    data.ACHIEVEMENTS.forEach(function (a) {
      var u = state.achievements[a.id] && state.achievements[a.id].unlocked;
      if (a.cat === "青铜") { mainTotal++; if (u) mainDone++; }
      else { subTotal++; if (u) subDone++; }
    });
    return { mainDone: mainDone, mainTotal: mainTotal, subDone: subDone, subTotal: subTotal };
  }

  function migrateAchievementRewards() {
    var migrated = [];
    data.ACHIEVEMENTS.forEach(function (def) {
      var rec = state.achievements[def.id];
      if (!rec || !rec.unlocked || rec.rewardGranted) return;
      var receipt = grantAchievementReward(def, rec);
      migrated.push({ def: def, receipt: receipt });
    });
    if (!migrated.length) return;
    var gold = migrated.reduce(function (sum, item) { return sum + Math.max(0, item.receipt.goldActual || 0); }, 0);
    appendJournal(
      "旧成就奖励补发",
      "补发 " + migrated.length + " 项既有成就奖励" + (gold ? " · 成就金币 +" + gold : "") + "，均已自动到账且不会重复发放。",
      { type: "achievement-migration", achievementIds: migrated.map(function (item) { return item.def.id; }) }
    );
    save();
  }

  function reconcileAchievementState() {
    var previousBatch = achievementBatch;
    var unlockedHere = [];
    achievementBatch = unlockedHere;
    var n = Math.max(0, Number(state.counters.tasksDone) || 0);
    if (n > 0) { unlock("first-task-kiln-fire"); unlock("first-gold"); }
    setAchProgress("tasks-3-raw-body", n);
    setAchProgress("tasks-5-five-wares", n);
    setAchProgress("tasks-10-warm-glaze", n);
    setAchProgress("tasks-20-kiln-transform", n);
    setAchProgress("tasks-50-official-kiln", n);
    setAchProgress("tasks-100-eternal-porcelain", n);
    setAchProgress("gold-50", state.totalGold);
    setAchProgress("gold-100", state.totalGold);
    setAchProgress("gold-300", state.totalGold);
    setAchProgress("gold-500", state.totalGold);
    setAchProgress("gold-1000", state.totalGold);
    setAchProgress("treasury-peak", state.totalGold);
    setAchProgress("gold-source-diverse", (state.counters.goldSources || []).length);
    setAchProgress("approval-gold", state.counters.approvalGold || 0);
    setAchProgress("jade-accumulate-500", state.totalRestored);
    setAchProgress("jade-accumulate-2000", state.totalRestored);
    setAchProgress("jade-astro-ten-times", state.counters.astroDone || 0);
    setAchProgress("jade-three-days-above-fifty", state.counters.aboveFiftyStreak || 0);
    setAchProgress("jade-seven-days-no-zero", state.counters.noZeroStreak || 0);
    setAchProgress("jade-hold-cap-three-days", state.counters.endAbove120Streak || 0);
    setAchProgress("daily-gold-streak", state.counters.dailyGoldStreak || 0);
    setAchProgress("flow-focus-master", state.counters.flowMinutes || 0);
    if ((state.counters.flowMinutes || 0) >= 25) unlock("flow-focus-single");
    setAchProgress("redo-simulation", Math.max.apply(null, [0].concat(Object.keys(state.counters.prophecyByDecision || {}).map(function (key) {
      return state.counters.prophecyByDecision[key] || 0;
    }))));
    setAchProgress("explore-all-scenes", (state.visitedScenes || []).filter(function (scene) { return scene !== "residence"; }).length);
    applyDayProgress();
    if (state.counters.approvals > 0) { unlock("first-vermilion-brush"); unlock("first-audience-minister"); }
    if (state.counters.pizhuAgain > 0) unlock("pizhu-zaiyi");
    if (state.counters.pizhuBold > 0) unlock("pizhu-dadan");
    if (state.counters.archiveReads > 0) unlock("archive-first-read");
    if (state.counters.uploads > 0) unlock("archive-upload");
    if (state.counters.prophecyUses > 0) unlock("prophecy-first");
    if (state.counters.astroDone > 0) unlock("jade-astro-first-restore");
    if ((state.visitedScenes || []).indexOf("garden") >= 0) unlock("garden-stroll");
    if ((state.visitedScenes || []).some(function (scene) { return ["ministry", "folk", "observatory", "library"].indexOf(scene) >= 0; })) unlock("first-explore-step");
    if (state.gold >= 500 && state.energy >= 100) unlock("gold-and-energy-balance");
    var completed = (state.mapTasks || []).filter(function (task) {
      return task.done && !task.restore && task.cat !== "mystic" && !/^demo(?:-|$)/.test(String(task.sourceKind || ""));
    });
    if (completed.some(function (task) { return task.scene === "ministry"; })) unlock("first-daily-liubu");
    if (completed.some(function (task) { return task.scene === "garden"; })) unlock("first-explore-garden");
    if (completed.some(function (task) { return task.scene === "folk"; })) unlock("first-fog-minjian");
    if (completed.some(function (task) { return task.scene === "court" && (task.independent || task.cat === "main"); })) unlock("first-solo-delivery");
    if (completed.some(function (task) { return task.energyTier === "HEAVY"; })) unlock("single-big-reward");
    if (completed.some(function (task) { return ((task.tags || []).indexOf("weekly_report") >= 0 || (task.tags || []).indexOf("sop") >= 0 || /周报|周奏|SOP|章程|流程/.test(task.title)); })) unlock("weekly-memorial-sop");
    if (completed.some(function (task) { return ((task.tags || []).indexOf("regularization_defense") >= 0 || /结业答辩|转正.*答辩|答辩.*转正/.test(task.title)); })) unlock("regularization-defense");
    setAchProgress("survey-six-ministries", completed.filter(function (task) { return task.scene === "ministry"; }).length);
    updateGrandHarmony();
    achievementBatch = previousBatch;
    if (unlockedHere.length) {
      appendJournal(
        "成就状态校准",
        "依据现有存档补齐成就「" + unlockedHere.map(function (event) { return event.def.name; }).join("、") + "」，奖励已自动到账。",
        { type: "achievement-reconcile", achievementIds: unlockedHere.map(function (event) { return event.def.id; }) }
      );
      save();
    }
  }

  /* ---------- 精力 ---------- */
  function addEnergy(delta, options) {
    options = options || {};
    var receipt = settleEconomy({
      id: options.id || nextSettlementId("energy"),
      type: options.type || "energy",
      source: options.source || "manual",
      energyDelta: delta,
      energyKind: options.source === "passive" ? "passive" : (delta > 0 ? "recovery" : "spend"),
      countsForAchievements: options.countsForAchievements
    });
    return receipt.energyActual;
  }
  function setEnergy(v) { // 用户校准精力条
    settleEconomy({
      id: nextSettlementId("calibration"),
      type: "calibration",
      source: "user",
      energySet: v,
      energyKind: "calibration"
    });
    unlock("jade-calibrate-energy");
    commit("energy");
  }

  /* ---------- 金币 ---------- */
  function addGold(delta, source, kind, id) {
    return settleEconomy({
      id: id || nextSettlementId("gold"),
      type: "gold",
      source: source || "manual",
      goldDelta: delta,
      goldKind: kind || "task"
    }).goldActual;
  }

  /* ---------- 场景 ---------- */
  function moveScene(id, options) {
    var sc = data.sceneById(id); if (!sc) return;
    options = options || {};
    var recordVisit = options.recordVisit !== false && sc.trackVisit !== false && achievementTrackingEnabled();
    if (recordVisit && state.scene === "folk" && id === "court") state.counters.fogReturnPending = true;
    var prevScene = state.scene;
    state.scene = id;
    // 有效进入民间（PRD §5.1）：目标 folk 且前场景非 folk → 生成 navigationToken、开启一次偶遇。
    // resize/重渲染/刷新时 state.scene 已是 folk，不经此路径，故不会重抽。
    if (id === "folk" && prevScene !== "folk") {
      var ft = folkTalk();
      beginFolkVisit("folk-nav:" + ((Number(ft.visitSequence) || 0) + 1), prevScene);
    }
    if (recordVisit && state.visitedScenes.indexOf(id) < 0) {
      state.visitedScenes.push(id);
      // 木器成就
      if (id === "garden") unlock("garden-stroll");
      if (["ministry", "folk", "observatory", "library"].indexOf(id) >= 0) unlock("first-explore-step");
      // 遍历九重（7 个可探索场景，除 residence 外）
      var explored = state.visitedScenes.filter(function (s) { return s !== "residence"; }).length;
      setAchProgress("explore-all-scenes", explored);
    }
    commit("scene");
  }

  /* ---------- 地图任务：投放 / 完成 ----------
     模块 03：决策「同意」后按分类生成任务并投放到对应地图场景。 */
  var taskSeq = 1;
  function nextTaskId() { return "mt-" + (taskSeq++) + "-" + state.mapTasks.length; }

  function normalizeTaskTitle(value) {
    return String(value || "").toLowerCase().replace(/[\s\-_\u2013\u2014，。！？、；：,.!?;:'"“”‘’（）()\[\]{}【】]/g, "");
  }
  function taskSemanticCore(value) {
    return normalizeTaskTitle(value)
      .replace(/^(?:完成|准备|制定|撰写|编写|整理|梳理|制作|创建|推进|执行|开始|提交|输出|检查|确认)+/, "")
      .replace(/的/g, "");
  }
  function titleBigrams(value) {
    var text = taskSemanticCore(value), result = [];
    if (text.length < 2) return text ? [text] : result;
    for (var i = 0; i < text.length - 1; i++) result.push(text.slice(i, i + 2));
    return result;
  }
  function taskTitleSimilarity(left, right) {
    var rawA = normalizeTaskTitle(left), rawB = normalizeTaskTitle(right);
    if (!rawA || !rawB) return 0;
    if (rawA === rawB) return 1;
    var a = taskSemanticCore(left), b = taskSemanticCore(right);
    if (!a || !b) return 0;
    if (a === b) return 0.96;
    if (Math.min(a.length, b.length) >= 6 && (a.indexOf(b) >= 0 || b.indexOf(a) >= 0)) return 0.92;
    var ap = titleBigrams(a), bp = titleBigrams(b), seenA = {}, seenB = {}, intersection = 0;
    ap.forEach(function (pair) { seenA[pair] = true; });
    bp.forEach(function (pair) { seenB[pair] = true; });
    Object.keys(seenA).forEach(function (pair) { if (seenB[pair]) intersection++; });
    var total = Object.keys(seenA).length + Object.keys(seenB).length;
    return total ? (2 * intersection) / total : 0;
  }

  function mergeTaskMetadata(existing, incoming) {
    existing.relatedFrom = Array.isArray(existing.relatedFrom) ? existing.relatedFrom : (existing.from ? [existing.from] : []);
    var incomingSources = Array.isArray(incoming.relatedFrom) ? incoming.relatedFrom : (incoming.from ? [incoming.from] : []);
    incomingSources.forEach(function (source) {
      if (source && existing.relatedFrom.indexOf(source) < 0 && existing.relatedFrom.length < 8) existing.relatedFrom.push(source);
    });
    existing.knowledgeRefs = Array.isArray(existing.knowledgeRefs) ? existing.knowledgeRefs : [];
    (Array.isArray(incoming.knowledgeRefs) ? incoming.knowledgeRefs : []).forEach(function (ref) {
      if (existing.knowledgeRefs.indexOf(ref) < 0 && existing.knowledgeRefs.length < 5) existing.knowledgeRefs.push(ref);
    });
    existing.updatedDay = Math.max(Number(existing.updatedDay) || 0, Number(incoming.updatedDay || incoming.day) || 0) || existing.updatedDay;
    return existing;
  }

  function mergeSavedActiveTaskDuplicates(tasks) {
    var kept = [];
    (tasks || []).forEach(function (task) {
      if (!task || task.done || task.expired) { kept.push(task); return; }
      var duplicate = null;
      kept.some(function (candidate) {
        if (!candidate || candidate.done || candidate.expired) return false;
        var similarity = taskTitleSimilarity(candidate.title, task.title);
        var threshold = candidate.scene === task.scene ? 0.72 : 0.9;
        if (similarity < threshold) return false;
        duplicate = candidate;
        return true;
      });
      if (duplicate) mergeTaskMetadata(duplicate, task);
      else kept.push(task);
    });
    return kept;
  }
  function overlappingTask(title, scene) {
    var best = null;
    state.mapTasks.forEach(function (task) {
      if (task.done) return;
      var similarity = taskTitleSimilarity(task.title, title);
      var threshold = task.scene === scene ? 0.72 : 0.9;
      if (similarity >= threshold && (!best || similarity > best.similarity)) best = { task: task, similarity: similarity };
    });
    return best;
  }

  function previewTaskOverlaps(templates) {
    return (templates || []).map(function (tpl) {
      var title = cleanTaskTitle(tpl.title) || "推进此事的第一步";
      var category = data.CATEGORIES[tpl.cat] ? tpl.cat : "daily";
      var catDef = data.CATEGORIES[category] || data.CATEGORIES.daily;
      var safeTemplate = Object.assign({}, tpl, { title: title, cat: category });
      var overlap = overlappingTask(safeTemplate.title, catDef.scene);
      return overlap ? { template: safeTemplate, task: overlap.task, similarity: overlap.similarity } : null;
    }).filter(Boolean);
  }

  /* ---------- 凌烟阁 NPC ----------
     人物识别结果随最终决策返回，但只在朱批同意、待办卡片实际落地后写入。 */
  var NPC_ROLES = ["leader", "coworker", "product", "customer", "mentor", "subordinate", "ally", "rival", "unknown"];
  var NPC_STANCES = ["unknown", "ally", "friendly", "neutral", "cold", "rival", "hostile"];
  var NPC_TASK_RELATIONS = ["owner", "stakeholder", "approver", "blocker", "recipient", "mentioned"];
  var NPC_ROLE_TITLES = {
    leader: "直属上级", coworker: "同事", product: "产品", customer: "客户",
    mentor: "导师", subordinate: "下属", ally: "协作者", rival: "竞争者", unknown: "身份待确认"
  };

  function npcText(value, max) {
    return String(value == null ? "" : value).trim().slice(0, max || 120);
  }
  function npcNumber(value, min, max, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : (fallback || 0);
  }
  function npcNameKey(value) {
    return npcText(value, 80).toLowerCase().replace(/[\s·•"'“”‘’（）()【】\[\]]/g, "");
  }
  function nextNpcId() { return "npc-" + (state.npcSequence++); }
  function nextNpcInteractionId() { return "interaction-" + (state.npcInteractionSequence++); }
  function nextNpcLinkId() { return "npc-task-link-" + (state.npcLinkSequence++); }

  function cleanNpcRelationship(value) {
    value = value || {};
    var stance = NPC_STANCES.indexOf(value.stance) >= 0 ? value.stance : "unknown";
    return {
      stance: stance,
      stanceConfidence: npcNumber(value.stanceConfidence, 0, 1, stance === "unknown" ? 0.2 : 0.45),
      inferenceReason: npcText(value.inferenceReason, 240),
      trust: npcNumber(value.trust, -100, 100, 0),
      influence: npcNumber(value.influence, 0, 100, 0),
      alignment: npcNumber(value.alignment, -100, 100, 0),
      conflict: npcNumber(value.conflict, 0, 100, 0),
      familiarity: npcNumber(value.familiarity, 0, 100, 0)
    };
  }

  function findNpc(candidate) {
    var candidateKeys = [candidate && candidate.displayName].concat(candidate && Array.isArray(candidate.aliases) ? candidate.aliases : [])
      .map(npcNameKey).filter(Boolean);
    var explicitId = npcText(candidate && candidate.existingNpcId, 80);
    if (explicitId) {
      var exact = state.npcs.filter(function (npc) { return npc.id === explicitId; })[0];
      if (exact) {
        var exactKeys = [exact.displayName].concat(Array.isArray(exact.aliases) ? exact.aliases : []).map(npcNameKey).filter(Boolean);
        if (candidateKeys.some(function (key) { return exactKeys.indexOf(key) >= 0; })) return exact;
      }
    }
    return state.npcs.filter(function (npc) {
      var knownKeys = [npc.displayName].concat(Array.isArray(npc.aliases) ? npc.aliases : []).map(npcNameKey).filter(Boolean);
      return candidateKeys.some(function (key) { return knownKeys.indexOf(key) >= 0; });
    })[0] || null;
  }

  function mergeNpcAliases(profile, candidate) {
    var aliases = Array.isArray(profile.aliases) ? profile.aliases.slice(0, 8) : [];
    [candidate.displayName].concat(Array.isArray(candidate.aliases) ? candidate.aliases : []).forEach(function (alias) {
      alias = npcText(alias, 60);
      if (!alias || npcNameKey(alias) === npcNameKey(profile.displayName)) return;
      if (!aliases.some(function (known) { return npcNameKey(known) === npcNameKey(alias); }) && aliases.length < 8) aliases.push(alias);
    });
    profile.aliases = aliases;
  }

  function upsertNpc(candidate) {
    var now = new Date().toISOString();
    var profile = findNpc(candidate);
    var incomingRelationship = cleanNpcRelationship(candidate && candidate.relationship);
    if (!profile) {
      var role = NPC_ROLES.indexOf(candidate && candidate.role) >= 0 ? candidate.role : "unknown";
      profile = {
        id: nextNpcId(),
        cat: "work",
        displayName: npcText(candidate && candidate.displayName, 60) || "待确认人物",
        title: npcText(candidate && candidate.title, 80) || NPC_ROLE_TITLES[role],
        aliases: [],
        role: role,
        identityStatus: ["auto_created", "confirmed", "ambiguous"].indexOf(candidate && candidate.identityStatus) >= 0
          ? candidate.identityStatus : "auto_created",
        confidence: npcNumber(candidate && candidate.identityConfidence, 0, 1, 0.5),
        relationship: incomingRelationship,
        portrait: null,
        createdAt: now,
        updatedAt: now
      };
      mergeNpcAliases(profile, candidate || {});
      state.npcs.push(profile);
      return profile;
    }

    mergeNpcAliases(profile, candidate || {});
    if (!profile.title && candidate && candidate.title) profile.title = npcText(candidate.title, 80);
    if (profile.role === "unknown" && NPC_ROLES.indexOf(candidate && candidate.role) >= 0) profile.role = candidate.role;
    profile.confidence = Math.max(Number(profile.confidence) || 0, npcNumber(candidate && candidate.identityConfidence, 0, 1, 0.5));
    if (profile.identityStatus !== "confirmed" && candidate && candidate.identityStatus === "confirmed") profile.identityStatus = "confirmed";
    if (!profile.relationship || incomingRelationship.stanceConfidence >= (Number(profile.relationship.stanceConfidence) || 0)) {
      profile.relationship = incomingRelationship;
    }
    if (profile.portrait === undefined) profile.portrait = null;
    profile.updatedAt = now;
    return profile;
  }

  function recordDecisionNpcs(decision, resolved, pathKey) {
    var detection = decision && decision.npcDetection;
    var candidates = detection && Array.isArray(detection.candidates) ? detection.candidates : [];
    if (!detection || !detection.hasRelevantPeople || !candidates.length) return [];
    var changed = false;
    var touched = [];
    var selectedPath = pathKey === "alt" ? "alt" : "recommend";
    candidates.forEach(function (candidate) {
      var taskLinks = (Array.isArray(candidate.taskLinks) ? candidate.taskLinks : []).filter(function (link) {
        return link && link.path === selectedPath && resolved[link.taskIndex] && resolved[link.taskIndex].task;
      });
      if (!taskLinks.length) return;
      var npc = upsertNpc(candidate);
      changed = true;
      if (touched.indexOf(npc) < 0) touched.push(npc);
      taskLinks.forEach(function (link) {
        var task = resolved[link.taskIndex].task;
        var duplicate = state.npcTaskCardLinks.some(function (savedLink) {
          return savedLink.npcId === npc.id && savedLink.taskCardId === task.id;
        });
        if (duplicate) return;
        var now = new Date().toISOString();
        var interaction = {
          id: nextNpcInteractionId(),
          npcId: npc.id,
          taskCardIds: [task.id],
          title: task.title,
          summary: task.title,
          relationshipSignal: {
            trust: npc.relationship.trust,
            influence: npc.relationship.influence,
            alignment: npc.relationship.alignment,
            conflict: npc.relationship.conflict,
            familiarity: npc.relationship.familiarity
          },
          recordedAt: now,
          updatedAt: now
        };
        state.npcInteractions.push(interaction);
        state.npcTaskCardLinks.push({
          id: nextNpcLinkId(),
          npcId: npc.id,
          interactionId: interaction.id,
          taskCardId: task.id,
          relation: NPC_TASK_RELATIONS.indexOf(link.relation) >= 0 ? link.relation : "mentioned",
          reason: npcText(link.reason, 240),
          confidence: npcNumber(link.confidence, 0, 1, 0.5),
          createdAt: now,
          updatedAt: now
        });
      });
    });
    if (changed) commit("npc");
    return touched;
  }

  // 外部立绘服务或素材库接入点；新人物默认 portrait: null。
  function setNpcPortrait(npcId, portrait) {
    var npc = state.npcs.filter(function (profile) { return profile.id === npcId; })[0];
    if (!npc) return null;
    if (portrait == null) {
      npc.portrait = null;
    } else {
      var providers = ["asset_library", "external_service", "manual_upload"];
      if (providers.indexOf(portrait.provider) < 0) return null;
      npc.portrait = {
        provider: portrait.provider,
        assetId: npcText(portrait.assetId, 200),
        imageUrl: npcText(portrait.imageUrl, 1000),
        updatedAt: new Date().toISOString()
      };
    }
    npc.updatedAt = new Date().toISOString();
    commit("npc");
    return npc;
  }

  /* =============================================================
     市井偶遇 / 凌烟阁招募（PRD 09）——共享内容池、名臣招募、加成
     ============================================================= */
  function folkTalk() {
    if (!state.folkTalk || typeof state.folkTalk !== "object") state.folkTalk = normalizeFolkTalk(null);
    return state.folkTalk;
  }
  function contentById(id) { return (data.FOLK_CONTENT || []).filter(function (c) { return c.id === id; })[0] || null; }
  function commonerById(id) { return (data.COMMONERS || []).filter(function (c) { return c.id === id; })[0] || null; }
  function legendById(id) { return (data.LEGENDS || []).filter(function (l) { return l.id === id; })[0] || null; }
  function enabledLegends() {
    return (data.LEGENDS || []).filter(function (legend) {
      return legend && legend.enabled && legend.portraitAsset && legend.buff && legend.buff.id &&
        Array.isArray(legend.praiseContentIds) && legend.praiseContentIds.some(function (id) { return !!contentById(id); });
    });
  }

  // sourceKey → 稳定短 hash，用于 book id（避免 DOI/URL 特殊字符进 DOM id）
  function hashSourceKey(key) {
    var s = String(key || ""), h = 5381;
    for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
    return h.toString(36);
  }

  // 读激活加成，按 buffId 排序返回（供结算/换签调用；各模块只读 activeBuffs，不看 UI）
  function getActiveRewardModifiers() {
    var buffs = folkTalk().activeBuffs || {};
    return Object.keys(buffs).sort().map(function (id) {
      return Object.assign({ id: id }, buffs[id]);
    });
  }
  function sumBuffValue(type) {
    return getActiveRewardModifiers().reduce(function (acc, b) {
      return b.type === type ? acc + (Number(b.value) || 0) : acc;
    }, 0);
  }
  function multiplyBuffValue(type, base) {
    // 按 buffId 排序依次相乘（PRD §10.2）
    return getActiveRewardModifiers().reduce(function (acc, b) {
      return b.type === type ? acc * (Number(b.value) || 1) : acc;
    }, base);
  }
  function legendChance() {
    return enabledLegends().length ? Math.min(0.5, 0.15 + sumBuffValue("encounter_weight_add")) : 0;
  }
  function effectiveTaskGold(taskOrValue) {
    var task = taskOrValue && typeof taskOrValue === "object" ? taskOrValue : null;
    var base = Math.max(0, Number(task ? task.gold : taskOrValue) || 0);
    if (task && (task.restore || task.cat === "mystic")) return 0;
    return Math.round(multiplyBuffValue("task_gold_multiplier", base));
  }
  function effectiveTaskEnergy(taskOrValue) {
    var task = taskOrValue && typeof taskOrValue === "object" ? taskOrValue : null;
    var base = Math.max(0, Math.abs(Number(task ? task.energy : taskOrValue) || 0));
    if (!base || (task && (task.restore || task.cat === "mystic"))) return 0;
    return Math.max(1, Math.round(multiplyBuffValue("task_energy_multiplier", base)));
  }

  // 任务卡预估：普通任务按当前激活加成给出有效金币/精力（§10.3.5）。恢复任务不受影响。
  function effectiveTaskValues(task) {
    var isRecovery = !!(task && task.restore) || (task && task.cat === "mystic");
    var baseGold = (task && task.gold) || 0;
    var baseEnergy = Math.abs((task && task.energy) || 0);
    if (isRecovery) return { gold: baseGold, energy: baseEnergy };
    var gold = Math.round(multiplyBuffValue("task_gold_multiplier", baseGold));
    var energy = baseEnergy > 0 ? Math.max(1, Math.round(multiplyBuffValue("task_energy_multiplier", baseEnergy))) : 0;
    return { gold: gold, energy: energy };
  }

  // 权重抽取（PRD §6，注入式 RNG）
  function drawEncounter(rng) {
    rng = rng || Math.random;
    var ft = folkTalk();
    var legendsAvail = enabledLegends().filter(function (l) {
      // 已招募的名臣仍可再遇（按钮显示「已在麾下」），故不因已招募而排除
      return true;
    });
    var baseLegendChance = 0.15;
    var effectiveLegendChance = legendChance();
    var appliedBuffIds = getActiveRewardModifiers()
      .filter(function (b) { return b.type === "encounter_weight_add"; })
      .map(function (b) { return b.id; });

    var actorType, actorId, contentId = null, legendId = null;
    if (legendsAvail.length && rng() < effectiveLegendChance) {
      actorType = "legend";
      legendId = pickLegend(rng);
      actorId = legendId;
      contentId = pickLegendPraise(legendId, rng);
    } else {
      actorType = "commoner";
      actorId = pickCommoner(rng);
      contentId = pickContent(rng);
    }
    return {
      actorType: actorType, actorId: actorId, legendId: legendId, contentId: contentId,
      baseLegendChance: baseLegendChance, effectiveLegendChance: effectiveLegendChance,
      appliedBuffIds: appliedBuffIds
    };
  }

  // 市井选人（§6.2）：优先未解锁等概率；全解锁则最久未见的 50% 中随机；避免连续同一人
  function pickCommoner(rng) {
    var ft = folkTalk();
    var pool = (data.COMMONERS || []).filter(function (c) { return c && c.enabled; });
    if (!pool.length) return "commoner_001";
    var lastId = ft.activeEncounter && ft.activeEncounter.actorType === "commoner" ? ft.activeEncounter.actorId : null;
    var unseen = pool.filter(function (c) { return !ft.unlockedCommoners[c.id]; });
    var candidates;
    if (unseen.length) {
      candidates = unseen;
    } else {
      // 全解锁：按 lastEncounteredAt 升序取前 50%（最久未见），再随机
      var sorted = pool.slice().sort(function (a, b) {
        var ta = (ft.unlockedCommoners[a.id] || {}).lastEncounteredAt || 0;
        var tb = (ft.unlockedCommoners[b.id] || {}).lastEncounteredAt || 0;
        return ta - tb;
      });
      candidates = sorted.slice(0, Math.max(1, Math.ceil(sorted.length / 2)));
    }
    if (candidates.length > 1 && lastId) {
      var filtered = candidates.filter(function (c) { return c.id !== lastId; });
      if (filtered.length) candidates = filtered;
    }
    return candidates[Math.floor(rng() * candidates.length)].id;
  }

  // 内容选择（§6.3）：按 30/50/20 抽 kind → 未 seen 优先 → 全 seen 排除 recent(≤5) → 仍空则全量但不连续同 id
  function pickContent(rng) {
    var ft = folkTalk();
    var kinds = [["praise", 30], ["knowledge", 50], ["poem", 20]];
    var total = 100, r = rng() * total, acc = 0, chosenKind = "praise";
    for (var i = 0; i < kinds.length; i++) { acc += kinds[i][1]; if (r < acc) { chosenKind = kinds[i][0]; break; } }
    var pool = (data.FOLK_CONTENT || []).filter(function (c) {
      return c && c.enabled && c.kind === chosenKind && c.id.indexOf("legend_") !== 0;
    });
    if (!pool.length) pool = (data.FOLK_CONTENT || []).filter(function (c) { return c && c.enabled && c.id.indexOf("legend_") !== 0; });
    if (!pool.length) return null;
    var lastId = ft.recentContentIds[ft.recentContentIds.length - 1];
    var unseen = pool.filter(function (c) { return ft.seenContentIds.indexOf(c.id) < 0; });
    var candidates = unseen.length ? unseen : pool.filter(function (c) { return ft.recentContentIds.indexOf(c.id) < 0; });
    if (!candidates.length) candidates = pool;
    if (candidates.length > 1 && lastId) {
      var f = candidates.filter(function (c) { return c.id !== lastId; });
      if (f.length) candidates = f;
    }
    return candidates[Math.floor(rng() * candidates.length)].id;
  }

  // 名臣选人（§6.4）：未招募等概率；全招募可重复遇到
  function pickLegend(rng) {
    var ft = folkTalk();
    var pool = enabledLegends();
    if (!pool.length) return null;
    var unrecruited = pool.filter(function (l) { return !ft.recruitedLegends[l.id]; });
    var candidates = unrecruited.length ? unrecruited : pool;
    return candidates[Math.floor(rng() * candidates.length)].id;
  }
  function pickLegendPraise(legendId, rng) {
    var legend = legendById(legendId);
    if (!legend || !legend.praiseContentIds || !legend.praiseContentIds.length) return null;
    var ft = folkTalk();
    var lastId = ft.recentContentIds[ft.recentContentIds.length - 1];
    var ids = legend.praiseContentIds.slice();
    if (ids.length > 1 && lastId) {
      var f = ids.filter(function (id) { return id !== lastId; });
      if (f.length) ids = f;
    }
    return ids[Math.floor(rng() * ids.length)];
  }

  var encSeq = 0;
  function nextEncounterId() { encSeq++; return "enc-" + folkTalk().visitSequence + "-" + encSeq; }

  function archiveEncounter(encounter, reason) {
    if (!encounter) return;
    var ft = folkTalk();
    ft.history.unshift(Object.assign({}, encounter, {
      closedAt: nowStamp(),
      closeReason: reason || "closed"
    }));
    ft.history = ft.history.slice(0, 200);
  }

  // 有效进入民间：生成 navigationToken、按权重抽取、写 activeEncounter（先落盘再渲染 §5.3）
  function beginFolkVisit(navigationToken, fromScene, rng) {
    var ft = folkTalk();
    if (ft.activeEncounter && String(ft.activeEncounter.navigationToken) === String(navigationToken)) return ft.activeEncounter;
    var selection = drawEncounter(rng);
    if (ft.activeEncounter) archiveEncounter(ft.activeEncounter, "new-visit");
    ft.visitSequence = (Number(ft.visitSequence) || 0) + 1;
    var actor = selection.actorType === "legend" ? legendById(selection.actorId) : commonerById(selection.actorId);
    // 兜底（§16.2）：抽取失败 → commoner_001 + 固定夸赞，绝不空白
    if (!actor) {
      selection.actorType = "commoner";
      selection.actorId = "commoner_001";
      selection.legendId = null;
      actor = commonerById("commoner_001") || { id: "commoner_001", displayName: "市井来客", title: "", portraitAsset: "市井1.png" };
    }
    var content = selection.contentId ? contentById(selection.contentId) : null;
    if (!content) {
      var fallback = (data.FOLK_CONTENT || []).filter(function (c) { return c.kind === "praise" && c.id.indexOf("legend_") !== 0; })[0];
      content = fallback || { id: "folk_praise_01", kind: "praise", text: "陛下今日气色甚佳。", source: null };
      selection.contentId = content.id;
    }
    var encounter = {
      encounterId: nextEncounterId(),
      navigationToken: navigationToken,
      fromScene: fromScene || null,
      actorType: selection.actorType,
      actorId: selection.actorId,
      legendId: selection.legendId,
      contentId: selection.contentId,
      status: "generated",
      baseLegendChance: selection.baseLegendChance,
      effectiveLegendChance: selection.effectiveLegendChance,
      appliedBuffIds: selection.appliedBuffIds,
      bookCollected: false,
      recruited: false,
      isFirstMeetCommoner: selection.actorType === "commoner" && !ft.unlockedCommoners[selection.actorId],
      createdAt: nowStamp()
    };
    ft.activeEncounter = encounter;
    commit("folk-encounter");
    return encounter;
  }

  // 素材就绪、展示时调用：status→displayed，commoner 首显写 unlockedCommoners（幂等）
  function markEncounterDisplayed(encounterId) {
    var ft = folkTalk();
    var enc = ft.activeEncounter;
    if (!enc || enc.encounterId !== encounterId) return null;
    if (enc.status === "displayed" || enc.displayedAt) return enc;
    enc.status = "displayed";
    enc.displayedAt = nowStamp();
    // 记录 recent/seen 内容
    if (enc.contentId) {
      if (ft.seenContentIds.indexOf(enc.contentId) < 0) ft.seenContentIds.push(enc.contentId);
      ft.recentContentIds = ft.recentContentIds.filter(function (id) { return id !== enc.contentId; });
      ft.recentContentIds.push(enc.contentId);
      ft.recentContentIds = ft.recentContentIds.slice(-5);
    }
    if (enc.actorType === "commoner") {
      var rec = ft.unlockedCommoners[enc.actorId];
      var now = nowStamp();
      if (!rec) {
        ft.unlockedCommoners[enc.actorId] = { encounterCount: 1, firstEncounteredAt: now, lastEncounteredAt: now };
        commit("folk");
        emit("commoner-unlocked", { commonerId: enc.actorId });
      } else {
        rec.encounterCount = (rec.encounterCount || 0) + 1;
        rec.lastEncounteredAt = now;
        commit("folk");
      }
    } else {
      commit("folk");
    }
    emit("folk-encounter-displayed", { encounter: enc, newlyUnlocked: !!enc.isFirstMeetCommoner });
    return enc;
  }

  // 收入藏书阁（幂等键 collect:{enc}:{sourceKey}）：同 sourceKey 已有则 already_collected，否则 addBook
  function collectFolkSource(encounterId, contentId, sourceKey) {
    var ft = folkTalk();
    var enc = ft.activeEncounter;
    if (!enc || enc.encounterId !== encounterId || enc.actorType !== "commoner") return { status: "no_encounter" };
    if (enc.contentId !== contentId) return { status: "mismatch" };
    var content = contentById(contentId);
    if (!content || !content.source) return { status: "not_collectible" };
    var src = content.source;
    var key = sourceKey || src.sourceKey;
    if (!key || key !== src.sourceKey) return { status: "mismatch" };
    var actionId = "collect:" + encounterId + ":" + key;
    // 查 books 中同 sourceKey 的 folk-encounter 书
    var existing = (state.books || []).filter(function (b) { return b && b.shelf === "folk-talk" && b.sourceKey === key; })[0];
    if (ft.actionLedger[actionId] || existing) {
      enc.bookCollected = true;
      save();
      return { status: "already_collected", book: existing };
    }
    var covers = [data.ASSET_BASE + "物品/书1.png", data.ASSET_BASE + "物品/书2.png", data.ASSET_BASE + "物品/书3.png"];
    var book = {
      id: "folk-book:" + hashSourceKey(key),
      title: src.bookTitle,
      author: src.author || "",
      note: content.text,
      content: content.text,
      cover: covers[(state.books.length) % 3],
      shelf: "folk-talk",
      origin: "folk-encounter",
      useInDecision: false,
      sourceType: src.sourceType,
      sourceKey: key,
      source: Object.assign({}, src),
      sourceLabel: src.author ? (src.author + (src.year ? " (" + src.year + ")" : "")) : "",
      sourceUrl: src.url || null,
      contentId: contentId,
      collectedFromEncounterId: encounterId,
      collectedAt: nowStamp(),
      folk: true
    };
    state.books.unshift(book);
    enc.bookCollected = true;
    ft.actionLedger[actionId] = { type: "collect", bookId: book.id, completedAt: nowStamp() };
    appendJournal("市井拾言", "《" + src.bookTitle + "》已收入藏书阁【市井闲谈】。", {
      type: "folk-book", bookId: book.id, sourceKey: key
    });
    commit("folk");
    emit("folk-book-collected", { book: book, encounterId: encounterId });
    emit("folkbook", { book: book, encounterId: encounterId });
    return { status: "collected", book: book };
  }

  // 招募名臣：原子事务（§9.3），幂等键 recruit:{enc}:{legendId}
  function recruitLegend(encounterId, legendId) {
    var ft = folkTalk();
    var enc = ft.activeEncounter;
    if (!enc || enc.encounterId !== encounterId) return { status: "no_encounter" };
    if (enc.actorType !== "legend" || enc.legendId !== legendId) return { status: "mismatch" };
    var legend = legendById(legendId);
    if (!legend || !legend.enabled) return { status: "invalid" };
    if (ft.recruitedLegends[legendId]) { enc.recruited = true; save(); return { status: "already_recruited", legend: legend, buff: ft.activeBuffs[legend.buff.id] }; }
    var buff = legend.buff;
    var actionId = "recruit:" + encounterId + ":" + legendId;
    // 快照回滚点
    var snapshotRecruited = JSON.parse(JSON.stringify(ft.recruitedLegends));
    var snapshotBuffs = JSON.parse(JSON.stringify(ft.activeBuffs));
    var snapshotActions = JSON.parse(JSON.stringify(ft.actionLedger));
    var snapshotRecruitedFlag = enc.recruited;
    try {
      var now = nowStamp();
      ft.recruitedLegends[legendId] = { recruitedAt: now, encounterId: encounterId };
      if (!ft.activeBuffs[buff.id]) {   // 同 buffId 不叠加（§10.6.6）
        ft.activeBuffs[buff.id] = {
          legendId: legendId, type: buff.type, value: buff.value,
          stackMode: buff.stackMode, name: buff.name, description: buff.description, activatedAt: now
        };
      }
      enc.recruited = true;
      ft.actionLedger[actionId] = { type: "recruit", legendId: legendId, buffId: buff.id, completedAt: now };
      commit("folk");
      emit("legend-recruited", { legendId: legendId, legend: legend, buff: ft.activeBuffs[buff.id] });
      emit("buff-activated", { buffId: buff.id, legendId: legendId, buff: ft.activeBuffs[buff.id] });
      return { status: "recruited", legend: legend, buff: buff };
    } catch (e) {
      // 回滚
      ft.recruitedLegends = snapshotRecruited;
      ft.activeBuffs = snapshotBuffs;
      ft.actionLedger = snapshotActions;
      enc.recruited = snapshotRecruitedFlag;
      console.error("[store] recruitLegend failed, rolled back", e);
      return { status: "error" };
    }
  }

  // 关闭偶遇：写 history、清 activeEncounter（不生成下一次）
  function closeFolkEncounter(encounterId) {
    var ft = folkTalk();
    var enc = ft.activeEncounter;
    if (!enc || (encounterId && enc.encounterId !== encounterId)) return;
    archiveEncounter(enc, "continue");
    ft.activeEncounter = null;
    commit("folk");
    emit("folk-encounter-closed", enc);
    return enc;
  }

  function folkActorName(enc) {
    if (!enc) return "一位市井之人";
    if (enc.actorType === "legend") { var l = legendById(enc.actorId); return l ? l.displayName : "一位名臣"; }
    var c = commonerById(enc.actorId); return c ? c.displayName : "一位市井之人";
  }
  function nowStamp() {
    try { return new Date().toISOString(); } catch (e) { return "" + state.day; }
  }

  // 兼容旧调用（scene/library/lingyan 过渡期）——空实现或代理，避免旧引用报错
  function folkMetIds() { return Object.keys(folkTalk().unlockedCommoners || {}); }
  function hasMetFolk(id) { return !!folkTalk().unlockedCommoners[id]; }
  function currentFolkEncounter() { return folkTalk().activeEncounter; }
  function isFolkSourceCollected(sourceKey) {
    return (state.books || []).some(function (book) { return book && book.shelf === "folk-talk" && book.sourceKey === sourceKey; });
  }

  // templates: [{title,cat,durationMinutes,from,knowledgeRefs}]；数值始终由 economy 固定计算。
  // 返回落地后的任务数组（含 id/scene/bg）
  function deployTasks(templates) {
    var created = [];
    var merged = [];
    var resolved = [];
    (templates || []).forEach(function (tpl, i) {
      var title = cleanTaskTitle(tpl.title) || "推进此事的第一步";
      var category = data.CATEGORIES[tpl.cat] ? tpl.cat : "daily";
      var safeTemplate = Object.assign({}, tpl, { title: title, cat: category });
      var catDef = data.CATEGORIES[category] || data.CATEGORIES.daily;
      var values = window.App.economy.calculate(safeTemplate, safeTemplate.cat);
      var overlap = overlappingTask(safeTemplate.title, catDef.scene);
      if (overlap) {
        var existing = overlap.task;
        mergeTaskMetadata(existing, Object.assign({}, safeTemplate, { updatedDay: state.day }));
        merged.push({ task: existing, template: safeTemplate, similarity: overlap.similarity });
        resolved.push({ task: existing, template: safeTemplate, merged: true });
        return;
      }
      var task = {
        id: nextTaskId(),
        title: safeTemplate.title,
        cat: safeTemplate.cat,
        scene: catDef.scene,
        durationMinutes: values.durationMinutes,
        energyTier: values.energyTier,
        energy: values.energy,
        gold: values.gold,
        restore: values.restore,
        from: safeTemplate.from || "",
        sourceKind: safeTemplate.sourceKind || "",
        tags: Array.isArray(safeTemplate.tags) ? safeTemplate.tags.slice(0, 8) : [],
        independent: !!safeTemplate.independent,
        relatedFrom: safeTemplate.from ? [safeTemplate.from] : [],
        knowledgeRefs: Array.isArray(safeTemplate.knowledgeRefs) ? safeTemplate.knowledgeRefs.slice(0, 5) : [],
        bg: data.brain.taskBg(state.mapTasks.length + i),
        done: false,
        day: state.day
      };
      state.mapTasks.push(task);
      created.push(task);
      resolved.push({ task: task, template: safeTemplate, merged: false });
    });
    created.merged = merged;
    created.resolved = resolved;
    commit("task");
    emit("deploy", { created: created, merged: merged });
    return created;
  }

  function finalizeDemoTasks() {
    var finalized = 0;
    state.mapTasks.forEach(function (task) {
      if (task.sourceKind !== "demo") return;
      task.sourceKind = "demo-kept";
      finalized += 1;
    });
    if (finalized) commit("task");
    return finalized;
  }

  function tasksForScene(sceneId) {
    return state.mapTasks.filter(function (t) { return t.scene === sceneId && !t.expired; });
  }
  function pendingCount() {
    return state.mapTasks.filter(function (t) { return !t.done && !t.expired; }).length;
  }

  // 标记一个地图任务完成 → 结算精力/金币/成就
  function completeMapTask(taskId) {
    var t = null;
    for (var i = 0; i < state.mapTasks.length; i++) { if (state.mapTasks[i].id === taskId) { t = state.mapTasks[i]; break; } }
    if (!t || t.done || t.expired) return;
    t.done = true;

    var previousBatch = achievementBatch;
    var unlockedHere = [];
    achievementBatch = unlockedHere;
    var countsForAchievements = taskCountsForAchievements(t);
    // 结算：普通任务同时扣精力并发任务金币；恢复任务只恢复精力。
    var isRecovery = !!t.restore || t.cat === "mystic";
    // 名臣加成（PRD §10）——只作用于普通任务，结算时按 activeBuffs 计算
    var baseGold = t.gold || 0;
    var baseEnergy = Math.abs(t.energy || 0);
    var finalGold = baseGold, finalEnergy = baseEnergy;
    var appliedBuffIds = [];
    if (!isRecovery) {
      var mods = getActiveRewardModifiers();
      appliedBuffIds = mods.filter(function (b) {
        return b.type === "task_gold_multiplier" || b.type === "task_energy_multiplier";
      }).map(function (b) { return b.id; });
      // 金笔生花：基础金币 → 按 buffId 排序连乘 → 四舍五入
      finalGold = Math.round(multiplyBuffValue("task_gold_multiplier", baseGold));
      // 银叶轻覆：max(1, round(base×0.5))，base=0 仍 0
      if (baseEnergy > 0) finalEnergy = Math.max(1, Math.round(multiplyBuffValue("task_energy_multiplier", baseEnergy)));
    }
    var receipt = settleEconomy({
      id: "task:" + t.id,
      type: isRecovery ? "recovery-task" : "task",
      source: t.scene,
      energyDelta: isRecovery ? t.restore : -finalEnergy,
      energyKind: isRecovery ? "recovery" : "spend",
      goldDelta: isRecovery ? 0 : finalGold,
      goldKind: isRecovery ? "none" : "task",
      countsForAchievements: countsForAchievements,
      appliedBuffIds: appliedBuffIds,
      baseGold: baseGold, finalGold: finalGold,
      baseEnergy: baseEnergy, finalEnergy: finalEnergy
    });
    if (countsForAchievements && !isRecovery && finalGold && t.sourceKind === "decision") {
      state.counters.approvalGold += finalGold;
      setAchProgress("approval-gold", state.counters.approvalGold);
    }

    if (countsForAchievements) state.completedTasks.push(t.id);
    var stats = currentDailyStats();
    if (isRecovery) {
      if (countsForAchievements) {
        stats.recoveryEvents++;
        if (receipt.energyBefore <= 30 && receipt.energyActual > 0) unlock("jade-low-energy-deliver");
        if (receipt.energyBefore <= 10 && receipt.energyActual > 0) unlock("jade-critical-complete");
      }
      if (t.isDailyMystic && state.dailyMystic && state.dailyMystic.taskId === t.id) state.dailyMystic.status = "completed";
    } else if (countsForAchievements) {
      stats.productiveTasks++;
      state.counters.tasksDone++;
      var n = state.counters.tasksDone;
      unlock("first-task-kiln-fire");
      setAchProgress("tasks-3-raw-body", n);
      setAchProgress("tasks-5-five-wares", n);
      setAchProgress("tasks-10-warm-glaze", n);
      setAchProgress("tasks-20-kiln-transform", n);
      setAchProgress("tasks-50-official-kiln", n);
      setAchProgress("tasks-100-eternal-porcelain", n);
      if (state.counters.fogReturnPending) {
        state.counters.fogReturnPending = false;
        unlock("fog-return");
      }
    }

    // 场景/分类相关成就
    if (countsForAchievements && !isRecovery && t.scene === "ministry") unlock("first-daily-liubu");
    if (countsForAchievements && !isRecovery && t.scene === "garden") unlock("first-explore-garden");
    if (countsForAchievements && !isRecovery && t.scene === "folk") unlock("first-fog-minjian");
    if (countsForAchievements && !isRecovery && t.scene === "court" && (t.independent || t.cat === "main")) unlock("first-solo-delivery");
    if (countsForAchievements && !isRecovery && t.energyTier === "HEAVY") unlock("single-big-reward");
    if (countsForAchievements && !isRecovery && ((t.tags || []).indexOf("weekly_report") >= 0 || (t.tags || []).indexOf("sop") >= 0 || /周报|周奏|SOP|章程|流程/.test(t.title))) {
      unlock("weekly-memorial-sop");
    }
    if (countsForAchievements && !isRecovery && ((t.tags || []).indexOf("regularization_defense") >= 0 || /结业答辩|转正.*答辩|答辩.*转正/.test(t.title))) {
      unlock("regularization-defense");
    }
    if (countsForAchievements && t.scene === "observatory" && isRecovery && receipt.energyActual > 0) {
      unlock("jade-astro-first-restore");
      state.counters.astroDone++;
      setAchProgress("jade-astro-ten-times", state.counters.astroDone);
    }
    if (countsForAchievements && !isRecovery && t.scene === "ministry") {
      var minCount = state.completedTasks.filter(function (id) {
        var tt = tasksForSceneAll(id); return tt && tt.scene === "ministry" && !tt.restore;
      }).length;
      setAchProgress("survey-six-ministries", Math.min(6, minCount));
    }

    var referenceText = t.knowledgeRefs && t.knowledgeRefs.length ? " · 参考「" + t.knowledgeRefs.join("、") + "」" : "";
    achievementBatch = previousBatch;
    var achievementGold = unlockedHere.reduce(function (sum, event) { return sum + Math.max(0, event.receipt.goldActual || 0); }, 0);
    var achievementNames = unlockedHere.map(function (event) { return event.def.name; });
    var energyLabel = receipt.energyActual > 0 ? "恢复精力 +" + receipt.energyActual : "精力 " + receipt.energyActual;
    var settlementText = "结算：" + energyLabel + "（" + receipt.energyBefore + "→" + receipt.energyAfter + "）" +
      (!isRecovery ? " · 任务金币 +" + receipt.goldActual : " · 恢复任务无金币") +
      (achievementNames.length ? " · 解锁成就「" + achievementNames.join("、") + "」" +
        (achievementGold ? "，成就奖励 +" + achievementGold + " 金已自动到账" : "，称号已自动入库") : "");
    appendJournal(
      t.isDailyMystic ? "天象·" + t.mysticName : t.title,
      (t.isDailyMystic ? "微探索完成" : "任务达成") + " · " + (data.CATEGORIES[t.cat] ? data.CATEGORIES[t.cat].label : "") + " · " + settlementText +
        (t.from ? " · 源自决策「" + t.from + "」" : "") + referenceText,
      { type: "task", taskId: t.id, settlementId: receipt.id, achievementIds: unlockedHere.map(function (event) { return event.def.id; }) }
    );
    commit("task");
    emit("taskDone", { task: t, settlement: receipt, achievements: unlockedHere });
    return receipt;
  }
  function tasksForSceneAll(id) {
    for (var i = 0; i < state.mapTasks.length; i++) { if (state.mapTasks[i].id === id) return state.mapTasks[i]; }
    return null;
  }

  /* ---------- 朱批（决策奏折） ----------
     kind: 'agree'（采纳并投放） | 'again'（再议，记起居注） | 'bold'（大胆，大臣道歉重问）
     agree 时传入 templates（将生成的任务），返回投放的任务。 */
  function applyPizhu(kind, decision, templates, options) {
    if (kind === "again") {
      if (achievementTrackingEnabled()) state.counters.pizhuAgain++;
      unlock("pizhu-zaiyi");
      addJournal((decision && decision.title) || "一桩决策", "朱批·再议：留中不发，容后补充信息再作定夺。");
      commit("task");
      return null;
    }
    if (kind === "bold") {
      if (achievementTrackingEnabled()) state.counters.pizhuBold++;
      unlock("pizhu-dadan");
      addJournal((decision && decision.title) || "一桩决策", "朱批·大胆：陛下以为判断草率，命大臣重新补充信息。");
      commit("task");
      return null;
    }
    // agree
    unlock("first-vermilion-brush");
    unlock("first-audience-minister");
    if (achievementTrackingEnabled()) state.counters.approvals++;
    var deployed = deployTasks(templates);
    deployed.npcs = recordDecisionNpcs(decision, deployed.resolved || [], options && options.pathKey);
    return deployed;
  }

  /* ---------- 起居注 / 藏书 ---------- */
  var jSeq = 100;
  function appendJournal(title, text, meta) {
    var j = Object.assign({
      id: "j" + (jSeq++), day: state.day, dayKey: state.dayKey,
      createdAt: new Date().toISOString(), title: title, text: text
    }, meta || {});
    state.journals.unshift(j);
    return j;
  }
  function addJournal(title, text, meta) {
    var j = appendJournal(title, text, meta);
    commit("journal");
    return j;
  }
  function readArchive() {
    if (achievementTrackingEnabled()) state.counters.archiveReads++;
    unlock("archive-first-read");
    commit();
  }
  var bSeq = 100;
  function addBook(book, options) {
    options = options || {};
    book.id = book.id || ("ub" + (bSeq++));
    book.shelf = book.shelf || "strategy";
    if (book.useInDecision == null) book.useInDecision = book.shelf === "strategy";
    state.books.unshift(book);
    if (options.countsForAchievements !== false && achievementTrackingEnabled()) {
      state.counters.uploads++;
      unlock("archive-upload");
    }
    commit("book");
    return book;
  }
  function addKnowledgeDocument(document) {
    state.knowledge = state.knowledge || { documents: [] };
    state.knowledge.documents = state.knowledge.documents || [];
    var entry = {
      id: document.id || ("kd" + Date.now() + Math.random().toString(36).slice(2, 7)),
      title: String(document.title || document.fileName || "用户典籍").slice(0, 80),
      fileName: String(document.fileName || "").slice(0, 160),
      content: String(document.content || "").slice(0, 60000)
    };
    state.knowledge.documents.unshift(entry);
    state.knowledge.documents = state.knowledge.documents.slice(0, 12);
    commit("knowledge");
    return entry;
  }

  /* ---------- 场景会话：切换不丢失，跨日归档 ---------- */
  function saveConversation(sceneId, snapshot) {
    if (!sceneId || !snapshot) return null;
    var copy = JSON.parse(JSON.stringify(snapshot));
    copy.scene = sceneId;
    copy.day = state.day;
    copy.updatedAt = new Date().toISOString();
    state.conversationSessions = state.conversationSessions || {};
    state.conversationSessions[sceneId] = copy;
    save();
    emit("conversation", { sceneId: sceneId, session: copy });
    return copy;
  }
  function getConversation(sceneId) {
    var session = state.conversationSessions && state.conversationSessions[sceneId];
    return session && session.day === state.day ? session : null;
  }
  function archiveConversationState(sceneId) {
    var sessions = state.conversationSessions || {};
    var session = sessions[sceneId];
    if (!session) return null;
    var journal = null;
    var summaryParts = conversationSummaryParts(session.transcript).slice(-12);
    if (session.pendingDecision && session.pendingDecision.decision) {
      summaryParts.push("未朱批奏折「" + String(session.pendingDecision.decision.title || "未命名奏折") + "」已随商讨归档，未生成任务。");
    } else if (session.activeQuestion && session.activeQuestion.q) {
      summaryParts.push("未回答追问「" + String(session.activeQuestion.q) + "」已随商讨归档。");
    }
    if (summaryParts.length) {
      var sc = data.sceneById(sceneId);
      journal = {
        id: "j" + (jSeq++), day: state.day,
        title: conversationJournalTitle(sc, session.topic),
        text: summaryParts.join("\n").slice(0, 1800),
        type: "conversation"
      };
      state.journals.unshift(journal);
    }
    delete sessions[sceneId];
    return journal;
  }
  function archiveConversation(sceneId) {
    var existed = state.conversationSessions && state.conversationSessions[sceneId];
    if (!existed) return null;
    var journal = archiveConversationState(sceneId);
    commit("conversation");
    if (journal) emit("journal", journal);
    return journal;
  }
  function archiveConversationSessions() {
    var sessions = state.conversationSessions || {};
    Object.keys(sessions).forEach(archiveConversationState);
    state.conversationSessions = {};
  }

  /* ---------- 模式 ---------- */
  function setMode(m) { state.mode = m; commit("mode"); }
  function addFlowMinutes(mins, options) {
    options = options || {};
    if (options.countsForAchievements === false || !achievementTrackingEnabled()) { commit(); return; }
    state.counters.flowMinutes += mins;
    setAchProgress("flow-focus-single", Math.min(25, mins));
    setAchProgress("flow-focus-master", state.counters.flowMinutes);
    commit();
  }
  function useProphecy(decisionId) {
    if (!achievementTrackingEnabled()) { commit(); return; }
    state.counters.prophecyUses++;
    unlock("prophecy-first");
    var key = String(decisionId || "default");
    state.counters.prophecyByDecision = state.counters.prophecyByDecision || {};
    state.counters.prophecyByDecision[key] = (state.counters.prophecyByDecision[key] || 0) + 1;
    setAchProgress("redo-simulation", state.counters.prophecyByDecision[key]);
    commit();
  }

  /* ---------- 天数推进 ---------- */
  function evaluateClosedDay(key) {
    var stats = ensureDailyStats(key, state.energy);
    state.counters.aboveFiftyStreak = stats.minEnergy >= 50 ? state.counters.aboveFiftyStreak + 1 : 0;
    state.counters.noZeroStreak = stats.overdrawn || stats.minEnergy <= 0 ? 0 : state.counters.noZeroStreak + 1;
    state.counters.endAbove120Streak = stats.endEnergy >= 120 ? state.counters.endAbove120Streak + 1 : 0;
    state.counters.dailyGoldStreak = stats.goldEarned > 0 ? state.counters.dailyGoldStreak + 1 : 0;
    setAchProgress("jade-three-days-above-fifty", state.counters.aboveFiftyStreak);
    setAchProgress("jade-seven-days-no-zero", state.counters.noZeroStreak);
    setAchProgress("jade-hold-cap-three-days", state.counters.endAbove120Streak);
    setAchProgress("daily-gold-streak", state.counters.dailyGoldStreak);
    updateGrandHarmony();
  }
  function applyDayProgress() {
    setAchProgress("thirty-day-foothold", state.day);
    setAchProgress("sixty-day-reform", state.day);
    setAchProgress("ninety-day-coronation", state.day);
  }
  function syncDay(value, silent) {
    var nextKey = localDayKey(value);
    if (!state.dayKey) state.dayKey = nextKey;
    ensureDailyStats(state.dayKey, state.energy).endEnergy = state.energy;
    var elapsed = dayOrdinal(nextKey) - dayOrdinal(state.dayKey);
    if (elapsed <= 0) return false;

    var previousKey = state.dayKey;
    expireAndResetDailyMystic(nextKey);
    var previousBatch = achievementBatch;
    var unlockedHere = [];
    achievementBatch = unlockedHere;
    archiveConversationSessions();
    var passiveTotal = 0;
    for (var i = 1; i <= elapsed; i++) {
      evaluateClosedDay(state.dayKey);
      var key = shiftDayKey(previousKey, i);
      state.day++;
      state.dayKey = key;
      state.dailyStats[key] = freshDailyStats(state.energy);
      var dayReceipt = settleEconomy({
        id: "day:" + key,
        type: "day",
        source: "natural-recovery",
        energyDelta: DAILY_ENERGY_GAIN,
        energyKind: "passive"
      });
      passiveTotal += dayReceipt.energyActual;
    }
    applyDayProgress();
    trimDailyStats();
    achievementBatch = previousBatch;
    appendJournal(
      "新日结算",
      "跨越 " + elapsed + " 个自然日 · 自然恢复精力 +" + passiveTotal + " · 当前精力 " + state.energy + "/" + state.energyCap +
        (unlockedHere.length ? " · 解锁成就「" + unlockedHere.map(function (event) { return event.def.name; }).join("、") + "」，奖励已自动到账" : ""),
      { type: "day", settlementIds: Object.keys(state.settlementLedger).filter(function (id) { return id.indexOf("day:") === 0; }).slice(-elapsed) }
    );
    maybeOfferDailyMystic("open-after-recovery");
    if (silent) save(); else commit("day");
    return true;
  }
  function advanceDay(by) {
    var amount = Math.max(1, Math.round(Number(by) || 1));
    return syncDay(shiftDayKey(state.dayKey || localDayKey(), amount));
  }

  /* ---------- Onboarding 完成 ---------- */
  function finishOnboarding(profile, empressType, startedAt) {
    state.onboarded = true;
    state.profile = profile;
    state.empressType = empressType;
    var started = new Date(startedAt || Date.now());
    state.startedAt = isNaN(started.getTime()) ? new Date().toISOString() : started.toISOString();
    state.scene = "court";
    if (state.visitedScenes.indexOf("court") < 0) state.visitedScenes.push("court");
    // 播种起居注
    data.JOURNALS_SEED.forEach(function (j) { state.journals.push(Object.assign({}, j)); });
    // 播种默认藏书
    data.BOOKS.forEach(function (b) { state.books.push(Object.assign({ shelf: "strategy", useInDecision: true }, b)); });
    commit("onboarded");
  }

  function toggleSidebar(force) {
    state.sidebarCollapsed = (typeof force === "boolean") ? force : !state.sidebarCollapsed;
    commit("sidebar");
  }

  load();
  ensureDailyStats(state.dayKey || localDayKey(), state.energy);
  reconcileAchievementState();
  migrateAchievementRewards();
  syncDay(undefined, true);
  maybeOfferDailyMystic("open");

  window.App.store = {
    ENERGY_CAP: ENERGY_CAP,
    DAILY_ENERGY_GAIN: DAILY_ENERGY_GAIN,
    STORAGE_KEY: STORAGE_KEY,
    get: get, save: save, reset: reset,
    on: on, off: off, emit: emit,
    today: today,
    // 精力金币
    settle: settleEconomy, addEnergy: addEnergy, setEnergy: setEnergy, addGold: addGold,
    // 场景 + 地图任务
    moveScene: moveScene,
    deployTasks: deployTasks, previewTaskOverlaps: previewTaskOverlaps, completeMapTask: completeMapTask, finalizeDemoTasks: finalizeDemoTasks,
    tasksForScene: tasksForScene, pendingCount: pendingCount,
    maybeOfferDailyMystic: maybeOfferDailyMystic, offerMysticCard: offerMysticCard, rerollDailyMystic: rerollDailyMystic, dailyRerollCap: dailyRerollCap,
    applyPizhu: applyPizhu, setNpcPortrait: setNpcPortrait,
    // 市井偶遇 / 凌烟阁招募（PRD 09）
    beginFolkVisit: beginFolkVisit, markEncounterDisplayed: markEncounterDisplayed,
    collectFolkSource: collectFolkSource, recruitLegend: recruitLegend, closeFolkEncounter: closeFolkEncounter,
    drawEncounter: drawEncounter, getActiveRewardModifiers: getActiveRewardModifiers, effectiveTaskValues: effectiveTaskValues,
    currentFolkEncounter: currentFolkEncounter, isFolkSourceCollected: isFolkSourceCollected,
    legendChance: legendChance, effectiveTaskGold: effectiveTaskGold, effectiveTaskEnergy: effectiveTaskEnergy,
    maxMysticRerolls: dailyRerollCap,
    folkTalk: folkTalk, hasMetFolk: hasMetFolk, folkMetIds: folkMetIds,
    // 成就
    unlock: unlock, demoUnlock: demoUnlock, bumpAch: bumpAch, setAchProgress: setAchProgress,
    achState: achState, progress: progress,
    // 藏书起居注
    addJournal: addJournal, readArchive: readArchive, addBook: addBook,
    addKnowledgeDocument: addKnowledgeDocument,
    saveConversation: saveConversation, getConversation: getConversation, archiveConversation: archiveConversation,
    // 模式
    setMode: setMode, addFlowMinutes: addFlowMinutes, useProphecy: useProphecy,
    // 生命周期
    syncDay: syncDay, advanceDay: advanceDay,
    finishOnboarding: finishOnboarding, toggleSidebar: toggleSidebar
  };
})();
