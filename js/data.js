/* =============================================================
   data.js —— 女皇入朝｜AI 职场心流决策地图
   所有静态内容：场景 / 御前推演题目 / 女帝类型 / NPC /
   成就(59, 复用珍宝阁数据) / 主线里程碑 / 默认藏书
   全局命名空间 window.App.data
   ============================================================= */
(function () {
  "use strict";
  window.App = window.App || {};
  var A = "assets/";

  /* ---------- 女帝类型（御前推演结果） ---------- */
  var EMPRESS_TYPES = {
    "铁腕": {
      key: "铁腕", title: "铁腕型女帝", portrait: A + "人物/女皇1.png",
      say: "乾纲独断，令行禁止。",
      desc: "你重结果、讲效率，遇事敢拍板。朝臣畏你三分，也服你三分。",
      trait: ["决断力强", "推进迅捷", "以结果论英雄"],
      advice: "偶尔纳谏，可让铁腕更得人心。"
    },
    "仁厚": {
      key: "仁厚", title: "仁厚型女帝", portrait: A + "人物/女皇2.png",
      say: "以德服人，怀柔天下。",
      desc: "你体恤下属、注重和谐，善于凝聚人心，团队愿为你效死力。",
      trait: ["善纳众议", "重视关系", "长于协调"],
      advice: "关键时刻仍需乾纲独断，莫因仁而失断。"
    },
    "谋略": {
      key: "谋略", title: "谋略型女帝", portrait: A + "人物/女皇3.png",
      say: "运筹帷幄，决胜千里。",
      desc: "你善分析、重规划，落子之前必先算三步，稳中求胜。",
      trait: ["深谋远虑", "风险敏感", "长线布局"],
      advice: "机会稍纵即逝，谋定之后须速动。"
    },
    "革新": {
      key: "革新", title: "革新型女帝", portrait: A + "人物/女皇4.png",
      say: "破旧立新，锐意进取。",
      desc: "你不拘成法、勇于尝试，愿为长远收益承担眼前风险。",
      trait: ["敢于突破", "拥抱变化", "创造力强"],
      advice: "革新之余，也要守住根基，勿失稳健。"
    }
  };

  /* ---------- 御前推演：6 题 ----------
     每题选项 weight 指向某种女帝类型 */
  var QUIZ = [
    {
      id: "q1", stem: "新官上任，第一件差事千头万绪，你先做什么？",
      npc: "史官", portrait: A + "人物/史官.png",
      options: [
        { text: "立刻定下目标，分派任务，即刻开工", w: "铁腕" },
        { text: "先召集众臣，听听大家的想法", w: "仁厚" },
        { text: "花半日理清全局，画出整盘计划", w: "谋略" },
        { text: "试几个新法子，看看哪条路走得通", w: "革新" }
      ]
    },
    {
      id: "q2", stem: "一位老臣当众质疑你的决策，你如何应对？",
      npc: "直臣", portrait: A + "人物/直臣.png",
      options: [
        { text: "当场驳回，维护决策的权威", w: "铁腕" },
        { text: "耐心听完，肯定他的用心再解释", w: "仁厚" },
        { text: "请他细陈理由，据此评估是否调整", w: "谋略" },
        { text: "干脆借他的质疑，抛出一个新方案", w: "革新" }
      ]
    },
    {
      id: "q3", stem: "国库吃紧，一项要事却缺钱推进，你怎么办？",
      npc: "顺臣", portrait: A + "人物/顺臣.png",
      options: [
        { text: "砍掉次要开支，集中资源办大事", w: "铁腕" },
        { text: "与各部商量，共度时艰、分摊压力", w: "仁厚" },
        { text: "细算投入产出，排出优先次序", w: "谋略" },
        { text: "另辟财源，想个前所未有的法子", w: "革新" }
      ]
    },
    {
      id: "q4", stem: "面对一件从未处理过的棘手政务，你的第一反应是？",
      npc: "翰林", portrait: A + "人物/翰林.png",
      options: [
        { text: "先干起来，边做边改", w: "铁腕" },
        { text: "找有经验的人请教一番", w: "仁厚" },
        { text: "查遍典籍旧例，谋定而后动", w: "谋略" },
        { text: "把它当成试验，大胆闯一闯", w: "革新" }
      ]
    },
    {
      id: "q5", stem: "深夜批阅奏折，精力将尽，尚有要务未了，你会？",
      npc: "宫女", portrait: A + "人物/宫女.png",
      options: [
        { text: "咬牙撑住，务必今夜办完", w: "铁腕" },
        { text: "留一半给可信的人分担", w: "仁厚" },
        { text: "先挑最要紧的批完，余者明日再议", w: "谋略" },
        { text: "换个新法子提提神，接着干", w: "革新" }
      ]
    },
    {
      id: "q6", stem: "一年之后，你最希望史书如何评价你？",
      npc: "卦师", portrait: A + "人物/卦师onboarding.png",
      options: [
        { text: "雷厉风行，功业卓著", w: "铁腕" },
        { text: "仁德爱人，四海归心", w: "仁厚" },
        { text: "深谋远虑，运筹帷幄", w: "谋略" },
        { text: "锐意革新，开一代新风", w: "革新" }
      ]
    }
  ];

  /* ---------- 场景（左侧地图 8 处） ---------- */
  var SCENES = [
    {
      id: "residence", name: "起居殿", role: "日常起居", type: "base",
      bg: A + "场景/起居殿.png", icon: A + "svg图标/起居殿.svg",
      desc: "女帝起居休整之所，可查看今日概览、稍作休憩。",
      npc: "宫女", portrait: A + "人物/宫女.png",
      opening: "陛下醒了。今日风和日丽，可要先用早膳，再理朝政？"
    },
    {
      id: "court", name: "朝堂", role: "主线·决策", type: "main",
      bg: A + "场景/上朝.png", icon: A + "svg图标/朝堂.svg",
      desc: "百官奏事之地，主线任务与重大决策在此定夺。",
      npc: "史官", portrait: A + "人物/史官.png",
      opening: "陛下临朝，众臣已候多时。今有数份奏折待陛下朱批。"
    },
    {
      id: "ministry", name: "六部", role: "日常事务", type: "daily",
      bg: A + "场景/书房.png", icon: A + "svg图标/六部.svg",
      desc: "吏户礼兵刑工六部，日常庶务在此办理。",
      npc: "顺臣", portrait: A + "人物/顺臣.png",
      opening: "陛下驾临六部，今日份的日常政务已整理成册，请陛下过目。"
    },
    {
      id: "garden", name: "御花园", role: "探索·休闲", type: "explore",
      bg: A + "场景/御花园.png", icon: A + "svg图标/御花园.svg",
      desc: "曲径通幽，忙里偷闲。探索任务与意外之喜藏于此处。",
      npc: "翰林", portrait: A + "人物/翰林.png",
      opening: "御花园中百花正盛，陛下不妨信步一游，说不定另有一番收获。"
    },
    {
      id: "folk", name: "民间", role: "拖延迷雾", type: "fog",
      bg: A + "场景/民间.png", icon: A + "svg图标/民间.svg",
      desc: "市井烟火，也是拖延迷雾聚集之地。搁置的旧事在此等待重启。",
      npc: "直臣", portrait: A + "人物/直臣.png",
      opening: "微服民间，雾气缭绕。那些被搁置的差事，正在雾中等陛下拨云见日。"
    },
    {
      id: "observatory", name: "钦天监", role: "神秘·恢复精力", type: "mystic",
      bg: A + "场景/钦天监.png", icon: A + "svg图标/钦天监.svg",
      desc: "夜观天象，问卜吉凶。完成神秘任务可恢复精力。",
      npc: "卦师", portrait: A + "人物/卦师.png",
      opening: "钦天监夜色沉沉，星台高耸。陛下若倦了，可在此借天时以养神。"
    },
    {
      id: "library", name: "藏书阁", role: "档案·典籍", type: "library",
      bg: A + "场景/藏书阁.png", icon: A + "svg图标/藏书阁.svg",
      desc: "主线任务、起居注与治国之策皆藏于此，亦可上传典籍。",
      npc: "翰林", portrait: A + "人物/翰林.png",
      opening: "藏书阁内典册林立。陛下的功业与心得，尽录于此。"
    },
    {
      id: "treasury", name: "珍宝阁", role: "成就·珍藏", type: "treasury",
      bg: A + "场景/珍宝阁.png", icon: A + "svg图标/藏宝阁.svg",
      desc: "陈列历次功业所得珍宝，共五材质五十九珍。",
      npc: "史官", portrait: A + "人物/史官.png",
      opening: "珍宝阁灯火通明，陛下的每一件功业，都在此化作一件珍宝。"
    }
  ];

  /* ---------- 主线里程碑（30/60/90 天） ---------- */
  var MILESTONES = [
    { id: "m30", day: 30, name: "初立之主·满月", desc: "熟悉阶段：走遍六部、完成首份交付，站稳脚跟。", achId: "thirty-day-foothold" },
    { id: "m60", day: 60, name: "中兴之主·整顿", desc: "成长阶段：确立章程、整顿内政，独当一面。", achId: "sixty-day-reform" },
    { id: "m90", day: 90, name: "正统女帝·加冕", desc: "转正阶段：御前答辩通过，举行加冕大典。", achId: "ninety-day-coronation" }
  ];

  /* ---------- 默认藏书（治国之策 tab 初始书籍） ---------- */
  var BOOKS = [
    { id: "b1", title: "职场生存录", author: "佚名", cover: A + "物品/书1.png", note: "初入官场者必读，讲述立足之道。" },
    { id: "b2", title: "决策通鉴", author: "翰林院", cover: A + "物品/书2.png", note: "历代明君决断案例辑要。" },
    { id: "b3", title: "养精调神谱", author: "钦天监", cover: A + "物品/书3.png", note: "调养精力、张弛有度之法。" }
  ];

  /* ---------- 起居注初始条目（journals） ---------- */
  var JOURNALS_SEED = [
    { id: "j1", day: 1, title: "登基第一日", text: "朕于今日登基，百废待兴。批下首份朱批，朝政自此始。" }
  ];

  /* =============================================================
     对话与任务发布（模块 03）——「模拟 AI 大脑」
     真实 API 由他人接入；此处用情景库模拟大臣的三种回复：
       对话(dialogue) / 选项追问(question) / 决策奏折(decision)
     决策经「同意」后，按分类生成任务并投放到对应地图场景。
     ============================================================= */

  /* ---------- 三位大臣（对话对象 / 风格可切换） ----------
     直言型：直臣（结论先行→摆证据→算代价）
     顺言型：顺臣（先安抚情绪→再给建议）
     奇策型：卦师（另辟第三条路，试一试、留退路） */
  var MINISTERS = {
    "直臣": {
      name: "直臣", key: "直臣", role: "铁面直臣", style: "direct",
      portrait: A + "人物/直臣.png",
      say: "陛下但说，臣直言相告，不绕弯子。",
      lead: "臣以为——"
    },
    "顺臣": {
      name: "顺臣", key: "顺臣", role: "温言近臣", style: "gentle",
      portrait: A + "人物/顺臣.png",
      say: "陛下辛苦了。有什么烦心事，说与臣听，臣为您分忧。",
      lead: "陛下先宽心，"
    },
    "卦师": {
      name: "卦师", key: "卦师", role: "奇策谋士", style: "strategist",
      portrait: A + "人物/卦师.png",
      say: "此局未必只有一解。陛下把难处道来，臣替您另寻蹊径。",
      lead: "何不换个路子——"
    }
  };
  var MINISTER_ORDER = ["直臣", "顺臣", "卦师"];

  /* ---------- 任务分类 → 地图场景 ----------
     主线→朝堂 日常→六部 探索→御花园 拖延→民间迷雾 神秘/恢复→钦天监 */
  var CATEGORIES = {
    main:    { key: "main",    label: "主线", scene: "court",       color: "var(--cat-bronze)",    icon: A + "svg图标/朝堂.svg",   note: "关乎前程的大事，投放朝堂" },
    daily:   { key: "daily",   label: "日常", scene: "ministry",    color: "var(--cat-porcelain)", icon: A + "svg图标/六部.svg",   note: "例行庶务，投放六部" },
    explore: { key: "explore", label: "探索", scene: "garden",      color: "var(--cat-jade)",      icon: A + "svg图标/御花园.svg", note: "值得一试的新机会，投放御花园" },
    delay:   { key: "delay",   label: "拖延", scene: "folk",         color: "var(--cat-wood)",      icon: A + "svg图标/民间.svg",   note: "搁置已久的旧事，投放民间迷雾" },
    mystic:  { key: "mystic",  label: "神秘", scene: "observatory",  color: "var(--cat-gold)",      icon: A + "svg图标/钦天监.svg", note: "调养身心、恢复精力，投放钦天监" }
  };
  var CATEGORY_ORDER = ["main", "daily", "explore", "delay", "mystic"];

  /* ---------- 场景空态任务范例 ----------
     只用于说明每个场景可承接的任务类型，不写入 mapTasks，也不参与查重或结算。 */
  var SCENE_TASK_TEMPLATES = {
    court: {
      title: "完成入职培训的结业答辩",
      label: "主线案例",
      flag: "仅供参考",
      meta: "耗精力 20 · 约 90 分钟 · 赏 20 金 · 案例「入职清单」 · 参考「女帝职场决策原则」",
      cta: "以此为例，与大臣商议",
      featured: true
    },
    ministry: { title: "例行协作与日常事务", hint: "说说你正在推进的日常待办" },
    garden: { title: "低风险试探与新机会", hint: "讲讲你想尝试、又有些犹豫的事" },
    folk: { title: "搁置已久的待启事项", hint: "说出一件想重新启动的事" },
    observatory: { title: "身心节奏与状态调整", hint: "说说你当下的精力和节奏" }
  };

  /* ---------- 任务底图池（每生成一个任务，取一张底图铺在卡片上） ---------- */
  var TASK_BGS = [
    "任务底图/image_0 (11).png", "任务底图/image_0 (27).png", "任务底图/image_0 (36).png",
    "任务底图/image_0 (38).png", "任务底图/image_1 (15).png", "任务底图/image_1 (16).png",
    "任务底图/image_1 (18).png", "任务底图/image_2 (10).png", "任务底图/image_2 (11).png",
    "任务底图/image_2 (12).png", "任务底图/image_3 (13).png", "任务底图/image_0 (11)_副本.png"
  ].map(function (p) { return A + p; });
  function taskBg(i) { return TASK_BGS[((i % TASK_BGS.length) + TASK_BGS.length) % TASK_BGS.length]; }

  /* ---------- v7 前自动写入真实任务池的演示模板 ----------
     仅用于识别并清理旧存档；普通用户不再自动获得虚构职场任务。 */
  var LEGACY_SEED_MAP_TASKS = [
    { title: "完成入职培训的结业答辩", cat: "main", durationMinutes: 90, from: "入职清单" },
    { title: "整理并发出本周周报", cat: "daily", durationMinutes: 20, from: "例行事务" },
    { title: "约同组前辈喝杯咖啡认识一下", cat: "explore", durationMinutes: 20, from: "融入团队" }
  ];
  var SEED_MAP_TASKS = [];

  /* ---------- 每日天象·微探索 ----------
     只提供无门槛、无需文字回顾的小探索；数值由 store 固定为恢复 10 精力、0 金币。 */
  var MYSTIC_CARDS = [
    { id: "green-trio", name: "青木有信", title: "找出身边三种不同的绿色", sign: "青色入眼，万物稍安。", durationMinutes: 10 },
    { id: "color-walk", name: "万色巡游", title: "来一次 Color Walk，沿途找到五件同色物品", sign: "循色而行，旧路也会生出新意。", durationMinutes: 15 },
    { id: "look-up", name: "抬首见天", title: "抬头看看树冠、天空或建筑顶部", sign: "目光向上，心也会腾出一点地方。", durationMinutes: 10 },
    { id: "light-shadow", name: "光影移宫", title: "找到三处形状不同的光影", sign: "光在移动，困意也并非永恒。", durationMinutes: 10 },
    { id: "feel-air", name: "风过万物", title: "到窗边或户外，感受一会儿空气的流动", sign: "风来不问缘由，只替万物松一口气。", durationMinutes: 10 },
    { id: "three-sounds", name: "百声入耳", title: "停下来，分辨远、中、近三层声音", sign: "世界并未催促，只是在轻轻作响。", durationMinutes: 10 },
    { id: "shapes", name: "方圆之谜", title: "在周围找到三个圆形和三个方形", sign: "方圆各有位置，你也不必只有一种样子。", durationMinutes: 10 },
    { id: "leaf-world", name: "一叶一世界", title: "仔细观察一片叶、一朵花或一件自然物", sign: "细看一物，便足以暂离纷扰。", durationMinutes: 10 },
    { id: "new-path", name: "未行之路", title: "在安全范围内，走一小段平时不走的路线", sign: "偏离半步，也可能遇见新的风景。", durationMinutes: 15 },
    { id: "window-details", name: "窗中远游", title: "从窗边找出五个以前没留意的细节", sign: "不必远行，眼前也藏着新世界。", durationMinutes: 10 },
    { id: "textures", name: "宫墙纹理", title: "观察木纹、墙面、布料或地面的纹理", sign: "万物皆有纹路，今日也会慢慢展开。", durationMinutes: 10 },
    { id: "today-color", name: "今日之色", title: "在身边找到一种能代表今天的颜色", sign: "今日有色，无须为它命名。", durationMinutes: 10 }
  ];

  /* ---------- 模拟 AI 情景库 ----------
     keywords 命中即走该情景；probe=追问（选项型）；decision=决策奏折。
     decision.paths：recommend(推荐) / alt(备选)，各自带将生成的 tasks。 */
  var SCENARIOS = [
    {
      id: "share", topic: "该不该接下这次行业分享",
      keywords: ["分享", "演讲", "汇报", "上台", "周会", "行业", "presentation", "讲"],
      probe: {
        q: "陛下接这次分享，心里最过不去的是哪一关？",
        options: [
          { text: "准备时间实在不够", tag: "缺时间" },
          { text: "怕讲不好，当众丢脸", tag: "怕出丑" },
          { text: "要占掉好几个晚上", tag: "成本高" }
        ]
      },
      decision: {
        category: "main", title: "行业分享邀约",
        summary: "部门周会邀你做一次行业分享。你担心准备不足，又不想错过这次露脸的机会。",
        mirror: { invest: "1～2 个晚上备稿", reward: "主线露脸 · 攒信任", cost: "占用两晚个人时间" },
        recommend: {
          label: "做一个 90 分钟的「足够好」版本",
          text: "别追求完美。挑一个你最熟的小切口，只准备 90 分钟能讲完的内容，讲清楚一件事即可。",
          tasks: [
            { title: "定选题 + 列一页大纲", cat: "main", durationMinutes: 15 },
            { title: "备稿并自己试讲一遍", cat: "main", durationMinutes: 60 }
          ]
        },
        alt: {
          label: "婉拒，把机会留到更有把握时",
          text: "如实说明近期项目吃紧，礼貌婉拒，并主动约定下一季度再来分享。",
          tasks: [{ title: "回复邀约并致谢、约定下次", cat: "daily", durationMinutes: 10 }]
        }
      }
    },
    {
      id: "course", topic: "这门 3999 的课值不值得买",
      keywords: ["课程", "报班", "培训", "买课", "3999", "付费", "网课", "学习"],
      probe: {
        q: "陛下想靠这门课解决什么？",
        options: [
          { text: "补一项明确缺的硬技能", tag: "补技能" },
          { text: "怕落后，同事都在学", tag: "怕掉队" },
          { text: "说不太清，只是想提升", tag: "模糊" }
        ]
      },
      decision: {
        category: "explore", title: "3999 元职业课程",
        summary: "看到一门 3999 元的职业课程，心动又肉痛，拿不准要不要下单。",
        mirror: { invest: "3999 元 + 每周若干晚", reward: "可能补上关键技能", cost: "钱与时间都可能打水漂" },
        recommend: {
          label: "先试听 / 用退款期验证，再决定",
          text: "别急着全款。先看免费试听或利用 7 天退款期，用一节课验证它到底解不解决你的问题。",
          tasks: [
            { title: "找出这门课的试听 / 退款政策", cat: "explore", durationMinutes: 10 },
            { title: "试学一节并写 3 行是否值得的判断", cat: "explore", durationMinutes: 45 }
          ]
        },
        alt: {
          label: "先用免费资源顶一个月",
          text: "先用官方文档、公开课把这块啃一个月。真卡住了再回来买，需求会清楚得多。",
          tasks: [{ title: "列一张免费替代资源清单", cat: "explore", durationMinutes: 20 }]
        }
      }
    },
    {
      id: "help", topic: "要不要接下同事的临时请求",
      keywords: ["同事", "帮忙", "求助", "临时", "插进来", "打断", "帮我"],
      decision: {
        category: "daily", title: "同事临时求助",
        summary: "手头正忙，同事临时塞来一个「帮个小忙」，不好意思拒绝，又怕耽误自己的正事。",
        mirror: { invest: "20 分钟以内", reward: "人情 + 协作口碑", cost: "打断当前专注" },
        recommend: {
          label: "限时协助 20 分钟，先把边界说清",
          text: "答应但先说清：「我这有 20 分钟，先帮你到这，之后我得赶自己的活。」既帮了忙，也守住了自己的节奏。",
          tasks: [{ title: "限时 20 分钟协助同事", cat: "daily", durationMinutes: 20 }]
        },
        alt: {
          label: "婉拒，给一个替代资源",
          text: "如实说自己正卡在 deadline 上，给他一个能自助的文档或人选，既不失礼也不揽责。",
          tasks: [{ title: "回复同事并附上替代资源", cat: "daily", durationMinutes: 10 }]
        }
      }
    },
    {
      id: "delay", topic: "那件一直拖着没做的事",
      keywords: ["拖", "一直没", "搁置", "不想做", "逃避", "堆着", "拖延", "懒得"],
      decision: {
        category: "delay", title: "拖了很久的那件事",
        summary: "有件事你已经拖了好一阵，一想到它就烦，越拖心里越沉。",
        mirror: { invest: "先花 15 分钟", reward: "卸下心理包袱", cost: "启动那一下最难" },
        recommend: {
          label: "切成 15 分钟就能启动的第一步",
          text: "别想着一次做完。只做「能在 15 分钟内启动」的最小一步，比如打开文档写下标题。开了头，雾就散了。",
          tasks: [{ title: "只做 15 分钟：启动第一步", cat: "delay", durationMinutes: 15 }]
        },
        alt: {
          label: "正式放弃并记录原因",
          text: "如果它其实没那么重要，就正式把它划掉，写一行为什么放弃。放下也是一种决策。",
          tasks: [{ title: "写一行放弃理由，正式了结", cat: "delay", durationMinutes: 10 }]
        }
      }
    },
    {
      id: "tired", topic: "最近有点撑不住了",
      keywords: ["累", "撑不住", "疲惫", "休息", "精力", "熬夜", "顶不住", "倦"],
      decision: {
        category: "mystic", title: "精力告急",
        summary: "连日高强度，精力见底，效率也在往下掉，但还有事压着。",
        mirror: { invest: "半小时喘口气", reward: "精力回血，恢复判断力", cost: "短暂放下手头事" },
        recommend: {
          label: "先去钦天监养神，再回来做要紧事",
          text: "硬扛只会越做越错。先给自己半小时彻底离开工作，回血之后再挑最要紧的一件事做。",
          tasks: [{ title: "彻底休息 30 分钟（恢复精力）", cat: "mystic", durationMinutes: 30 }]
        },
        alt: {
          label: "只保当日底线，其余明日再说",
          text: "今天只交付一件必须交的，其余全部推到明天。允许自己有一个「低电量档」的一天。",
          tasks: [{ title: "只交付今日必做的一件事", cat: "main", durationMinutes: 30 }]
        }
      }
    }
  ];

  /* ---------- 通用兜底决策（任何输入都能给出一份像样的奏折） ---------- */
  function genericDecision(text) {
    var t = (text || "这件事").trim();
    if (t.length > 16) t = t.slice(0, 16) + "…";
    return {
      category: "daily", title: "关于「" + t + "」的决断", generic: true,
      summary: "陛下所议之事，臣已记下。信息虽还不全，臣先拟一条稳妥之策，供陛下裁夺。",
      mirror: { invest: "先投入一小步", reward: "把事情推进起来", cost: "占用一点当下时间" },
      recommend: {
        label: "拆一个今天就能完成的最小步骤",
        text: "把这件事切出一个今天、30 分钟内就能做完的小块先做掉。先动起来，方向会更清楚。",
        tasks: [{ title: "完成「" + t + "」的第一小步", cat: "daily", durationMinutes: 30 }]
      },
      alt: {
        label: "再想清楚目标后重新规划",
        text: "先花几分钟写下你真正想要的结果是什么，再回来让臣为你重排优先级。",
        tasks: [{ title: "写清目标，稍后再议", cat: "delay", durationMinutes: 10 }]
      }
    };
  }

  /* ---------- 大脑：分析一句用户输入 ----------
     ctx = { probed: 是否已追问过 }
     返回 { type:'dialogue'|'question'|'decision', ... } */
  function analyze(text, ctx) {
    ctx = ctx || {};
    var raw = (text || "").trim();
    var lower = raw.toLowerCase();
    var hit = null;
    // 用户回答追问时，延续上一轮命中的情景，不用单独的选项文字重新猜测主题。
    if (ctx.probed && ctx.scenarioId && ctx.scenarioId !== "generic") {
      hit = SCENARIOS.filter(function (scenario) { return scenario.id === ctx.scenarioId; })[0] || null;
    }
    for (var i = 0; i < SCENARIOS.length; i++) {
      if (hit) break;
      var sc = SCENARIOS[i];
      for (var k = 0; k < sc.keywords.length; k++) {
        if (lower.indexOf(sc.keywords[k].toLowerCase()) >= 0) { hit = sc; break; }
      }
      if (hit) break;
    }
    if (hit) {
      if (hit.probe && !ctx.probed) {
        return { type: "question", topic: hit.topic, scenarioId: hit.id, question: hit.probe };
      }
      return { type: "decision", topic: hit.topic, scenarioId: hit.id, decision: hit.decision };
    }
    // 无命中：过短当闲聊；否则先追问一次，再给兜底决策
    if (!ctx.probed && raw.length < 8) {
      return { type: "dialogue", topic: "闲话家常" };
    }
    if (!ctx.probed) {
      return {
        type: "question", topic: "把话说得再细些", scenarioId: "generic",
        question: {
          q: "陛下这桩事，眼下最要紧的是？",
          options: [
            { text: "赶时间，得尽快定", tag: "急" },
            { text: "拿不准值不值得做", tag: "犹豫" },
            { text: "知道要做，就是不想动", tag: "拖延" }
          ]
        }
      };
    }
    return { type: "decision", topic: "把话说得再细些", scenarioId: "generic", decision: genericDecision(raw) };
  }

  /* ---------- 按分类给一句大臣风格的开场（结论先行/先安抚/献奇策） ---------- */
  function ministerLine(ministerKey, phase, decision) {
    var m = MINISTERS[ministerKey] || MINISTERS["直臣"];
    if (phase === "decision") {
      if (m.style === "direct") return "臣的结论：" + decision.recommend.label + "。理由与代价都写在奏折里，请陛下过目。";
      if (m.style === "gentle") return "陛下别为难。臣替您想了个稳妥的法子，也留了条退路，您看看这份奏折。";
      return "臣献上两条路——一条稳，一条留后手。奏折在此，陛下定夺。";
    }
    if (phase === "bold-apology") {
      if (m.style === "direct") return "是臣考虑不周。方才判断下得太急，还缺关键信息，请陛下再补一句。";
      if (m.style === "gentle") return "陛下息怒，是臣想得浅了。臣收回方才的话，愿再听陛下细说。";
      return "陛下说得是，此策失之草率。臣重新想过，先请教陛下一事。";
    }
    return m.say;
  }

  /* 将一条决策路径展开为可投放地图的任务模板（无 id/bg，交由 store 落地） */
  function cleanTaskTitle(value) {
    return String(value || "")
      .replace(/^\s*[\[【]\s*(?:main|daily|explore|delay|mystic)\s*[\]】]\s*[:：\-–—]?\s*/i, "")
      .trim();
  }

  function cleanMinisterSpeech(value) {
    return String(value || "").replace(/朕/g, "臣");
  }

  function isLegacySeedTask(task) {
    var title = cleanTaskTitle(task && task.title);
    if (LEGACY_SEED_MAP_TASKS.some(function (template) { return template.title === title; })) return true;
    var source = String(task && task.from || "");
    if (["行业分享邀约", "3999 元职业课程", "同事临时求助", "拖了很久的那件事", "精力告急"].indexOf(source) >= 0) return true;
    return /入职培训.*(?:结业)?答辩/.test(title) ||
      /(?:整理|撰写|发出|提交).{0,5}(?:本周)?周报/.test(title) ||
      /(?:同组)?前辈.*咖啡|咖啡.*(?:同组)?前辈/.test(title);
  }

  function tasksFromPath(decision, pathKey) {
    var path = decision[pathKey] || decision.recommend;
    return (path.tasks || []).map(function (t) {
      var category = CATEGORIES[t.cat] ? t.cat : (CATEGORIES[decision.category] ? decision.category : "daily");
      var values = window.App.economy.calculate(t, category);
      return {
        title: cleanTaskTitle(t.title) || "推进此事的第一步",
        cat: category,
        durationMinutes: values.durationMinutes,
        energyTier: values.energyTier,
        energy: values.energy,
        gold: values.gold,
        restore: values.restore,
        from: decision.title,
        sourceKind: window.App.demo && window.App.demo.active === true ? "demo" : "decision",
        knowledgeRefs: Array.isArray(decision.sources) ? decision.sources.slice(0, 5) : []
      };
    });
  }

  var brain = {
    analyze: analyze,
    genericDecision: genericDecision,
    ministerLine: ministerLine,
    tasksFromPath: tasksFromPath,
    taskBg: taskBg
  };

  /* =============================================================
     成就数据（复用珍宝阁，59 项，5 材质）
     ============================================================= */
  var CAT_META = {
    "青铜": { file: "青铜", total: 9, label: "青铜·主线", say: "庙堂重器，铭刻主线功业", color: "var(--cat-bronze)" },
    "瓷器": { file: "瓷器", total: 10, label: "瓷器·任务", say: "窑火千淬，积任务之勤", color: "var(--cat-porcelain)" },
    "玉雕": { file: "玉雕", total: 14, label: "玉雕·精力", say: "温润养身，见精力之衡", color: "var(--cat-jade)" },
    "金器": { file: "金器", total: 14, label: "金器·金钱", say: "仓廪金玉，纪财帛之丰", color: "var(--cat-gold)" },
    "木器": { file: "木器", total: 12, label: "木器·其他", say: "闲雅探幽，藏彩蛋于宫阙", color: "var(--cat-wood)" }
  };
  var CAT_ORDER = ["青铜", "瓷器", "玉雕", "金器", "木器"];

  var ACHIEVEMENTS = [
    // ---------- 青铜·主线(9) ----------
    { cat: "青铜", idx: 1, id: "first-vermilion-brush", name: "初落朱批", goal: "首次在奏折上批下朱批(完成第一个决策审批)", hint: "在朝堂批准你的第一份奏折", tier: 1, reward: "+20金", flavor: "朱笔一落，朝政始于今日。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: ["首份奏折·录用通知"] },
    { cat: "青铜", idx: 2, id: "survey-six-ministries", name: "遍识六部", goal: "累计完成 6 项六部日常任务", hint: "在六部办结六项日常事务", tier: 1, reward: "+30金", flavor: "知人知职，方能理事。", cur: 0, target: 6, unlocked: false, date: null, journalRefs: ["六部巡礼记"] },
    { cat: "青铜", idx: 3, id: "first-audience-minister", name: "初见重臣", goal: "首次与AI大臣完成一次完整对话(在朝堂与关键角色交流)", hint: "在朝堂与一位大臣深谈一次", tier: 1, reward: "+20金", flavor: "得一良臣，如添一臂。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: ["与史官的初次奏对"] },
    { cat: "青铜", idx: 4, id: "thirty-day-foothold", name: "立足登基", goal: "抵达登基第30天", hint: "完成首月历程，抵达登基第30天", tier: 2, reward: "称号·初立之主", flavor: "满月未缺，基石已定。", cur: 1, target: 30, unlocked: false, date: null, journalRefs: ["30天主线·熟悉阶段"] },
    { cat: "青铜", idx: 5, id: "first-solo-delivery", name: "独任其事", goal: "首次完成一项朝堂主线交付任务", hint: "在朝堂办结你的第一项主线差事", tier: 2, reward: "+50金", flavor: "不假人手，独当一面。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "青铜", idx: 6, id: "weekly-memorial-sop", name: "循章立制", goal: "首次提交周报并确立一套办事章程(完成周报/SOP相关主线任务)", hint: "呈上首份周奏，并立下一套章程", tier: 3, reward: "+60金", flavor: "章成而政不乱，制立而事有序。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "青铜", idx: 7, id: "sixty-day-reform", name: "整顿内政", goal: "抵达登基第60天", hint: "完成成长阶段，抵达登基第60天", tier: 3, reward: "称号·中兴之主", flavor: "半程已过，宫阙焕然。", cur: 1, target: 60, unlocked: false, date: null, journalRefs: ["60天主线·成长阶段"] },
    { cat: "青铜", idx: 8, id: "regularization-defense", name: "御前答辩", goal: "完成转正答辩主线任务(讲述阶段成果并通过朝堂审议)", hint: "在朝堂讲述你的成果，通过转正答辩", tier: 4, reward: "称号·堪当大任", flavor: "陈功于庭，众臣叹服。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "青铜", idx: 9, id: "ninety-day-coronation", name: "加冕正统", goal: "抵达登基第90天", hint: "走完九十日历程，举行加冕大典", tier: 5, reward: "称号·正统女帝", flavor: "九十日砺，今日加冕，名正而言顺。", cur: 1, target: 90, unlocked: false, date: null, journalRefs: ["90天主线·转正大典"] },
    // ---------- 瓷器·任务数(10) ----------
    { cat: "瓷器", idx: 1, id: "first-task-kiln-fire", name: "初开窑火", goal: "首次完成任意一项任务", hint: "完成你的第一项任务", tier: 1, reward: "+10金", flavor: "窑火初燃，坯泥始有温度。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: ["初次结项"] },
    { cat: "瓷器", idx: 2, id: "tasks-3-raw-body", name: "素坯初成", goal: "累计完成 3 项任务", hint: "累计完成 3 项任务", tier: 1, reward: "+15金", flavor: "三度揉泥，素坯已有其形。", cur: 0, target: 3, unlocked: false, date: null, journalRefs: [] },
    { cat: "瓷器", idx: 3, id: "tasks-5-five-wares", name: "五器承奉", goal: "累计完成 5 项任务", hint: "累计完成 5 项任务", tier: 2, reward: "+25金", flavor: "五器列案，勤勉可鉴。", cur: 0, target: 5, unlocked: false, date: null, journalRefs: [] },
    { cat: "瓷器", idx: 4, id: "tasks-10-warm-glaze", name: "温润初显", goal: "累计完成 10 项任务", hint: "累计完成 10 项任务", tier: 2, reward: "+40金", flavor: "十事既成，釉色温润如玉。", cur: 0, target: 10, unlocked: false, date: null, journalRefs: [] },
    { cat: "瓷器", idx: 5, id: "tasks-20-kiln-transform", name: "窑变生辉", goal: "累计完成 20 项任务", hint: "累计完成 20 项任务", tier: 3, reward: "+70金", flavor: "二十入窑，火中自见斑斓。", cur: 0, target: 20, unlocked: false, date: null, journalRefs: [] },
    { cat: "瓷器", idx: 6, id: "tasks-50-official-kiln", name: "官窑重器", goal: "累计完成 50 项任务", hint: "累计完成 50 项任务", tier: 4, reward: "+150金", flavor: "积五十器，堪为官窑重宝。", cur: 0, target: 50, unlocked: false, date: null, journalRefs: [] },
    { cat: "瓷器", idx: 7, id: "tasks-100-eternal-porcelain", name: "瓷魂千载", goal: "累计完成 100 项任务", hint: "累计完成 100 项任务", tier: 5, reward: "称号·瓷心不改", flavor: "百器成阵，日积月累而成千载之魂。", cur: 0, target: 100, unlocked: false, date: null, journalRefs: [] },
    { cat: "瓷器", idx: 8, id: "first-daily-liubu", name: "六部勤勉", goal: "首次完成一项六部日常任务", hint: "在六部完成第一项日常任务", tier: 1, reward: "+15金", flavor: "日拱一卒，六部庶务始入手。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: ["吏部·考勤归档"] },
    { cat: "瓷器", idx: 9, id: "first-explore-garden", name: "御园寻幽", goal: "首次完成一项御花园探索任务", hint: "在御花园完成第一项探索任务", tier: 2, reward: "+30金", flavor: "闲步御园，于幽径中另得一器。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "瓷器", idx: 10, id: "first-fog-minjian", name: "拨雾见坯", goal: "首次完成一项民间(拖延迷雾)任务", hint: "穿过拖延迷雾，完成第一项民间任务", tier: 3, reward: "+50金", flavor: "迷雾散尽，搁置之坯终得重烧。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    // ---------- 玉雕·精力(14) ----------
    { cat: "玉雕", idx: 1, id: "jade-first-restore-hundred", name: "玉衡初立", goal: "首次将精力恢复至100点", hint: "试着休整一番，让精力回满至100", tier: 1, reward: "+20金", flavor: "衡者，平也。心平则事顺。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "玉雕", idx: 2, id: "jade-calibrate-energy", name: "澄心正气", goal: "首次点击精力条自行校准精力数值(臣子将据此调整决策意见)", hint: "点一下精力条，亲自校准一次你的精力状态", tier: 1, reward: "+15金", flavor: "澄心以观己，方知盈亏。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "玉雕", idx: 3, id: "jade-full-cap-150", name: "精盈满盏", goal: "精力首次达到上限150点(解锁精力爆棚)", hint: "将精力蓄至上限150，尽享精力爆棚", tier: 3, reward: "称号·精盈满盏", flavor: "满而不溢，盈而能持。", cur: 100, target: 150, unlocked: false, date: null, journalRefs: [] },
    { cat: "玉雕", idx: 4, id: "jade-low-energy-deliver", name: "韬光养晦", goal: "精力不高于30时主动完成一次恢复", hint: "精力偏低时先休整，不再勉强硬撑", tier: 2, reward: "+30金", flavor: "光敛于内，力蓄于微。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "玉雕", idx: 5, id: "jade-astro-first-restore", name: "星台祈息", goal: "首次在钦天监完成神秘任务并恢复精力", hint: "前往钦天监，完成一次神秘任务恢复精力", tier: 2, reward: "+25金", flavor: "夜观星台，借天时以养神。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "玉雕", idx: 6, id: "jade-accumulate-500", name: "养精蓄锐", goal: "累计实际恢复精力达200点", hint: "通过真实休整累计恢复200点精力", tier: 2, reward: "+40金", flavor: "锐气藏锋，待时而发。", cur: 0, target: 200, unlocked: false, date: null, journalRefs: [] },
    { cat: "玉雕", idx: 7, id: "jade-three-days-above-fifty", name: "松柏长青", goal: "连续3日精力未低于50点", hint: "连续三日让精力都守在50点以上", tier: 3, reward: "称号·松柏长青", flavor: "岁寒不凋，自有其常。", cur: 0, target: 3, unlocked: false, date: null, journalRefs: [] },
    { cat: "玉雕", idx: 8, id: "jade-critical-complete", name: "气定神闲", goal: "精力不高于10时选择恢复而非继续透支", hint: "精力告急时先进行一次有效休整", tier: 4, reward: "+60金", flavor: "气不乱则神自定。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "玉雕", idx: 9, id: "jade-seven-days-no-zero", name: "灯火续明", goal: "连续7日精力从未归零", hint: "连续七日，别让精力见底归零", tier: 3, reward: "称号·灯火续明", flavor: "薪火相承，长夜不熄。", cur: 0, target: 7, unlocked: false, date: null, journalRefs: [] },
    { cat: "玉雕", idx: 10, id: "jade-hold-cap-three-days", name: "元气淋漓", goal: "连续3日日末精力不低于120", hint: "连续三日以至少120点精力收尾", tier: 4, reward: "+80金", flavor: "元气充盈，举步生风。", cur: 0, target: 3, unlocked: false, date: null, journalRefs: [] },
    { cat: "玉雕", idx: 11, id: "jade-single-day-rebound", name: "返照回光", goal: "单日内从不高于30点恢复至至少60点", hint: "低精力时通过有效休整回到60以上", tier: 2, reward: "+35金", flavor: "谷底一转，复见天光。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "玉雕", idx: 12, id: "jade-accumulate-2000", name: "玉体康泰", goal: "累计实际恢复精力达1000点", hint: "长期休整，累计恢复1000点精力", tier: 3, reward: "称号·玉体康泰", flavor: "调养有方，体安神泰。", cur: 0, target: 1000, unlocked: false, date: null, journalRefs: [] },
    { cat: "玉雕", idx: 13, id: "jade-astro-ten-times", name: "星河问命", goal: "累计在钦天监完成神秘任务10次", hint: "累计在钦天监完成十次神秘任务", tier: 4, reward: "称号·星河问命", flavor: "十度问星，天机渐明。", cur: 0, target: 10, unlocked: false, date: null, journalRefs: [] },
    { cat: "玉雕", idx: 14, id: "jade-grand-harmony", name: "天人合一", goal: "累计实际恢复1500点，且连续30日无透支", hint: "长期张弛有度：累计恢复1500点，并连续三十日不归零", tier: 5, reward: "称号·天人合一", flavor: "内外相和，身与天齐。", cur: 0, target: 1500, unlocked: false, date: null, journalRefs: [] },
    // ---------- 金器·金钱(14) ----------
    { cat: "金器", idx: 1, id: "first-gold", name: "初入国库", goal: "首次通过完成任务获得金币奖励", hint: "完成任意一项任务，领取首笔金币入库", tier: 1, reward: "+20金", flavor: "一枚落库，万贯之始。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 2, id: "gold-50", name: "薄有积蓄", goal: "金币累计获得达到50(历史总额，不因消费回退)", hint: "金币累计攒到50，添置第一笔家底", tier: 1, reward: "+30金", flavor: "涓滴入囊，渐成薄产。", cur: 0, target: 50, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 3, id: "gold-100", name: "百金入库", goal: "金币累计获得达到100(历史总额)", hint: "金币累计攒到100，国库初见规模", tier: 2, reward: "称号·理财新丁", flavor: "百川汇流，始成其渊。", cur: 0, target: 100, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 4, id: "gold-300", name: "钱囊渐丰", goal: "金币累计获得达到300(历史总额)", hint: "金币累计攒到300，用度愈发从容", tier: 2, reward: "+50金", flavor: "囊中渐丰，行止从容。", cur: 0, target: 300, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 5, id: "gold-500", name: "府库半盈", goal: "金币累计获得达到500(历史总额)", hint: "金币累计攒到500，国库已半满", tier: 3, reward: "+80金", flavor: "半仓已实，根基渐稳。", cur: 0, target: 500, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 6, id: "gold-1000", name: "富甲一方", goal: "金币累计获得达到1000(历史总额)", hint: "金币累计攒到1000，坐拥千金", tier: 4, reward: "称号·富甲一方", flavor: "千金在握，心自安然。", cur: 0, target: 1000, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 7, id: "single-big-reward", name: "一掷千赏", goal: "首次完成一项重量档普通任务", hint: "完成一项91至240分钟的重量任务", tier: 3, reward: "+40金", flavor: "一赏倾金，足见其功。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 8, id: "gold-source-diverse", name: "财源广进", goal: "在朝堂、六部、御花园等三种以上不同来源都获得过金币奖励", hint: "从三类以上不同场景各领过一次金币", tier: 3, reward: "+60金", flavor: "源不一途，利归四海。", cur: 0, target: 3, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 9, id: "daily-gold-streak", name: "日进斗金", goal: "连续三日每天都有金币进账", hint: "连续三天每日都赚到金币", tier: 3, reward: "+50金", flavor: "日日有进，积少成多。", cur: 0, target: 3, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 10, id: "first-spend", name: "量入为出", goal: "首次在已开放的非必要增强或装饰中消费金币", hint: "金币用途尚未上线，此珍暂不开放", tier: 1, reward: "+15金", flavor: "知取知舍，方善持家。", cur: 0, target: 1, unlocked: false, date: null, availability: "dormant", journalRefs: [] },
    { cat: "金器", idx: 11, id: "single-day-gold-200", name: "日纳百川", goal: "单日累计获得100金", hint: "一天内通过任务与成就累计进账100金", tier: 4, reward: "+80金", flavor: "一日之内，财如潮涌。", cur: 0, target: 100, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 12, id: "approval-gold", name: "朱批生金", goal: "通过批准奏折(朱批决策)累计获得200金", hint: "靠批朱批累计赚到200金", tier: 3, reward: "+50金", flavor: "一笔朱批，半仓金玉。", cur: 0, target: 200, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 13, id: "gold-and-energy-balance", name: "金精两全", goal: "当前持有金币达到500的同时，精力保持在100以上", hint: "手头金币满500且精力仍在100以上，财力精神两不误", tier: 4, reward: "称号·内外兼修", flavor: "财足神旺，两全其美。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 14, id: "treasury-peak", name: "富可敌国", goal: "金币累计获得达到3000(历史总额)，登临财富之巅", hint: "金币累计攒到3000，国库充盈甲天下", tier: 5, reward: "称号·富可敌国 · +200金", flavor: "仓廪充实，江山无忧。", cur: 0, target: 3000, unlocked: false, date: null, journalRefs: [] },
    // ---------- 木器·其他(12) ----------
    { cat: "木器", idx: 1, id: "first-explore-step", name: "初履宫墙", goal: "首次进入御花园以外的任意探索场景(六部/民间/钦天监/藏书阁)", hint: "离开朝堂，踏入御花园之外的宫廷场景一次", tier: 1, reward: "+10金", flavor: "宫墙之外，别有天地。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "木器", idx: 2, id: "garden-stroll", name: "偷得浮生", goal: "首次进入御花园场景", hint: "前往御花园，忙里偷闲一回", tier: 1, reward: "+10金", flavor: "忙中一憩，花影自闲。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "木器", idx: 3, id: "fog-return", name: "迷途知返", goal: "从民间(拖延迷雾)返回朝堂后，再完成一项任意任务", hint: "从拖延迷雾中归返朝堂，重拾状态完成一件事", tier: 2, reward: "+20金", flavor: "雾散云开，归来仍是少年。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "木器", idx: 4, id: "explore-all-scenes", name: "遍历九重", goal: "探索宫廷地图全部场景各至少一次", hint: "走遍朝堂/六部/御花园/民间/钦天监/藏书阁/珍宝阁全部场景", tier: 4, reward: "称号·九重游者", flavor: "九重宫阙，尽在足下。", cur: 0, target: 7, unlocked: false, date: null, journalRefs: [] },
    { cat: "木器", idx: 5, id: "archive-first-read", name: "手不释卷", goal: "首次进入藏书阁查阅档案", hint: "去藏书阁打开一次档案区", tier: 1, reward: "+10金", flavor: "开卷有益，一读倾心。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: ["治国之策·首阅"] },
    { cat: "木器", idx: 6, id: "archive-upload", name: "藏经纳典", goal: "在藏书阁首次上传一份自己的文档或书籍", hint: "向藏书阁上传一份属于你的文档", tier: 2, reward: "+20金", flavor: "典籍入阁，自成一家之言。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "木器", idx: 7, id: "prophecy-first", name: "窥算天机", goal: "首次使用预言模式推演一项决策的结果", hint: "开启预言模式，预演一次决策走向", tier: 2, reward: "+15金", flavor: "未卜先知，天机微露。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "木器", idx: 8, id: "redo-simulation", name: "三思后行", goal: "对同一项决策重做推演达3次", hint: "就同一份奏折反复推演3次再定夺", tier: 2, reward: "+15金", flavor: "再三斟酌，方落定音。", cur: 0, target: 3, unlocked: false, date: null, journalRefs: [] },
    { cat: "木器", idx: 9, id: "flow-focus-single", name: "心澄意定", goal: "在心流模式中连续专注满25分钟", hint: "进入心流模式，一次专注满25分钟", tier: 3, reward: "+30金", flavor: "心如止水，意随笔行。", cur: 0, target: 25, unlocked: false, date: null, journalRefs: [] },
    { cat: "木器", idx: 10, id: "flow-focus-master", name: "物我两忘", goal: "心流模式累计专注时长满10小时", hint: "心流模式累计专注满10小时", tier: 5, reward: "称号·忘机", flavor: "不知窗外几度晨昏。", cur: 0, target: 600, unlocked: false, date: null, journalRefs: [] },
    { cat: "木器", idx: 11, id: "pizhu-zaiyi", name: "留中不发", goal: '首次以"再议"朱批处理一份奏折', hint: '用"再议"朱批批阅一次奏折', tier: 2, reward: "+15金", flavor: "事有可缓，姑且留中。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "木器", idx: 12, id: "pizhu-dadan", name: "大胆驳回", goal: '首次以"大胆"指出方案草率并命大臣重拟', hint: '用"大胆"朱批驳回一次不合适的方案', tier: 3, reward: "+20金", flavor: "不拘一格，方见胆识。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] }
  ];

  var byId = {};
  ACHIEVEMENTS.forEach(function (a) { byId[a.id] = a; });

  function achImg(a) { return A + "成就/" + CAT_META[a.cat].file + a.idx + ".png"; }

  window.App.data = {
    ASSET_BASE: A,
    EMPRESS_TYPES: EMPRESS_TYPES,
    QUIZ: QUIZ,
    SCENES: SCENES,
    MILESTONES: MILESTONES,
    BOOKS: BOOKS,
    JOURNALS_SEED: JOURNALS_SEED,
    // 模块 03：对话与任务发布
    MINISTERS: MINISTERS,
    MINISTER_ORDER: MINISTER_ORDER,
    CATEGORIES: CATEGORIES,
    CATEGORY_ORDER: CATEGORY_ORDER,
    SCENE_TASK_TEMPLATES: SCENE_TASK_TEMPLATES,
    TASK_BGS: TASK_BGS,
    SEED_MAP_TASKS: SEED_MAP_TASKS,
    isLegacySeedTask: isLegacySeedTask,
    MYSTIC_CARDS: MYSTIC_CARDS,
    cleanTaskTitle: cleanTaskTitle,
    cleanMinisterSpeech: cleanMinisterSpeech,
    SCENARIOS: SCENARIOS,
    brain: brain,
    // 成就
    CAT_META: CAT_META,
    CAT_ORDER: CAT_ORDER,
    ACHIEVEMENTS: ACHIEVEMENTS,
    achById: byId,
    achImg: achImg,
    sceneById: function (id) { return SCENES.filter(function (s) { return s.id === id; })[0]; },
    // 该场景（category.scene）下的地图任务由 store 维护，见 store.tasksForScene
    catByScene: function (sceneId) {
      for (var k in CATEGORIES) { if (CATEGORIES[k].scene === sceneId) return CATEGORIES[k]; }
      return null;
    }
  };
})();
