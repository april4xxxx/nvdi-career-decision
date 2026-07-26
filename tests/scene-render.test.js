import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

function elementStub() {
  return {
    classList: {
      add() {},
      remove() {},
      toggle() {}
    },
    innerHTML: "",
    style: {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
}

test("scene renders generated tasks through the store reward API", async () => {
  const source = await readFile(new URL("../js/scene.js", import.meta.url), "utf8");
  const elements = {
    "#sceneBg": elementStub(),
    "#sceneHead": elementStub(),
    "#taskFieldInner": elementStub(),
    "#npcPortrait": elementStub(),
    "#folkStage": elementStub(),
    "#stage": elementStub()
  };
  const task = {
    id: "guide-task",
    title: "完成第一封新手奏折",
    bg: "task.png",
    cat: "main",
    done: false,
    durationMinutes: 20,
    energy: -8,
    gold: 12
  };
  let effectiveValuesCalls = 0;
  const store = {
    get() {
      return { scene: "court", dailyMystic: null };
    },
    tasksForScene() {
      return [task];
    },
    effectiveTaskValues(receivedTask) {
      effectiveValuesCalls += 1;
      assert.equal(receivedTask, task);
      return { gold: 18, energy: 6 };
    },
    dailyRerollCap() {
      return 1;
    },
    on() {}
  };
  const App = {
    data: {
      sceneById() {
        return {
          id: "court",
          name: "朝堂",
          role: "主线决策",
          icon: "court.svg",
          bg: "court.png",
          portrait: ""
        };
      },
      catByScene() {
        return { color: "#b33", label: "主线" };
      }
    },
    store,
    ui: {
      $(selector) {
        return elements[selector] || elementStub();
      },
      esc(value) {
        return String(value);
      }
    }
  };
  const context = {
    window: { App },
    setTimeout(callback) {
      callback();
      return 1;
    }
  };

  vm.runInNewContext(source, context);
  assert.doesNotThrow(() => context.window.App.scene.init());
  assert.equal(effectiveValuesCalls, 1);
  assert.match(elements["#taskFieldInner"].innerHTML, />18<\/span>/);
  assert.match(elements["#taskFieldInner"].innerHTML, />6<\/span>/);
});
