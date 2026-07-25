import { calculateTaskEconomy } from "./economy.js";

export const CATEGORIES = ["main", "daily", "explore", "delay", "mystic"];
export const NPC_ROLES = ["leader", "coworker", "product", "customer", "mentor", "subordinate", "ally", "rival", "unknown"];
export const NPC_STANCES = ["unknown", "ally", "friendly", "neutral", "cold", "rival", "hostile"];
export const NPC_TASK_RELATIONS = ["owner", "stakeholder", "approver", "blocker", "recipient", "mentioned"];

const taskSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    cat: { type: "string", enum: CATEGORIES },
    durationMinutes: { type: "number" }
  },
  required: ["title", "cat", "durationMinutes"]
};

const pathSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    label: { type: "string" },
    text: { type: "string" },
    tasks: { type: "array", items: taskSchema }
  },
  required: ["label", "text", "tasks"]
};

const npcTaskLinkSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    path: { type: "string", enum: ["recommend", "alt"] },
    taskIndex: { type: "number" },
    relation: { type: "string", enum: NPC_TASK_RELATIONS },
    reason: { type: "string" },
    confidence: { type: "number" }
  },
  required: ["path", "taskIndex", "relation", "reason", "confidence"]
};

const npcCandidateSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    existingNpcId: { type: "string" },
    displayName: { type: "string" },
    title: { type: "string" },
    aliases: { type: "array", items: { type: "string" } },
    role: { type: "string", enum: NPC_ROLES },
    identityStatus: { type: "string", enum: ["auto_created", "confirmed", "ambiguous"] },
    identityConfidence: { type: "number" },
    relationship: {
      type: "object",
      additionalProperties: false,
      properties: {
        stance: { type: "string", enum: NPC_STANCES },
        stanceConfidence: { type: "number" },
        inferenceReason: { type: "string" },
        trust: { type: "number" },
        influence: { type: "number" },
        alignment: { type: "number" },
        conflict: { type: "number" },
        familiarity: { type: "number" }
      },
      required: ["stance", "stanceConfidence", "inferenceReason", "trust", "influence", "alignment", "conflict", "familiarity"]
    },
    taskLinks: { type: "array", items: npcTaskLinkSchema }
  },
  required: [
    "existingNpcId", "displayName", "title", "aliases", "role", "identityStatus",
    "identityConfidence", "relationship", "taskLinks"
  ]
};

const npcDetectionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    hasRelevantPeople: { type: "boolean" },
    candidates: { type: "array", items: npcCandidateSchema }
  },
  required: ["hasRelevantPeople", "candidates"]
};

export const decisionResponseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    type: { type: "string", enum: ["dialogue", "question", "decision"] },
    topic: { type: "string" },
    message: { type: "string" },
    question: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            q: { type: "string" },
            options: {
              type: "array",
              items: {
                type: "object",
                additionalProperties: false,
                properties: { text: { type: "string" }, tag: { type: "string" } },
                required: ["text", "tag"]
              }
            }
          },
          required: ["q", "options"]
        },
        { type: "null" }
      ]
    },
    decision: {
      anyOf: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            category: { type: "string", enum: CATEGORIES },
            title: { type: "string" },
            summary: { type: "string" },
            mirror: {
              type: "object",
              additionalProperties: false,
              properties: {
                invest: { type: "string" }, reward: { type: "string" }, cost: { type: "string" }
              },
              required: ["invest", "reward", "cost"]
            },
            recommend: pathSchema,
            alt: { anyOf: [pathSchema, { type: "null" }] },
            sources: { type: "array", items: { type: "string" } },
            npcDetection: npcDetectionSchema
          },
          required: ["category", "title", "summary", "mirror", "recommend", "alt", "sources", "npcDetection"]
        },
        { type: "null" }
      ]
    }
  },
  required: ["type", "topic", "message", "question", "decision"]
};

function cleanText(value, max = 500) {
  return String(value || "").trim().slice(0, max);
}

function cleanMinisterSpeech(value, max = 800) {
  // “朕”只属于用户扮演的女帝；模型在大臣回复中误用时统一纠正身份。
  return cleanText(value, max).replace(/朕/g, "臣");
}

function cleanTaskTitle(value) {
  return cleanText(value, 80)
    .replace(/^\s*[\[【]\s*(?:main|daily|explore|delay|mystic)\s*[\]】]\s*[:：\-–—]?\s*/i, "")
    .trim();
}

function cleanTask(task, fallbackCategory) {
  const category = CATEGORIES.includes(task?.cat) ? task.cat : fallbackCategory;
  const economy = calculateTaskEconomy(task, category);
  return {
    title: cleanTaskTitle(task?.title) || "推进此事的第一步",
    cat: category,
    durationMinutes: economy.durationMinutes,
    energyTier: economy.energyTier,
    energy: economy.energy,
    gold: economy.gold,
    restore: economy.restore
  };
}

function cleanPath(path, category) {
  return {
    label: cleanText(path?.label, 80),
    text: cleanText(path?.text, 600),
    tasks: (Array.isArray(path?.tasks) ? path.tasks : []).slice(0, 4).map((task) => cleanTask(task, category))
  };
}

