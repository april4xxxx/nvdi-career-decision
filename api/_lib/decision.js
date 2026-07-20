export const CATEGORIES = ["main", "daily", "explore", "delay", "mystic"];

const taskSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    cat: { type: "string", enum: CATEGORIES },
    energy: { type: "number" },
    gold: { type: "number" },
    restore: { type: "number" }
  },
  required: ["title", "cat", "energy", "gold", "restore"]
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
            sources: { type: "array", items: { type: "string" } }
          },
          required: ["category", "title", "summary", "mirror", "recommend", "alt", "sources"]
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

function cleanTask(task, fallbackCategory) {
  const category = CATEGORIES.includes(task?.cat) ? task.cat : fallbackCategory;
  return {
    title: cleanText(task?.title, 80) || "推进此事的第一步",
    cat: category,
    energy: Math.max(-50, Math.min(50, Number(task?.energy) || 0)),
    gold: Math.max(0, Math.min(100, Number(task?.gold) || 0)),
    restore: Math.max(0, Math.min(50, Number(task?.restore) || 0))
  };
}

function cleanPath(path, category) {
  return {
    label: cleanText(path?.label, 80),
    text: cleanText(path?.text, 600),
    tasks: (Array.isArray(path?.tasks) ? path.tasks : []).slice(0, 4).map((task) => cleanTask(task, category))
  };
}

export function normalizeDecisionResponse(value) {
  const type = ["dialogue", "question", "decision"].includes(value?.type) ? value.type : "dialogue";
  const result = {
    type,
    topic: cleanText(value?.topic, 80) || "御前议事",
    message: cleanText(value?.message, 800),
    question: null,
    decision: null
  };
  if (type === "question") {
    const options = (Array.isArray(value?.question?.options) ? value.question.options : []).slice(0, 3);
    result.question = {
      q: cleanText(value?.question?.q, 240) || "这件事眼下最重要的约束是什么？",
      options: options.map((option) => ({ text: cleanText(option?.text, 100), tag: cleanText(option?.tag, 40) }))
    };
  }
  if (type === "decision") {
    const category = CATEGORIES.includes(value?.decision?.category) ? value.decision.category : "daily";
    result.decision = {
      category,
      title: cleanText(value?.decision?.title, 80) || "御前决策",
      summary: cleanText(value?.decision?.summary, 500),
      mirror: {
        invest: cleanText(value?.decision?.mirror?.invest, 120),
        reward: cleanText(value?.decision?.mirror?.reward, 120),
        cost: cleanText(value?.decision?.mirror?.cost, 120)
      },
      recommend: cleanPath(value?.decision?.recommend, category),
      alt: value?.decision?.alt ? cleanPath(value.decision.alt, category) : null,
      sources: (Array.isArray(value?.decision?.sources) ? value.decision.sources : []).slice(0, 5).map((s) => cleanText(s, 100)).filter(Boolean)
    };
    if (!result.decision.recommend.tasks.length) {
      result.decision.recommend.tasks.push(cleanTask({}, category));
    }
  }
  return result;
}
