import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("local Vercel command cannot be discovered as its own dev command", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(pkg.scripts.dev, undefined);
  assert.equal(pkg.scripts.local, "vercel dev");
});

test("conversation thinking round awaits the async AI result", async () => {
  const source = await readFile(new URL("../js/conversation.js", import.meta.url), "utf8");

  assert.match(source, /think\(function \(\) \{ return respond\(text\); \}\);/);
  assert.match(source, /think\(function \(\) \{ return regenerate\(text\); \}\);/);
});

test("hardcoded decision templates stay inside explicit demo mode", async () => {
  const [conversation, modes] = await Promise.all([
    readFile(new URL("../js/conversation.js", import.meta.url), "utf8"),
    readFile(new URL("../js/modes.js", import.meta.url), "utf8")
  ]);

  assert.match(conversation, /App\.demo && App\.demo\.active === true/);
  assert.doesNotMatch(conversation, /else presentDecision\(data\.brain\.genericDecision/);
  assert.doesNotMatch(modes, /data\.SCENARIOS\[0\]/);
});

test("场景任务范例只是空态入口，不写入真实任务池", async () => {
  const [scene, store] = await Promise.all([
    readFile(new URL("../js/scene.js", import.meta.url), "utf8"),
    readFile(new URL("../js/store.js", import.meta.url), "utf8")
  ]);

  assert.match(scene, /task-template-card/);
  assert.match(scene, /task-example-case/);
  assert.match(scene, /App\.conversation\.expand\(\)/);
  assert.doesNotMatch(store, /SCENE_TASK_TEMPLATES/);
});

test("前端不使用标题关键词篡改 AI 任务分类", async () => {
  const [data, store] = await Promise.all([
    readFile(new URL("../js/data.js", import.meta.url), "utf8"),
    readFile(new URL("../js/store.js", import.meta.url), "utf8")
  ]);

  assert.doesNotMatch(data, /function correctTaskCategory/);
  assert.doesNotMatch(store, /correctTaskCategory/);
});

test("演示模式保留宁静的窗口跳转与阅读时间", async () => {
  const source = await readFile(new URL("../js/demo.js", import.meta.url), "utf8");

  assert.match(source, /typeChar:\s*54/);
  assert.match(source, /scene:\s*1800/);
  assert.match(source, /window:\s*1200/);
  assert.match(source, /readMedium:\s*2400/);
  assert.match(source, /readLong:\s*3200/);
  assert.match(source, /chapter:\s*1200/);
});

test("藏书阁演示无论典籍上传结果都会收起弹窗", async () => {
  const source = await readFile(new URL("../js/demo.js", import.meta.url), "utf8");
  const demoLibrary = source.match(/async function demoLibrary\(\) \{([\s\S]*?)\n  \}\n\n  async function demoTreasury/);

  assert.ok(demoLibrary, "demoLibrary function should remain discoverable");
  const uploadWait = demoLibrary[1].indexOf("await sleep(DEMO_PACE.readShort);");
  const modalClose = demoLibrary[1].indexOf("ui.closeModal();", uploadWait);
  assert.ok(uploadWait >= 0 && modalClose > uploadWait, "upload modal should close after its result is shown");
});

test("藏书阁演示先预览主线任务，再浏览起居注和治国之策", async () => {
  const source = await readFile(new URL("../js/demo.js", import.meta.url), "utf8");
  const demoLibrary = source.match(/async function demoLibrary\(\) \{([\s\S]*?)\n  \}\n\n  async function demoTreasury/);

  assert.ok(demoLibrary, "demoLibrary function should remain discoverable");
  const milestone = demoLibrary[1].indexOf("tabs[0]");
  const journal = demoLibrary[1].indexOf("tabs[1]");
  const books = demoLibrary[1].indexOf("tabs[2]");
  assert.ok(milestone >= 0 && milestone < journal && journal < books, "library demo should preview tabs in product order");
});

test("普通对话恢复自适应高度，只有追问区扩展并保留底部输入框", async () => {
  const css = await readFile(new URL("../css/app.css", import.meta.url), "utf8");
  const ordinaryExpanded = css.match(/\.convo\.expanded\s*\{([^}]*)\}/);

  assert.ok(ordinaryExpanded, "ordinary expanded conversation rule should remain discoverable");
  assert.match(css, /\.convo\.expanded\s*\{[^}]*max-height:\s*78%/s);
  assert.doesNotMatch(ordinaryExpanded[1], /(?:^|;)\s*height:/s);
  assert.match(css, /\.convo\.expanded:has\(\.reply-zone \.opt-btn\)\s*\{[^}]*height:\s*78%/s);
  assert.match(css, /\.convo\.expanded \.convo-input\s*\{[^}]*flex:\s*0 0 auto/s);
  assert.match(css, /\.convo\.expanded:not\(\.decision-pending\) \.gal-box\s*\{[^}]*flex:\s*0 0 auto[^}]*overflow-y:\s*auto/s);
});

test("待批奏折覆盖在舞台边界内，压缩历史以首屏露出完整操作区", async () => {
  const css = await readFile(new URL("../css/app.css", import.meta.url), "utf8");

  assert.match(css, /\.convo\.expanded\.decision-pending\s*\{[^}]*position:\s*absolute[^}]*inset:\s*8px 0 0[^}]*height:\s*auto/s);
  assert.match(css, /\.convo\.expanded\.decision-pending \.convo-scroll\s*\{[^}]*flex:\s*0 0 48px[^}]*max-height:\s*48px/s);
});

test("public product surfaces use the unified brand name", async () => {
  const [html, onboarding, topbar, readme, chat] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../js/onboarding.js", import.meta.url), "utf8"),
    readFile(new URL("../js/topbar.js", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../api/chat.js", import.meta.url), "utf8")
  ]);
  const fullName = "女皇入朝｜AI 职场心流决策地图";

  assert.match(html, new RegExp(fullName));
  assert.match(onboarding, new RegExp(fullName));
  assert.match(readme, new RegExp(fullName));
  assert.match(chat, new RegExp(fullName));
  assert.match(topbar, /女皇入朝/);
});
