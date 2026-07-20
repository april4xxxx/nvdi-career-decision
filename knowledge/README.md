# 公共知识库

`女帝职场决策原则.md` 是公共决策知识的可读、可维护原稿。为保证 Vercel Function 部署稳定，当前版本把它的核心规则同步到 `api/chat.js` 的 `PUBLIC_KNOWLEDGE`，每次 DeepSeek 对话都会使用。

用户上传的 TXT、Markdown、PDF 不进入公共知识库。服务端只负责提取文字并立即返回；浏览器在 `localStorage(nvdi-full-v1)` 的 `knowledge.documents` 中保存文本，并在每次对话前做轻量相关片段检索。

更新公共原则时，应同时更新原稿与 `api/chat.js` 中的精简版本，并运行 `npm test`。
