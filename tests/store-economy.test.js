import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

function createStore(savedState) {
  const memory = new Map();
  if (savedState) memory.set("nvdi-full-v1", JSON.stringify(savedState));
  const NativeDate = Date;
  class FixedDate extends NativeDate {
    constructor(...args) {
      super(...(args.length ? args : ["2026-07-20T12:00:00+08:00"]));
    }
    static now() { return new NativeDate("2026-07-20T12:00:00+08:00").getTime(); }
  }
  const context = vm.createContext({
    console,
    Date: FixedDate,
    Math,
    setTimeout,
    clearTimeout,
    localStorage: {
      getItem(key) { return memory.has(key) ? memory.get(key) : null; },
      setItem(key, value) { memory.set(key, String(value)); },
      removeItem(key) { memory.delete(key); }
    },
    window: { App: {} }
  });
  for (const file of ["js/data.js", "js/economy.js", "js/store.js"]) {
    vm.runInContext(fs.readFileSync(new URL("../" + file, import.meta.url), "utf8"), context, { filename: file });
  }
  return { store: context.window.App.store, data: context.window.App.data, memory };
}

test("ordinary task settlement is idempotent and uses the approved scale", () => {
  const { store } = createStore();
  const task = store.deployTasks([{ title: "整理周报", cat: "daily", durationMinutes: 30, from: "测试" }])[0];

  store.completeMapTask(task.id);
  assert.equal(store.get().energy, 90);
  assert.equal(store.get().gold, 225);
  assert.equal(store.get().totalGold, 225);
  assert.equal(store.get().counters.tasksDone, 1);
  assert.match(store.get().journals[0].text, /精力 -10（100→90）/);
  assert.match(store.get().journals[0].text, /任务金币 \+10/);
  assert.match(store.get().journals[0].text, /成就奖励 \+215 金已自动到账/);

  store.completeMapTask(task.id);
  assert.equal(store.get().energy, 90);
  assert.equal(store.get().gold, 225);
  assert.equal(store.get().counters.tasksDone, 1);
});

test("recovery only records actual gain and grants no gold or ordinary task progress", () => {
  const { store } = createStore();
  store.setEnergy(145);
  const first = store.deployTasks([{ title: "离屏休整", cat: "mystic", durationMinutes: 30 }])[0];
  assert.equal(first.energyTier, "STANDARD");
  assert.equal(first.restore, 20);
  store.completeMapTask(first.id);

  assert.equal(store.get().energy, 150);
  assert.equal(store.get().gold, 90);
  assert.equal(store.get().totalGold, 90);
  assert.equal(store.get().achievements["gold-50"].rewardGranted, true);
  assert.equal(store.get().totalActualRestored, 5);
  assert.equal(store.get().totalRestored, 5);
  assert.equal(store.get().counters.tasksDone, 0);

  const capped = store.deployTasks([{ title: "重复休整", cat: "mystic", durationMinutes: 30 }])[0];
  store.completeMapTask(capped.id);
  assert.equal(store.get().totalActualRestored, 5);
  assert.equal(store.get().totalRestored, 5);
});

test("active recovery counts at most 60 points per day toward achievements", () => {
  const { store } = createStore();
  store.setEnergy(0);
  ["上午深休", "午间深休", "傍晚深休"].forEach((title) => {
    const task = store.deployTasks([{ title, cat: "mystic", durationMinutes: 60 }])[0];
    store.completeMapTask(task.id);
  });

  assert.equal(store.get().energy, 90);
  assert.equal(store.get().totalActualRestored, 90);
  assert.equal(store.get().totalRestored, 60);
  assert.equal(store.get().dailyStats["2026-07-20"].actualRestored, 90);
  assert.equal(store.get().dailyStats["2026-07-20"].achievementRestored, 60);
});

