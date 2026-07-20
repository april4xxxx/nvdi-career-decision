import test from "node:test";
import assert from "node:assert/strict";
import { normalizeDecisionResponse } from "../api/_lib/decision.js";

test("normalizes and clamps a decision returned by the model", () => {
  const result = normalizeDecisionResponse({
    type: "decision",
    topic: "是否接下分享",
    message: "",
    question: null,
    decision: {
      category: "main",
      title: "行业分享",
      summary: "先做小版本",
      mirror: { invest: "90 分钟", reward: "获得反馈", cost: "占用晚上" },
      recommend: {
        label: "先试讲",
        text: "准备一个小切口",
        tasks: [{ title: "列大纲", cat: "main", durationMinutes: 90, energy: 999, gold: -10, restore: 50 }]
      },
      alt: null,
      sources: ["女帝职场决策原则.md"]
    }
  });
  assert.equal(result.type, "decision");
  assert.equal(result.decision.recommend.tasks[0].durationMinutes, 90);
  assert.equal(result.decision.recommend.tasks[0].energyTier, "MEDIUM");
  assert.equal(result.decision.recommend.tasks[0].energy, 20);
  assert.equal(result.decision.recommend.tasks[0].gold, 20);
  assert.equal(result.decision.recommend.tasks[0].restore, 0);
  assert.deepEqual(result.decision.sources, ["女帝职场决策原则.md"]);
});

test("creates a safe task when a decision contains no tasks", () => {
  const result = normalizeDecisionResponse({
    type: "decision",
    decision: { category: "unknown", recommend: { tasks: [] } }
  });
  assert.equal(result.decision.category, "daily");
  assert.equal(result.decision.recommend.tasks.length, 1);
  assert.equal(result.decision.recommend.tasks[0].energy, 10);
  assert.equal(result.decision.recommend.tasks[0].gold, 10);
});

test("limits questions to three choices", () => {
  const result = normalizeDecisionResponse({
    type: "question",
    question: { q: "最重要的限制？", options: [1, 2, 3, 4].map((n) => ({ text: String(n), tag: String(n) })) }
  });
  assert.equal(result.question.options.length, 3);
});
