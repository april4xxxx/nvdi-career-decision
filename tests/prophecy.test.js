import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../js/prophecy.js", import.meta.url), "utf8");
const dataSource = await readFile(new URL("../js/data.js", import.meta.url), "utf8");

function createProphecy(state, demoTasks = []) {
  const App = {
    data: {
      PROPHECY_DEMO_TASKS: demoTasks,
      CATEGORIES: {
        main: { label: "主线" },
        daily: { label: "日常" },
        explore: { label: "探索" },
        delay: { label: "拖延" },
        mystic: { label: "神秘" }
      }
    },
    store: { get: () => state },
    ui: { esc: (value) => String(value) },
    economy: {
      calculate(task) {
        const recovery = task.cat === "mystic";
        return {
          durationMinutes: Number(task.durationMinutes) || 30,
          energy: recovery ? 0 : 10,
          gold: recovery ? 0 : 10,
          restore: recovery ? 20 : 0,
          energyTier: recovery ? "STANDARD" : "LIGHT"
        };
      }
    }
  };
  const context = vm.createContext({ window: { App }, console });
  vm.runInContext(source, context);
  return App.prophecy;
}

test("没有真实待办时，预言明确回退到新入职演示样本", () => {
  const demoTasks = [
    { id: "demo-1", weekday: 1, title: "确认优先级", cat: "main", durationMinutes: 30 },
    { id: "demo-2", weekday: 0, title: "彻底休息", cat: "mystic", durationMinutes: 30 }
  ];
  const prophecy = createProphecy({ mapTasks: [], energy: 100 }, demoTasks);
  const model = prophecy.buildModel({ mapTasks: [], energy: 100 }, { today: "2026-07-27T08:00:00+08:00" });

  assert.equal(model.isDemo, true);
  assert.equal(model.sourceLabel, "演示样本");
  assert.equal(model.taskCount, 2);
  assert.equal(model.goldGain, 10);
  assert.equal(model.energyRestore, 20);
});

test("有真实待办时优先使用任务池，并排除已完成与演示任务", () => {
  const state = {
    energy: 40,
    mapTasks: [
      { id: "real-1", title: "提交周报", cat: "daily", durationMinutes: 20, energy: 10, gold: 10, restore: 0, done: false },
      { id: "real-2", title: "完成答辩", cat: "main", durationMinutes: 90, energy: 20, gold: 20, restore: 0, done: false },
      { id: "done-1", title: "已经完成", cat: "daily", durationMinutes: 20, energy: 10, gold: 10, restore: 0, done: true },
      { id: "demo-1", title: "演示遗留", cat: "daily", durationMinutes: 20, energy: 10, gold: 10, restore: 0, done: false, sourceKind: "demo-kept" }
    ]
  };
  const prophecy = createProphecy(state, [{ id: "fallback", weekday: 1, title: "演示", cat: "daily" }]);
  const model = prophecy.buildModel(state, { today: "2026-07-27T08:00:00+08:00" });

  assert.equal(model.isDemo, false);
  assert.equal(model.sourceLabel, "真实任务");
  assert.deepEqual(Array.from(model.tasks, (task) => task.id), ["real-1", "real-2"]);
  assert.equal(model.goldGain, 30);
  assert.equal(model.energySpend, 30);
  assert.equal(model.missingDeadlineCount, 2);
  assert.equal(model.confidence, "低");
});

test("预言文案不使用尚不存在的主线、声誉或关系分数", () => {
  assert.doesNotMatch(source, /主线\+|声誉\+|人际\+|关系\+|主线进度\s*[＋+]/);
  assert.match(source, /可观察迹象/);
  assert.match(source, /不代表结果一定发生/);
});

test("新入职演示样本包含此前设计的八张独立任务卡", () => {
  [
    "复盘本周卡点并列下周三件事",
    "彻底休息 30 分钟",
    "确认第一周优先级",
    "问清数据口径",
    "约 mentor coffee chat",
    "准备入职培训结业答辩",
    "完成入职培训结业答辩",
    "整理并发出本周周报"
  ].forEach((title) => assert.match(dataSource, new RegExp(title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))));

  assert.doesNotMatch(dataSource, /title:\s*"完成答辩，并发出本周周报"/);
});