test("v1 saves migrate to the current version without shrinking the 150 energy cap", () => {
  const { store } = createStore({
    version: 1,
    day: 3,
    energy: 140,
    energyCap: 150,
    gold: 70,
    totalGold: 90,
    achievements: {},
    knowledge: { documents: [] },
    mapTasks: []
  });

  assert.equal(store.get().version, 8);
  assert.equal(store.get().energy, 140);
  assert.equal(store.get().energyCap, 150);
  assert.equal(store.get().gold, 100);
  assert.equal(store.get().totalGold, 120);
  assert.equal(store.get().achievements["gold-50"].rewardGranted, true);
  assert.equal(store.get().totalActualRestored, 0);
});

test("onboarding does not auto-create fabricated career tasks", () => {
  const { store, data } = createStore();
  store.finishOnboarding({ nickname: "测试", answers: [] }, "铁腕", "2026-07-20T08:00:00+08:00");

  assert.equal(data.SEED_MAP_TASKS.length, 0);
  assert.equal(store.get().mapTasks.length, 0);
  assert.equal(Object.keys(data.SCENE_TASK_TEMPLATES).length, 5);
  assert.equal(data.SCENE_TASK_TEMPLATES.court.title, "完成入职培训的结业答辩");
  assert.equal(data.SCENE_TASK_TEMPLATES.court.featured, true);
});

test("old saves remove seeded, copied and demo template tasks once", () => {
  const { store } = createStore({
    version: 6,
    onboarded: true,
    day: 2,
    mapTasks: [
      { id: "mt-seed-0", title: "完成入职培训的结业答辩", cat: "main", scene: "court", durationMinutes: 90, from: "入职清单", done: false, day: 1 },
      { id: "mt-seed-2", title: "约同组前辈喝杯咖啡认识一下", cat: "explore", scene: "garden", durationMinutes: 20, from: "融入团队", done: false, day: 1 },
      { id: "copied-coffee", title: "约同组前辈喝杯咖啡认识一下", cat: "daily", scene: "ministry", durationMinutes: 30, from: "明日就医日的双翼安排", done: false, day: 2 },
      { id: "copied-outline", title: "准备入职培训结业答辩大纲", cat: "main", scene: "court", durationMinutes: 60, from: "明日就医日的双翼安排", done: false, day: 2 },
      { id: "demo-help", title: "限时 20 分钟协助同事", cat: "daily", scene: "ministry", durationMinutes: 20, from: "同事临时求助", done: false, day: 1 },
      { id: "real-task", title: "在部门群里说明下午请假", cat: "daily", scene: "ministry", durationMinutes: 10, from: "明日就医日的双翼安排", done: false, day: 2 }
    ]
  });

  assert.deepEqual(Array.from(store.get().mapTasks, (task) => task.id), ["real-task"]);
});

test("day sync grants 30 energy once for the same date", () => {
  const { store } = createStore();
  store.setEnergy(60);
  store.syncDay("2026-07-20");
  store.syncDay("2026-07-21");
  assert.equal(store.get().energy, 90);
  assert.equal(store.get().day, 2);
  assert.equal(store.get().totalActualRestored, 0);

  store.syncDay("2026-07-21");
  assert.equal(store.get().energy, 90);
  assert.equal(store.get().day, 2);
});

test("daily celestial exploration appears once when spending crosses 60 energy", () => {
  const { store, data } = createStore();
  assert.equal(data.MYSTIC_CARDS.length, 12);
  assert.equal(store.get().dailyMystic.status, "idle");

  ["第一件小事", "第二件小事", "第三件小事", "第四件小事"].forEach((title) => {
    const task = store.deployTasks([{ title, cat: "daily", durationMinutes: 10 }])[0];
    store.completeMapTask(task.id);
  });

  const offers = store.get().mapTasks.filter((task) => task.isDailyMystic && !task.expired);
  assert.equal(store.get().energy, 60);
  assert.equal(offers.length, 1);
  assert.equal(offers[0].restore, 10);
  assert.equal(offers[0].gold, 0);
  assert.equal(offers[0].energyTier, "MICRO");
  assert.equal(store.get().dailyMystic.status, "offered");

  store.maybeOfferDailyMystic("duplicate-check");
  assert.equal(store.get().mapTasks.filter((task) => task.isDailyMystic && !task.expired).length, 1);
});

