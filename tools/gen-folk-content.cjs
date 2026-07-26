#!/usr/bin/env node
/* 生成市井偶遇内容层：从文案 md 逐字提取正文，套用已核对的 sourceKey/bookTitle 映射，
   改写 js/data.js 中的 FOLK_NPCS 块为 FOLK_CONTENT / COMMONERS / LEGENDS。
   一次性构建工具，不参与运行时。用法：node tools/gen-folk-content.js */
"use strict";
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const MD = path.resolve(ROOT, "../outputs/市井闲谈文案-2026-07-25.md");
const DATA = path.resolve(ROOT, "js/data.js");

const md = fs.readFileSync(MD, "utf8");

/* ---------- 提取夸赞 24 条（“## 一、夸赞陛下” 到 “## 二、知识闲谈” 之间的引用行） ---------- */
function slice(from, to) {
  const a = md.indexOf(from);
  const b = to ? md.indexOf(to, a) : md.length;
  return md.slice(a, b < 0 ? md.length : b);
}
function quotes(block) {
  return block.split("\n")
    .map(l => l.match(/^>\s+(.+?)\s*$/))
    .filter(Boolean)
    .map(m => m[1].trim());
}

const praiseTexts = quotes(slice("## 一、夸赞陛下", "## 二、知识闲谈"));
if (praiseTexts.length !== 24) throw new Error("夸赞条数 " + praiseTexts.length + " ≠ 24");

/* ---------- 提取知识 24 条正文（#### NN｜标题 后紧跟的引用行） ---------- */
const kBlock = slice("## 二、知识闲谈", "### 诗句");
const kBodies = [];
const re = /^####\s+(\d+)｜.*$\n\n>\s+(.+?)\s*$/gm;
let m;
while ((m = re.exec(kBlock))) kBodies[parseInt(m[1], 10)] = m[2].trim();
for (let i = 1; i <= 24; i++) if (!kBodies[i]) throw new Error("知识 #" + i + " 正文未提取到");

/* ---------- 提取诗句 18 条（### 诗句 之后的引用行，格式：“句。”——作者《作品》） ---------- */
const poemLines = quotes(slice("### 诗句", null));
if (poemLines.length !== 18) throw new Error("诗句条数 " + poemLines.length + " ≠ 18");

/* ---------- 已核对映射：知识 24 → sourceKey/bookTitle/author/year/sourceType（Appendix A.1） ----------
   paper：url = https://doi.org/{doi}；web：url 用原链接；composite：url = null。
   sourceKey 中的 doi 一律小写。同 sourceKey 只成一本书（去重在 store 落地）。 */
