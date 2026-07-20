# 公共知识库

`女帝职场决策原则.md` 是公共决策知识的可读、可维护原稿。为保证 Vercel Function 部署稳定，当前版本把它的核心规则同步到 `api/chat.js` 的 `PUBLIC_KNOWLEDGE`，每次 DeepSeek 对话都会使用。

用户上传的 TXT、Markdown、PDF 不进入公共知识库。服务端只负责提取文字并立即返回；浏览器在 `localStorage(nvdi-full-v1)` 的 `knowledge.documents` 中保存文本，并在每次对话前做轻量相关片段检索。

结构化职场新人 SOP 独立维护在项目根目录的 `sop/`，避免与每轮常驻提示词混用。`sop/04-职场新人SOP库.json` 是主库，经 `scripts/build-sop-runtime.mjs` 编译到 `api/_generated/sop-runtime.js`；只有通过发布门并标记为 `ACTIVE` 的内容参与服务端检索。

更新公共原则时，应同时更新原稿与 `api/chat.js` 中的精简版本，并运行 `npm test`。
