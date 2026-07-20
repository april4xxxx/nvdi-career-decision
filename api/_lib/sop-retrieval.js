import { SOP_RUNTIME_PACKAGE } from "../_generated/sop-runtime.js";

function normalize(value) {
  return String(value || "").toLowerCase().replace(/[\s\p{P}\p{S}_]+/gu, "");
}

function terms(value) {
  const text = String(value || "").toLowerCase();
  const result = text.match(/[a-z0-9]{2,}/g) || [];
  for (const run of text.match(/[\u3400-\u9fff]+/g) || []) {
    if (run.length === 1) result.push(run);
    for (let index = 0; index < run.length - 1; index++) result.push(run.slice(index, index + 2));
  }
  return [...new Set(result)];
}

function textScore(queryTerms, value) {
  const haystack = normalize(value);
  return queryTerms.reduce((score, term) => score + (haystack.includes(normalize(term)) ? 1 : 0), 0);
}

const TOPIC_ALIASES = {
  onboarding_landing: ["入职", "试用期", "岗位", "职责", "工具", "流程", "融入"],
  organization_stakeholder: ["关键人", "负责人", "协作者", "谁负责", "找谁", "关系"],
  workload_priority: ["优先级", "做不完", "任务冲突", "工作量", "排序", "延期"],
  manager_communication: ["领导", "主管", "负责人", "一对一", "汇报", "向上沟通", "反馈"],
  peer_collaboration: ["同事", "协作", "跨部门", "依赖", "配合"],
  performance_visibility: ["成果", "交付", "价值", "述职", "复盘", "周报", "被看见"],
  boundary_conflict: ["拒绝", "边界", "冲突", "抢功", "甩锅"],
  skill_growth: ["能力", "学习", "技能", "成长", "卡点"],
  ai_workflow: ["AI", "人工智能", "大模型", "自动化"]
};

const INTENT_ALIASES = {
  decide: ["要不要", "选哪个", "是否值得", "怎么选"],
  plan: ["计划", "规划", "步骤", "怎么做"],
  next_action: ["先做什么", "第一步", "眼下", "现在做什么"],
  communication_script: ["怎么说", "话术", "怎么回复", "怎么沟通", "怎么汇报", "怎么确认"],
  template: ["模板", "表格", "清单", "结构"],
  prepare: ["准备", "明天", "会议", "答辩"],
  review: ["复盘", "检查", "帮我看", "总结"]
};

function inferredLabels(message, aliases) {
  const input = String(message || "").toLowerCase();
  return Object.entries(aliases)
    .filter(([, values]) => values.some((value) => input.includes(String(value).toLowerCase())))
    .map(([label]) => label);
}

const NEGATIVE_CUES = ["尚未", "还没有", "还没", "没有", "未开通", "未完成", "不存在", "无法", "不能", "不清楚", "缺少", "即将离职"];

