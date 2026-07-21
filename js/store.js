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
  var STATE_VERSION = 8;
  var ENERGY_CAP = 150;
  var DAILY_ENERGY_GAIN = 30;
  var MAX_DAILY_COUNTED_RESTORE = 60;

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

  function initialState() {
    return {
      version: STATE_VERSION,
      onboarded: false,
      startedAt: null,        // 由 UI 层填入时间字符串
      day: 1,
      profile: { nickname: "陛下", answers: [] },
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
        state.knowledge = Object.assign({ documents: [] }, parsed.knowledge || {});
        if (!Array.isArray(state.knowledge.documents)) state.knowledge.documents = [];
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

  function maybeOfferDailyMystic(trigger) {
    var daily = ensureMysticDay(state.dayKey || localDayKey());
    if (daily.status !== "idle" || state.energy > 60) return null;
    var card = chooseMysticCard(null);
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

  function rerollDailyMystic() {
    var daily = ensureMysticDay(state.dayKey || localDayKey());
    if (daily.status !== "offered" || daily.rerollsUsed >= 1 || !daily.taskId) return null;
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
    if (delta <= 0) return;
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

    if (energyKind === "recovery" && actualEnergy > 0) {
      var countableRoom = Math.max(0, MAX_DAILY_COUNTED_RESTORE - stats.achievementRestored);
      var counted = Math.min(actualEnergy, countableRoom);
      state.totalActualRestored += actualEnergy;
      state.totalCountedRestored += counted;
      state.totalRestored = state.totalCountedRestored;
      stats.actualRestored += actualEnergy;
      stats.achievementRestored += counted;
    } else if (energyKind === "passive" && actualEnergy > 0) {
      stats.passiveRestored += actualEnergy;
    } else if (energyKind === "calibration") {
      stats.calibrated = true;
    }
    if (state.energy === 0 && energyBefore > 0) stats.overdrawn = true;
    recordEnergySnapshot();

    var requestedGold = Number(transaction.goldDelta) || 0;
    state.gold = Math.max(0, state.gold + requestedGold);
    var actualGold = state.gold - goldBefore;
    var goldKind = String(transaction.goldKind || "none");
    if (actualGold > 0) {
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
      titleGranted: grantedTitle
    };
    state.settlementLedger[id] = receipt;
    save();

    if (energyKind === "recovery" && actualEnergy > 0) {
      if (state.energy >= 100) unlock("jade-first-restore-hundred");
      if (state.energy >= 150) unlock("jade-full-cap-150");
      setAchProgress("jade-accumulate-500", state.totalRestored);
      setAchProgress("jade-accumulate-2000", state.totalRestored);
      if (energyBefore <= 30 && state.energy >= 60) unlock("jade-single-day-rebound");
      updateGrandHarmony();
    }
    if (energyKind === "passive" && state.energy >= 150) unlock("jade-full-cap-150");
    if ((energyKind === "recovery" || energyKind === "passive") && state.gold >= 500 && state.energy >= 100) unlock("gold-and-energy-balance");
    if (actualGold > 0) evaluateGoldAchievements(actualGold, transaction.source, goldKind);
    if (actualGold < 0) unlock("first-spend");

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
    var def = data.achById[id]; if (!def) return;
    var rec = state.achievements[id] || (state.achievements[id] = { unlocked: false, cur: 0, date: null });
    if (cur > rec.cur) rec.cur = cur;
    if (!rec.unlocked && rec.cur >= def.target) unlock(id);
  }
  function updateGrandHarmony() {
    var def = data.achById["jade-grand-harmony"];
    var rec = state.achievements["jade-grand-harmony"];
    if (!def || !rec) return;
    if (state.totalRestored > rec.cur) rec.cur = state.totalRestored;
    if (!rec.unlocked && rec.cur >= def.target && state.counters.noZeroStreak >= 30) unlock(def.id);
  }
  function bumpAch(id, by) {
    var def = data.achById[id]; if (!def) return;
    var rec = state.achievements[id] || (state.achievements[id] = { unlocked: false, cur: 0, date: null });
    rec.cur += (by || 1);
    if (!rec.unlocked && rec.cur >= def.target) unlock(id);
  }
  function unlock(id) {
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
    var completed = (state.mapTasks || []).filter(function (task) { return task.done && !task.restore && task.cat !== "mystic"; });
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
      energyKind: options.source === "passive" ? "passive" : (delta > 0 ? "recovery" : "spend")
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
  function moveScene(id) {
    var sc = data.sceneById(id); if (!sc) return;
    if (state.scene === "folk" && id === "court") state.counters.fogReturnPending = true;
    state.scene = id;
    if (state.visitedScenes.indexOf(id) < 0) {
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

  // templates: [{title,cat,durationMinutes,from,knowledgeRefs}]；数值始终由 economy 固定计算。
  // 返回落地后的任务数组（含 id/scene/bg）
  function deployTasks(templates) {
    var created = [];
    var merged = [];
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
    });
    created.merged = merged;
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
    // 结算：普通任务同时扣精力并发任务金币；恢复任务只恢复精力。
    var isRecovery = !!t.restore || t.cat === "mystic";
    var receipt = settleEconomy({
      id: "task:" + t.id,
      type: isRecovery ? "recovery-task" : "task",
      source: t.scene,
      energyDelta: isRecovery ? t.restore : -Math.abs(t.energy || 0),
      energyKind: isRecovery ? "recovery" : "spend",
      goldDelta: isRecovery ? 0 : (t.gold || 0),
      goldKind: isRecovery ? "none" : "task"
    });
    if (!isRecovery && t.gold && t.sourceKind === "decision") {
      state.counters.approvalGold += t.gold;
      setAchProgress("approval-gold", state.counters.approvalGold);
    }

    state.completedTasks.push(t.id);
    var stats = currentDailyStats();
    if (isRecovery) {
      stats.recoveryEvents++;
      if (receipt.energyBefore <= 30 && receipt.energyActual > 0) unlock("jade-low-energy-deliver");
      if (receipt.energyBefore <= 10 && receipt.energyActual > 0) unlock("jade-critical-complete");
      if (t.isDailyMystic && state.dailyMystic && state.dailyMystic.taskId === t.id) state.dailyMystic.status = "completed";
    } else {
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
    if (!isRecovery && t.scene === "ministry") unlock("first-daily-liubu");
    if (!isRecovery && t.scene === "garden") unlock("first-explore-garden");
    if (!isRecovery && t.scene === "folk") unlock("first-fog-minjian");
    if (!isRecovery && t.scene === "court" && (t.independent || t.cat === "main")) unlock("first-solo-delivery");
    if (!isRecovery && t.energyTier === "HEAVY") unlock("single-big-reward");
    if (!isRecovery && ((t.tags || []).indexOf("weekly_report") >= 0 || (t.tags || []).indexOf("sop") >= 0 || /周报|周奏|SOP|章程|流程/.test(t.title))) {
      unlock("weekly-memorial-sop");
    }
    if (!isRecovery && ((t.tags || []).indexOf("regularization_defense") >= 0 || /结业答辩|转正.*答辩|答辩.*转正/.test(t.title))) {
      unlock("regularization-defense");
    }
    if (t.scene === "observatory" && isRecovery && receipt.energyActual > 0) {
      unlock("jade-astro-first-restore");
      state.counters.astroDone++;
      setAchProgress("jade-astro-ten-times", state.counters.astroDone);
    }
    if (!isRecovery && t.scene === "ministry") {
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
  function applyPizhu(kind, decision, templates) {
    if (kind === "again") {
      state.counters.pizhuAgain++;
      unlock("pizhu-zaiyi");
      addJournal((decision && decision.title) || "一桩决策", "朱批·再议：留中不发，容后补充信息再作定夺。");
      commit("task");
      return null;
    }
    if (kind === "bold") {
      state.counters.pizhuBold++;
      unlock("pizhu-dadan");
      addJournal((decision && decision.title) || "一桩决策", "朱批·大胆：陛下以为判断草率，命大臣重新补充信息。");
      commit("task");
      return null;
    }
    // agree
    unlock("first-vermilion-brush");
    unlock("first-audience-minister");
    state.counters.approvals++;
    return deployTasks(templates);
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
    state.counters.archiveReads++;
    unlock("archive-first-read");
    commit();
  }
  var bSeq = 100;
  function addBook(book) {
    book.id = book.id || ("ub" + (bSeq++));
    state.books.unshift(book);
    state.counters.uploads++;
    unlock("archive-upload");
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
  function addFlowMinutes(mins) {
    state.counters.flowMinutes += mins;
    setAchProgress("flow-focus-single", Math.min(25, mins));
    setAchProgress("flow-focus-master", state.counters.flowMinutes);
    commit();
  }
  function useProphecy(decisionId) {
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
    data.BOOKS.forEach(function (b) { state.books.push(Object.assign({}, b)); });
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
    maybeOfferDailyMystic: maybeOfferDailyMystic, rerollDailyMystic: rerollDailyMystic,
    applyPizhu: applyPizhu,
    // 成就
    unlock: unlock, bumpAch: bumpAch, setAchProgress: setAchProgress,
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
