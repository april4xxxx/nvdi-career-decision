import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const modesSource = await readFile(new URL("../js/modes.js", import.meta.url), "utf8");
const sceneSource = await readFile(new URL("../js/scene.js", import.meta.url), "utf8");
const mainSource = await readFile(new URL("../js/main.js", import.meta.url), "utf8");
const appCss = await readFile(new URL("../css/app.css", import.meta.url), "utf8");
const libraryCss = await readFile(new URL("../css/library.css", import.meta.url), "utf8");

function makeElement() {
  const classes = new Set();
  return {
    style: {},
    innerHTML: "",
    classList: {
      add(name) { classes.add(name); },
      remove(name) { classes.delete(name); },
      contains(name) { return classes.has(name); }
    },
    querySelector() { return null; }
  };
}

function createModes(initialMode = "normal") {
  const state = { mode: initialMode, mapTasks: [] };
  const elements = {
    "#flowVeil": makeElement(),
    "#prophecyVeil": makeElement(),
    "#flowStart": makeElement(),
    "#flowExit": makeElement(),
    "#prophExit": makeElement()
  };
  let prophecyOpenCount = 0;
  let prophecyUseCount = 0;

  const App = {
    data: { ASSET_BASE: "assets/" },
    store: {
      get: () => state,
      setMode(mode) { state.mode = mode; },
      useProphecy() { prophecyUseCount += 1; }
    },
    ui: {
      $: (selector) => elements[selector] || null,
      esc: (value) => String(value)
    },
    prophecy: {
      open() {
        prophecyOpenCount += 1;
        return { sourceKey: "mode-test" };
      },
      close(container) {
        if (container) container.innerHTML = "";
      }
    }
  };

  const context = vm.createContext({
    window: { App },
    console,
    setInterval,
    clearInterval
  });
  vm.runInContext(modesSource, context, { filename: "modes.js" });

  return {
    modes: App.modes,
    state,
    elements,
    prophecyOpenCount: () => prophecyOpenCount,
    prophecyUseCount: () => prophecyUseCount
  };
}

test("顶部模式 Tab 重复点击不会重建或重复计数", () => {
  const fixture = createModes();
  fixture.modes.init();

  assert.equal(fixture.modes.switchTo("prophecy"), true);
  assert.equal(fixture.state.mode, "prophecy");
  assert.equal(fixture.prophecyOpenCount(), 1);
  assert.equal(fixture.prophecyUseCount(), 1);

  assert.equal(fixture.modes.switchTo("prophecy"), false);
  assert.equal(fixture.prophecyOpenCount(), 1);
  assert.equal(fixture.prophecyUseCount(), 1);
  assert.equal(fixture.elements["#prophecyVeil"].classList.contains("active"), true);
});

test("离开模式时遮罩与顶部 mode 同时回到常规", () => {
  const fixture = createModes();
  fixture.modes.init();
  fixture.modes.switchTo("prophecy");

  fixture.modes.exitToNormal();

  assert.equal(fixture.state.mode, "normal");
  assert.equal(fixture.modes.isOverlayActive(), false);
  assert.equal(fixture.elements["#prophecyVeil"].innerHTML, "");
});

test("刷新时不恢复无法延续的心流或预言遮罩", () => {
  const fixture = createModes("prophecy");

  fixture.modes.init();

  assert.equal(fixture.state.mode, "normal");
  assert.equal(fixture.modes.isOverlayActive(), false);
  assert.equal(fixture.prophecyOpenCount(), 0);
  assert.equal(fixture.prophecyUseCount(), 0);
});

test("地图导航和 Esc 均通过模式切换回到常规", () => {
  assert.match(sceneSource, /App\.modes\.exitToNormal\(\)/);
  assert.match(mainSource, /App\.modes\.isOverlayActive\(\)[\s\S]*?App\.modes\.switchTo\("normal"\)/);
});

test("心流和预言模式覆盖藏书阁、珍宝阁与凌烟阁面板", () => {
  const panelLayer = Number(libraryCss.match(/\.panel-screen\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);
  const flowLayer = Number(appCss.match(/\.flow-veil\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);
  const prophecyLayer = Number(appCss.match(/\.prophecy-veil\s*\{[^}]*z-index:\s*(\d+)/s)?.[1]);

  assert.ok(flowLayer > panelLayer, "心流遮罩必须显示在三个独立阁楼面板之上");
  assert.ok(prophecyLayer > panelLayer, "预言遮罩必须显示在三个独立阁楼面板之上");
});
