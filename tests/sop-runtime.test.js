import test from "node:test";
import assert from "node:assert/strict";
import { buildRuntimePackage } from "../scripts/build-sop-runtime.mjs";
import { retrieveSopCandidates } from "../api/_lib/sop-retrieval.js";

function moduleFixture(overrides) {
  return {
    sop_id: "SOP_FIXTURE",
    version: "1.0.0",
    status: "REVIEWED",
    title: "测试模块",
    career_phase: "posthire",
    journey_stages: ["DAY_1_7"],
    primary_topic: "onboarding_landing",
    secondary_topics: [],
    supported_intents: ["plan"],
    content_priority: "core",
    retrieval_tags: ["fixture"],
    recommendation_priority: "REQUIRED_CANDIDATE",
    applicable_when: ["用户需要测试"],
    not_applicable_when: ["测试条件不成立"],
    estimated_minutes: 10,
    tasks: [{ action: "完成测试动作", duration_minutes: 10, done_criteria: "测试动作已完成" }],
    ...overrides
  };
}

function sourceLibrary() {
  return {
    library_id: "workplace_newcomer_year_one",
    schema_version: "sop.v2.2",
    version: "2.3.0-reviewed",
    status: "MIGRATED_DRAFT",
    updated_at: "2026-07-19",
    modules: [
      moduleFixture({
        sop_id: "SOP_TOOL_FLOW_01",
        title: "跑通一个核心工具或流程",
        journey_stages: ["DAY_1_7"],
        retrieval_tags: ["tools", "workflow"],
        applicable_when: ["岗位需要使用新系统或流程"],
        not_applicable_when: ["系统权限尚未开通"]
      }),
      moduleFixture({
        sop_id: "SOP_ACHIEVEMENT_LOG_03",
        title: "开始记录成果证据",
        journey_stages: ["DAY_31_60", "DAY_61_90"],
        primary_topic: "performance_visibility",
        supported_intents: ["review"],
        retrieval_tags: ["achievement_log", "review"],
        applicable_when: ["已经产生交付、反馈或问题解决记录"],
        not_applicable_when: ["尚未产生任何工作成果"]
      })
    ]
  };
}

const taxonomy = {
  journey_stages: { posthire: ["DAY_1_7", "DAY_31_60", "DAY_61_90"] },
  topics: [{ id: "onboarding_landing" }, { id: "performance_visibility" }],
  intents: ["plan", "review"]
};

function reviewedFixtureAsActive() {
  const library = sourceLibrary();
  return {
    runtime_schema: "sop-runtime.v1",
    library_id: library.library_id,
    source_version: library.version,
    release_status: "ACTIVE",
    module_count: library.modules.length,
    selection_rules: { max_modules_per_retrieval: 3 },
    modules: library.modules.map((module) => ({ ...module, status: "ACTIVE" }))
  };
}

test("runtime build excludes REVIEWED modules until the library passes the ACTIVE gate", () => {
  const library = sourceLibrary();
  const runtime = buildRuntimePackage(library, taxonomy);

  assert.equal(runtime.release_status, "BLOCKED_NO_ACTIVE_MODULES");
  assert.equal(runtime.module_count, 0);
  assert.deepEqual(runtime.modules, []);
});

test("runtime build requires library-level ACTIVE before publishing modules", () => {
  const library = sourceLibrary();
  library.modules[0].status = "ACTIVE";

  assert.throws(() => buildRuntimePackage(library, taxonomy), /library must be ACTIVE/);
});

test("deterministic applicability gate blocks the two strict DEV exclusions", () => {
  const runtimePackage = reviewedFixtureAsActive();

  const noPermission = retrieveSopCandidates({
    message: "我要学习公司的核心系统，但账号权限还没有开通。",
    journeyStage: "DAY_1_7",
    runtimePackage
  });
  assert.equal(noPermission.some((module) => module.sop_id === "SOP_TOOL_FLOW_01"), false);

  const noAchievement = retrieveSopCandidates({
    message: "我刚入职，还没有完成任何交付、获得反馈或解决实际问题。",
    journeyStage: "DAY_31_60",
    runtimePackage
  });
  assert.equal(noAchievement.some((module) => module.sop_id === "SOP_ACHIEVEMENT_LOG_03"), false);
});

test("applicable modules remain retrievable after stage and exclusion checks", () => {
  const runtimePackage = reviewedFixtureAsActive();

  const tools = retrieveSopCandidates({
    message: "核心系统权限已经开通，岗位需要使用新系统，我想跑通一个高频工具流程。",
    journeyStage: "DAY_1_7",
    runtimePackage
  });
  assert.equal(tools.some((module) => module.sop_id === "SOP_TOOL_FLOW_01"), true);

  const achievements = retrieveSopCandidates({
    message: "我已经完成一次交付，也收到了反馈，想把这项工作整理成成果记录。",
    journeyStage: "DAY_31_60",
    runtimePackage
  });
  assert.equal(achievements.some((module) => module.sop_id === "SOP_ACHIEVEMENT_LOG_03"), true);

  const wrongStage = retrieveSopCandidates({
    message: "权限已经开通，我想跑通核心工具流程。",
    journeyStage: "DAY_61_90",
    runtimePackage
  });
  assert.equal(wrongStage.some((module) => module.sop_id === "SOP_TOOL_FLOW_01"), false);
  assert.ok(tools.length <= 3);
});