test("daily celestial exploration supports one reroll and completes through unified settlement", () => {
  const { store } = createStore();
  store.setEnergy(50);
  const task = store.tasksForScene("observatory").find((item) => item.isDailyMystic);
  const firstCard = task.mysticCardId;

  const rerolled = store.rerollDailyMystic();
  assert.ok(rerolled);
  assert.notEqual(rerolled.mysticCardId, firstCard);
  assert.equal(store.get().dailyMystic.rerollsUsed, 1);
  assert.equal(store.rerollDailyMystic(), null);

  const receipt = store.completeMapTask(task.id);
  assert.equal(receipt.type, "recovery-task");
  assert.equal(receipt.energyActual, 10);
  assert.equal(receipt.goldActual, 0);
  assert.equal(store.get().energy, 60);
  assert.equal(store.get().dailyMystic.status, "completed");
  assert.match(store.get().journals[0].title, /^天象·/);
  assert.match(store.get().journals[0].text, /微探索完成/);
});

test("unfinished celestial exploration expires across days and only reappears after passive recovery if energy remains low", () => {
  const { store } = createStore();
  store.setEnergy(20);
  const oldTask = store.tasksForScene("observatory").find((item) => item.isDailyMystic);

  store.advanceDay(1);

  const visible = store.tasksForScene("observatory").filter((item) => item.isDailyMystic);
  assert.equal(oldTask.expired, true);
  assert.equal(store.get().energy, 50);
  assert.equal(visible.length, 1);
  assert.notEqual(visible[0].id, oldTask.id);
  assert.equal(store.get().dailyMystic.trigger, "open-after-recovery");
  assert.equal(store.get().journals.some((entry) => /失败|未完成/.test(entry.text)), false);
});

test("day snapshots drive consecutive energy achievements", () => {
  const { store } = createStore();
  store.setEnergy(130);
  store.advanceDay(1);
  store.advanceDay(1);
  store.advanceDay(1);

  assert.equal(store.get().achievements["jade-three-days-above-fifty"].unlocked, true);
  assert.equal(store.get().achievements["jade-hold-cap-three-days"].unlocked, true);
  assert.equal(store.get().achievements["jade-seven-days-no-zero"].cur, 3);
  assert.equal(store.get().achievements["jade-seven-days-no-zero"].unlocked, false);
});

test("overlapping active tasks are linked instead of duplicated", () => {
  const { store } = createStore();
  const first = store.deployTasks([{ title: "完成最小可交付版本", cat: "daily", durationMinutes: 30, from: "第一份决策" }]);
  const preview = store.previewTaskOverlaps([{ title: "完成一个最小可交付版本", cat: "daily", durationMinutes: 30 }]);
  const second = store.deployTasks([{ title: "完成一个最小可交付版本", cat: "daily", durationMinutes: 30, from: "第二份决策" }]);

  assert.equal(first.length, 1);
  assert.equal(preview.length, 1);
  assert.equal(preview[0].task.id, first[0].id);
  assert.equal(second.length, 0);
  assert.equal(second.merged.length, 1);
  assert.equal(store.get().mapTasks.length, 1);
  assert.deepEqual(Array.from(store.get().mapTasks[0].relatedFrom), ["第一份决策", "第二份决策"]);
});

test("frontend preserves the category returned by the backend AI", () => {
  const { store } = createStore();
  const coffee = store.deployTasks([{
    title: "约同组前辈喝杯咖啡认识一下", cat: "daily", durationMinutes: 30, from: "测试"
  }])[0];
  const rest = store.deployTasks([{
    title: "就医前预留时间休息", cat: "daily", durationMinutes: 30, from: "测试"
  }])[0];

  assert.equal(coffee.cat, "daily");
  assert.equal(coffee.scene, "ministry");
  assert.equal(rest.cat, "daily");
  assert.equal(rest.scene, "ministry");
});

test("演示追问答案会延续原情景，不退化成通用任务", () => {
  const { data } = createStore();
  const question = data.brain.analyze("下周部门周会邀请我做一次行业分享，我有点犹豫", { probed: false });
  const answer = data.brain.analyze("缺时间 准备时间实在不够", {
    probed: true,
    scenarioId: question.scenarioId
  });

  assert.equal(answer.type, "decision");
  assert.equal(answer.decision.title, "行业分享邀约");
  assert.equal(answer.decision.category, "main");
});