function conditionMatches(message, condition) {
  const input = String(message || "");
  const rule = String(condition || "");
  if (rule.includes("权限") && rule.includes("开通") && /权限.{0,12}(尚未|还没有|还没|没有|未)开通/.test(input)) return true;
  if (rule.includes("工作成果") && /(尚未|还没有|还没|没有).{0,18}(成果|交付|反馈|解决.{0,4}问题)/.test(input)) return true;
  if (rule.includes("关键人员") && rule.includes("清晰书面记录") && /(分工|关键人|找谁).{0,24}(清晰|完整|书面|记录)|已有.{0,12}(完整|清晰).{0,12}(书面)?(分工|记录)|已有.{0,30}(分工表|书面记录)/.test(input)) return true;
  if (rule.includes("保密") && rule.includes("指定处理流程") && /(保密|敏感数据|未脱敏|客户身份|安全工单|指定.{0,8}流程|禁止.{0,12}聊天)/.test(input)) return true;
  if (rule.includes("技能与当前任务无关") && /(工作|任务).{0,12}(不需要|无关)|与.{0,8}(工作|任务).{0,8}无关/.test(input)) return true;
  if (rule.includes("泛化焦虑") && /(泛化焦虑|只是.{0,12}焦虑|看到别人.{0,8}(都在学|学习)|怕.{0,8}(落后|掉队))/.test(input)) return true;
  if (rule.includes("即将离职或转岗") && /(即将|准备|已经|确认|下月|两周后).{0,12}(离职|转岗)|(离职|转岗).{0,12}(已确认|交接)/.test(input)) return true;
  if (rule.includes("专门升级") && /(专门|正式).{0,8}(升级|渠道|流程)|骚扰|歧视|报复风险/.test(input)) return true;
  const query = normalize(message);
  const target = normalize(condition);
  if (!query || !target) return false;
  if (query.includes(target) || (query.length >= 8 && target.includes(query))) return true;

  const conditionTerms = terms(condition).filter((term) => normalize(term).length > 1);
  if (!conditionTerms.length) return false;
  const matched = conditionTerms.filter((term) => query.includes(normalize(term))).length;
  const ratio = matched / conditionTerms.length;
  const conditionIsNegative = NEGATIVE_CUES.some((cue) => String(condition).includes(cue));
  const queryIsNegative = NEGATIVE_CUES.some((cue) => String(message).includes(cue));
  return ratio >= 0.55 && (!conditionIsNegative || queryIsNegative);
}

function moduleScore(module, message) {
  const queryTerms = terms(message);
  const inferredTopics = inferredLabels(message, TOPIC_ALIASES);
  const inferredIntents = inferredLabels(message, INTENT_ALIASES);
  let score = textScore(queryTerms, module.title) * 4;
  score += textScore(queryTerms, module.retrieval_tags.join(" ")) * 3;
  score += textScore(queryTerms, module.applicable_when.join(" ")) * 2;
  score += textScore(queryTerms, `${module.primary_topic} ${module.secondary_topics.join(" ")} ${module.supported_intents.join(" ")}`);
  if (inferredTopics.includes(module.primary_topic)) score += 8;
  score += module.secondary_topics.filter((topic) => inferredTopics.includes(topic)).length * 3;
  score += module.supported_intents.filter((intent) => inferredIntents.includes(intent)).length * 4;
  if (/现在.{0,8}(应该|该做)|当前阶段|这个阶段|接下来.{0,8}(做什么|怎么做)/.test(String(message || "")) && module.recommendation_priority === "REQUIRED_CANDIDATE") score += 2;
  if (module.recommendation_priority === "REQUIRED_CANDIDATE") score += 1;
  return score;
}

export function sopSourceLabel(module) {
  return `SOP:${module.sop_id}｜${module.title}`;
}

export function retrieveSopCandidates({ message, journeyStage, limit, runtimePackage = SOP_RUNTIME_PACKAGE }) {
  if (runtimePackage?.release_status !== "ACTIVE") return [];
  const max = Math.max(1, Math.min(3, Number(limit) || runtimePackage.selection_rules?.max_modules_per_retrieval || 3));
  return (Array.isArray(runtimePackage.modules) ? runtimePackage.modules : [])
    .filter((module) => module.status === "ACTIVE")
    .filter((module) => module.career_phase === "posthire" && module.journey_stages.includes(journeyStage))
    .filter((module) => !module.not_applicable_when.some((condition) => conditionMatches(message, condition)))
    .map((module) => ({ module, score: moduleScore(module, message) }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || left.module.sop_id.localeCompare(right.module.sop_id))
    .slice(0, max)
    .map(({ module }) => ({ ...module, source_label: sopSourceLabel(module) }));
}

export function compactSopForPrompt(module) {
  return {
    sop_id: module.sop_id,
    title: module.title,
    journey_stages: module.journey_stages,
    primary_topic: module.primary_topic,
    secondary_topics: module.secondary_topics,
    supported_intents: module.supported_intents,
    applicable_when: module.applicable_when,
    not_applicable_when: module.not_applicable_when,
    estimated_minutes: module.estimated_minutes,
    tasks: module.tasks,
    source_label: module.source_label
  };
}
