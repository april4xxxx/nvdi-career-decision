import { readFile, writeFile, chmod } from "node:fs/promises";
import { resolve } from "node:path";

function readHidden(prompt) {
  if (!process.stdin.isTTY) throw new Error("请在本机交互式终端运行此命令");
  process.stdout.write(prompt);
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise((resolveSecret, reject) => {
    let secret = "";
    function finish(error) {
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdin.off("data", onData);
      process.stdout.write("\n");
      if (error) reject(error);
      else resolveSecret(secret.trim());
    }
    function onData(chunk) {
      for (const character of chunk) {
        if (character === "\u0003") return finish(new Error("已取消"));
        if (character === "\r" || character === "\n") return finish();
        if (character === "\u007f" || character === "\b") secret = secret.slice(0, -1);
        else secret += character;
      }
    }
    process.stdin.on("data", onData);
  });
}

const envPath = resolve(process.argv[2] || ".env.local");
const secret = await readHidden("请输入 DeepSeek API Key（输入不会显示）：");
if (!secret || /SENSITIVE|REDACTED|PLACEHOLDER/i.test(secret) || secret.length < 20) {
  throw new Error("输入不像有效的 DeepSeek API Key，未写入文件");
}

let current = "";
try { current = await readFile(envPath, "utf8"); } catch {}
const lines = current.split(/\r?\n/).filter((line) => !/^\s*(DEEPSEEK_API_KEY|deepseek)\s*=/.test(line));
while (lines.length && !lines.at(-1).trim()) lines.pop();
lines.push(`DEEPSEEK_API_KEY=${JSON.stringify(secret)}`, "");
await writeFile(envPath, lines.join("\n"), { encoding: "utf8", mode: 0o600 });
await chmod(envPath, 0o600);
process.stdout.write(`已安全写入 ${envPath}；文件权限为 600，密钥未显示。\n`);
