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

  /* ---------- 御前推演：3 题 ----------
     每题选项 weight 指向某种女帝类型。
     stem = 宫廷主问（沉浸），sub = 职场小字（点破与你、与工作的关系）。
     三题分别落在：接手新事 / 当众受质 / 资源紧张下的取舍，各覆盖铁腕/仁厚/谋略/革新四向。 */
  var QUIZ = [
    {
      id: "q1", stem: "初接差事",
      sub: "刚接到一件目标还不太清楚的新任务，你通常会先怎么做？",
      npc: "史官", portrait: A + "人物/史官.png",
      options: [
        { text: "先确认目标、截止时间和完成标准", w: "铁腕" },
        { text: "先找带教或同事了解背景与常见坑", w: "仁厚" },
        { text: "先搜集资料，把全貌和风险理清", w: "谋略" },
        { text: "先做一个小版本，再用反馈修正", w: "革新" }
      ]
    },
    {
      id: "q2", stem: "面折廷争",
      sub: "有人当众质疑你的做法时，你更倾向于怎么回应？",
      npc: "直臣", portrait: A + "人物/直臣.png",
      options: [
        { text: "先守住自己的判断，把理由讲清楚", w: "铁腕" },
        { text: "先听完对方，认可用心再解释", w: "仁厚" },
        { text: "请对方摆出依据，据此评估要不要调整", w: "谋略" },
        { text: "顺着这个质疑，试试另一个方案", w: "革新" }
      ]
    },
    {
      id: "q3", stem: "度支有度",
      sub: "手头资源（时间/预算/人手）不够，一件要紧事却得推进，你会？",
      npc: "顺臣", portrait: A + "人物/顺臣.png",
      options: [
        { text: "砍掉次要的，把资源压到最关键处", w: "铁腕" },
        { text: "和相关的人商量，一起分摊压力", w: "仁厚" },
        { text: "算清投入产出，排出优先次序", w: "谋略" },
        { text: "另找一条省资源的新路子", w: "革新" }
      ]
    },
    {
      // 偏好题：不参与女帝画像判定（w 为大臣 key，非四类型），
      // 仅用于确定进入主界面后的默认议事大臣。
      id: "q4", stem: "愿听何谏", pref: "minister",
      sub: "当你拿不准时，希望大臣怎样与你商议？",
      npc: "卦师", portrait: A + "人物/卦师.png",
      options: [
        { text: "先告诉我最重要的结论，再说明理由", w: "直臣" },
        { text: "先听懂我的处境，再温和地给出建议", w: "顺臣" },
        { text: "帮我跳出原有选项，寻找一条可尝试的新路", w: "卦师" }
      ]
    },
  ];

  /* ---------- 场景（左侧地图 8 处） ---------- */
  var SCENES = [
    {
      id: "residence", name: "起居殿", role: "召见·议事", type: "base",
      bg: A + "场景/起居殿.png", icon: A + "svg图标/起居殿.svg",
      desc: "女帝召见大臣、梳理心事之所。把眼下的难题说与大臣，一同理出决策。",
      npc: "宫女", portrait: A + "人物/宫女.png",
      opening: "陛下今日临朝之前，可有什么烦心的差事？说与臣听，臣陪您一件件理清。"
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
      id: "garden", name: "御花园", role: "探索·养性", type: "explore",
      bg: A + "场景/御花园.png", icon: A + "svg图标/御花园.svg",
      desc: "重要而不紧急之事的归处。侍女相伴赏花，让陛下松一口气，也养一养心性。",
      npc: "翰林", portrait: A + "人物/翰林.png",
      opening: "御花园中百花正盛，臣女陪陛下信步赏花、松散心神，那些值得一试的新机会，也在这里静静候着。"
    },
    {
      id: "folk", name: "民间", role: "散佚之事", type: "fog",
      bg: A + "场景/民间.png", icon: A + "svg图标/民间.svg",
      desc: "那些被搁置、渐渐石沉大海的旧事，流落到了民间。唯有循着市井线索，才能把它们重新拾起。",
      npc: "直臣", portrait: A + "人物/直臣.png",
      opening: "有些宫中旧事，已悄悄流传到民间。陛下可愿微服一探，把那些搁置已久的差事重新拾起？"
    },
    {
      id: "observatory", name: "钦天监", role: "神秘·恢复精力", type: "mystic",
      bg: A + "场景/钦天监.png", icon: A + "svg图标/钦天监.svg",
      desc: "夜观天象，问卜吉凶。完成神秘任务可恢复精力。",
      npc: "观星师", portrait: A + "人物/观星师.png",
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
    },
    {
      id: "lingyan", name: "凌烟阁", role: "群臣关系与待办", type: "roster",
      bg: A + "场景/上朝.png", icon: A + "svg图标/六部.svg",
      desc: "记录已经遇见的群臣、人物关系与关联待办。",
      npc: "史官", portrait: A + "人物/史官.png",
      opening: "凌烟阁中群像俨然，朝野人物与相关事务皆录于此。",
      trackVisit: false
    }
  ];

  /* ---------- 主线里程碑（30/60/90 天） ---------- */
  var MILESTONES = [
    { id: "m30", day: 30, name: "初立之主·满月", desc: "熟悉阶段。新朝初立，百事待认：走遍六部、认全关键的人、摸清流程，赶在满月之前完成第一份交付，先站稳脚跟。根基未稳，容不得半点松懈。", achId: "thirty-day-foothold" },
    { id: "m60", day: 60, name: "中兴之主·整顿", desc: "成长阶段。立足之后，暗流渐显：确立自己的章程、整顿手头的事务，独立扛起一块，用一份拿得出手的成果证明自己已能独当一面。", achId: "sixty-day-reform" },
    { id: "m90", day: 90, name: "正统女帝·加冕", desc: "转正阶段。九十日砺练至此，御前答辩通过、举行加冕大典，名正言顺地坐稳这一朝。往后的江山，愿陛下走得更远、更从容。", achId: "ninety-day-coronation" }
  ];

  /* ---------- 默认藏书（治国之策 tab 初始书籍） ---------- */
  var BOOKS = [
    { id: "b1", title: "职场生存录", author: "佚名", cover: A + "物品/书1.png", note: "初入官场者必读，讲述立足之道。" },
    { id: "b2", title: "决策通鉴", author: "翰林院", cover: A + "物品/书2.png", note: "历代明君决断案例辑要。" },
    { id: "b3", title: "养精调神谱", author: "钦天监", cover: A + "物品/书3.png", note: "调养精力、张弛有度之法。" }
  ];

  /* ---------- 起居注初始条目（journals） ---------- */
  var JOURNALS_SEED = [
    { id: "j1", day: 1, title: "登基第一日", text: "今日入朝，接过这一摊千头万绪的差事。人还没认全，事已压上肩头。批下第一份朱批，就从这里开始吧。" }
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
    },
    // 观星师：钦天监正，与卦师共用一套策士提示词，但是另一个人（立绘用 14.png 去背版观星师.png）。
    // 专属钦天监，不参与御花园/六部的随机偶遇（MINISTER_ORDER 不含此人）。
    "观星师": {
      name: "观星师", key: "观星师", role: "钦天监正", style: "strategist",
      portrait: A + "人物/观星师.png",
      say: "夜观天象，星轨自有其序。陛下把难处道来，臣为您卜算宜行之路。",
      lead: "观星象所示——"
    }
  };
  var MINISTER_ORDER = ["直臣", "顺臣", "卦师"];

  /* ---------- 任务分类 → 地图场景 ----------
     主线→朝堂 日常→六部 探索→御花园 拖延→民间迷雾 神秘/恢复→钦天监 */
  var CATEGORIES = {
    main:    { key: "main",    label: "主线", scene: "court",       color: "var(--cat-bronze)",    icon: A + "svg图标/朝堂.svg",   note: "关乎前程的大事，投往朝堂。陛下每次临朝，都是在推进自己的主线。" },
    daily:   { key: "daily",   label: "日常", scene: "ministry",    color: "var(--cat-porcelain)", icon: A + "svg图标/六部.svg",   note: "例行庶务，投往六部。六部会替陛下盯着，督促您一件件办结。" },
    explore: { key: "explore", label: "探索", scene: "garden",      color: "var(--cat-jade)",      icon: A + "svg图标/御花园.svg", note: "值得一试的新机会，投往御花园。宫女已领旨，在园中恭候陛下。" },
    delay:   { key: "delay",   label: "拖延", scene: "folk",         color: "var(--cat-wood)",      icon: A + "svg图标/民间.svg",   note: "搁置已久、渐渐石沉大海的旧事，唯有民间尚存线索，可循迹重启。" },
    mystic:  { key: "mystic",  label: "神秘", scene: "observatory",  color: "var(--cat-gold)",      icon: A + "svg图标/钦天监.svg", note: "调养身心、恢复精力之事。钦天监传此举大有益处，请陛下亲临。" }
  };
  var CATEGORY_ORDER = ["main", "daily", "explore", "delay", "mystic"];

  /* ---------- 场景空态任务范例 ----------
     只用于说明部分场景可承接的任务类型，不写入 mapTasks，也不参与查重或结算。 */
  var SCENE_TASK_TEMPLATES = {
    court: {
      title: "完成入职培训的结业答辩",
      // 结构化数值：与正常任务卡（v5）一致地渲染金币胶囊 + 精力 + 时长
      gold: 20, energy: 20, durationMinutes: 90,
      cta: "盖印",
      featured: true
    },
    garden: {
      title: "约行业前辈喝一次咖啡",
      gold: 10, energy: 10, durationMinutes: 30,
      cta: "议事",
      featured: true
    },
    folk: {
      title: "重启搁置三周的复盘文档",
      gold: 10, energy: 10, durationMinutes: 25,
      cta: "议事",
      featured: true
    },
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

  /* ---------- 预言模式 · 新入职七日演示样本 ----------
     只在真实任务池没有未完成任务时作为 prophecy 的只读 Adapter；
     不写入 mapTasks，不参与结算，也不冒充用户事实。 */
  var PROPHECY_DEMO_TASKS = [
    {
      id: "prophecy-demo-sat-review", weekday: 6,
      title: "复盘本周卡点并列下周三件事", cat: "delay", durationMinutes: 25,
      deadlineText: "周日 21:00 前", outcome: "让下周方向更早可见",
      conflict: "容易被休息计划挤掉"
    },
    {
      id: "prophecy-demo-sun-rest", weekday: 0,
      title: "彻底休息 30 分钟", cat: "mystic", durationMinutes: 30,
      deadlineText: "周日完成", outcome: "为下周保留判断力",
      conflict: "没有金币回报，容易被忽略"
    },
    {
      id: "prophecy-demo-mon-priority", weekday: 1,
      title: "确认第一周优先级", cat: "main", durationMinutes: 30,
      deadlineText: "周二 16:00 前", outcome: "让验收标准更清楚",
      conflict: "与入职培训吸收争夺注意力"
    },
    {
      id: "prophecy-demo-tue-metric", weekday: 2,
      title: "问清数据口径", cat: "daily", durationMinutes: 20,
      deadlineText: "周三 12:00 前", outcome: "减少后续返工",
      conflict: "需要主动开口提问"
    },
    {
      id: "prophecy-demo-wed-mentor", weekday: 3,
      title: "约 mentor coffee chat", cat: "explore", durationMinutes: 30,
      deadlineText: "本周内", outcome: "建立一条求教路径",
      conflict: "答辩前夜会占用社交精力",
      tags: ["mentor", "relationship"]
    },
    {
      id: "prophecy-demo-thu-defense", weekday: 4,
      title: "准备入职培训结业答辩", cat: "main", durationMinutes: 60,
      deadlineText: "周四晚完成", outcome: "降低答辩不确定性",
      conflict: "与 coffee chat 相邻，连续消耗精力",
      tags: ["regularization_defense"]
    },
    {
      id: "prophecy-demo-fri-defense", weekday: 5,
      title: "完成入职培训结业答辩", cat: "main", durationMinutes: 90,
      deadlineText: "周五 17:00 前", outcome: "完成第一项可验收的关键交付",
      conflict: "与周报同日收口，是本周高压点",
      tags: ["regularization_defense"]
    },
    {
      id: "prophecy-demo-fri-report", weekday: 5,
      title: "整理并发出本周周报", cat: "daily", durationMinutes: 20,
      deadlineText: "周五下班前", outcome: "留下可追踪的工作记录",
      conflict: "与答辩同日，容易被推迟到下班前赶工",
      tags: ["weekly_report"]
    }
  ];

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
          label: "折中之策：做一个 90 分钟的「足够好」版本",
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
    { cat: "青铜", idx: 1, id: "first-vermilion-brush", name: "初落朱批", goal: "首次在奏折上批下朱批(完成第一个决策审批)", hint: "在朝堂批准你的第一份奏折", tier: 1, reward: "+5金", flavor: "朱笔一落，朝政始于今日。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: ["首份奏折·录用通知"] },
    { cat: "青铜", idx: 2, id: "survey-six-ministries", name: "遍识六部", goal: "累计完成 6 项六部日常任务", hint: "在六部办结六项日常事务", tier: 1, reward: "+30金", flavor: "知人知职，方能理事。", cur: 0, target: 6, unlocked: false, date: null, journalRefs: ["六部巡礼记"] },
    { cat: "青铜", idx: 3, id: "first-audience-minister", name: "初见重臣", goal: "首次与AI大臣完成一次完整对话(在朝堂与关键角色交流)", hint: "在朝堂与一位大臣深谈一次", tier: 1, reward: "+5金", flavor: "得一良臣，如添一臂。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: ["与史官的初次奏对"] },
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
    { cat: "瓷器", idx: 8, id: "first-daily-liubu", name: "六部勤勉", goal: "首次完成一项六部日常任务", hint: "在六部完成第一项日常任务", tier: 1, reward: "+5金", flavor: "日拱一卒，六部庶务始入手。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: ["吏部·考勤归档"] },
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
    { cat: "金器", idx: 1, id: "first-gold", name: "初入国库", goal: "首次通过完成任务获得金币奖励", hint: "完成任意一项任务，领取首笔金币入库", tier: 1, reward: "徽记·初入国库", flavor: "一枚落库，万贯之始。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 2, id: "gold-50", name: "薄有积蓄", goal: "通过任务累计获得达到50金(历史总额，不因消费回退)", hint: "通过任务累计赚到50金，添置第一笔家底", tier: 1, reward: "+10金", flavor: "涓滴入囊，渐成薄产。", cur: 0, target: 50, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 3, id: "gold-100", name: "百金入库", goal: "通过任务累计获得达到100金(历史总额)", hint: "通过任务累计赚到100金，国库初见规模", tier: 2, reward: "称号·理财新丁", flavor: "百川汇流，始成其渊。", cur: 0, target: 100, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 4, id: "gold-300", name: "钱囊渐丰", goal: "通过任务累计获得达到300金(历史总额)", hint: "通过任务累计赚到300金，用度愈发从容", tier: 2, reward: "+50金", flavor: "囊中渐丰，行止从容。", cur: 0, target: 300, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 5, id: "gold-500", name: "府库半盈", goal: "通过任务累计获得达到500金(历史总额)", hint: "通过任务累计赚到500金，国库已半满", tier: 3, reward: "+80金", flavor: "半仓已实，根基渐稳。", cur: 0, target: 500, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 6, id: "gold-1000", name: "富甲一方", goal: "通过任务累计获得达到1000金(历史总额)", hint: "通过任务累计赚到1000金，坐拥千金", tier: 4, reward: "称号·富甲一方", flavor: "千金在握，心自安然。", cur: 0, target: 1000, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 7, id: "single-big-reward", name: "一掷千赏", goal: "首次完成一项重量档普通任务", hint: "完成一项91至240分钟的重量任务", tier: 3, reward: "+40金", flavor: "一赏倾金，足见其功。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 8, id: "gold-source-diverse", name: "财源广进", goal: "在朝堂、六部、御花园等三种以上不同来源都获得过金币奖励", hint: "从三类以上不同场景各领过一次金币", tier: 3, reward: "+60金", flavor: "源不一途，利归四海。", cur: 0, target: 3, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 9, id: "daily-gold-streak", name: "日进斗金", goal: "连续三日每天都有任务金币进账", hint: "连续三天每日都通过任务赚到金币", tier: 3, reward: "+50金", flavor: "日日有进，积少成多。", cur: 0, target: 3, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 10, id: "first-spend", name: "量入为出", goal: "首次在已开放的非必要增强或装饰中消费金币", hint: "金币用途尚未上线，此珍暂不开放", tier: 1, reward: "+15金", flavor: "知取知舍，方善持家。", cur: 0, target: 1, unlocked: false, date: null, availability: "dormant", journalRefs: [] },
    { cat: "金器", idx: 11, id: "single-day-gold-200", name: "日纳百川", goal: "单日通过任务累计获得100金", hint: "一天内通过任务累计进账100金", tier: 4, reward: "+25金", flavor: "一日之内，财如潮涌。", cur: 0, target: 100, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 12, id: "approval-gold", name: "朱批生金", goal: "通过批准奏折(朱批决策)累计获得200金", hint: "靠批朱批累计赚到200金", tier: 3, reward: "+50金", flavor: "一笔朱批，半仓金玉。", cur: 0, target: 200, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 13, id: "gold-and-energy-balance", name: "金精两全", goal: "当前持有金币达到500的同时，精力保持在100以上", hint: "手头金币满500且精力仍在100以上，财力精神两不误", tier: 4, reward: "称号·内外兼修", flavor: "财足神旺，两全其美。", cur: 0, target: 1, unlocked: false, date: null, journalRefs: [] },
    { cat: "金器", idx: 14, id: "treasury-peak", name: "富可敌国", goal: "通过任务累计获得达到3000金(历史总额)，登临财富之巅", hint: "通过任务累计赚到3000金，国库充盈甲天下", tier: 5, reward: "称号·富可敌国 · +200金", flavor: "仓廪充实，江山无忧。", cur: 0, target: 3000, unlocked: false, date: null, journalRefs: [] },
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

  /* ---------- 市井闲谈内容池（66 条共享 + 16 条名臣夸赞）----------
     由 tools/gen-folk-content.js 从 outputs/市井闲谈文案-2026-07-25.md 生成，勿手改。
     kind: praise 只听不成书(source:null) / knowledge / poem 可成书(带 source)。 */
  var FOLK_CONTENT = [
    { id: "folk_praise_01", kind: "praise", text: "陛下如今越来越清楚自己真正看重什么，做起取舍也比从前从容了。", source: null, enabled: true },
    { id: "folk_praise_02", kind: "praise", text: "陛下心里的那杆秤越来越稳，热闹的机会再多，也扰不乱您的主意。", source: null, enabled: true },
    { id: "folk_praise_03", kind: "praise", text: "陛下近来考虑事情更周全了，既看得到眼前的好处，也看得到背后的代价。", source: null, enabled: true },
    { id: "folk_praise_04", kind: "praise", text: "陛下不是每次都选最显眼的路，却越来越会选真正适合自己的路。", source: null, enabled: true },
    { id: "folk_praise_05", kind: "praise", text: "陛下已经把那件搁了许久的事重新拿起来了，肯重新开始，本身就是很了不起的进展。", source: null, enabled: true },
    { id: "folk_praise_06", kind: "praise", text: "陛下这段时间说到做到的次数越来越多，难怪心里也越来越信任自己。", source: null, enabled: true },
    { id: "folk_praise_07", kind: "praise", text: "陛下今日走的虽是一小步，却是实实在在向前的一步。", source: null, enabled: true },
    { id: "folk_praise_08", kind: "praise", text: "陛下做事的节奏越来越稳，不靠一时兴起，也能一点点把事情推下去。", source: null, enabled: true },
    { id: "folk_praise_09", kind: "praise", text: "陛下现在越来越能分清什么最要紧，忙起来也没有从前那么容易乱了。", source: null, enabled: true },
    { id: "folk_praise_10", kind: "praise", text: "陛下专心做事时，心里像亮着一盏灯，旁边再热闹也带不走您的目光。", source: null, enabled: true },
    { id: "folk_praise_11", kind: "praise", text: "陛下把事情安排得越来越有条理，手上有事，心里却不再挤成一团。", source: null, enabled: true },
    { id: "folk_praise_12", kind: "praise", text: "陛下如今既看得见全局，也没有漏掉眼前的小事，这份细致很难得。", source: null, enabled: true },
    { id: "folk_praise_13", kind: "praise", text: "陛下现在听人说话越来越沉得住气，难怪大家更愿意把真心话告诉您。", source: null, enabled: true },
    { id: "folk_praise_14", kind: "praise", text: "陛下既能体谅别人的难处，也没有把自己的感受丢在一边，这份温柔很有力量。", source: null, enabled: true },
    { id: "folk_praise_15", kind: "praise", text: "陛下如今说话更清楚，也更照顾人的感受，分寸拿捏得真好。", source: null, enabled: true },
    { id: "folk_praise_16", kind: "praise", text: "陛下越来越会让功劳落到该落的人身上，这份气度很得人心。", source: null, enabled: true },
    { id: "folk_praise_17", kind: "praise", text: "陛下吃过的亏没有白吃，正在一点点长成自己的眼光和判断。", source: null, enabled: true },
    { id: "folk_praise_18", kind: "praise", text: "陛下肯坦然承认暂时不会，这份底气可比装作什么都懂难得多了。", source: null, enabled: true },
    { id: "folk_praise_19", kind: "praise", text: "陛下如今看待失误比从前宽了一些，恢复得也越来越快了。", source: null, enabled: true },
    { id: "folk_praise_20", kind: "praise", text: "陛下每次回头看，都能发现自己又比从前多会了一点、多懂了一点。", source: null, enabled: true },
    { id: "folk_praise_21", kind: "praise", text: "陛下近来更懂得珍惜自己的精力了，整个人看起来也比从前舒展。", source: null, enabled: true },
    { id: "folk_praise_22", kind: "praise", text: "陛下的日程不再塞得密不透风，做起真正重要的事反而更从容了。", source: null, enabled: true },
    { id: "folk_praise_23", kind: "praise", text: "陛下现在既有往前冲的劲，也懂得什么时候收一收力，越来越有掌舵者的样子了。", source: null, enabled: true },
    { id: "folk_praise_24", kind: "praise", text: "陛下愿意给自己留一点喘息的地方，这份清醒和自爱都很珍贵。", source: null, enabled: true },
    { id: "folk_knowledge_01", kind: "knowledge", text: "新人适应并不只是“能不能把活做完”。组织社会化研究常用四个近端指标观察适应：是否弄清自己的职责，是否相信自己能胜任工作，是否获得同事接纳，以及是否理解组织的文化和隐性规则。这些因素会进一步关联工作满意度、组织承诺、绩效和离职意向。刚入职时感到生疏，不一定说明能力不足，也可能只是角色、关系和环境知识还没有建立起来。因此，适应过程同时需要学事、认人、懂规则，而不只是埋头练技能。", source: { sourceKey: "doi:10.1037/0021-9010.92.3.707", sourceType: "paper", bookTitle: "Newcomer Adjustment During Organizational Socialization", author: "Bauer et al.", year: 2007, displayText: "新人适应并不只是“能不能把活做完”。组织社会化研究常用四个近端指标观察适应：是否弄清自己的职责，是否相信自己能胜任工作，是否获得同事接纳，以及是否理解组织的文化和隐性规则。这些因素会进一步关联工作满意度、组织承诺、绩效和离职意向。刚入职时感到生疏，不一定说明能力不足，也可能只是角色、关系和环境知识还没有建立起来。因此，适应过程同时需要学事、认人、懂规则，而不只是埋头练技能。", url: "https://doi.org/10.1037/0021-9010.92.3.707" }, enabled: true },
    { id: "folk_knowledge_02", kind: "knowledge", text: "新人主动适应可以包括询问信息、寻求反馈、观察他人做法、建立工作关系和尝试理解组织规则。它的目的不是让所有人注意到自己，而是减少不确定性。提问时带上已经知道的背景、尝试过的方法和仍然不确定的部分，通常更容易得到有效帮助。把“我什么都不懂”改成“我目前理解到这里，想确认这一点”，既保留主动性，也能让对方快速判断该补充什么。主动也不等于高频打扰，关键是让每次询问都带着明确问题和可继续推进的下一步。", source: { sourceKey: "doi:10.1037/0021-9010.92.3.707", sourceType: "paper", bookTitle: "Newcomer Adjustment During Organizational Socialization", author: "Bauer et al.", year: 2007, displayText: "新人主动适应可以包括询问信息、寻求反馈、观察他人做法、建立工作关系和尝试理解组织规则。它的目的不是让所有人注意到自己，而是减少不确定性。提问时带上已经知道的背景、尝试过的方法和仍然不确定的部分，通常更容易得到有效帮助。把“我什么都不懂”改成“我目前理解到这里，想确认这一点”，既保留主动性，也能让对方快速判断该补充什么。主动也不等于高频打扰，关键是让每次询问都带着明确问题和可继续推进的下一步。", url: "https://doi.org/10.1037/0021-9010.92.3.707" }, enabled: true },
    { id: "folk_knowledge_03", kind: "knowledge", text: "心理安全感指的是，团队成员相信提出问题、承认不知道、讨论错误或表达不同意见时，不会因此遭受人际惩罚。它不代表没有分歧、降低标准或谁都不能被批评。恰恰相反，当成员能及时暴露风险、互相纠错，团队才更容易学习。一个气氛看似和谐、但没人敢报告坏消息的团队，心理安全可能并不高；允许坦诚讨论问题，同时对结果保持要求，才是更完整的状态。管理者承认自己也可能犯错，通常能更好地打开这种讨论空间。", source: { sourceKey: "doi:10.2307/2666999", sourceType: "paper", bookTitle: "Psychological Safety and Learning Behavior in Work Teams", author: "Edmondson", year: 1999, displayText: "心理安全感指的是，团队成员相信提出问题、承认不知道、讨论错误或表达不同意见时，不会因此遭受人际惩罚。它不代表没有分歧、降低标准或谁都不能被批评。恰恰相反，当成员能及时暴露风险、互相纠错，团队才更容易学习。一个气氛看似和谐、但没人敢报告坏消息的团队，心理安全可能并不高；允许坦诚讨论问题，同时对结果保持要求，才是更完整的状态。管理者承认自己也可能犯错，通常能更好地打开这种讨论空间。", url: "https://doi.org/10.2307/2666999" }, enabled: true },
    { id: "folk_knowledge_04", kind: "knowledge", text: "反馈不一定天然提升表现。Kluger 与 DeNisi 的元分析发现，反馈干预整体上有积极效果，但超过三分之一的干预反而降低了表现。一个重要区别是反馈把注意力引向哪里：聚焦任务过程、具体差距和下一步动作，通常比评价人格、聪明程度或“你到底行不行”更有帮助。“这份材料缺少两组数据，下次先补来源”比“你不够细心”更容易转化成可执行的改进。反馈越接近当下任务、越能指向可控制的行为，通常越有学习价值。", source: { sourceKey: "doi:10.1037/0033-2909.119.2.254", sourceType: "paper", bookTitle: "The Effects of Feedback Interventions on Performance", author: "Kluger & DeNisi", year: 1996, displayText: "反馈不一定天然提升表现。Kluger 与 DeNisi 的元分析发现，反馈干预整体上有积极效果，但超过三分之一的干预反而降低了表现。一个重要区别是反馈把注意力引向哪里：聚焦任务过程、具体差距和下一步动作，通常比评价人格、聪明程度或“你到底行不行”更有帮助。“这份材料缺少两组数据，下次先补来源”比“你不够细心”更容易转化成可执行的改进。反馈越接近当下任务、越能指向可控制的行为，通常越有学习价值。", url: "https://doi.org/10.1037/0033-2909.119.2.254" }, enabled: true },
    { id: "folk_knowledge_05", kind: "knowledge", text: "很多新人焦虑并非来自工作本身，而是来自“不知道怎样才算做好”。角色清晰通常包含职责范围、决策权限、优先级、时间节点、协作对象和验收标准。任务开始前把这些内容问清，能把模糊的不安变成具体问题。即使暂时得不到完整答案，也可以先确认当前假设，例如“我先按这个标准做一版，周三再校准”。清晰不是等别人把说明书递来，也可以通过提问和小版本逐步建立。长期说不清的职责会增加重复劳动，也容易让人把系统问题误解成个人失败。", source: { sourceKey: "doi:10.1037/0021-9010.92.3.707", sourceType: "paper", bookTitle: "Newcomer Adjustment During Organizational Socialization", author: "Bauer et al.", year: 2007, displayText: "很多新人焦虑并非来自工作本身，而是来自“不知道怎样才算做好”。角色清晰通常包含职责范围、决策权限、优先级、时间节点、协作对象和验收标准。任务开始前把这些内容问清，能把模糊的不安变成具体问题。即使暂时得不到完整答案，也可以先确认当前假设，例如“我先按这个标准做一版，周三再校准”。清晰不是等别人把说明书递来，也可以通过提问和小版本逐步建立。长期说不清的职责会增加重复劳动，也容易让人把系统问题误解成个人失败。", url: "https://doi.org/10.1037/0021-9010.92.3.707" }, enabled: true },
    { id: "folk_knowledge_06", kind: "knowledge", text: "自我决定理论认为，自主感、胜任感和联结感是三种基本心理需要。联结感不是认识很多人，而是感到自己被看见、被尊重，并与周围的人存在真实联系。工作中，一位愿意解释背景的同事、一次具体的感谢、一个能放心求助的对象，都可能增强联结感。长期只靠竞争、害怕和外部奖励驱动，即使短期能推进，也更难维持稳定的投入与幸福感。稳定关系带来的安全感，会让人更愿意尝试、求助并承担适度挑战。", source: { sourceKey: "doi:10.1207/s15327965pli1104_01", sourceType: "paper", bookTitle: "The \"What\" and \"Why\" of Goal Pursuits", author: "Deci & Ryan", year: 2000, displayText: "自我决定理论认为，自主感、胜任感和联结感是三种基本心理需要。联结感不是认识很多人，而是感到自己被看见、被尊重，并与周围的人存在真实联系。工作中，一位愿意解释背景的同事、一次具体的感谢、一个能放心求助的对象，都可能增强联结感。长期只靠竞争、害怕和外部奖励驱动，即使短期能推进，也更难维持稳定的投入与幸福感。稳定关系带来的安全感，会让人更愿意尝试、求助并承担适度挑战。", url: "https://doi.org/10.1207/s15327965pli1104_01" }, enabled: true },
    { id: "folk_knowledge_07", kind: "knowledge", text: "社会认知职业理论认为，职业兴趣、选择和表现会同时受到自我效能、结果预期、个人目标以及环境支持和障碍的影响。喜欢一件事，不一定相信自己做得好；相信自己能做，也不代表现实环境允许投入。规划时可以分别记录：我是否愿意长期做、我是否有能力证据、这条路可能带来什么、目前有哪些支持和阻碍。把这些变量拆开，比只问“我到底喜不喜欢”更容易得到可操作的答案。它更像多个变量组成的系统，而不是一道只靠直觉作答的选择题。", source: { sourceKey: "doi:10.1006/jvbe.1994.1027", sourceType: "paper", bookTitle: "Toward a Unifying Social Cognitive Theory of Career and Academic Interest, Choice, and Performance", author: "Lent, Brown, & Hackett", year: 1994, displayText: "社会认知职业理论认为，职业兴趣、选择和表现会同时受到自我效能、结果预期、个人目标以及环境支持和障碍的影响。喜欢一件事，不一定相信自己做得好；相信自己能做，也不代表现实环境允许投入。规划时可以分别记录：我是否愿意长期做、我是否有能力证据、这条路可能带来什么、目前有哪些支持和阻碍。把这些变量拆开，比只问“我到底喜不喜欢”更容易得到可操作的答案。它更像多个变量组成的系统，而不是一道只靠直觉作答的选择题。", url: "https://doi.org/10.1006/jvbe.1994.1027" }, enabled: true },
    { id: "folk_knowledge_08", kind: "knowledge", text: "生涯建构研究常把职业适应力概括为四个维度：关注未来、对选择保有一定控制、对可能性保持好奇，以及相信自己能够处理问题。它不是要求一个人提前知道完整答案，而是面对变化时仍愿意探索和行动。今天整理一项能力证据属于信心，访谈不同岗位属于好奇，为下季度设一个方向属于关注，主动决定投入边界则属于控制。四个维度可以分别练习，不必一次全部具备。面对转岗、失业或新技术时，适应力体现为能够重新组织这四种资源。", source: { sourceKey: "doi:10.1016/j.jvb.2012.01.011", sourceType: "paper", bookTitle: "Career Adapt-Abilities Scale", author: "Savickas & Porfeli", year: 2012, displayText: "生涯建构研究常把职业适应力概括为四个维度：关注未来、对选择保有一定控制、对可能性保持好奇，以及相信自己能够处理问题。它不是要求一个人提前知道完整答案，而是面对变化时仍愿意探索和行动。今天整理一项能力证据属于信心，访谈不同岗位属于好奇，为下季度设一个方向属于关注，主动决定投入边界则属于控制。四个维度可以分别练习，不必一次全部具备。面对转岗、失业或新技术时，适应力体现为能够重新组织这四种资源。", url: "https://doi.org/10.1016/j.jvb.2012.01.011" }, enabled: true },
    { id: "folk_knowledge_09", kind: "knowledge", text: "把职业方向写成“我必须选对的一生答案”，很容易带来决策瘫痪。更可行的写法是：“我猜自己可能适合解决某类问题，接下来用一个短项目验证。”验证可以观察三类证据：做得是否越来越熟练，完成后是恢复还是持续消耗，以及真实岗位是否需要这种能力。一次试验不能证明一生，但能排除一些想象、补充一些事实，让下一次选择比上一次更有依据。关键是事先写清验证周期、投入上限和停止条件，避免试验悄悄变成长期承诺。", source: { sourceKey: "composite:career-direction-hypothesis", sourceType: "composite", bookTitle: "职业方向作为待验证假设（基于 SCCT 的实践整理）", author: "基于 Lent, Brown, & Hackett (1994)", year: 1994, displayText: "把职业方向写成“我必须选对的一生答案”，很容易带来决策瘫痪。更可行的写法是：“我猜自己可能适合解决某类问题，接下来用一个短项目验证。”验证可以观察三类证据：做得是否越来越熟练，完成后是恢复还是持续消耗，以及真实岗位是否需要这种能力。一次试验不能证明一生，但能排除一些想象、补充一些事实，让下一次选择比上一次更有依据。关键是事先写清验证周期、投入上限和停止条件，避免试验悄悄变成长期承诺。", url: null }, enabled: true },
    { id: "folk_knowledge_10", kind: "knowledge", text: "目标设定研究表明，在承诺、能力和反馈等条件合适时，具体且具有挑战性的目标往往比“尽力而为”更能促进表现。困难目标并非无限加码；如果目标超出控制范围、缺少资源或无法获得反馈，它也可能带来挫败。一个更完整的目标需要说明产出、标准、期限和反馈节点，并区分结果目标与行动目标。例如“本月获得认可”难以直接控制，而“完成两次访谈并整理结论”更便于执行。目标难度也要与当前能力匹配，学习新任务时先建立策略，往往比只盯最终数字有效。", source: { sourceKey: "doi:10.1037/0003-066x.57.9.705", sourceType: "paper", bookTitle: "Building a Practically Useful Theory of Goal Setting and Task Motivation", author: "Locke & Latham", year: 2002, displayText: "目标设定研究表明，在承诺、能力和反馈等条件合适时，具体且具有挑战性的目标往往比“尽力而为”更能促进表现。困难目标并非无限加码；如果目标超出控制范围、缺少资源或无法获得反馈，它也可能带来挫败。一个更完整的目标需要说明产出、标准、期限和反馈节点，并区分结果目标与行动目标。例如“本月获得认可”难以直接控制，而“完成两次访谈并整理结论”更便于执行。目标难度也要与当前能力匹配，学习新任务时先建立策略，往往比只盯最终数字有效。", url: "https://doi.org/10.1037/0003-066x.57.9.705" }, enabled: true },
    { id: "folk_knowledge_11", kind: "knowledge", text: "拖延通常指明知延迟可能带来不利后果，仍自愿推迟原本计划的行动。研究把它视为典型的自我调节失败，并发现任务厌恶、回报遥远、低自我效能、冲动性和自我控制困难等因素与拖延相关。把拖延简单解释为“人不够上进”，容易增加羞耻，却没有改变任务结构。识别自己在逃避什么，例如不确定、无聊、害怕评价或任务过大，才更接近真正的启动障碍。不同人可能拖延同一任务，却由完全不同的情绪和环境机制触发。", source: { sourceKey: "doi:10.1037/0033-2909.133.1.65", sourceType: "paper", bookTitle: "The Nature of Procrastination", author: "Steel", year: 2007, displayText: "拖延通常指明知延迟可能带来不利后果，仍自愿推迟原本计划的行动。研究把它视为典型的自我调节失败，并发现任务厌恶、回报遥远、低自我效能、冲动性和自我控制困难等因素与拖延相关。把拖延简单解释为“人不够上进”，容易增加羞耻，却没有改变任务结构。识别自己在逃避什么，例如不确定、无聊、害怕评价或任务过大，才更接近真正的启动障碍。不同人可能拖延同一任务，却由完全不同的情绪和环境机制触发。", url: "https://doi.org/10.1037/0033-2909.133.1.65" }, enabled: true },
    { id: "folk_knowledge_12", kind: "knowledge", text: "实施意图是一种把行动与具体情境绑定的计划，常写成“如果情境 X 出现，那么我就执行行为 Y”。普通目标只说明想做到什么，实施意图则提前决定什么时候开始、看到什么线索就行动。例如“如果上午九点坐到工位，我就先打开报告写五分钟”。它并不替代目标价值或实际能力，但能减少临场反复决定的消耗，让已经形成的意愿更容易在合适时机转化为行动。情境线索越具体，越容易在关键时刻唤起预定行为。", source: { sourceKey: "doi:10.1037/0003-066x.54.7.493", sourceType: "paper", bookTitle: "Implementation Intentions: Strong Effects of Simple Plans", author: "Gollwitzer", year: 1999, displayText: "实施意图是一种把行动与具体情境绑定的计划，常写成“如果情境 X 出现，那么我就执行行为 Y”。普通目标只说明想做到什么，实施意图则提前决定什么时候开始、看到什么线索就行动。例如“如果上午九点坐到工位，我就先打开报告写五分钟”。它并不替代目标价值或实际能力，但能减少临场反复决定的消耗，让已经形成的意愿更容易在合适时机转化为行动。情境线索越具体，越容易在关键时刻唤起预定行为。", url: "https://doi.org/10.1037/0003-066x.54.7.493" }, enabled: true },
    { id: "folk_knowledge_13", kind: "knowledge", text: "时间动机理论把多种动机观点整合到一个直观关系中：一件事的吸引力会随成功预期和结果价值上升，也会随等待时间和冲动性增加而下降。年底可能获得的成长，很难和眼前刷消息的即时轻松竞争。缩短反馈周期、设置中间成果、让第一步更容易看见，可以把遥远回报拉近。这个模型不是精确计算每个人的动力，而是解释为什么“明明重要”仍可能输给“马上舒服”。因此，动力管理也可以从提升成功预期、增加即时价值和缩短等待三处入手。", source: { sourceKey: "doi:10.5465/amr.2006.22527462", sourceType: "paper", bookTitle: "Integrating Theories of Motivation", author: "Steel & König", year: 2006, displayText: "时间动机理论把多种动机观点整合到一个直观关系中：一件事的吸引力会随成功预期和结果价值上升，也会随等待时间和冲动性增加而下降。年底可能获得的成长，很难和眼前刷消息的即时轻松竞争。缩短反馈周期、设置中间成果、让第一步更容易看见，可以把遥远回报拉近。这个模型不是精确计算每个人的动力，而是解释为什么“明明重要”仍可能输给“马上舒服”。因此，动力管理也可以从提升成功预期、增加即时价值和缩短等待三处入手。", url: "https://doi.org/10.5465/amr.2006.22527462" }, enabled: true },
    { id: "folk_knowledge_14", kind: "knowledge", text: "“推进项目、完善方案、提升能力”都描述了方向，却没有告诉大脑现在该动哪一步。更容易启动的动作通常包含具体对象和可观察行为，例如“打开上次纪要，圈出三个未确认的问题”或“给负责人发出约会时间的消息”。动作越明确，越容易形成实施意图，也越容易在完成后获得反馈。把大目标翻译成下一步，不是降低标准，而是给目标一个能够进入现实的入口。一个合格的下一步，应该能让旁人看见它是否已经发生。", source: { sourceKey: "composite:visible-next-action", sourceType: "composite", bookTitle: "让下一步动作可见（实施意图×目标设定的实践整理）", author: "基于 Gollwitzer (1999) + Locke & Latham (2002)", year: 2002, displayText: "“推进项目、完善方案、提升能力”都描述了方向，却没有告诉大脑现在该动哪一步。更容易启动的动作通常包含具体对象和可观察行为，例如“打开上次纪要，圈出三个未确认的问题”或“给负责人发出约会时间的消息”。动作越明确，越容易形成实施意图，也越容易在完成后获得反馈。把大目标翻译成下一步，不是降低标准，而是给目标一个能够进入现实的入口。一个合格的下一步，应该能让旁人看见它是否已经发生。", url: null }, enabled: true },
    { id: "folk_knowledge_15", kind: "knowledge", text: "完整版本往往需要很长时间才暴露理解偏差，小版本则能提前把假设放到现实中检验。提纲、草图、样例、问题清单或一页数据，都可以成为反馈载体。小版本的意义不是永远交低质量成果，而是把一次漫长、封闭的制作过程拆成多个可校准的循环。每个循环都需要明确当前要验证什么，否则“先做一版”也可能变成没有边界的反复修改。这种方式也能减轻完美主义，因为评价对象变成了当前要验证的假设。", source: { sourceKey: "composite:small-batch-feedback", sourceType: "composite", bookTitle: "小版本与早反馈（基于目标设定的实践整理）", author: "基于 Locke & Latham (2002)", year: 2002, displayText: "完整版本往往需要很长时间才暴露理解偏差，小版本则能提前把假设放到现实中检验。提纲、草图、样例、问题清单或一页数据，都可以成为反馈载体。小版本的意义不是永远交低质量成果，而是把一次漫长、封闭的制作过程拆成多个可校准的循环。每个循环都需要明确当前要验证什么，否则“先做一版”也可能变成没有边界的反复修改。这种方式也能减轻完美主义，因为评价对象变成了当前要验证的假设。", url: null }, enabled: true },
    { id: "folk_knowledge_16", kind: "knowledge", text: "从一项任务切换到另一项任务时，注意力不一定同步完成切换。Leroy 将仍停留在上一项任务上的部分称为“注意力残留”。上一项任务没有收尾、表现不佳或仍有未解决目标时，残留往往更加明显，并可能影响后一项任务的表现。减少随意切换、完成一个小阶段再离开，或在切换前写下下一步，都可能帮助心理上的收尾。频繁切换造成的疲惫，不一定是意志力差，也可能是工作被切得太碎。这也解释了为什么一整天都很忙，却常觉得没有真正进入任何一件事。", source: { sourceKey: "doi:10.1016/j.obhdp.2009.04.002", sourceType: "paper", bookTitle: "Why Is It So Hard to Do My Work? The Challenge of Attention Residue", author: "Leroy", year: 2009, displayText: "从一项任务切换到另一项任务时，注意力不一定同步完成切换。Leroy 将仍停留在上一项任务上的部分称为“注意力残留”。上一项任务没有收尾、表现不佳或仍有未解决目标时，残留往往更加明显，并可能影响后一项任务的表现。减少随意切换、完成一个小阶段再离开，或在切换前写下下一步，都可能帮助心理上的收尾。频繁切换造成的疲惫，不一定是意志力差，也可能是工作被切得太碎。这也解释了为什么一整天都很忙，却常觉得没有真正进入任何一件事。", url: "https://doi.org/10.1016/j.obhdp.2009.04.002" }, enabled: true },
    { id: "folk_knowledge_17", kind: "knowledge", text: "大脑在不同任务规则之间切换时，需要重新配置注意和反应方式，因此即使任务都很简单，切换也可能增加反应时间和错误。所谓“多任务处理”经常不是同时完成两件需要思考的事，而是在两套规则之间快速来回。每次成本看似很小，累积后却会显著切碎工作。把相似回复集中处理、为复杂任务保留连续时间，通常比不断在消息、表格和文档之间跳转更节省认知资源。切换越频繁、任务规则差异越大，重新配置的负担通常越明显。", source: { sourceKey: "doi:10.1037/0096-1523.27.4.763", sourceType: "paper", bookTitle: "Executive Control of Cognitive Processes in Task Switching", author: "Rubinstein, Meyer, & Evans", year: 2001, displayText: "大脑在不同任务规则之间切换时，需要重新配置注意和反应方式，因此即使任务都很简单，切换也可能增加反应时间和错误。所谓“多任务处理”经常不是同时完成两件需要思考的事，而是在两套规则之间快速来回。每次成本看似很小，累积后却会显著切碎工作。把相似回复集中处理、为复杂任务保留连续时间，通常比不断在消息、表格和文档之间跳转更节省认知资源。切换越频繁、任务规则差异越大，重新配置的负担通常越明显。", url: "https://doi.org/10.1037/0096-1523.27.4.763" }, enabled: true },
    { id: "folk_knowledge_18", kind: "knowledge", text: "认知负荷理论指出，人在解决新问题时，可用于当下加工信息的工作记忆容量有限。材料层级混乱、一次给出过多新概念、还没学会基础步骤就处理复杂变化，都会占用额外资源。把信息分块、提供清晰示例、先掌握基础模式再增加难度，可以减少无关负荷。熟练者能依靠已有知识结构处理更多信息，因此同一份任务对新人和老手的认知负担可能完全不同。好的学习材料会让有限注意力优先用于真正要学的结构。", source: { sourceKey: "doi:10.1207/s15516709cog1202_4", sourceType: "paper", bookTitle: "Cognitive Load During Problem Solving: Effects on Learning", author: "Sweller", year: 1988, displayText: "认知负荷理论指出，人在解决新问题时，可用于当下加工信息的工作记忆容量有限。材料层级混乱、一次给出过多新概念、还没学会基础步骤就处理复杂变化，都会占用额外资源。把信息分块、提供清晰示例、先掌握基础模式再增加难度，可以减少无关负荷。熟练者能依靠已有知识结构处理更多信息，因此同一份任务对新人和老手的认知负担可能完全不同。好的学习材料会让有限注意力优先用于真正要学的结构。", url: "https://doi.org/10.1207/s15516709cog1202_4" }, enabled: true },
    { id: "folk_knowledge_19", kind: "knowledge", text: "被打断后最费力的部分，常常不是继续写，而是重新想起“刚才做到哪里、为什么这样做、下一步是什么”。在切换前留下恢复线索，例如记录已完成内容、下一动作、尚未解决的问题和相关文件位置，相当于把一部分工作记忆外置。回来后无需重新浏览全部材料，就能更快恢复任务上下文。这种做法尤其适合消息较多、会议密集或一天内必须处理多类事务的工作环境。恢复线索越简短、具体，重新进入任务时越不依赖当时的记忆状态。", source: { sourceKey: "composite:recovery-cue", sourceType: "composite", bookTitle: "恢复线索（注意力残留×任务切换的实践整理）", author: "基于 Leroy (2009) + Rubinstein et al. (2001)", year: 2009, displayText: "被打断后最费力的部分，常常不是继续写，而是重新想起“刚才做到哪里、为什么这样做、下一步是什么”。在切换前留下恢复线索，例如记录已完成内容、下一动作、尚未解决的问题和相关文件位置，相当于把一部分工作记忆外置。回来后无需重新浏览全部材料，就能更快恢复任务上下文。这种做法尤其适合消息较多、会议密集或一天内必须处理多类事务的工作环境。恢复线索越简短、具体，重新进入任务时越不依赖当时的记忆状态。", url: null }, enabled: true },
    { id: "folk_knowledge_20", kind: "knowledge", text: "工作要求—资源模型把工作环境中的因素分成两类。持续高负荷、时间压力、情绪劳动和角色冲突会消耗身心资源；自主性、及时反馈、同伴支持、清晰流程和发展机会则可能帮助完成工作并促进投入。同样的任务量，在缺少控制和支持时可能更难承受。因此，面对长期疲惫，除了调整个人习惯，也需要检查工作量、权限、支持和流程是否匹配，不能把所有问题都归结为个人抗压不足。资源不是福利点缀，而是维持表现、学习和健康所需的工作条件。", source: { sourceKey: "doi:10.1108/02683940710733115", sourceType: "paper", bookTitle: "The Job Demands–Resources Model: State of the Art", author: "Bakker & Demerouti", year: 2007, displayText: "工作要求—资源模型把工作环境中的因素分成两类。持续高负荷、时间压力、情绪劳动和角色冲突会消耗身心资源；自主性、及时反馈、同伴支持、清晰流程和发展机会则可能帮助完成工作并促进投入。同样的任务量，在缺少控制和支持时可能更难承受。因此，面对长期疲惫，除了调整个人习惯，也需要检查工作量、权限、支持和流程是否匹配，不能把所有问题都归结为个人抗压不足。资源不是福利点缀，而是维持表现、学习和健康所需的工作条件。", url: "https://doi.org/10.1108/02683940710733115" }, enabled: true },
    { id: "folk_knowledge_21", kind: "knowledge", text: "世界卫生组织在 ICD-11 中将职业倦怠描述为未被成功管理的慢性工作压力所导致的职业现象，包含精力耗竭、对工作产生心理距离或消极感，以及职业效能下降三个维度。它只用于职业情境，并不等同于所有疲惫，也不是医学疾病名称。短暂劳累可能通过休息缓解；若情绪、睡眠、身体症状或绝望感持续并影响生活，应寻求医生或心理专业人员评估，而不是只靠自律硬撑。这一定义也提醒人们，倦怠既涉及个人恢复，也涉及组织如何设计工作。", source: { sourceKey: "url:https://www.who.int/news/item/28-05-2019-burn-out-an-occupational-phenomenon-international-classification-of-diseases", sourceType: "web", bookTitle: "Burn-out an \"Occupational Phenomenon\"", author: "World Health Organization", year: 2019, displayText: "世界卫生组织在 ICD-11 中将职业倦怠描述为未被成功管理的慢性工作压力所导致的职业现象，包含精力耗竭、对工作产生心理距离或消极感，以及职业效能下降三个维度。它只用于职业情境，并不等同于所有疲惫，也不是医学疾病名称。短暂劳累可能通过休息缓解；若情绪、睡眠、身体症状或绝望感持续并影响生活，应寻求医生或心理专业人员评估，而不是只靠自律硬撑。这一定义也提醒人们，倦怠既涉及个人恢复，也涉及组织如何设计工作。", url: "https://www.who.int/news/item/28-05-2019-burn-out-an-occupational-phenomenon-international-classification-of-diseases" }, enabled: true },
    { id: "folk_knowledge_22", kind: "knowledge", text: "工作恢复研究常讨论四种体验：心理脱离，即下班后不再持续处理工作；放松，即降低身心激活水平；掌握体验，即做一件有挑战但能带来成长感的非工作活动；控制感，即能自主决定休息时间怎么使用。躺着刷消息未必同时满足这些条件，参加喜欢的运动、做饭或学习小技能也可能具有恢复作用。恢复方式没有统一答案，关键在于它是否真正减少消耗并补充资源。真正的恢复不是完成另一份隐形任务，而是让消耗系统得到不同形式的休息。", source: { sourceKey: "doi:10.1037/1076-8998.12.3.204", sourceType: "paper", bookTitle: "The Recovery Experience Questionnaire", author: "Sonnentag & Fritz", year: 2007, displayText: "工作恢复研究常讨论四种体验：心理脱离，即下班后不再持续处理工作；放松，即降低身心激活水平；掌握体验，即做一件有挑战但能带来成长感的非工作活动；控制感，即能自主决定休息时间怎么使用。躺着刷消息未必同时满足这些条件，参加喜欢的运动、做饭或学习小技能也可能具有恢复作用。恢复方式没有统一答案，关键在于它是否真正减少消耗并补充资源。真正的恢复不是完成另一份隐形任务，而是让消耗系统得到不同形式的休息。", url: "https://doi.org/10.1037/1076-8998.12.3.204" }, enabled: true },
    { id: "folk_knowledge_23", kind: "knowledge", text: "自我决定理论认为，自主感、胜任感和联结感是支持持续动机与幸福感的三种基本心理需要。自主感是感到行动与自己的选择一致，不等于完全不受约束；胜任感是能看到学习和掌握；联结感是感到被尊重并与他人相连。一份工作即使奖励很高，如果长期缺乏决定空间、看不到进步、也没有可信任的关系，投入也可能逐渐枯竭。改善动力时，可以分别检查这三种需要缺了哪一块。三种需要彼此独立，一项很强也难以完全补偿另一项长期缺失。", source: { sourceKey: "doi:10.1207/s15327965pli1104_01", sourceType: "paper", bookTitle: "The \"What\" and \"Why\" of Goal Pursuits", author: "Deci & Ryan", year: 2000, displayText: "自我决定理论认为，自主感、胜任感和联结感是支持持续动机与幸福感的三种基本心理需要。自主感是感到行动与自己的选择一致，不等于完全不受约束；胜任感是能看到学习和掌握；联结感是感到被尊重并与他人相连。一份工作即使奖励很高，如果长期缺乏决定空间、看不到进步、也没有可信任的关系，投入也可能逐渐枯竭。改善动力时，可以分别检查这三种需要缺了哪一块。三种需要彼此独立，一项很强也难以完全补偿另一项长期缺失。", url: "https://doi.org/10.1207/s15327965pli1104_01" }, enabled: true },
    { id: "folk_knowledge_24", kind: "knowledge", text: "自我效能指的是一个人对自己能否组织并完成某类行动的信念。Bandura 指出，亲自完成相似任务的掌握经验，是形成自我效能的重要来源；观察他人成功、获得可信鼓励以及对身心状态的解释也会产生影响。空泛地告诉自己“我一定行”，通常不如积累一个真实的小闭环有效。把完成过的作品、解决过的问题和收到的具体反馈留下来，能为下一次面对相似挑战提供更可靠的信心依据。小成果越具体、越接近将来要面对的情境，转化成信心的效果通常越可靠。", source: { sourceKey: "doi:10.1037/0033-295x.84.2.191", sourceType: "paper", bookTitle: "Self-efficacy: Toward a Unifying Theory of Behavioral Change", author: "Bandura", year: 1977, displayText: "自我效能指的是一个人对自己能否组织并完成某类行动的信念。Bandura 指出，亲自完成相似任务的掌握经验，是形成自我效能的重要来源；观察他人成功、获得可信鼓励以及对身心状态的解释也会产生影响。空泛地告诉自己“我一定行”，通常不如积累一个真实的小闭环有效。把完成过的作品、解决过的问题和收到的具体反馈留下来，能为下一次面对相似挑战提供更可靠的信心依据。小成果越具体、越接近将来要面对的情境，转化成信心的效果通常越可靠。", url: "https://doi.org/10.1037/0033-295x.84.2.191" }, enabled: true },
    { id: "folk_poem_01", kind: "poem", text: "草木有本心，何求美人折。——张九龄《感遇十二首·其一》", source: { sourceKey: "poem:张九龄:感遇十二首·其一", sourceType: "poem", bookTitle: "感遇十二首·其一", author: "张九龄", displayText: "草木有本心，何求美人折。——张九龄《感遇十二首·其一》", url: null }, enabled: true },
    { id: "folk_poem_02", kind: "poem", text: "试玉要烧三日满，辨材须待七年期。——白居易《放言五首·其三》", source: { sourceKey: "poem:白居易:放言五首·其三", sourceType: "poem", bookTitle: "放言五首·其三", author: "白居易", displayText: "试玉要烧三日满，辨材须待七年期。——白居易《放言五首·其三》", url: null }, enabled: true },
    { id: "folk_poem_03", kind: "poem", text: "宣父犹能畏后生，丈夫未可轻年少。——李白《上李邕》", source: { sourceKey: "poem:李白:上李邕", sourceType: "poem", bookTitle: "上李邕", author: "李白", displayText: "宣父犹能畏后生，丈夫未可轻年少。——李白《上李邕》", url: null }, enabled: true },
    { id: "folk_poem_04", kind: "poem", text: "山光物态弄春晖，莫为轻阴便拟归。——张旭《山中留客》", source: { sourceKey: "poem:张旭:山中留客", sourceType: "poem", bookTitle: "山中留客", author: "张旭", displayText: "山光物态弄春晖，莫为轻阴便拟归。——张旭《山中留客》", url: null }, enabled: true },
    { id: "folk_poem_05", kind: "poem", text: "向来枉费推移力，此日中流自在行。——朱熹《观书有感·其二》", source: { sourceKey: "poem:朱熹:观书有感·其二", sourceType: "poem", bookTitle: "观书有感·其二", author: "朱熹", displayText: "向来枉费推移力，此日中流自在行。——朱熹《观书有感·其二》", url: null }, enabled: true },
    { id: "folk_poem_06", kind: "poem", text: "芙蓉生在秋江上，不向东风怨未开。——高蟾《上高侍郎》", source: { sourceKey: "poem:高蟾:上高侍郎", sourceType: "poem", bookTitle: "上高侍郎", author: "高蟾", displayText: "芙蓉生在秋江上，不向东风怨未开。——高蟾《上高侍郎》", url: null }, enabled: true },
    { id: "folk_poem_07", kind: "poem", text: "政入万山围子里，一山放出一山拦。——杨万里《过松源晨炊漆公店·其五》", source: { sourceKey: "poem:杨万里:过松源晨炊漆公店·其五", sourceType: "poem", bookTitle: "过松源晨炊漆公店·其五", author: "杨万里", displayText: "政入万山围子里，一山放出一山拦。——杨万里《过松源晨炊漆公店·其五》", url: null }, enabled: true },
    { id: "folk_poem_08", kind: "poem", text: "山静似太古，日长如小年。——唐庚《醉眠》", source: { sourceKey: "poem:唐庚:醉眠", sourceType: "poem", bookTitle: "醉眠", author: "唐庚", displayText: "山静似太古，日长如小年。——唐庚《醉眠》", url: null }, enabled: true },
    { id: "folk_poem_09", kind: "poem", text: "未出土时先有节，及凌云处尚虚心。——徐庭筠《咏竹》", source: { sourceKey: "poem:徐庭筠:咏竹", sourceType: "poem", bookTitle: "咏竹", author: "徐庭筠", displayText: "未出土时先有节，及凌云处尚虚心。——徐庭筠《咏竹》", url: null }, enabled: true },
    { id: "folk_poem_10", kind: "poem", text: "水流心不竞，云在意俱迟。——杜甫《江亭》", source: { sourceKey: "poem:杜甫:江亭", sourceType: "poem", bookTitle: "江亭", author: "杜甫", displayText: "水流心不竞，云在意俱迟。——杜甫《江亭》", url: null }, enabled: true },
    { id: "folk_poem_11", kind: "poem", text: "万物静观皆自得，四时佳兴与人同。——程颢《秋日偶成》", source: { sourceKey: "poem:程颢:秋日偶成", sourceType: "poem", bookTitle: "秋日偶成", author: "程颢", displayText: "万物静观皆自得，四时佳兴与人同。——程颢《秋日偶成》", url: null }, enabled: true },
    { id: "folk_poem_12", kind: "poem", text: "古来存老马，不必取长途。——杜甫《江汉》", source: { sourceKey: "poem:杜甫:江汉", sourceType: "poem", bookTitle: "江汉", author: "杜甫", displayText: "古来存老马，不必取长途。——杜甫《江汉》", url: null }, enabled: true },
    { id: "folk_poem_13", kind: "poem", text: "莫道谗言如浪深，莫言迁客似沙沉。——刘禹锡《浪淘沙·其八》", source: { sourceKey: "poem:刘禹锡:浪淘沙·其八", sourceType: "poem", bookTitle: "浪淘沙·其八", author: "刘禹锡", displayText: "莫道谗言如浪深，莫言迁客似沙沉。——刘禹锡《浪淘沙·其八》", url: null }, enabled: true },
    { id: "folk_poem_14", kind: "poem", text: "得即高歌失即休，多愁多恨亦悠悠。——罗隐《自遣》", source: { sourceKey: "poem:罗隐:自遣", sourceType: "poem", bookTitle: "自遣", author: "罗隐", displayText: "得即高歌失即休，多愁多恨亦悠悠。——罗隐《自遣》", url: null }, enabled: true },
    { id: "folk_poem_15", kind: "poem", text: "自小刺头深草里，而今渐觉出蓬蒿。——杜荀鹤《小松》", source: { sourceKey: "poem:杜荀鹤:小松", sourceType: "poem", bookTitle: "小松", author: "杜荀鹤", displayText: "自小刺头深草里，而今渐觉出蓬蒿。——杜荀鹤《小松》", url: null }, enabled: true },
    { id: "folk_poem_16", kind: "poem", text: "便觉眼前生意满，东风吹水绿参差。——张栻《立春偶成》", source: { sourceKey: "poem:张栻:立春偶成", sourceType: "poem", bookTitle: "立春偶成", author: "张栻", displayText: "便觉眼前生意满，东风吹水绿参差。——张栻《立春偶成》", url: null }, enabled: true },
    { id: "folk_poem_17", kind: "poem", text: "清风明月无人管，并作南楼一味凉。——黄庭坚《鄂州南楼书事》", source: { sourceKey: "poem:黄庭坚:鄂州南楼书事", sourceType: "poem", bookTitle: "鄂州南楼书事", author: "黄庭坚", displayText: "清风明月无人管，并作南楼一味凉。——黄庭坚《鄂州南楼书事》", url: null }, enabled: true },
    { id: "folk_poem_18", kind: "poem", text: "钓罢归来不系船，江村月落正堪眠。——司空曙《江村即事》", source: { sourceKey: "poem:司空曙:江村即事", sourceType: "poem", bookTitle: "江村即事", author: "司空曙", displayText: "钓罢归来不系船，江村月落正堪眠。——司空曙《江村即事》", url: null }, enabled: true },
    { id: "legend_shangguan_praise_01", kind: "praise", text: "陛下近来落笔越来越稳，繁杂的事到了您手里，也总能很快理出轻重。臣看着，心里实在佩服。", source: null, enabled: true },
    { id: "legend_shangguan_praise_02", kind: "praise", text: "陛下如今待人既有温度，也有分寸，大家愿意把真话说给您听，这份信任最难得。", source: null, enabled: true },
    { id: "legend_shangguan_praise_03", kind: "praise", text: "陛下这一路走来，眼光比从前更准，做事也更从容。许多变化不声不响，却都落在实处。", source: null, enabled: true },
    { id: "legend_shangguan_praise_04", kind: "praise", text: "臣见陛下今日比昨日更笃定，既守得住自己的主意，也容得下不同声音，这份气度着实少见。", source: null, enabled: true },
    { id: "legend_silver_praise_01", kind: "praise", text: "陛下近来既有向前的劲，也越来越懂得把力气用在真正要紧的地方，整个人都比从前从容了。", source: null, enabled: true },
    { id: "legend_silver_praise_02", kind: "praise", text: "陛下忙起来依然能顾到自己的感受，这份清醒很难得，也让您做事的节奏越来越稳。", source: null, enabled: true },
    { id: "legend_silver_praise_03", kind: "praise", text: "陛下如今遇到繁杂事务也不轻易乱了步子，缓一缓、再落子，反而每一步都走得更实。", source: null, enabled: true },
    { id: "legend_silver_praise_04", kind: "praise", text: "臣看陛下这段日子越来越舒展，心里有主意，手上有分寸，这样的状态真让人欢喜。", source: null, enabled: true },
    { id: "legend_rabbit_praise_01", kind: "praise", text: "陛下近来走到哪里都有人愿意搭把手，这不是碰巧，是您平日待人的真心都被大家记住了。", source: null, enabled: true },
    { id: "legend_rabbit_praise_02", kind: "praise", text: "陛下现在越来越能看见那些不起眼的小机会，还总能把它们稳稳接住，这份机敏真漂亮。", source: null, enabled: true },
    { id: "legend_rabbit_praise_03", kind: "praise", text: "陛下做事越来越有轻重，忙的时候不慌，顺的时候也不松，难怪好运总愿意往您这边来。", source: null, enabled: true },
    { id: "legend_rabbit_praise_04", kind: "praise", text: "臣瞧着陛下最近的笑意比从前多了，事情也一件件有了回音，这份好光景全是您自己走出来的。", source: null, enabled: true },
    { id: "legend_diviner_praise_01", kind: "praise", text: "陛下近来判断事情越来越准，遇到变化也不慌，总能从乱局里看出真正关键的那一点。", source: null, enabled: true },
    { id: "legend_diviner_praise_02", kind: "praise", text: "臣见陛下如今眼光放得更远，脚下却走得更稳，这份清醒和笃定实在难得。", source: null, enabled: true },
    { id: "legend_diviner_praise_03", kind: "praise", text: "陛下现在面对不确定的事越来越从容，既看得见风险，也看得见机会，心里的格局比从前更开阔了。", source: null, enabled: true },
    { id: "legend_diviner_praise_04", kind: "praise", text: "陛下这段日子的每一次取舍都更有自己的章法，旁人看见的是结果，臣看见的是您越来越稳的心。", source: null, enabled: true },
  ];

  // 生成器保留原始正文；运行时将出处规范为适合界面展示的引用，避免重复整段闲谈。
  FOLK_CONTENT.forEach(function (item) {
    var source = item.source;
    if (!source) return;
    if (source.sourceType === "poem") {
      source.displayText = (source.author || "佚名") + "《" + source.bookTitle + "》";
      return;
    }
    source.displayText = (source.author ? source.author + (source.year ? " (" + source.year + ")" : "") + ", " : "") +
      source.bookTitle + ".";
  });

  /* ---------- 19 位市井人物（数字立绘无身份设定，不虚构姓名与职业） ---------- */
  var COMMONERS = [
    { id: "commoner_001", displayName: "市井来客 01", portraitAsset: "市井1.png", enabled: true },
    { id: "commoner_002", displayName: "市井来客 02", portraitAsset: "市井2.png", enabled: true },
    { id: "commoner_003", displayName: "市井来客 03", portraitAsset: "市井3.png", enabled: true },
    { id: "commoner_004", displayName: "市井来客 04", portraitAsset: "市井4.png", enabled: true },
    { id: "commoner_005", displayName: "市井来客 05", portraitAsset: "市井5.png", enabled: true },
    { id: "commoner_006", displayName: "市井来客 06", portraitAsset: "市井6.png", enabled: true },
    { id: "commoner_007", displayName: "市井来客 07", portraitAsset: "市井7.png", enabled: true },
    { id: "commoner_008", displayName: "市井来客 08", portraitAsset: "市井8.png", enabled: true },
    { id: "commoner_009", displayName: "市井来客 09", portraitAsset: "市井9.png", enabled: true },
    { id: "commoner_010", displayName: "市井来客 10", portraitAsset: "市井10.png", enabled: true },
    { id: "commoner_011", displayName: "市井来客 11", portraitAsset: "市井11.png", enabled: true },
    { id: "commoner_012", displayName: "市井来客 12", portraitAsset: "市井12.png", enabled: true },
    { id: "commoner_013", displayName: "市井来客 13", portraitAsset: "市井13.png", enabled: true },
    { id: "commoner_014", displayName: "市井来客 14", portraitAsset: "市井14.png", enabled: true },
    { id: "commoner_015", displayName: "市井来客 15", portraitAsset: "市井15.png", enabled: true },
    { id: "commoner_016", displayName: "市井来客 16", portraitAsset: "市井16.png", enabled: true },
    { id: "commoner_017", displayName: "市井来客 17", portraitAsset: "市井17.png", enabled: true },
    { id: "commoner_019", displayName: "市井来客 19", portraitAsset: "市井19.png", enabled: true },
    { id: "commoner_020", displayName: "市井来客 20", portraitAsset: "市井20.png", enabled: true },
  ];

  /* ---------- 4 位名臣（PRD §19.3；praiseContentIds 指向 FOLK_CONTENT 中的名臣夸赞） ---------- */
  var LEGENDS = [
    {
      id: "legend_shangguan_waner", displayName: "上官婉儿", title: "掌诏才女", portraitAsset: "人物/上官婉儿.png",
      praiseContentIds: ["legend_shangguan_praise_01", "legend_shangguan_praise_02", "legend_shangguan_praise_03", "legend_shangguan_praise_04"],
      buff: { id: "buff_shangguan_waner_gold", name: "金笔生花", type: "task_gold_multiplier", value: 2, stackMode: "multiply", description: "从现在起，完成并呈报普通任务时，基础金币赏赐翻倍。" },
      enabled: true
    },
    {
      id: "legend_silver_chrysanthemum", displayName: "银叶菊仙", title: "疗愈花仙", portraitAsset: "人物/银叶菊仙.png",
      praiseContentIds: ["legend_silver_praise_01", "legend_silver_praise_02", "legend_silver_praise_03", "legend_silver_praise_04"],
      buff: { id: "buff_silver_chrysanthemum_energy", name: "银叶轻覆", type: "task_energy_multiplier", value: 0.5, stackMode: "multiply", description: "从现在起，完成普通任务时，精力消耗减半，四舍五入。" },
      enabled: true
    },
    {
      id: "legend_rabbit_spirit", displayName: "兔子精", title: "玉兔机敏", portraitAsset: "人物/兔子精.png",
      praiseContentIds: ["legend_rabbit_praise_01", "legend_rabbit_praise_02", "legend_rabbit_praise_03", "legend_rabbit_praise_04"],
      buff: { id: "buff_rabbit_legend_chance", name: "福缘广结", type: "encounter_weight_add", value: 0.1, stackMode: "add", description: "下一次进入民间起，名臣出现率由 15% 提高到 25%。" },
      enabled: true
    },
    {
      id: "legend_diviner", displayName: "卦师", title: "钦天监正", portraitAsset: "人物/卦师.png",
      praiseContentIds: ["legend_diviner_praise_01", "legend_diviner_praise_02", "legend_diviner_praise_03", "legend_diviner_praise_04"],
      buff: { id: "buff_diviner_daily_reroll", name: "观星改命", type: "daily_reroll_add", value: 1, stackMode: "add", description: "从现在起，每日天象签可额外免费重抽一次，总数增至 2 次。" },
      enabled: true
    },
  ];

  window.App.data = {
    ASSET_BASE: A,
    FOLK_CONTENT: FOLK_CONTENT,
    COMMONERS: COMMONERS,
    LEGENDS: LEGENDS,
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
    PROPHECY_DEMO_TASKS: PROPHECY_DEMO_TASKS,
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
