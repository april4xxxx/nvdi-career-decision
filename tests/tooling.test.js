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

test("普通对话不注入演示模板，预言由独立模块接管", async () => {
  const [conversation, modes, prophecy] = await Promise.all([
    readFile(new URL("../js/conversation.js", import.meta.url), "utf8"),
    readFile(new URL("../js/modes.js", import.meta.url), "utf8"),
    readFile(new URL("../js/prophecy.js", import.meta.url), "utf8")
  ]);

  assert.match(conversation, /App\.demo && App\.demo\.active === true/);
  assert.doesNotMatch(conversation, /else presentDecision\(data\.brain\.genericDecision/);
  assert.match(modes, /App\.prophecy\.open\(prophVeil/);
  assert.doesNotMatch(modes, /data\.SCENARIOS\[0\]/);
  assert.doesNotMatch(modes, /getPendingDecision/);
  assert.match(prophecy, /data\.PROPHECY_DEMO_TASKS/);
  assert.match(prophecy, /state\.mapTasks/);
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

test("钦天监空态展示三张符合定稿卡样式的天象候选", async () => {
  const [scene, css] = await Promise.all([
    readFile(new URL("../js/scene.js", import.meta.url), "utf8"),
    readFile(new URL("../css/app.css", import.meta.url), "utf8")
  ]);

  assert.match(scene, /MYSTIC_PREVIEW_COUNT\s*=\s*3/);
  assert.match(scene, /task-template-card task-example-case mystic-preview/);
  assert.match(scene, /ic-energy-rest/);
  assert.match(scene, /store\.offerMysticCard/);
  assert.match(css, /\.task-template-card\.mystic-preview/);
});

test("普通地图切换只由 scene 事件触发一次场景渲染", async () => {
  const source = await readFile(new URL("../js/scene.js", import.meta.url), "utf8");
  const goScene = source.match(/function goScene\(id, options\) \{([\s\S]*?)\n  \}\n\n  function init/);

  assert.ok(goScene, "应能定位 goScene");
  assert.match(source, /store\.on\("scene", render\)/);
  assert.doesNotMatch(
    goScene[1],
    /store\.moveScene\(id, options\);[\s\S]*?\n\s*render\(\);/,
    "moveScene 已同步发出 scene 事件，goScene 不应再次手动 render"
  );
});

test("场景背景在应用空闲时按唯一地址预加载", async () => {
  const source = await readFile(new URL("../js/scene.js", import.meta.url), "utf8");

  assert.match(source, /function preloadSceneBackgrounds\(\)/);
  assert.match(source, /data\.SCENES/);
  assert.match(source, /new Image\(\)/);
  assert.match(source, /backgroundPreloads\[src\]/);
  assert.match(source, /requestIdleCallback/);
  assert.match(source, /preloadSceneBackgrounds\(\)/);
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

test("预言演示带读七日天象与功绩史卷，且不会从全流程巡览中缺席", async () => {
  const source = await readFile(new URL("../js/demo.js", import.meta.url), "utf8");
  const prophecy = source.match(/async function demoProphecy\(\) \{([\s\S]*?)\n  \}\n\n  async function demoLibrary/);
  const tour = source.match(/async function demoTour\(\) \{([\s\S]*?)\n  \}\n\n  function init/);

  assert.ok(prophecy, "demoProphecy function should remain discoverable");
  assert.match(prophecy[1], /\.prophecy-day-card/);
  assert.match(prophecy[1], /data-prophecy-view="chronicle"/);
  assert.match(prophecy[1], /\.prophecy-scroll-sheet/);
  assert.ok(tour, "demoTour function should remain discoverable");
  assert.ok(tour[1].indexOf("demoProphecy()") >= 0, "full tour should include prophecy");
  assert.ok(tour[1].indexOf("demoProphecy()") < tour[1].indexOf("demoFlow()"), "prophecy should appear before flow mode");
});

test("演示切换场景不冒充用户到访，也不直接解锁到访成就", async () => {
  const source = await readFile(new URL("../js/demo.js", import.meta.url), "utf8");
  const sceneJumps = Array.from(source.matchAll(/App\.nav\.goScene\(([^\n]+)\)/g), (match) => match[1]);

  assert.ok(sceneJumps.length > 0, "demo should still preview multiple scenes");
  assert.ok(sceneJumps.every((call) => /recordVisit:\s*false/.test(call)), "every demo scene preview must opt out of visit tracking");
  assert.doesNotMatch(source, /store\.unlock\("garden-stroll"\)|\[([^\]]*"garden-stroll"[^\]]*)\]\.forEach/);
});

test("三个独立阁楼切换无闪跳，凌烟阁可保持选中态", async () => {
  const [data, panel, scene, store, library, css] = await Promise.all([
    readFile(new URL("../js/data.js", import.meta.url), "utf8"),
    readFile(new URL("../js/panel.js", import.meta.url), "utf8"),
    readFile(new URL("../js/scene.js", import.meta.url), "utf8"),
    readFile(new URL("../js/store.js", import.meta.url), "utf8"),
    readFile(new URL("../js/library.js", import.meta.url), "utf8"),
    readFile(new URL("../css/library.css", import.meta.url), "utf8")
  ]);

  assert.match(data, /id:\s*"lingyan"[\s\S]*?trackVisit:\s*false/);
  assert.match(panel, /st\.scene === s\.id \? " active" : ""/);
  assert.match(store, /sc\.trackVisit !== false/);
  assert.ok(scene.indexOf("overlay.open();") < scene.indexOf("store.moveScene(id, options);"), "目标面板应先显示，再更新底层场景状态");
  assert.match(css, /\.panel-screen\.active\s*\{\s*display:\s*flex;\s*\}/);
  assert.doesNotMatch(css, /\.panel-screen\.active\s*\{[^}]*animation:/s);
  assert.doesNotMatch(library, /这里收着陛下的进阶之路/);
  assert.match(css, /\.panel-head \.picon\s*\{[^}]*filter:/s);
});

test("侧栏不再展示功业进度区块", async () => {
  const [panel, css] = await Promise.all([
    readFile(new URL("../js/panel.js", import.meta.url), "utf8"),
    readFile(new URL("../css/app.css", import.meta.url), "utf8")
  ]);

  assert.doesNotMatch(panel, /功业进度|sb-progress|mainPct|subPct/);
  assert.doesNotMatch(css, /\.sb-progress/);
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

test("public product surfaces retain the unified brand while onboarding uses the campaign copy", async () => {
  const [html, onboarding, topbar, readme, chat] = await Promise.all([
    readFile(new URL("../index.html", import.meta.url), "utf8"),
    readFile(new URL("../js/onboarding.js", import.meta.url), "utf8"),
    readFile(new URL("../js/topbar.js", import.meta.url), "utf8"),
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../api/chat.js", import.meta.url), "utf8")
  ]);
  const fullName = "女皇入朝｜AI 职场心流决策地图";

  assert.match(html, new RegExp(fullName));
  assert.match(onboarding, /真正的少女心事/);
  assert.match(onboarding, /是渴望建功立业/);
  assert.match(readme, new RegExp(fullName));
  assert.match(chat, new RegExp(fullName));
  assert.match(topbar, /女皇入朝/);
});
