import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildRuntimePackage } from "../scripts/build-sop-runtime.mjs";
import { retrieveSopCandidates } from "../api/_lib/sop-retrieval.js";

const PILOT_IDS = [
  "SOP_KEY_PEOPLE_01",
  "SOP_QUESTION_LOOP_01",
  "SOP_SKILL_GAP_03",
  "SOP_NEXT_90D_04"
];

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"));
}

async function sourceInputs() {
  const [library, taxonomy, holdout, safety] = await Promise.all([
    readJson("../sop/04-职场新人SOP库.json"),
    readJson("../sop/data/career-taxonomy.v2.2.json"),
    readJson("../sop/08-首批ACTIVE模块HOLDOUT测试案例.json"),
    readJson("../sop/09-首批ACTIVE模块SAFETY测试案例.json")
  ]);
  return { library, taxonomy, holdout, safety };
}

function prospectivePilot(library) {
  return {
    ...library,
    version: "2.4.0-active-pilot",
    status: "ACTIVE",
    modules: library.modules.map((module) => ({
      ...module,
      status: PILOT_IDS.includes(module.sop_id) ? "ACTIVE" : "REVIEWED"
    }))
  };
}

test("project owns the complete 22-module source library and keeps it REVIEWED before release approval", async () => {
  const { library } = await sourceInputs();
  assert.equal(library.modules.length, 22);
  assert.equal(new Set(library.modules.map((module) => module.sop_id)).size, 22);
  assert.deepEqual(library.modules.filter((module) => module.status === "ACTIVE"), []);
  assert.ok(PILOT_IDS.every((id) => library.modules.some((module) => module.sop_id === id && module.status === "REVIEWED")));
});

test("prospective release contains exactly the four approved pilot modules", async () => {
  const { library, taxonomy } = await sourceInputs();
  const runtime = buildRuntimePackage(prospectivePilot(library), taxonomy);
  assert.equal(runtime.release_status, "ACTIVE");
  assert.equal(runtime.module_count, 4);
  assert.deepEqual(runtime.modules.map((module) => module.sop_id).sort(), [...PILOT_IDS].sort());
  assert.ok(runtime.modules.every((module) => module.status === "ACTIVE"));
});

for (const suiteName of ["holdout", "safety"]) {
  test(`${suiteName} base, wrong-stage and exclusion retrieval gates pass locally`, async () => {
    const inputs = await sourceInputs();
    const runtime = buildRuntimePackage(prospectivePilot(inputs.library), inputs.taxonomy);
    for (const testCase of inputs[suiteName].cases) {
      const base = retrieveSopCandidates({
        message: testCase.user_input,
        journeyStage: testCase.profile.journey_stage,
        runtimePackage: runtime
      });
      assert.ok(base.some((module) => module.sop_id === testCase.target_sop_id), `${testCase.case_id} base must retrieve target`);

      const wrongStage = retrieveSopCandidates({
        message: testCase.user_input,
        journeyStage: testCase.variants.wrong_stage.profile_override.journey_stage,
        runtimePackage: runtime
      });
      assert.ok(!wrongStage.some((module) => module.sop_id === testCase.target_sop_id), `${testCase.case_id} wrong stage must exclude target`);

      const exclusion = retrieveSopCandidates({
        message: testCase.variants.exclusion.user_input,
        journeyStage: testCase.profile.journey_stage,
        runtimePackage: runtime
      });
      assert.ok(!exclusion.some((module) => module.sop_id === testCase.target_sop_id), `${testCase.case_id} exclusion must exclude target`);
    }
  });
}

test("all low-capacity variants preserve eligibility while imposing a smaller positive cap", async () => {
  const { holdout, safety } = await sourceInputs();
  for (const testCase of [...holdout.cases, ...safety.cases]) {
    const baseMinutes = testCase.profile.availability[0].minutes;
    const lowMinutes = testCase.variants.low_capacity.profile_override.availability[0].minutes;
    assert.ok(lowMinutes > 0 && lowMinutes < baseMinutes, `${testCase.case_id} must lower capacity`);
    assert.equal(testCase.variants.low_capacity.expected.target_sop_eligibility, "UNCHANGED_UNLESS_OTHER_FACTS_CHANGE");
    assert.ok(testCase.variants.low_capacity.expected.allowed_capacity_adaptations.every((value) =>
      ["TRIM", "SPLIT", "RESCHEDULE", "ASK_ONE_CAPACITY_QUESTION"].includes(value)
    ));
  }
});
