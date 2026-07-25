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

test("strips internal category markers from AI task titles", () => {
  const result = normalizeDecisionResponse({
    type: "decision",
    decision: {
      category: "main",
      title: "入职准备",
      summary: "分步完成",
      mirror: {},
      recommend: {
        label: "今晚先准备",
        text: "把材料收齐",
        tasks: [
          { title: "[main] 备齐材料", cat: "main", durationMinutes: 15 },
          { title: "【daily】检查通知", cat: "daily", durationMinutes: 10 }
        ]
      },
      alt: null,
      sources: []
    }
  });

  assert.deepEqual(result.decision.recommend.tasks.map((task) => task.title), ["备齐材料", "检查通知"]);
});

test("keeps the minister role from speaking as the empress", () => {
  const dialogue = normalizeDecisionResponse({
    type: "dialogue",
    topic: "医院安排",
    message: "朕理解，明日当以龙体为重；若需安排，朕可为你谋划。",
    question: null,
    decision: null
  });
  const question = normalizeDecisionResponse({
    type: "question",
    topic: "医院安排",
    message: "",
    question: { q: "朕先问一句：明日可以请假吗？", options: [] },
    decision: null
  });

  assert.equal(dialogue.message, "臣理解，明日当以龙体为重；若需安排，臣可为你谋划。");
  assert.equal(question.question.q, "臣先问一句：明日可以请假吗？");
});

test("normalizes NPC detection and keeps only links to final task cards", () => {
  const result = normalizeDecisionResponse({
    type: "decision",
    topic: "需求范围冲突",
    message: "",
    question: null,
    decision: {
      category: "daily",
      title: "确认上线范围",
      summary: "先和产品确认 MVP 边界",
      mirror: {},
      recommend: {
        label: "先书面确认",
        text: "列出边界和风险",
        tasks: [{ title: "给 Alice 发送需求边界确认", cat: "daily", durationMinutes: 20 }]
      },
      alt: null,
      sources: [],
      npcDetection: {
        hasRelevantPeople: true,
        candidates: [{
          existingNpcId: "",
          displayName: "Alice",
          title: "产品经理",
          aliases: ["产品 Alice"],
          role: "product",
          identityStatus: "auto_created",
          identityConfidence: 1.4,
          relationship: {
            stance: "rival",
            stanceConfidence: 0.72,
            inferenceReason: "排期和需求边界存在冲突",
            trust: 0,
            influence: 70,
            alignment: -20,
            conflict: 45,
            familiarity: 35
          },
          taskLinks: [
            { path: "recommend", taskIndex: 0, relation: "recipient", reason: "待办行动对象是 Alice", confidence: 0.9 },
            { path: "recommend", taskIndex: 3, relation: "mentioned", reason: "无效索引", confidence: 0.5 }
          ]
        }]
      }
    }
  });

  assert.equal(result.decision.npcDetection.hasRelevantPeople, true);
  assert.equal(result.decision.npcDetection.candidates.length, 1);
  assert.equal(result.decision.npcDetection.candidates[0].identityConfidence, 1);
  assert.equal(result.decision.npcDetection.candidates[0].taskLinks.length, 1);
  assert.equal(result.decision.npcDetection.candidates[0].taskLinks[0].taskIndex, 0);
});