test("identical active tasks cannot bypass deduplication by changing scenes", () => {
  const { store } = createStore();
  const first = store.deployTasks([{
    title: "汇总客户访谈反馈", cat: "explore", durationMinutes: 30, from: "第一份决策"
  }]);
  const second = store.deployTasks([{
    title: "汇总客户访谈反馈", cat: "daily", durationMinutes: 30, from: "第二份决策"
  }]);

  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
  assert.equal(second.merged.length, 1);
  assert.equal(store.get().mapTasks.length, 1);
});

test("explicit demo tasks are removed when the demo ends", () => {
  const { store } = createStore();
  store.deployTasks([{ title: "演示任务", cat: "daily", durationMinutes: 10, sourceKind: "demo" }]);
  store.deployTasks([{ title: "真实任务", cat: "daily", durationMinutes: 10, sourceKind: "decision" }]);

  assert.equal(store.clearDemoTasks(), 1);
  assert.deepEqual(Array.from(store.get().mapTasks, (task) => task.title), ["真实任务"]);
});

test("task deduplication ignores planning verbs and particles", () => {
  const { store } = createStore();
  const first = store.deployTasks([{
    title: "完成入职培训的结业答辩", cat: "main", durationMinutes: 90, from: "入职清单"
  }]);
  const second = store.deployTasks([{
    title: "准备入职培训结业答辩大纲", cat: "main", durationMinutes: 60, from: "明日：半日理政，半日就医"
  }]);

  assert.equal(first.length, 1);
  assert.equal(second.length, 0);
  assert.equal(second.merged.length, 1);
  assert.equal(store.get().mapTasks.length, 1);
});

test("saved active near-duplicate tasks are merged on refresh", () => {
  const { store } = createStore({
    version: 8,
    day: 2,
    mapTasks: [
      {
        id: "original", title: "完成入职培训的结业答辩", cat: "main", scene: "court",
        durationMinutes: 90, from: "入职清单", relatedFrom: ["入职清单"], done: false, day: 1
      },
      {
        id: "duplicate", title: "准备入职培训结业答辩大纲", cat: "main", scene: "court",
        durationMinutes: 60, from: "明日：半日理政，半日就医", done: false, day: 2
      }
    ]
  });

  assert.equal(store.get().mapTasks.length, 1);
  assert.equal(store.get().mapTasks[0].id, "original");
  assert.deepEqual(Array.from(store.get().mapTasks[0].relatedFrom), ["入职清单", "明日：半日理政，半日就医"]);
});

test("completed tasks may be created again in a later decision", () => {
  const { store } = createStore();
  const first = store.deployTasks([{ title: "整理周报", cat: "daily", durationMinutes: 30, from: "本周周报" }]);
  store.completeMapTask(first[0].id);
  const second = store.deployTasks([{ title: "整理周报", cat: "daily", durationMinutes: 30, from: "下周周报" }]);

  assert.equal(second.length, 1);
  assert.equal(second.merged.length, 0);
  assert.equal(store.get().mapTasks.length, 2);
});

test("new tasks and saved conversations hide internal category markers", () => {
  const { store } = createStore({
    version: 6,
    mapTasks: [{
      id: "legacy-tagged-task", title: "[main] 备齐材料", cat: "main", scene: "court",
      durationMinutes: 15, done: false, day: 1
    }],
    conversationSessions: {
      court: {
        transcript: [
          { role: "sys", who: "", text: "· [main] 备齐材料（约 15 分钟）" },
          { role: "npc", who: "铁面直臣", text: "朕理解，工作可缓，朕可为你谋划。" },
          { role: "me", who: "陛下", text: "朕明日先去医院。" }
        ],
        pendingDecision: {
          decision: {
            recommend: { tasks: [{ title: "[daily] 检查通知", cat: "daily", durationMinutes: 10 }] },
            alt: null
          }
        }
      }
    }
  });
  const created = store.deployTasks([{ title: "【explore】记录观察", cat: "explore", durationMinutes: 20 }]);
  const saved = store.getConversation("court");

  assert.equal(store.get().mapTasks[0].title, "备齐材料");
  assert.equal(created[0].title, "记录观察");
  assert.equal(saved.transcript[0].text, "· 备齐材料（约 15 分钟）");
  assert.equal(saved.transcript[1].text, "臣理解，工作可缓，臣可为你谋划。");
  assert.equal(saved.transcript[2].text, "朕明日先去医院。");
  assert.equal(saved.pendingDecision.decision.recommend.tasks[0].title, "检查通知");
});

