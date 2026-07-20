import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";

const apiKey = process.env.OPENAI_API_KEY;
if (!apiKey) {
  console.error("缺少 OPENAI_API_KEY。请只在本机环境变量中设置，不要写入仓库。");
  process.exit(1);
}

const root = new URL("../knowledge/", import.meta.url);
const allowed = new Set([".md", ".txt", ".pdf"]);

async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set("authorization", "Bearer " + apiKey);
  if (options.body && !(options.body instanceof FormData)) headers.set("content-type", "application/json");
  const response = await fetch("https://api.openai.com/v1" + path, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.message || `OpenAI API ${response.status}`);
  return data;
}

const entries = (await readdir(root, { withFileTypes: true }))
  .filter((entry) => entry.isFile() && allowed.has(extname(entry.name).toLowerCase()))
  .filter((entry) => entry.name !== "README.md");

if (!entries.length) {
  console.error("knowledge/ 中没有可上传的知识文件。");
  process.exit(1);
}

const vectorStore = await api("/vector_stores", {
  method: "POST",
  body: JSON.stringify({ name: "女帝职场决策系统·公共知识库" })
});

for (const entry of entries) {
  const bytes = await readFile(new URL(entry.name, root));
  const form = new FormData();
  form.set("purpose", "assistants");
  form.set("file", new Blob([bytes]), basename(entry.name));
  const uploaded = await api("/files", { method: "POST", body: form });
  await api(`/vector_stores/${encodeURIComponent(vectorStore.id)}/files`, {
    method: "POST",
    body: JSON.stringify({ file_id: uploaded.id })
  });
  console.log(`已提交：${entry.name}`);
}

console.log("\n公共知识库已创建。等待 OpenAI 完成索引后，将下列值填入 Vercel：");
console.log(`OPENAI_VECTOR_STORE_ID=${vectorStore.id}`);
