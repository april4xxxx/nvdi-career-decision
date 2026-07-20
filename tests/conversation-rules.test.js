import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

async function loadRules() {
  const source = await readFile(new URL("../js/conversation-rules.js", import.meta.url), "utf8");
  const context = { window: { App: {} } };
  vm.runInNewContext(source, context, { filename: "conversation-rules.js" });
  return context.window.App.conversationRules;
}

test("再议后输入补充内容会重新生成方案，不会误批准旧奏折", async () => {
  const rules = await loadRules();

  assert.equal(rules.sendAction("stamp", true, "我只有半天时间"), "submit");
  assert.equal(rules.sendAction("stamp", true, ""), "approve");
});

test("普通闲聊不会消耗职场决策的唯一次追问机会", async () => {
  const rules = await loadRules();

  assert.equal(rules.nextProbed(false, "dialogue"), false);
  assert.equal(rules.nextProbed(false, "question"), true);
  assert.equal(rules.nextProbed(true, "dialogue"), true);
});

test("开启新对话前识别待批奏折、未答追问和未发送草稿", async () => {
  const rules = await loadRules();

  assert.deepEqual(Array.from(rules.newConversationRisks({
    pendingDecision: { decision: {} },
    activeQuestion: { q: "要先处理哪件事？" },
    draft: "我再补充一句"
  })), ["pending", "question", "draft"]);
  assert.deepEqual(Array.from(rules.newConversationRisks({ draft: "   " })), []);
});

test("新对话主题使用当前场景的议事名称", async () => {
  const rules = await loadRules();

  assert.equal(rules.sceneConversationTopic("御花园"), "御花园议事");
  assert.equal(rules.sceneConversationTopic(""), "宫廷议事");
});

test("用户典籍只发送与当前问题命中的片段", async () => {
  const rules = await loadRules();
  const documents = [
    { title: "医院客户复盘", content: "与医生沟通前，先确认产品的使用场景与异常反馈。" },
    { title: "旅行清单", content: "出发前检查护照、行李和酒店预订。" }
  ];

  const selected = rules.selectKnowledge(documents, "下午要去医院跟医生沟通产品反馈");
  assert.deepEqual(Array.from(selected, (item) => item.title), ["医院客户复盘"]);
  assert.equal(rules.selectKnowledge(documents, "如何准备年终述职").length, 0);
});

test("典籍检索保留当前入职阶段的上下文加权", async () => {
  const rules = await loadRules();
  const documents = [
    { title: "入职手册", content: "入职第1周：先熟悉业务和团队协作方式。" },
    { title: "转正手册", content: "入职61-90天：准备转正答辩。" }
  ];

  const selected = rules.selectKnowledge(documents, "我现在应该注意什么", "DAY_1_7");
  assert.deepEqual(Array.from(selected, (item) => item.title), ["入职手册"]);
});

test("相同关键词优先返回当前入职阶段的典籍片段", async () => {
  const rules = await loadRules();
  const documents = [{
    title: "90天入职计划",
    content: "第1-7天：整理工作汇报的基本格式。".padEnd(2400, "入") +
      "第31-60天：用成果和风险证据准备工作汇报。"
  }];

  const selected = rules.selectKnowledge(documents, "怎么准备工作汇报", "DAY_31_60");

  assert.match(selected[0].content, /第31-60天/);
  assert.deepEqual(Array.from(selected[0].journeyStages), ["DAY_31_60"]);
  assert.equal(rules.selectKnowledge(documents, "如何安排年度旅行", "DAY_31_60").length, 0);
});