test("conversation sessions survive scene switches and archive on a new day", () => {
  const { store } = createStore();
  store.saveConversation("court", {
    expanded: true,
    transcript: [
      { role: "me", who: "陛下", text: "这句话需要保留" },
      { role: "npc", who: "直臣", text: "臣已记下" }
    ]
  });

  store.moveScene("garden");
  assert.equal(store.getConversation("court").transcript[0].text, "这句话需要保留");

  store.advanceDay(1);
  assert.equal(store.getConversation("court"), null);
  const archived = store.get().journals.find((journal) => /对话归档/.test(journal.title));
  assert.ok(archived);
  assert.match(archived.text, /这句话需要保留/);
});

test("achievement rewards arrive automatically once in the unified gold balance", () => {
  const { store } = createStore();
  store.unlock("gold-50");
  store.unlock("gold-50");
  store.unlock("gold-100");

  assert.equal(store.get().gold, 30);
  assert.equal(store.get().totalGold, 30);
  assert.equal(store.get().achievements["gold-50"].rewardGranted, true);
  assert.match(store.get().achievements["gold-50"].date, /^2026-07-20 · 登基第1天$/);
  assert.equal(Object.keys(store.get().settlementLedger).filter((id) => id === "achievement:gold-50").length, 1);
  assert.deepEqual(Array.from(store.get().titles), ["理财新丁"]);
});

test("legacy unlocked achievements receive one migration payout", () => {
  const first = createStore({
    version: 3,
    day: 1,
    dayKey: "2026-07-20",
    energy: 100,
    energyCap: 150,
    gold: 0,
    totalGold: 0,
    achievements: { "first-task-kiln-fire": { unlocked: true, cur: 1, date: "登基第1天" } },
    knowledge: { documents: [] },
    mapTasks: []
  });
  assert.equal(first.store.get().gold, 10);
  assert.match(first.store.get().journals[0].title, /旧成就奖励补发/);

  const persisted = JSON.parse(first.memory.get("nvdi-full-v1"));
  const second = createStore(persisted);
  assert.equal(second.store.get().gold, 10);
  assert.equal(second.store.get().totalGold, 10);
});

test("all 59 displayed achievement rewards can settle exactly once", () => {
  const { store, data } = createStore();
  assert.equal(data.ACHIEVEMENTS.length, 59);
  assert.equal(new Set(data.ACHIEVEMENTS.map((item) => item.id)).size, 59);

  data.ACHIEVEMENTS.forEach((achievement) => store.unlock(achievement.id));
  const firstGold = store.get().gold;
  const firstTitles = store.get().titles.length;
  data.ACHIEVEMENTS.forEach((achievement) => store.unlock(achievement.id));

  assert.equal(firstGold, 1730);
  assert.equal(firstTitles, 17);
  assert.equal(store.get().gold, 1730);
  assert.equal(store.get().totalGold, 1730);
  assert.equal(store.get().titles.length, 17);
  assert.equal(Object.keys(store.get().settlementLedger).filter((id) => id.startsWith("achievement:")).length, 59);
  assert.equal(data.ACHIEVEMENTS.filter((item) => item.availability === "dormant").length, 1);
});