const KMAP = {
  1:  { type: "paper", doi: "10.1037/0021-9010.92.3.707", title: "Newcomer Adjustment During Organizational Socialization", author: "Bauer et al.", year: 2007 },
  2:  { type: "paper", doi: "10.1037/0021-9010.92.3.707", title: "Newcomer Adjustment During Organizational Socialization", author: "Bauer et al.", year: 2007 },
  3:  { type: "paper", doi: "10.2307/2666999", title: "Psychological Safety and Learning Behavior in Work Teams", author: "Edmondson", year: 1999 },
  4:  { type: "paper", doi: "10.1037/0033-2909.119.2.254", title: "The Effects of Feedback Interventions on Performance", author: "Kluger & DeNisi", year: 1996 },
  5:  { type: "paper", doi: "10.1037/0021-9010.92.3.707", title: "Newcomer Adjustment During Organizational Socialization", author: "Bauer et al.", year: 2007 },
  6:  { type: "paper", doi: "10.1207/s15327965pli1104_01", title: "The \"What\" and \"Why\" of Goal Pursuits", author: "Deci & Ryan", year: 2000 },
  7:  { type: "paper", doi: "10.1006/jvbe.1994.1027", title: "Toward a Unifying Social Cognitive Theory of Career and Academic Interest, Choice, and Performance", author: "Lent, Brown, & Hackett", year: 1994 },
  8:  { type: "paper", doi: "10.1016/j.jvb.2012.01.011", title: "Career Adapt-Abilities Scale", author: "Savickas & Porfeli", year: 2012 },
  9:  { type: "composite", key: "composite:career-direction-hypothesis", title: "职业方向作为待验证假设（基于 SCCT 的实践整理）", author: "基于 Lent, Brown, & Hackett (1994)", year: 1994 },
  10: { type: "paper", doi: "10.1037/0003-066x.57.9.705", title: "Building a Practically Useful Theory of Goal Setting and Task Motivation", author: "Locke & Latham", year: 2002 },
  11: { type: "paper", doi: "10.1037/0033-2909.133.1.65", title: "The Nature of Procrastination", author: "Steel", year: 2007 },
  12: { type: "paper", doi: "10.1037/0003-066x.54.7.493", title: "Implementation Intentions: Strong Effects of Simple Plans", author: "Gollwitzer", year: 1999 },
  13: { type: "paper", doi: "10.5465/amr.2006.22527462", title: "Integrating Theories of Motivation", author: "Steel & König", year: 2006 },
  14: { type: "composite", key: "composite:visible-next-action", title: "让下一步动作可见（实施意图×目标设定的实践整理）", author: "基于 Gollwitzer (1999) + Locke & Latham (2002)", year: 2002 },
  15: { type: "composite", key: "composite:small-batch-feedback", title: "小版本与早反馈（基于目标设定的实践整理）", author: "基于 Locke & Latham (2002)", year: 2002 },
  16: { type: "paper", doi: "10.1016/j.obhdp.2009.04.002", title: "Why Is It So Hard to Do My Work? The Challenge of Attention Residue", author: "Leroy", year: 2009 },
  17: { type: "paper", doi: "10.1037/0096-1523.27.4.763", title: "Executive Control of Cognitive Processes in Task Switching", author: "Rubinstein, Meyer, & Evans", year: 2001 },
  18: { type: "paper", doi: "10.1207/s15516709cog1202_4", title: "Cognitive Load During Problem Solving: Effects on Learning", author: "Sweller", year: 1988 },
  19: { type: "composite", key: "composite:recovery-cue", title: "恢复线索（注意力残留×任务切换的实践整理）", author: "基于 Leroy (2009) + Rubinstein et al. (2001)", year: 2009 },
  20: { type: "paper", doi: "10.1108/02683940710733115", title: "The Job Demands–Resources Model: State of the Art", author: "Bakker & Demerouti", year: 2007 },
  21: { type: "web", url: "https://www.who.int/news/item/28-05-2019-burn-out-an-occupational-phenomenon-international-classification-of-diseases", title: "Burn-out an \"Occupational Phenomenon\"", author: "World Health Organization", year: 2019 },
  22: { type: "paper", doi: "10.1037/1076-8998.12.3.204", title: "The Recovery Experience Questionnaire", author: "Sonnentag & Fritz", year: 2007 },
  23: { type: "paper", doi: "10.1207/s15327965pli1104_01", title: "The \"What\" and \"Why\" of Goal Pursuits", author: "Deci & Ryan", year: 2000 },
  24: { type: "paper", doi: "10.1037/0033-295x.84.2.191", title: "Self-efficacy: Toward a Unifying Theory of Behavioral Change", author: "Bandura", year: 1977 }
};

/* ---------- 名臣夸赞 16 条（PRD §9.2，只夸不教育） ---------- */
const LEGEND_PRAISE = {
  legend_shangguan: [
    "陛下近来落笔越来越稳，繁杂的事到了您手里，也总能很快理出轻重。臣看着，心里实在佩服。",
    "陛下如今待人既有温度，也有分寸，大家愿意把真话说给您听，这份信任最难得。",
    "陛下这一路走来，眼光比从前更准，做事也更从容。许多变化不声不响，却都落在实处。",
    "臣见陛下今日比昨日更笃定，既守得住自己的主意，也容得下不同声音，这份气度着实少见。"
  ],
  legend_silver: [
    "陛下近来既有向前的劲，也越来越懂得把力气用在真正要紧的地方，整个人都比从前从容了。",
    "陛下忙起来依然能顾到自己的感受，这份清醒很难得，也让您做事的节奏越来越稳。",
    "陛下如今遇到繁杂事务也不轻易乱了步子，缓一缓、再落子，反而每一步都走得更实。",
    "臣看陛下这段日子越来越舒展，心里有主意，手上有分寸，这样的状态真让人欢喜。"
  ],
  legend_rabbit: [
    "陛下近来走到哪里都有人愿意搭把手，这不是碰巧，是您平日待人的真心都被大家记住了。",
    "陛下现在越来越能看见那些不起眼的小机会，还总能把它们稳稳接住，这份机敏真漂亮。",
    "陛下做事越来越有轻重，忙的时候不慌，顺的时候也不松，难怪好运总愿意往您这边来。",
    "臣瞧着陛下最近的笑意比从前多了，事情也一件件有了回音，这份好光景全是您自己走出来的。"
  ],
  legend_diviner: [
    "陛下近来判断事情越来越准，遇到变化也不慌，总能从乱局里看出真正关键的那一点。",
    "臣见陛下如今眼光放得更远，脚下却走得更稳，这份清醒和笃定实在难得。",
    "陛下现在面对不确定的事越来越从容，既看得见风险，也看得见机会，心里的格局比从前更开阔了。",
    "陛下这段日子的每一次取舍都更有自己的章法，旁人看见的是结果，臣看见的是您越来越稳的心。"
  ]
};

