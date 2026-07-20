#!/usr/bin/env python3
"""Validate 女皇入朝 newcomer SOP libraries and candidate packages."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

MODULE_FIELDS = [
    "sop_id",
    "version",
    "status",
    "title",
    "career_phase",
    "journey_stages",
    "primary_topic",
    "secondary_topics",
    "supported_intents",
    "content_priority",
    "retrieval_tags",
    "recommendation_priority",
    "applicable_when",
    "not_applicable_when",
    "estimated_minutes",
    "tasks",
]
TASK_FIELDS = ["action", "duration_minutes", "done_criteria"]
RUNTIME_STATUSES = {"MIGRATED_DRAFT", "REVIEWED", "ACTIVE", "RETIRED"}
CANDIDATE_STATUSES = RUNTIME_STATUSES | {"DRAFT"}
RECOMMENDATION_PRIORITIES = {"REQUIRED_CANDIDATE", "OPTIONAL", "CONDITIONAL"}
CONTENT_PRIORITIES = {"core", "extended", "secondary", "event_only", "routing_only"}
RETRIEVAL_STATUSES = {"MATCHED", "NO_MATCH"}
SCOPE_STATUSES = {"IN_SCOPE", "OUT_OF_SCOPE", "ESCALATE"}
ORDINARY_DECISIONS = {"EXECUTE", "ARCHIVE", "RESPOND_ONLY"}
ROUTES = {"ORDINARY", "SPECIAL_PROCESS", "EVENT_ROUTE"}
CLARIFICATION_STATES = {"REQUIRED", "OPTIONAL", "NOT_REQUIRED"}
CAPACITY_ADAPTATIONS = {
    "NONE",
    "TRIM",
    "SPLIT",
    "RESCHEDULE",
    "ASK_ONE_CAPACITY_QUESTION",
}
FORBIDDEN_KEYS = {
    "source_ids",
    "evidence_level",
    "sources",
    "references",
    "source_notes",
    "author",
    "authors",
    "platform",
    "url",
    "urls",
    "citation",
    "citations",
}
SNAKE_CASE = re.compile(r"^[a-z][a-z0-9_]*$")


def load_json(path: str) -> Any:
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"Cannot read JSON {path}: {exc}") from exc


def add_error(errors: list[str], location: str, message: str) -> None:
    errors.append(f"{location}: {message}")


def walk_forbidden(value: Any, location: str, errors: list[str]) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if key.lower() in FORBIDDEN_KEYS:
                add_error(errors, location, f"forbidden field '{key}'")
            walk_forbidden(child, f"{location}.{key}", errors)
    elif isinstance(value, list):
        for index, child in enumerate(value):
            walk_forbidden(child, f"{location}[{index}]", errors)


def require_string(value: Any, location: str, errors: list[str]) -> bool:
    if not isinstance(value, str) or not value.strip():
        add_error(errors, location, "must be a non-empty string")
        return False
    return True


def require_string_list(
    value: Any,
    location: str,
    errors: list[str],
    *,
    minimum: int = 0,
    maximum: int | None = None,
) -> bool:
    if not isinstance(value, list) or any(not isinstance(item, str) or not item.strip() for item in value):
        add_error(errors, location, "must be an array of non-empty strings")
        return False
    if len(value) < minimum:
        add_error(errors, location, f"must contain at least {minimum} item(s)")
    if maximum is not None and len(value) > maximum:
        add_error(errors, location, f"must contain at most {maximum} item(s)")
    if len(set(value)) != len(value):
        add_error(errors, location, "must not contain duplicates")
    return True


def validate_module(
    module: Any,
    location: str,
    taxonomy: dict[str, Any],
    errors: list[str],
    warnings: list[str],
    *,
    allow_draft: bool,
) -> None:
    if not isinstance(module, dict):
        add_error(errors, location, "must be an object")
        return

    actual_fields = list(module.keys())
    missing = [field for field in MODULE_FIELDS if field not in module]
    extra = [field for field in actual_fields if field not in MODULE_FIELDS]
    if missing:
        add_error(errors, location, f"missing fields: {', '.join(missing)}")
    if extra:
        add_error(errors, location, f"unknown fields: {', '.join(extra)}")
    if not missing and not extra and actual_fields != MODULE_FIELDS:
        warnings.append(f"{location}: field order differs from the frozen write order")

    for field in ["sop_id", "version", "status", "title", "career_phase", "primary_topic"]:
        if field in module:
            require_string(module[field], f"{location}.{field}", errors)

    allowed_statuses = CANDIDATE_STATUSES if allow_draft else RUNTIME_STATUSES
    if module.get("status") not in allowed_statuses:
        add_error(errors, f"{location}.status", f"must be one of {sorted(allowed_statuses)}")

    phase = module.get("career_phase")
    stage_map = taxonomy.get("journey_stages", {})
    allowed_stages = stage_map.get(phase, []) if isinstance(stage_map, dict) else []
    if require_string_list(module.get("journey_stages"), f"{location}.journey_stages", errors, minimum=1):
        invalid_stages = sorted(set(module["journey_stages"]) - set(allowed_stages))
        if invalid_stages:
            add_error(errors, f"{location}.journey_stages", f"unknown for phase {phase}: {invalid_stages}")

    topic_ids = {
        topic.get("id")
        for topic in taxonomy.get("topics", [])
        if isinstance(topic, dict) and isinstance(topic.get("id"), str)
    }
    primary_topic = module.get("primary_topic")
    if primary_topic not in topic_ids:
        add_error(errors, f"{location}.primary_topic", f"unknown topic '{primary_topic}'")

    if require_string_list(
        module.get("secondary_topics"),
        f"{location}.secondary_topics",
        errors,
        maximum=2,
    ):
        invalid_topics = sorted(set(module["secondary_topics"]) - topic_ids)
        if invalid_topics:
            add_error(errors, f"{location}.secondary_topics", f"unknown topics: {invalid_topics}")
        if primary_topic in module["secondary_topics"]:
            add_error(errors, f"{location}.secondary_topics", "must not repeat primary_topic")

    intent_ids = set(taxonomy.get("intents", []))
    if require_string_list(
        module.get("supported_intents"),
        f"{location}.supported_intents",
        errors,
        minimum=1,
        maximum=3,
    ):
        invalid_intents = sorted(set(module["supported_intents"]) - intent_ids)
        if invalid_intents:
            add_error(errors, f"{location}.supported_intents", f"unknown intents: {invalid_intents}")

    if module.get("content_priority") not in CONTENT_PRIORITIES:
        add_error(
            errors,
            f"{location}.content_priority",
            f"must be one of {sorted(CONTENT_PRIORITIES)}",
        )

    tags = module.get("retrieval_tags")
    if require_string_list(tags, f"{location}.retrieval_tags", errors):
        invalid_tags = [tag for tag in tags if not SNAKE_CASE.fullmatch(tag)]
        if invalid_tags:
            add_error(errors, f"{location}.retrieval_tags", f"not lower snake_case: {invalid_tags}")

    if module.get("recommendation_priority") not in RECOMMENDATION_PRIORITIES:
        add_error(
            errors,
            f"{location}.recommendation_priority",
            f"must be one of {sorted(RECOMMENDATION_PRIORITIES)}",
        )

    require_string_list(
        module.get("applicable_when"),
        f"{location}.applicable_when",
        errors,
        minimum=1,
    )
    require_string_list(
        module.get("not_applicable_when"),
        f"{location}.not_applicable_when",
        errors,
        minimum=1,
    )

    estimate = module.get("estimated_minutes")
    if estimate is not None and (not isinstance(estimate, int) or isinstance(estimate, bool) or estimate <= 0):
        add_error(errors, f"{location}.estimated_minutes", "must be a positive integer or null")

    tasks = module.get("tasks")
    if not isinstance(tasks, list) or not 1 <= len(tasks) <= 5:
        add_error(errors, f"{location}.tasks", "must contain 1 to 5 tasks")
    else:
        for index, task in enumerate(tasks):
            task_location = f"{location}.tasks[{index}]"
            if not isinstance(task, dict):
                add_error(errors, task_location, "must be an object")
                continue
            task_fields = list(task.keys())
            missing_task = [field for field in TASK_FIELDS if field not in task]
            extra_task = [field for field in task_fields if field not in TASK_FIELDS]
            if missing_task:
                add_error(errors, task_location, f"missing fields: {', '.join(missing_task)}")
            if extra_task:
                add_error(errors, task_location, f"unknown fields: {', '.join(extra_task)}")
            if not missing_task and not extra_task and task_fields != TASK_FIELDS:
                warnings.append(f"{task_location}: field order differs from frozen write order")
            require_string(task.get("action"), f"{task_location}.action", errors)
            require_string(task.get("done_criteria"), f"{task_location}.done_criteria", errors)
            duration = task.get("duration_minutes")
            if duration is not None and (
                not isinstance(duration, int) or isinstance(duration, bool) or duration <= 0
            ):
                add_error(errors, f"{task_location}.duration_minutes", "must be positive integer or null")


def bigrams(text: str) -> set[str]:
    normalized = re.sub(r"\s+", "", text.lower())
    return {normalized[index : index + 2] for index in range(max(0, len(normalized) - 1))}


def jaccard(left: set[str], right: set[str]) -> float:
    union = left | right
    return len(left & right) / len(union) if union else 0.0


def duplicate_warnings(candidate: dict[str, Any], modules: list[dict[str, Any]]) -> list[str]:
    warnings: list[str] = []
    candidate_stages = set(candidate.get("journey_stages", []))
    candidate_tags = set(candidate.get("retrieval_tags", []))
    candidate_title = bigrams(candidate.get("title", ""))
    candidate_intents = set(candidate.get("supported_intents", []))

    for module in modules:
        if module.get("sop_id") == candidate.get("sop_id"):
            continue
        same_topic = module.get("primary_topic") == candidate.get("primary_topic")
        stage_overlap = bool(candidate_stages & set(module.get("journey_stages", [])))
        tag_score = jaccard(candidate_tags, set(module.get("retrieval_tags", [])))
        title_score = jaccard(candidate_title, bigrams(module.get("title", "")))
        intent_overlap = bool(candidate_intents & set(module.get("supported_intents", [])))
        if same_topic and stage_overlap and intent_overlap and (tag_score >= 0.5 or title_score >= 0.45):
            warnings.append(
                "possible overlap with "
                f"{module.get('sop_id')}: tag_jaccard={tag_score:.2f}, "
                f"title_bigram_jaccard={title_score:.2f}"
            )
    return warnings


def validate_test_case(
    test_case: Any,
    module: dict[str, Any],
    errors: list[str],
) -> None:
    location = "candidate.test_case"
    if not isinstance(test_case, dict):
        add_error(errors, location, "must be an object")
        return
    target = module.get("sop_id")
    if test_case.get("target_sop_id") != target:
        add_error(errors, f"{location}.target_sop_id", f"must equal {target}")

    profile = test_case.get("profile", {})
    if profile.get("career_phase") != module.get("career_phase"):
        add_error(errors, f"{location}.profile.career_phase", "must match proposed module")
    if profile.get("journey_stage") not in module.get("journey_stages", []):
        add_error(errors, f"{location}.profile.journey_stage", "must be compatible with proposed module")

    expected = test_case.get("expected", {})
    if expected.get("primary_topic") != module.get("primary_topic"):
        add_error(errors, f"{location}.expected.primary_topic", "must match proposed module")
    if expected.get("primary_intent") not in module.get("supported_intents", []):
        add_error(errors, f"{location}.expected.primary_intent", "must be supported by proposed module")
    if target not in expected.get("allowed_sop_ids", []):
        add_error(errors, f"{location}.expected.allowed_sop_ids", "must include target SOP")

    variants = test_case.get("variants")
    if not isinstance(variants, dict) or set(variants) != {"wrong_stage", "exclusion", "low_capacity"}:
        add_error(errors, f"{location}.variants", "must contain wrong_stage, exclusion, and low_capacity")
        return

    wrong_stage = variants.get("wrong_stage", {}).get("profile_override", {}).get("journey_stage")
    if wrong_stage in module.get("journey_stages", []):
        add_error(errors, f"{location}.variants.wrong_stage", "stage must be incompatible")

    for variant_name in ["wrong_stage", "exclusion"]:
        retrieval = variants.get(variant_name, {}).get("expected", {}).get("target_sop_retrieval")
        if retrieval != "FORBIDDEN":
            add_error(
                errors,
                f"{location}.variants.{variant_name}.expected.target_sop_retrieval",
                "must be FORBIDDEN",
            )

    exclusion_expected = variants.get("exclusion", {}).get("expected", {})
    if isinstance(exclusion_expected, dict):
        if "allowed_outcomes" in exclusion_expected:
            add_error(
                errors,
                f"{location}.variants.exclusion.expected.allowed_outcomes",
                "is forbidden; split outcome layers",
            )
        required_exclusion_fields = {
            "allowed_retrieval_statuses",
            "scope_status",
            "allowed_decisions",
            "route",
            "clarification",
            "allowed_capacity_adaptations",
        }
        missing_exclusion_fields = sorted(required_exclusion_fields - set(exclusion_expected))
        if missing_exclusion_fields:
            add_error(
                errors,
                f"{location}.variants.exclusion.expected",
                f"missing split outcome fields: {missing_exclusion_fields}",
            )

    low_capacity_expected = variants.get("low_capacity", {}).get("expected", {})
    if isinstance(low_capacity_expected, dict):
        adaptations = low_capacity_expected.get("allowed_capacity_adaptations")
        if not isinstance(adaptations, list) or not adaptations:
            add_error(
                errors,
                f"{location}.variants.low_capacity.expected.allowed_capacity_adaptations",
                "must be a non-empty array",
            )
        elif set(adaptations) - CAPACITY_ADAPTATIONS:
            add_error(
                errors,
                f"{location}.variants.low_capacity.expected.allowed_capacity_adaptations",
                f"unknown values: {sorted(set(adaptations) - CAPACITY_ADAPTATIONS)}",
            )

    base_capacity = None
    availability = profile.get("availability", [])
    if availability and isinstance(availability[0], dict):
        base_capacity = availability[0].get("minutes")
    low_capacity = (
        variants.get("low_capacity", {})
        .get("profile_override", {})
        .get("availability", [{}])[0]
        .get("minutes")
    )
    if not isinstance(base_capacity, int) or not isinstance(low_capacity, int) or low_capacity >= base_capacity:
        add_error(errors, f"{location}.variants.low_capacity", "must lower available minutes")


def validate_test_suite_contract(
    test_suite: dict[str, Any],
    taxonomy: dict[str, Any],
    errors: list[str],
) -> None:
    contract = test_suite.get("outcome_contract")
    if not isinstance(contract, dict):
        add_error(errors, "tests.outcome_contract", "must be an object")
        return

    expected_contract = {
        "retrieval_statuses": RETRIEVAL_STATUSES,
        "scope_statuses": set(taxonomy.get("scope_statuses", [])),
        "ordinary_decisions": set(taxonomy.get("ordinary_decisions", [])),
        "routes": ROUTES,
        "clarification_states": CLARIFICATION_STATES,
        "capacity_adaptations": CAPACITY_ADAPTATIONS,
    }
    for field, required_values in expected_contract.items():
        actual_values = contract.get(field)
        if not isinstance(actual_values, list) or set(actual_values) != required_values:
            add_error(
                errors,
                f"tests.outcome_contract.{field}",
                f"must contain exactly {sorted(required_values)}",
            )

    test_cases = test_suite.get("cases", [])
    if not isinstance(test_cases, list):
        return
    for index, case in enumerate(test_cases):
        if not isinstance(case, dict):
            continue
        location = f"tests.cases[{index}]"
        base_expected = case.get("expected", {})
        if isinstance(base_expected, dict):
            invalid_base_decisions = set(base_expected.get("allowed_decisions", [])) - expected_contract[
                "ordinary_decisions"
            ]
            if invalid_base_decisions:
                add_error(
                    errors,
                    f"{location}.expected.allowed_decisions",
                    f"unknown decisions: {sorted(invalid_base_decisions)}",
                )

        variants = case.get("variants", {})
        exclusion = variants.get("exclusion", {}).get("expected", {}) if isinstance(variants, dict) else {}
        if not isinstance(exclusion, dict):
            add_error(errors, f"{location}.variants.exclusion.expected", "must be an object")
            continue
        if "allowed_outcomes" in exclusion:
            add_error(
                errors,
                f"{location}.variants.exclusion.expected.allowed_outcomes",
                "is forbidden; split retrieval, scope, decision, route, clarification, and capacity",
            )
        required_fields = {
            "allowed_retrieval_statuses",
            "scope_status",
            "allowed_decisions",
            "route",
            "clarification",
            "allowed_capacity_adaptations",
        }
        missing_fields = sorted(required_fields - set(exclusion))
        if missing_fields:
            add_error(
                errors,
                f"{location}.variants.exclusion.expected",
                f"missing split outcome fields: {missing_fields}",
            )
            continue

        value_checks = [
            ("allowed_retrieval_statuses", RETRIEVAL_STATUSES),
            ("allowed_decisions", expected_contract["ordinary_decisions"]),
            ("allowed_capacity_adaptations", CAPACITY_ADAPTATIONS),
        ]
        for field, allowed in value_checks:
            values = exclusion.get(field)
            if not isinstance(values, list):
                add_error(errors, f"{location}.variants.exclusion.expected.{field}", "must be an array")
                continue
            invalid = set(values) - allowed
            if invalid:
                add_error(
                    errors,
                    f"{location}.variants.exclusion.expected.{field}",
                    f"unknown values: {sorted(invalid)}",
                )

        scalar_checks = [
            ("scope_status", expected_contract["scope_statuses"]),
            ("route", ROUTES),
            ("clarification", CLARIFICATION_STATES),
        ]
        for field, allowed in scalar_checks:
            if exclusion.get(field) not in allowed:
                add_error(
                    errors,
                    f"{location}.variants.exclusion.expected.{field}",
                    f"must be one of {sorted(allowed)}",
                )

        if exclusion.get("scope_status") == "ESCALATE" and exclusion.get("allowed_decisions"):
            add_error(
                errors,
                f"{location}.variants.exclusion.expected.allowed_decisions",
                "must be empty when scope_status is ESCALATE",
            )
        if exclusion.get("route") == "SPECIAL_PROCESS" and exclusion.get("scope_status") != "ESCALATE":
            add_error(
                errors,
                f"{location}.variants.exclusion.expected.scope_status",
                "must be ESCALATE for SPECIAL_PROCESS",
            )

        low_capacity_expected = (
            variants.get("low_capacity", {}).get("expected", {}) if isinstance(variants, dict) else {}
        )
        if isinstance(low_capacity_expected, dict):
            adaptations = low_capacity_expected.get("allowed_capacity_adaptations")
            if not isinstance(adaptations, list) or not adaptations:
                add_error(
                    errors,
                    f"{location}.variants.low_capacity.expected.allowed_capacity_adaptations",
                    "must be a non-empty array",
                )
            elif set(adaptations) - CAPACITY_ADAPTATIONS:
                add_error(
                    errors,
                    f"{location}.variants.low_capacity.expected.allowed_capacity_adaptations",
                    f"unknown values: {sorted(set(adaptations) - CAPACITY_ADAPTATIONS)}",
                )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--library", required=True)
    parser.add_argument("--taxonomy", required=True)
    parser.add_argument("--candidate")
    parser.add_argument("--tests")
    args = parser.parse_args()

    errors: list[str] = []
    warnings: list[str] = []

    try:
        library = load_json(args.library)
        taxonomy = load_json(args.taxonomy)
        candidate_package = load_json(args.candidate) if args.candidate else None
        test_suite = load_json(args.tests) if args.tests else None
    except ValueError as exc:
        print(json.dumps({"ok": False, "errors": [str(exc)], "warnings": []}, ensure_ascii=False, indent=2))
        return 1

    walk_forbidden(library, "library", errors)
    modules = library.get("modules") if isinstance(library, dict) else None
    if not isinstance(modules, list):
        add_error(errors, "library.modules", "must be an array")
        modules = []

    ids: list[str] = []
    for index, module in enumerate(modules):
        validate_module(
            module,
            f"library.modules[{index}]",
            taxonomy,
            errors,
            warnings,
            allow_draft=False,
        )
        if isinstance(module, dict) and isinstance(module.get("sop_id"), str):
            ids.append(module["sop_id"])
    duplicates = sorted({sop_id for sop_id in ids if ids.count(sop_id) > 1})
    if duplicates:
        add_error(errors, "library.modules", f"duplicate SOP IDs: {duplicates}")

    candidate_id = None
    if candidate_package is not None:
        walk_forbidden(candidate_package, "candidate", errors)
        if not isinstance(candidate_package, dict):
            add_error(errors, "candidate", "must be an object")
        else:
            candidate = candidate_package.get("proposed_module")
            if isinstance(candidate, dict):
                candidate_id = candidate.get("sop_id")
                validate_module(
                    candidate,
                    "candidate.proposed_module",
                    taxonomy,
                    errors,
                    warnings,
                    allow_draft=True,
                )
                if candidate_id in ids:
                    add_error(errors, "candidate.proposed_module.sop_id", "already exists in library")
                warnings.extend(duplicate_warnings(candidate, modules))
                validate_test_case(candidate_package.get("test_case"), candidate, errors)
            else:
                add_error(errors, "candidate.proposed_module", "must be an object")

    test_count = 0
    missing_test_targets: list[str] = []
    if test_suite is not None:
        walk_forbidden(test_suite, "tests", errors)
        if isinstance(test_suite, dict):
            validate_test_suite_contract(test_suite, taxonomy, errors)
        test_cases = test_suite.get("cases") if isinstance(test_suite, dict) else None
        if not isinstance(test_cases, list):
            add_error(errors, "tests.cases", "must be an array")
        else:
            test_count = len(test_cases)
            case_ids = [
                case.get("case_id")
                for case in test_cases
                if isinstance(case, dict) and isinstance(case.get("case_id"), str)
            ]
            duplicate_case_ids = sorted(
                {case_id for case_id in case_ids if case_ids.count(case_id) > 1}
            )
            if duplicate_case_ids:
                add_error(errors, "tests.cases", f"duplicate case IDs: {duplicate_case_ids}")
            valid_targets = set(ids)
            if isinstance(candidate_id, str):
                valid_targets.add(candidate_id)
            missing_test_targets = sorted(
                {
                    case.get("target_sop_id")
                    for case in test_cases
                    if isinstance(case, dict)
                    and isinstance(case.get("target_sop_id"), str)
                    and case.get("target_sop_id") not in valid_targets
                }
            )
            if missing_test_targets:
                add_error(
                    errors,
                    "tests.cases",
                    f"target SOP IDs missing from library or candidate: {missing_test_targets}",
                )

    result = {
        "ok": not errors,
        "errors": errors,
        "warnings": warnings,
        "stats": {
            "library_modules": len(modules),
            "unique_library_ids": len(set(ids)),
            "candidate_sop_id": candidate_id,
            "test_cases": test_count,
            "missing_test_targets": missing_test_targets,
        },
    }
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0 if not errors else 1


if __name__ == "__main__":
    sys.exit(main())
