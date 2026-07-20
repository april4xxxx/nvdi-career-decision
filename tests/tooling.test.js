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

test("演示模式保留宁静的窗口跳转与阅读时间", async () => {
  const source = await readFile(new URL("../js/demo.js", import.meta.url), "utf8");

  assert.match(source, /typeChar:\s*54/);
  assert.match(source, /scene:\s*1800/);
  assert.match(source, /window:\s*1200/);
  assert.match(source, /readMedium:\s*2400/);
  assert.match(source, /readLong:\s*3200/);
  assert.match(source, /chapter:\s*1200/);
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