/* ---------- 19 位市井人物（Appendix A.3；只留 displayName/title/portraitAsset） ---------- */
const COMMONERS = [
  ["001", "报信驿使", "市井脚夫", "市井1.png"],
  ["002", "茶摊老张", "街角茶摊主", "市井2.png"],
  ["003", "布庄掌柜", "东市布行东家", "市井3.png"],
  ["004", "卖花小娥", "巷口卖花女", "市井4.png"],
  ["005", "说书先生", "瓦舍说书人", "市井5.png"],
  ["006", "铁匠老王", "城南铁铺师傅", "市井6.png"],
  ["007", "巷口郎中", "街坊医者", "市井7.png"],
  ["008", "账房先生", "商行账房", "市井8.png"],
  ["009", "面摊阿婆", "西市面摊主", "市井9.png"],
  ["010", "挑夫阿力", "码头挑夫", "市井10.png"],
  ["011", "书画摊主", "文墨摊贩", "市井11.png"],
  ["012", "渔家阿舟", "河畔渔夫", "市井12.png"],
  ["013", "绣娘阿绫", "绣坊女工", "市井13.png"],
  ["014", "酒肆掌柜", "老字号酒家", "市井14.png"],
  ["015", "更夫老陈", "街巷更夫", "市井15.png"],
  ["016", "货郎阿担", "走街货郎", "市井16.png"],
  ["017", "桥头卜者", "桥头算命人", "市井17.png"],
  ["019", "镖师阿豹", "镖局武师", "市井19.png"],
  ["020", "药童小满", "药铺学徒", "市井20.png"]
];

/* ---------- 序列化辅助 ---------- */
function q(s) { return '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"'; }

/* ---------- 构建 FOLK_CONTENT ---------- */
const lines = [];
lines.push("  /* ---------- 市井闲谈内容池（66 条共享 + 16 条名臣夸赞）----------");
lines.push("     由 tools/gen-folk-content.js 从 outputs/市井闲谈文案-2026-07-25.md 生成，勿手改。");
lines.push("     kind: praise 只听不成书(source:null) / knowledge / poem 可成书(带 source)。 */");
lines.push("  var FOLK_CONTENT = [");

// 夸赞 24
praiseTexts.forEach((t, i) => {
  const id = "folk_praise_" + String(i + 1).padStart(2, "0");
  lines.push("    { id: " + q(id) + ", kind: \"praise\", text: " + q(t) + ", source: null, enabled: true },");
});
// 知识 24
for (let i = 1; i <= 24; i++) {
  const k = KMAP[i];
  const id = "folk_knowledge_" + String(i).padStart(2, "0");
  let sourceKey, url;
  if (k.type === "paper") { sourceKey = "doi:" + k.doi; url = "https://doi.org/" + k.doi; }
  else if (k.type === "web") { sourceKey = "url:" + k.url; url = k.url; }
  else { sourceKey = k.key; url = null; }
  const src = "{ sourceKey: " + q(sourceKey) + ", sourceType: " + q(k.type) +
    ", bookTitle: " + q(k.title) + ", author: " + q(k.author) + ", year: " + k.year +
    ", displayText: " + q(kBodies[i]) + ", url: " + (url ? q(url) : "null") + " }";
  lines.push("    { id: " + q(id) + ", kind: \"knowledge\", text: " + q(kBodies[i]) + ", source: " + src + ", enabled: true },");
}
// 诗句 18
poemLines.forEach((line, i) => {
  const mm = line.match(/^[“"](.+?)[”"]——(.+?)《(.+?)》\s*$/);
  if (!mm) throw new Error("诗句解析失败: " + line);
  const verse = mm[1], author = mm[2], work = mm[3];
  const id = "folk_poem_" + String(i + 1).padStart(2, "0");
  const displayText = verse + "——" + author + "《" + work + "》";
  const src = "{ sourceKey: " + q("poem:" + author + ":" + work) + ", sourceType: \"poem\"" +
    ", bookTitle: " + q(work) + ", author: " + q(author) + ", displayText: " + q(displayText) + ", url: null }";
  lines.push("    { id: " + q(id) + ", kind: \"poem\", text: " + q(displayText) + ", source: " + src + ", enabled: true },");
});
// 名臣夸赞 16
Object.keys(LEGEND_PRAISE).forEach(prefix => {
  LEGEND_PRAISE[prefix].forEach((t, i) => {
    const id = prefix + "_praise_" + String(i + 1).padStart(2, "0");
    lines.push("    { id: " + q(id) + ", kind: \"praise\", text: " + q(t) + ", source: null, enabled: true },");
  });
});
lines.push("  ];");
lines.push("");