test("ending one scene conversation archives it without clearing other scenes", () => {
  const { store } = createStore();
  store.saveConversation("court", {
    topic: "延期沟通",
    transcript: [{ role: "me", who: "陛下", text: "这段商讨需要归档" }]
  });
  store.saveConversation("garden", {
    topic: "午间休息",
    transcript: [{ role: "npc", who: "近臣", text: "御花园会话仍需保留" }]
  });

  const journal = store.archiveConversation("court");

  assert.equal(store.getConversation("court"), null);
  assert.equal(store.getConversation("garden").topic, "午间休息");
  assert.match(journal.title, /朝堂.*延期沟通/);
  assert.match(journal.text, /这段商讨需要归档/);
});

test("起居注归档忽略切换大臣提示和重复开场白", () => {
  const { store } = createStore();
  store.saveConversation("garden", {
    topic: "闲话家常",
    transcript: [
      { role: "npc", who: "温言近臣", text: "陛下辛苦了。有什么烦心事，说与臣听，臣为您分忧。" },
      { role: "sys", who: "", text: "— 改由【卦师】（奇策谋士）为陛下参详 —" },
      { role: "npc", who: "奇策谋士", text: "此局未必只有一解。陛下把难处道来，臣替您另寻蹊径。" }
    ]
  });

  assert.equal(store.archiveConversation("garden"), null);

  store.saveConversation("garden", {
    topic: "午间休息",
    transcript: [
      { role: "me", who: "陛下", text: "今天很累，我想先休息半小时。" },
      { role: "sys", who: "", text: "— 改由【顺臣】（温言近臣）为陛下参详 —" },
      { role: "npc", who: "温言近臣", text: "先离开屏幕，半小时后再回来处理最重要的一件事。" },
      { role: "npc", who: "温言近臣", text: "陛下辛苦了。有什么烦心事，说与臣听，臣为您分忧。" }
    ]
  });

  const journal = store.archiveConversation("garden");
  assert.match(journal.text, /今天很累/);
  assert.match(journal.text, /先离开屏幕/);
  assert.doesNotMatch(journal.text, /改由|陛下辛苦了/);

  store.saveConversation("garden", {
    topic: "御花园议事",
    transcript: [
      { role: "me", who: "陛下", text: "我想聊聊今天的状态。" },
      { role: "npc", who: "温言近臣", text: "先说说最让你挂心的一件事。" }
    ]
  });
  const sceneTopicJournal = store.archiveConversation("garden");
  assert.equal(sceneTopicJournal.title, "御花园议事");
  assert.equal(sceneTopicJournal.text,
    "陛下：我想聊聊今天的状态。\n温言近臣：先说说最让你挂心的一件事。");

  const migrated = createStore({
    version: 5,
    journals: [
      {
        id: "legacy-switches", day: 1, title: "御花园·闲话家常",
        text: "— 改由【顺臣】（温言近臣）为陛下参详 —；温言近臣：陛下辛苦了。有什么烦心事，说与臣听，臣为您分忧。"
      },
      {
        id: "legacy-greeting", day: 1, title: "朝堂·朝堂议事",
        text: "铁面直臣：陛下但说，臣直言相告，不绕弯子。"
      },
      {
        id: "legacy-real-talk", day: 1, title: "朝堂·项目取舍",
        text: "上一段商讨已归入起居注；陛下：我要不要接这个项目；AI 驿站未连通；铁面直臣：先确认时间边界和交付标准。"
      }
    ],
    achievements: {}, knowledge: { documents: [] }, mapTasks: []
  }).store;
  assert.equal(migrated.get().journals.some((item) => item.id === "legacy-switches"), false);
  assert.equal(migrated.get().journals.some((item) => item.id === "legacy-greeting"), false);
  assert.equal(migrated.get().journals.find((item) => item.id === "legacy-real-talk").text,
    "陛下：我要不要接这个项目\n铁面直臣：先确认时间边界和交付标准。");

  const currentVersion = createStore({
    version: 6,
    journals: [{
      id: "v6-empty-talk", day: 1, title: "御花园·御花园议事",
      text: "上一段商讨已归入起居注，现已开启新对话。；温言近臣：陛下辛苦了。有什么烦心事，说与臣听，臣为您分忧。"
    }],
    achievements: {}, knowledge: { documents: [] }, mapTasks: []
  }).store;
  assert.equal(currentVersion.get().journals.some((item) => item.id === "v6-empty-talk"), false);
});