function clampNumber(value, min, max, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
}

function cleanNpcDetection(value, paths) {
  const seen = new Set();
  const candidates = (Array.isArray(value?.candidates) ? value.candidates : []).slice(0, 8).map((candidate) => {
    const displayName = cleanText(candidate?.displayName, 60);
    if (!displayName) return null;
    const key = displayName.toLowerCase().replace(/\s+/g, "");
    if (seen.has(key)) return null;
    seen.add(key);

    const role = NPC_ROLES.includes(candidate?.role) ? candidate.role : "unknown";
    const identityStatus = ["auto_created", "confirmed", "ambiguous"].includes(candidate?.identityStatus)
      ? candidate.identityStatus
      : (candidate?.existingNpcId ? "confirmed" : "auto_created");
    const relationship = candidate?.relationship || {};
    const stance = NPC_STANCES.includes(relationship.stance) ? relationship.stance : "unknown";
    const aliases = (Array.isArray(candidate?.aliases) ? candidate.aliases : [])
      .slice(0, 8)
      .map((alias) => cleanText(alias, 60))
      .filter((alias) => alias && alias !== displayName);
    const taskLinks = (Array.isArray(candidate?.taskLinks) ? candidate.taskLinks : []).slice(0, 8).map((link) => {
      const path = link?.path === "alt" ? "alt" : "recommend";
      const tasks = Array.isArray(paths?.[path]?.tasks) ? paths[path].tasks : [];
      const taskIndex = Math.floor(Number(link?.taskIndex));
      if (!Number.isFinite(taskIndex) || taskIndex < 0 || taskIndex >= tasks.length) return null;
      return {
        path,
        taskIndex,
        relation: NPC_TASK_RELATIONS.includes(link?.relation) ? link.relation : "mentioned",
        reason: cleanText(link?.reason, 240),
        confidence: clampNumber(link?.confidence, 0, 1, 0.5)
      };
    }).filter(Boolean);
    if (!taskLinks.length) return null;

    return {
      existingNpcId: cleanText(candidate?.existingNpcId, 80),
      displayName,
      title: cleanText(candidate?.title, 80),
      aliases,
      role,
      identityStatus,
      identityConfidence: clampNumber(candidate?.identityConfidence, 0, 1, 0.5),
      relationship: {
        stance,
        stanceConfidence: clampNumber(relationship.stanceConfidence, 0, 1, stance === "unknown" ? 0.2 : 0.45),
        inferenceReason: cleanText(relationship.inferenceReason, 240),
        trust: clampNumber(relationship.trust, -100, 100),
        influence: clampNumber(relationship.influence, 0, 100),
        alignment: clampNumber(relationship.alignment, -100, 100),
        conflict: clampNumber(relationship.conflict, 0, 100),
        familiarity: clampNumber(relationship.familiarity, 0, 100)
      },
      taskLinks
    };
  }).filter(Boolean);
  return {
    hasRelevantPeople: candidates.length > 0,
    candidates
  };
}

export function normalizeDecisionResponse(value) {
  const type = ["dialogue", "question", "decision"].includes(value?.type) ? value.type : "dialogue";
  const result = {
    type,
    topic: cleanText(value?.topic, 80) || "御前议事",
    message: cleanMinisterSpeech(value?.message, 800),
    question: null,
    decision: null
  };
  if (type === "question") {
    const options = (Array.isArray(value?.question?.options) ? value.question.options : []).slice(0, 3);
    result.question = {
      q: cleanMinisterSpeech(value?.question?.q, 240) || "这件事眼下最重要的约束是什么？",
      options: options.map((option) => ({ text: cleanText(option?.text, 100), tag: cleanText(option?.tag, 40) }))
    };
  }
  if (type === "decision") {
    const category = CATEGORIES.includes(value?.decision?.category) ? value.decision.category : "daily";
    result.decision = {
      category,
      title: cleanTaskTitle(value?.decision?.title) || "御前决策",
      summary: cleanText(value?.decision?.summary, 500),
      mirror: {
        invest: cleanText(value?.decision?.mirror?.invest, 120),
        reward: cleanText(value?.decision?.mirror?.reward, 120),
        cost: cleanText(value?.decision?.mirror?.cost, 120)
      },
      recommend: cleanPath(value?.decision?.recommend, category),
      alt: value?.decision?.alt ? cleanPath(value.decision.alt, category) : null,
      sources: (Array.isArray(value?.decision?.sources) ? value.decision.sources : []).slice(0, 5).map((s) => cleanText(s, 100)).filter(Boolean),
      npcDetection: { hasRelevantPeople: false, candidates: [] }
    };
    if (!result.decision.recommend.tasks.length) {
      result.decision.recommend.tasks.push(cleanTask({}, category));
    }
    result.decision.npcDetection = cleanNpcDetection(value?.decision?.npcDetection, {
      recommend: result.decision.recommend,
      alt: result.decision.alt
    });
  }
  return result;
}