/* ---------- 构建 COMMONERS ---------- */
lines.push("  /* ---------- 19 位市井人物（保留人名/立绘，内容改抽自 FOLK_CONTENT 共享池） ---------- */");
lines.push("  var COMMONERS = [");
COMMONERS.forEach(c => {
  lines.push("    { id: " + q("commoner_" + c[0]) + ", displayName: " + q(c[1]) +
    ", title: " + q(c[2]) + ", portraitAsset: " + q(c[3]) + ", enabled: true },");
});
lines.push("  ];");
lines.push("");

/* ---------- 构建 LEGENDS（PRD §19.3） ---------- */
const LEGENDS = [
  ["legend_shangguan_waner", "上官婉儿", "掌诏才女", "人物/上官婉儿.png", "legend_shangguan",
   "buff_shangguan_waner_gold", "金笔生花", "task_gold_multiplier", 2, "multiply", "从现在起，完成并呈报普通任务时，基础金币赏赐翻倍。"],
  ["legend_silver_chrysanthemum", "银叶菊仙", "疗愈花仙", "人物/银叶菊仙.png", "legend_silver",
   "buff_silver_chrysanthemum_energy", "银叶轻覆", "task_energy_multiplier", 0.5, "multiply", "从现在起，完成普通任务时，精力消耗减半，四舍五入。"],
  ["legend_rabbit_spirit", "兔子精", "玉兔机敏", "人物/兔子精.png", "legend_rabbit",
   "buff_rabbit_legend_chance", "福缘广结", "encounter_weight_add", 0.1, "add", "下一次进入民间起，名臣出现率由 15% 提高到 25%。"],
  ["legend_diviner", "卦师", "钦天监正", "人物/卦师.png", "legend_diviner",
   "buff_diviner_daily_reroll", "观星改命", "daily_reroll_add", 1, "add", "从现在起，每日天象签可额外免费重抽一次，总数增至 2 次。"]
];
lines.push("  /* ---------- 4 位名臣（PRD §19.3；praiseContentIds 指向 FOLK_CONTENT 中的名臣夸赞） ---------- */");
lines.push("  var LEGENDS = [");
LEGENDS.forEach(l => {
  const pids = [1, 2, 3, 4].map(n => q(l[4] + "_praise_0" + n)).join(", ");
  lines.push("    {");
  lines.push("      id: " + q(l[0]) + ", displayName: " + q(l[1]) + ", title: " + q(l[2]) + ", portraitAsset: " + q(l[3]) + ",");
  lines.push("      praiseContentIds: [" + pids + "],");
  lines.push("      buff: { id: " + q(l[5]) + ", name: " + q(l[6]) + ", type: " + q(l[7]) + ", value: " + l[8] + ", stackMode: " + q(l[9]) + ", description: " + q(l[10]) + " },");
  lines.push("      enabled: true");
  lines.push("    },");
});
lines.push("  ];");

const block = lines.join("\n") + "\n";

/* ---------- 写回 data.js：替换 “市井之人名录” 注释 + FOLK_NPCS 数组 ---------- */
let src = fs.readFileSync(DATA, "utf8");
const START = "  /* ---------- 市井之人名录";
const startIdx = src.indexOf(START);
if (startIdx < 0) throw new Error("未找到 FOLK_NPCS 注释起点");
const arrStart = src.indexOf("var FOLK_NPCS = [", startIdx);
const arrEnd = src.indexOf("\n  ];", arrStart);
if (arrEnd < 0) throw new Error("未找到 FOLK_NPCS 数组结尾");
const after = arrEnd + "\n  ];".length;
src = src.slice(0, startIdx) + block.replace(/\n$/, "") + src.slice(after);

/* 导出块：FOLK_NPCS 键换成三块 */
src = src.replace(
  "    FOLK_NPCS: FOLK_NPCS,",
  "    FOLK_CONTENT: FOLK_CONTENT,\n    COMMONERS: COMMONERS,\n    LEGENDS: LEGENDS,"
);
if (src.indexOf("FOLK_CONTENT: FOLK_CONTENT") < 0) throw new Error("导出块替换失败");

fs.writeFileSync(DATA, src, "utf8");
console.log("OK: FOLK_CONTENT " + (24 + 24 + 18 + 16) + " 条, COMMONERS " + COMMONERS.length + ", LEGENDS " + LEGENDS.length);
