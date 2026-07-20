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
  var ENERGY_CAP = 150;

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
      m[a.id] = { unlocked: a.unlocked, cur: a.cur, date: a.date };
    });
    return m;
  }

  function initialState() {
    return {
      version: 1,
      onboarded: false,
      startedAt: null,        // 由 UI 层填入时间字符串
      day: 1,
      profile: { nickname: "陛下", answers: [] },
      empressType: null,      // 铁腕/仁厚/谋略/革新
      energy: 100,
      energyCap: ENERGY_CAP,
      totalRestored: 0,
      gold: 0,
      totalGold: 0,
      mode: "normal",         // normal | flow | prophecy
      scene: "court",
      visitedScenes: [],
      completedTasks: [],     // 已完成 task id（累计计数用）
      mapTasks: [],           // 地图任务 {id,title,cat,scene,energy,gold,restore,from,bg,done,day}
      pendingPetitions: [],   // 奏折匣中待办 {taskId, title, scene, day}
      journals: [],           // 起居注 {id,day,title,text}
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
        uploads: 0,
        archiveReads: 0
      },
      sidebarCollapsed: false
    };
  }

  /* ---------- 加载 / 保存 ---------- */
  var state;
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        state = Object.assign(initialState(), parsed);
        // 合并成就 map，兼容新增成就
        var freshMap = freshAchMap();
        state.achievements = Object.assign(freshMap, parsed.achievements || {});
        state.knowledge = Object.assign({ documents: [] }, parsed.knowledge || {});
        if (!Array.isArray(state.knowledge.documents)) state.knowledge.documents = [];
        // 迁移：旧存档无地图任务且已登基 → 直接播种初始任务（不触发事件）
        if (state.onboarded && (!state.mapTasks || !state.mapTasks.length)) {
          state.mapTasks = [];
          (data.SEED_MAP_TASKS || []).forEach(function (tpl, i) {
            var catDef = data.CATEGORIES[tpl.cat] || data.CATEGORIES.daily;
            state.mapTasks.push({
              id: "mt-seed-" + i, title: tpl.title, cat: tpl.cat, scene: catDef.scene,
              energy: tpl.energy || 0, gold: tpl.gold || 0, restore: tpl.restore || 0,
              from: tpl.from || "", bg: data.brain.taskBg(i), done: false, day: state.day || 1
            });
          });
        }
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

  /* ---------- 成就引擎 ---------- */
  // 设置成就当前进度（取较大值），到达 target 则解锁
  function setAchProgress(id, cur) {
    var def = data.achById[id]; if (!def) return;
    var rec = state.achievements[id] || (state.achievements[id] = { unlocked: false, cur: 0, date: null });
    if (cur > rec.cur) rec.cur = cur;
    if (!rec.unlocked && rec.cur >= def.target) unlock(id);
  }
  function bumpAch(id, by) {
    var def = data.achById[id]; if (!def) return;
    var rec = state.achievements[id] || (state.achievements[id] = { unlocked: false, cur: 0, date: null });
    rec.cur += (by || 1);
    if (!rec.unlocked && rec.cur >= def.target) unlock(id);
  }
  function unlock(id) {
    var def = data.achById[id]; if (!def) return;
    var rec = state.achievements[id] || (state.achievements[id] = { unlocked: false, cur: 0, date: null });
    if (rec.unlocked) return;
    rec.unlocked = true;
    if (rec.cur < def.target) rec.cur = def.target;
    rec.date = today();
    emit("achievement", def);   // 触发轻量通知
  }
  function achState(id) {
    var def = data.achById[id];
    var rec = state.achievements[id] || { unlocked: false, cur: 0, date: null };
    return { def: def, unlocked: rec.unlocked, cur: rec.cur, target: def.target, date: rec.date };
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

  /* ---------- 精力 ---------- */
  function addEnergy(delta) {
    var before = state.energy;
    state.energy = Math.max(0, Math.min(state.energyCap, state.energy + delta));
    if (delta > 0) {
      var gained = state.energy - before;
      if (gained > 0) {
        state.totalRestored += gained;
        // 玉雕成就
        if (state.energy >= 100) unlock("jade-first-restore-hundred");
        if (state.energy >= 150) unlock("jade-full-cap-150");
        setAchProgress("jade-accumulate-500", state.totalRestored);
        setAchProgress("jade-accumulate-2000", state.totalRestored);
        setAchProgress("jade-grand-harmony", state.totalRestored);
      }
    }
    emit("energy", state.energy);
  }
  function setEnergy(v) { // 用户校准精力条
    state.energy = Math.max(0, Math.min(state.energyCap, Math.round(v)));
    unlock("jade-calibrate-energy");
    commit("energy");
  }

  /* ---------- 金币 ---------- */
  function addGold(delta, source) {
    if (delta > 0) {
      state.gold += delta;
      state.totalGold += delta;
      if (source) {
        unlock("first-gold");
        if (state.counters.goldSources.indexOf(source) < 0) state.counters.goldSources.push(source);
        setAchProgress("gold-source-diverse", state.counters.goldSources.length);
      }
      if (delta >= 100) unlock("single-big-reward");
      setAchProgress("gold-50", state.totalGold);
      setAchProgress("gold-100", state.totalGold);
      setAchProgress("gold-300", state.totalGold);
      setAchProgress("gold-500", state.totalGold);
      setAchProgress("gold-1000", state.totalGold);
      setAchProgress("treasury-peak", state.totalGold);
      if (state.gold >= 500 && state.energy >= 100) unlock("gold-and-energy-balance");
    } else if (delta < 0) {
      state.gold = Math.max(0, state.gold + delta);
      unlock("first-spend");
    }
    emit("gold", state.gold);
  }

  /* ---------- 场景 ---------- */
  function moveScene(id) {
    var sc = data.sceneById(id); if (!sc) return;
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

  // templates: [{title,cat,energy,gold,restore,from}]，来自 data.brain.tasksFromPath
  // 返回落地后的任务数组（含 id/scene/bg）
  function deployTasks(templates) {
    var created = [];
    (templates || []).forEach(function (tpl, i) {
      var catDef = data.CATEGORIES[tpl.cat] || data.CATEGORIES.daily;
      var task = {
        id: nextTaskId(),
        title: tpl.title,
        cat: tpl.cat,
        scene: catDef.scene,
        energy: tpl.energy || 0,
        gold: tpl.gold || 0,
        restore: tpl.restore || 0,
        from: tpl.from || "",
        bg: data.brain.taskBg(state.mapTasks.length + i),
        done: false,
        day: state.day
      };
      state.mapTasks.push(task);
      created.push(task);
    });
    commit("task");
    emit("deploy", created);
    return created;
  }

  function tasksForScene(sceneId) {
    return state.mapTasks.filter(function (t) { return t.scene === sceneId; });
  }
  function pendingCount() {
    return state.mapTasks.filter(function (t) { return !t.done; }).length;
  }

  // 标记一个地图任务完成 → 结算精力/金币/成就
  function completeMapTask(taskId) {
    var t = null;
    for (var i = 0; i < state.mapTasks.length; i++) { if (state.mapTasks[i].id === taskId) { t = state.mapTasks[i]; break; } }
    if (!t || t.done) return;
    t.done = true;

    // 结算：energy 为消耗(正数=消耗)，restore 为恢复量
    if (t.restore) addEnergy(t.restore);
    else if (t.energy) addEnergy(-Math.abs(t.energy));
    if (t.gold) addGold(t.gold, t.scene);

    state.completedTasks.push(t.id);
    state.counters.tasksDone++;
    var n = state.counters.tasksDone;
    unlock("first-task-kiln-fire");
    setAchProgress("tasks-3-raw-body", n);
    setAchProgress("tasks-5-five-wares", n);
    setAchProgress("tasks-10-warm-glaze", n);
    setAchProgress("tasks-20-kiln-transform", n);
    setAchProgress("tasks-50-official-kiln", n);
    setAchProgress("tasks-100-eternal-porcelain", n);

    // 场景/分类相关成就
    if (t.scene === "ministry") unlock("first-daily-liubu");
    if (t.scene === "garden") unlock("first-explore-garden");
    if (t.scene === "folk") unlock("first-fog-minjian");
    if (t.scene === "court") { unlock("first-solo-delivery"); unlock("first-audience-minister"); }
    if (t.scene === "observatory" && t.restore) {
      unlock("jade-astro-first-restore");
      state.counters.astroDone++;
      setAchProgress("jade-astro-ten-times", state.counters.astroDone);
    }
    if (t.scene === "ministry") {
      var minCount = state.completedTasks.filter(function (id) {
        var tt = tasksForSceneAll(id); return tt && tt.scene === "ministry";
      }).length;
      setAchProgress("survey-six-ministries", Math.min(6, minCount + 2));
    }

    addJournal(t.title, "任务达成 · " + (data.CATEGORIES[t.cat] ? data.CATEGORIES[t.cat].label : "") + " · 出自「" + t.from + "」");
    commit("task");
    emit("taskDone", { task: t });
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
    state.counters.approvals++;
    var goldSum = (templates || []).reduce(function (s, t) { return s + (t.gold || 0); }, 0);
    if (goldSum > 0) {
      state.counters.approvalGold += goldSum;
      setAchProgress("approval-gold", state.counters.approvalGold);
    }
    return deployTasks(templates);
  }

  /* ---------- 起居注 / 藏书 ---------- */
  var jSeq = 100;
  function addJournal(title, text) {
    var j = { id: "j" + (jSeq++), day: state.day, title: title, text: text };
    state.journals.unshift(j);
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

  /* ---------- 模式 ---------- */
  function setMode(m) { state.mode = m; commit("mode"); }
  function addFlowMinutes(mins) {
    state.counters.flowMinutes += mins;
    setAchProgress("flow-focus-single", Math.min(25, mins));
    setAchProgress("flow-focus-master", state.counters.flowMinutes);
    commit();
  }
  function useProphecy() {
    state.counters.prophecyUses++;
    unlock("prophecy-first");
    setAchProgress("redo-simulation", state.counters.prophecyUses);
    commit();
  }

  /* ---------- 天数推进 ---------- */
  function advanceDay(by) {
    state.day += (by || 1);
    setAchProgress("thirty-day-foothold", state.day);
    setAchProgress("sixty-day-reform", state.day);
    setAchProgress("ninety-day-coronation", state.day);
    if (state.day >= 90) { unlock("regularization-defense"); unlock("weekly-memorial-sop"); }
    commit("day");
  }

  /* ---------- Onboarding 完成 ---------- */
  function finishOnboarding(profile, empressType, startedAt) {
    state.onboarded = true;
    state.profile = profile;
    state.empressType = empressType;
    state.startedAt = startedAt;
    state.scene = "court";
    if (state.visitedScenes.indexOf("court") < 0) state.visitedScenes.push("court");
    // 播种起居注
    data.JOURNALS_SEED.forEach(function (j) { state.journals.push(Object.assign({}, j)); });
    // 播种默认藏书
    data.BOOKS.forEach(function (b) { state.books.push(Object.assign({}, b)); });
    // 播种初始地图任务（登基之初已在案的事务）
    if (!state.mapTasks.length) deployTasks(data.SEED_MAP_TASKS);
    commit("onboarded");
  }

  function toggleSidebar(force) {
    state.sidebarCollapsed = (typeof force === "boolean") ? force : !state.sidebarCollapsed;
    commit("sidebar");
  }

  load();

  window.App.store = {
    ENERGY_CAP: ENERGY_CAP,
    STORAGE_KEY: STORAGE_KEY,
    get: get, save: save, reset: reset,
    on: on, off: off, emit: emit,
    today: today,
    // 精力金币
    addEnergy: addEnergy, setEnergy: setEnergy, addGold: addGold,
    // 场景 + 地图任务
    moveScene: moveScene,
    deployTasks: deployTasks, completeMapTask: completeMapTask,
    tasksForScene: tasksForScene, pendingCount: pendingCount,
    applyPizhu: applyPizhu,
    // 成就
    unlock: unlock, bumpAch: bumpAch, setAchProgress: setAchProgress,
    achState: achState, progress: progress,
    // 藏书起居注
    addJournal: addJournal, readArchive: readArchive, addBook: addBook,
    addKnowledgeDocument: addKnowledgeDocument,
    // 模式
    setMode: setMode, addFlowMinutes: addFlowMinutes, useProphecy: useProphecy,
    // 生命周期
    advanceDay: advanceDay, finishOnboarding: finishOnboarding, toggleSidebar: toggleSidebar
  };
})();
