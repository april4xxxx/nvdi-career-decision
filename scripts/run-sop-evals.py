#!/usr/bin/env python3
"""Run 女皇入朝 SOP DEV suites against a DeepSeek-compatible chat API."""

from __future__ import annotations

import argparse
import concurrent.futures
import copy
import datetime as dt
import hashlib
import json
import os
import pathlib
import random
import re
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import Counter, defaultdict
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


PROMPT_VERSION = "deepseek-sop-eval.v1.4"
DEFAULT_BASE_URL = "https://api.deepseek.com"
DEFAULT_MODEL = "deepseek-v4-pro"
PRINT_LOCK = threading.Lock()


def parse_args() -> argparse.Namespace:
    project_root = pathlib.Path(__file__).resolve().parents[3]
    docs_default = project_root / "女皇入朝-统一产品文档-V2.2"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--docs-dir", type=pathlib.Path, default=docs_default)
    parser.add_argument("--output-dir", type=pathlib.Path)
    parser.add_argument("--suite", choices=["both", "posthire", "job"], default="both")
    parser.add_argument("--variants", choices=["all", "base"], default="all")
    parser.add_argument("--case-id", action="append", default=[])
    parser.add_argument("--limit", type=int)
    parser.add_argument("--model", default=DEFAULT_MODEL)
    parser.add_argument("--judge-model")
    parser.add_argument("--judge", choices=["semantic", "off"], default="semantic")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--api-key-env", default="DEEPSEEK_API_KEY")
    parser.add_argument("--api-key-file", type=pathlib.Path)
    parser.add_argument("--max-workers", type=int, default=3)
    parser.add_argument("--timeout", type=int, default=120)
    parser.add_argument("--retries", type=int, default=2)
    parser.add_argument("--temperature", type=float, default=0.0)
    parser.add_argument("--max-tokens", type=int, default=2200)
    parser.add_argument("--judge-max-tokens", type=int, default=1200)
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--self-test", action="store_true")
    return parser.parse_args()


def read_json(path: pathlib.Path) -> Dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: pathlib.Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")


def append_jsonl(path: pathlib.Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(value, ensure_ascii=False) + "\n")


def file_sha256(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(65536), b""):
            digest.update(block)
    return digest.hexdigest()


def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    result = copy.deepcopy(base)
    for key, value in override.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = deep_merge(result[key], value)
        else:
            result[key] = copy.deepcopy(value)
    return result


def scenario_files(docs_dir: pathlib.Path, suite: str) -> List[Tuple[str, pathlib.Path, pathlib.Path]]:
    candidates = [
        ("posthire", docs_dir / "04-职场新人SOP库.json", docs_dir / "07-入职SOP测试案例.json"),
        ("job", docs_dir / "05-职场求职SOP库.json", docs_dir / "14-求职SOP测试案例.json"),
    ]
    return [item for item in candidates if suite == "both" or item[0] == suite]


def validate_inputs(items: Sequence[Tuple[str, pathlib.Path, pathlib.Path]], taxonomy_path: pathlib.Path) -> None:
    missing = [str(path) for _, library, tests in items for path in (library, tests) if not path.exists()]
    if not taxonomy_path.exists():
        missing.append(str(taxonomy_path))
    if missing:
        raise SystemExit("Missing input files:\n- " + "\n- ".join(missing))
    for label, library_path, tests_path in items:
        library = read_json(library_path)
        tests = read_json(tests_path)
        module_ids = [module["sop_id"] for module in library.get("modules", [])]
        target_ids = [case["target_sop_id"] for case in tests.get("cases", [])]
        if len(module_ids) != len(set(module_ids)):
            raise SystemExit("Duplicate SOP IDs in {}".format(library_path))
        if sorted(module_ids) != sorted(target_ids):
            raise SystemExit("Test targets do not exactly cover {} library".format(label))


def run_structural_preflight(
    project_root: pathlib.Path,
    items: Sequence[Tuple[str, pathlib.Path, pathlib.Path]],
    taxonomy_path: pathlib.Path,
) -> Dict[str, Any]:
    validator = project_root / "skills" / "build-newcomer-sop" / "scripts" / "validate_sop.py"
    if not validator.exists():
        raise SystemExit("Structural validator not found: {}".format(validator))
    results: Dict[str, Any] = {}
    for label, library_path, tests_path in items:
        process = subprocess.run(
            [
                sys.executable,
                str(validator),
                "--library", str(library_path),
                "--taxonomy", str(taxonomy_path),
                "--tests", str(tests_path),
            ],
            check=False,
            capture_output=True,
            text=True,
        )
        try:
            payload = json.loads(process.stdout)
        except json.JSONDecodeError:
            payload = {"ok": False, "errors": [process.stdout or process.stderr or "validator returned no JSON"]}
        results[label] = payload
        if process.returncode != 0 or not payload.get("ok"):
            raise SystemExit("Structural preflight failed for {}: {}".format(label, json.dumps(payload, ensure_ascii=False)))
    return results


def expand_scenarios(
    label: str,
    library_path: pathlib.Path,
    tests_path: pathlib.Path,
    variants: str,
    selected_case_ids: Sequence[str],
) -> Tuple[Dict[str, Any], Dict[str, Any], List[Dict[str, Any]]]:
    library = read_json(library_path)
    tests = read_json(tests_path)
    scenarios: List[Dict[str, Any]] = []
    for case in tests["cases"]:
        if selected_case_ids and case["case_id"] not in selected_case_ids:
            continue
        scenario_names = ["base"] if variants == "base" else ["base", "wrong_stage", "exclusion", "low_capacity"]
        for name in scenario_names:
            variant = {} if name == "base" else case["variants"][name]
            profile = deep_merge(case["profile"], variant.get("profile_override", {}))
            scenarios.append(
                {
                    "scenario_id": "{}::{}".format(case["case_id"], name),
                    "case_id": case["case_id"],
                    "case_family_id": case["case_family_id"],
                    "suite": label,
                    "variant": name,
                    "target_sop_id": case["target_sop_id"],
                    "profile": profile,
                    "user_input": variant.get("user_input", case["user_input"]),
                    "expected": copy.deepcopy(case["expected"] if name == "base" else variant["expected"]),
                    "base_expected": copy.deepcopy(case["expected"]),
                    "test_layers": case.get("test_layers", []),
                    "library_path": str(library_path),
                    "tests_path": str(tests_path),
                    "runtime_modules": copy.deepcopy(library["modules"]),
                }
            )
    return library, tests, scenarios


NEGATIVE_CUES = ["尚未", "还没有", "还没", "没有", "未开通", "未完成", "不存在", "无法", "不能", "不清楚", "缺少", "即将离职"]


def normalized_text(value: Any) -> str:
    return re.sub(r"[^a-z0-9\u3400-\u9fff]+", "", str(value or "").lower())


def text_terms(value: Any) -> List[str]:
    text = str(value or "").lower()
    result = re.findall(r"[a-z0-9]{2,}", text)
    for run in re.findall(r"[\u3400-\u9fff]+", text):
        if len(run) == 1:
            result.append(run)
        result.extend(run[index:index + 2] for index in range(len(run) - 1))
    return list(dict.fromkeys(result))


def condition_matches(message: str, condition: str) -> bool:
    if "权限" in condition and "开通" in condition and re.search(r"权限.{0,12}(尚未|还没有|还没|没有|未)开通", message):
        return True
    if "工作成果" in condition and re.search(r"(尚未|还没有|还没|没有).{0,18}(成果|交付|反馈|解决.{0,4}问题)", message):
        return True
    query = normalized_text(message)
    target = normalized_text(condition)
    if not query or not target:
        return False
    if target in query or (len(query) >= 8 and query in target):
        return True
    condition_terms = [term for term in text_terms(condition) if len(normalized_text(term)) > 1]
    if not condition_terms:
        return False
    ratio = sum(1 for term in condition_terms if normalized_text(term) in query) / len(condition_terms)
    condition_is_negative = any(cue in condition for cue in NEGATIVE_CUES)
    query_is_negative = any(cue in message for cue in NEGATIVE_CUES)
    return ratio >= 0.55 and (not condition_is_negative or query_is_negative)


def compact_library(library: Dict[str, Any], profile: Dict[str, Any], user_input: str) -> Dict[str, Any]:
    fields = [
        "sop_id", "title", "career_phase", "journey_stages", "primary_topic", "secondary_topics",
        "supported_intents", "content_priority", "recommendation_priority", "applicable_when",
        "not_applicable_when", "estimated_minutes", "tasks",
    ]
    compatible_modules = [
        module for module in library["modules"]
        if module.get("career_phase") == profile.get("career_phase")
        and profile.get("journey_stage") in module.get("journey_stages", [])
        and not any(condition_matches(user_input, condition) for condition in module.get("not_applicable_when", []))
    ]
    return {
        "library_id": library["library_id"],
        "version": library["version"],
        "max_returned_modules": library.get("selection_rules", {}).get("max_modules_per_retrieval", 3),
        "prefilter": {
            "career_phase": profile.get("career_phase"),
            "journey_stage": profile.get("journey_stage"),
            "rule": "Only phase-and-stage-compatible modules that did not hit not_applicable_when are supplied to the model.",
        },
        "modules": [{key: module.get(key) for key in fields} for module in compatible_modules],
    }


def system_prompt(library: Dict[str, Any], taxonomy: Dict[str, Any], profile: Dict[str, Any], user_input: str) -> str:
    output_contract = {
        "career_phase": "job_seeking|preboarding|posthire",
        "journey_stage": "echo the confirmed profile stage",
        "primary_topic": "taxonomy topic id",
        "secondary_topics": [],
        "primary_intent": "taxonomy intent id",
        "secondary_intents": [],
        "risk_level": "normal|caution|high|emergency",
        "scope_status": "IN_SCOPE|OUT_OF_SCOPE|ESCALATE",
        "decision": "EXECUTE|ARCHIVE|RESPOND_ONLY|null when scope is ESCALATE or OUT_OF_SCOPE",
        "route": "ORDINARY|SPECIAL_PROCESS|EVENT_ROUTE",
        "clarification": "REQUIRED|OPTIONAL|NOT_REQUIRED",
        "retrieval_status": "MATCHED|NO_MATCH",
        "matched_sop_ids": [],
        "capacity_adaptation": "NONE|TRIM|SPLIT|RESCHEDULE|ASK_ONE_CAPACITY_QUESTION",
        "tasks": [
            {
                "source_sop_id": "existing SOP id",
                "action": "user-controlled action",
                "duration_minutes": 15,
                "suggested_window": "time window or null",
                "done_criteria": "verifiable completion criterion",
            }
        ],
        "total_minutes": 15,
        "requires_user_confirmation": True,
        "task_pool_write": False,
        "direct_response": "",
        "reason_summary": "concise reason",
    }
    rules = """You are the neutral structured decision engine for 女皇入朝. Return one JSON object only.
The saved career_phase and journey_stage in the profile are confirmed facts: echo them and never switch libraries.
Classify the user's main goal, then apply scope and risk rules. Only EXECUTE may retrieve an SOP or return tasks.
The runtime has already removed phase-and-stage-incompatible modules. Select at most three SOP IDs, only from the supplied compatible library. A module must match applicable conditions and must not match any exclusion condition. Return NO_MATCH honestly.
Intent boundaries: requests for usable wording are communication_script; asking how to confirm, report, ask, or align something with a manager or colleague is also communication_script even if the user does not explicitly request a verbatim script. Requests for a reusable document structure are template; preparation for a specific event is prepare; examination of completed work or a period is review; only an immediate first step is next_action; a broader multi-step approach is plan.
RESPOND_ONLY means the user only needs an answer or the stated need is already satisfied; it returns NO_MATCH and no tasks. ARCHIVE means the user proposed spending effort and the correct judgment is that it is not worth doing now. Do not create unrelated proactive tasks merely because other modules exist.
Sensitive data governed by a company-designated secure process, company-prohibited AI use, data that cannot be anonymized or placed in an approved environment, harassment, discrimination, illegality, medical danger, or personal safety must use scope_status=ESCALATE, route=SPECIAL_PROCESS, decision=null, NO_MATCH, and no ordinary tasks. Promotion, transfer, layoff, resignation, and side-project requests remain IN_SCOPE but use route=EVENT_ROUTE and do not retrieve ordinary newcomer SOPs. For clear event-route action requests, clarification=OPTIONAL when extra details could improve the plan but are not required to choose the route.
SOP modules are candidate templates. Keep only the smallest relevant user-controlled tasks. Waiting for another person's reply is not a completion criterion.
Availability minutes are a hard cap, not a suggestion. Sum task durations before returning. Keep at most five tasks total and never exceed the available minutes. Every returned task duration must be a non-negative integer; scope an unbounded delivery into a bounded preparation action instead of returning null. If capacity is low, keep module eligibility stable but TRIM, SPLIT, RESCHEDULE, or ask one capacity question. If capacity_adaptation=ASK_ONE_CAPACITY_QUESTION, return tasks=[], total_minutes=0, and requires_user_confirmation=false. Never return the full plan together with that question. Never silently delete commitments.
Use capacity_adaptation=NONE only when no tasks are proposed or the complete relevant source plan already fits without adjustment. If any source task is omitted, shortened, split, or moved because of the cap, label the actual operation as TRIM, SPLIT, or RESCHEDULE rather than NONE. Do not ask a capacity question when the profile already provides enough information to make a safe bounded plan.
Tasks are proposals only. Always set task_pool_write=false. Set requires_user_confirmation=true when proposing tasks.
Role style and decision profile may change wording or granularity only; they cannot change facts, risk, decision, SOP applicability, or exclusions.
Do not invent company policy, motives, promotion probability, or career outcomes. Output valid JSON matching the example contract."""
    payload = {
        "prompt_version": PROMPT_VERSION,
        "allowed_taxonomy": {
            "career_phases": [item["id"] for item in taxonomy["career_phases"]],
            "journey_stages": taxonomy["journey_stages"],
            "topics": [item["id"] for item in taxonomy["topics"]],
            "intents": taxonomy["intents"],
            "risk_levels": taxonomy["risk_levels"],
            "scope_statuses": taxonomy["scope_statuses"],
            "ordinary_decisions": taxonomy["ordinary_decisions"],
        },
        "output_json_example": output_contract,
        "runtime_library": compact_library(library, profile, user_input),
    }
    return rules + "\n\nREFERENCE JSON:\n" + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def user_prompt(scenario: Dict[str, Any]) -> str:
    payload = {
        "profile": scenario["profile"],
        "user_input": scenario["user_input"],
        "instruction": "Process this synthetic DEV case and return the structured JSON result. Do not assume user confirmation.",
    }
    return "INPUT JSON:\n" + json.dumps(payload, ensure_ascii=False, separators=(",", ":"))


def load_api_key(args: argparse.Namespace) -> Optional[str]:
    value = os.environ.get(args.api_key_env, "").strip()
    if value:
        return value
    candidates: List[pathlib.Path] = []
    if args.api_key_file:
        candidates.append(args.api_key_file)
    candidates.append(args.docs_dir.parent / ".env.deepseek")
    for path in candidates:
        if not path.exists():
            continue
        text = path.read_text(encoding="utf-8").strip()
        for line in text.splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue
            if "=" in stripped:
                key, candidate = stripped.split("=", 1)
                if key.strip() == args.api_key_env and candidate.strip():
                    return candidate.strip().strip('"').strip("'")
            elif stripped:
                return stripped
    return None


def api_endpoint(base_url: str) -> str:
    return base_url.rstrip("/") + "/chat/completions"


def call_chat(
    api_key: str,
    base_url: str,
    model: str,
    messages: List[Dict[str, str]],
    temperature: float,
    max_tokens: int,
    timeout: int,
    retries: int,
) -> Dict[str, Any]:
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "temperature": temperature,
        "max_tokens": max_tokens,
        "response_format": {"type": "json_object"},
        "thinking": {"type": "disabled"},
    }
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    last_error: Optional[Exception] = None
    for attempt in range(retries + 1):
        request = urllib.request.Request(
            api_endpoint(base_url),
            data=body,
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer {}".format(api_key),
            },
            method="POST",
        )
        try:
            started = time.monotonic()
            with urllib.request.urlopen(request, timeout=timeout) as response:
                response_body = response.read().decode("utf-8")
            envelope = json.loads(response_body)
            choice = envelope["choices"][0]
            content = choice["message"].get("content")
            if not content or not content.strip():
                raise ValueError("DeepSeek returned empty content")
            parsed = json.loads(content)
            return {
                "parsed": parsed,
                "finish_reason": choice.get("finish_reason"),
                "usage": envelope.get("usage", {}),
                "model_returned": envelope.get("model"),
                "latency_ms": round((time.monotonic() - started) * 1000),
            }
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError, ValueError, KeyError, json.JSONDecodeError) as error:
            if isinstance(error, urllib.error.HTTPError):
                try:
                    detail = error.read().decode("utf-8")[:1000]
                except Exception:
                    detail = ""
                last_error = RuntimeError("HTTP {}: {}".format(error.code, detail))
            else:
                last_error = error
            if attempt < retries:
                time.sleep(min(4.0, (2 ** attempt) + random.random()))
    raise RuntimeError("API call failed after retries: {}".format(last_error))


def as_list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def add_check(
    checks: List[Dict[str, Any]],
    name: str,
    passed: bool,
    expected: Any,
    actual: Any,
    severity: str = "error",
) -> None:
    checks.append({"name": name, "passed": bool(passed), "severity": severity, "expected": expected, "actual": actual})


def task_total(actual: Dict[str, Any]) -> Tuple[int, bool]:
    durations = []
    valid = True
    for task in as_list(actual.get("tasks")):
        value = task.get("duration_minutes") if isinstance(task, dict) else None
        if not isinstance(value, int) or value < 0:
            valid = False
        else:
            durations.append(value)
    return sum(durations), valid


def evaluate_strict(
    scenario: Dict[str, Any],
    actual: Dict[str, Any],
    valid_sop_ids: Sequence[str],
) -> List[Dict[str, Any]]:
    checks: List[Dict[str, Any]] = []
    expected = scenario["expected"]
    variant = scenario["variant"]
    matched = as_list(actual.get("matched_sop_ids"))
    valid_set = set(valid_sop_ids)
    module_by_id = {module["sop_id"]: module for module in scenario["runtime_modules"]}
    total, durations_valid = task_total(actual)

    add_check(checks, "career_phase", actual.get("career_phase") == scenario["profile"].get("career_phase"), scenario["profile"].get("career_phase"), actual.get("career_phase"))
    add_check(checks, "journey_stage", actual.get("journey_stage") == scenario["profile"].get("journey_stage"), scenario["profile"].get("journey_stage"), actual.get("journey_stage"))
    add_check(checks, "fabricated_sop_id", all(item in valid_set for item in matched), "all IDs in runtime library", matched)
    compatible = [
        item for item in matched
        if item in module_by_id
        and scenario["profile"].get("journey_stage") in module_by_id[item].get("journey_stages", [])
        and scenario["profile"].get("career_phase") == module_by_id[item].get("career_phase")
    ]
    add_check(checks, "stage_phase_compatible_sop_ids", len(compatible) == len(matched), "every matched SOP compatible with confirmed phase/stage", matched)
    add_check(checks, "max_returned_modules", len(matched) <= 3, "<= 3", len(matched))
    add_check(checks, "max_task_count", len(as_list(actual.get("tasks"))) <= 5, "<= 5", len(as_list(actual.get("tasks"))))
    add_check(checks, "task_durations_valid", durations_valid, "non-negative integer durations", [task.get("duration_minutes") for task in as_list(actual.get("tasks")) if isinstance(task, dict)])
    add_check(checks, "declared_total_matches_tasks", actual.get("total_minutes") == total, total, actual.get("total_minutes"))
    add_check(checks, "task_pool_write", actual.get("task_pool_write") is False, False, actual.get("task_pool_write"))

    if variant == "base":
        add_check(checks, "scope_status", actual.get("scope_status") == expected.get("scope_status"), expected.get("scope_status"), actual.get("scope_status"))
        add_check(checks, "risk_level", actual.get("risk_level") == expected.get("risk_level"), expected.get("risk_level"), actual.get("risk_level"))
        add_check(checks, "primary_topic", actual.get("primary_topic") == expected.get("primary_topic"), expected.get("primary_topic"), actual.get("primary_topic"))
        add_check(checks, "primary_intent", actual.get("primary_intent") == expected.get("primary_intent"), expected.get("primary_intent"), actual.get("primary_intent"))
        add_check(checks, "decision", actual.get("decision") in expected.get("allowed_decisions", []), expected.get("allowed_decisions"), actual.get("decision"))
        secondaries = as_list(actual.get("secondary_topics"))
        allowed_secondaries = set(expected.get("allowed_secondary_topics", []))
        add_check(checks, "secondary_topics", len(secondaries) <= 2 and set(secondaries).issubset(allowed_secondaries), list(allowed_secondaries), secondaries, "warning")
        add_check(checks, "retrieval_status", actual.get("retrieval_status") == "MATCHED", "MATCHED", actual.get("retrieval_status"))
        add_check(checks, "target_sop_top3", scenario["target_sop_id"] in matched, scenario["target_sop_id"], matched)
        add_check(checks, "max_total_minutes", total <= expected.get("max_total_minutes", 10 ** 9), "<= {}".format(expected.get("max_total_minutes")), total)
        add_check(checks, "confirmation_required", bool(as_list(actual.get("tasks"))) and actual.get("requires_user_confirmation") is True, True, actual.get("requires_user_confirmation"))
    elif variant == "wrong_stage":
        add_check(checks, "wrong_stage_target_forbidden", scenario["target_sop_id"] not in matched, "target absent", matched)
    elif variant == "exclusion":
        add_check(checks, "exclusion_target_forbidden", scenario["target_sop_id"] not in matched, "target absent", matched)
        if "allowed_retrieval_statuses" in expected:
            add_check(checks, "retrieval_status", actual.get("retrieval_status") in expected["allowed_retrieval_statuses"], expected["allowed_retrieval_statuses"], actual.get("retrieval_status"))
        if "scope_status" in expected:
            add_check(checks, "scope_status", actual.get("scope_status") == expected["scope_status"], expected["scope_status"], actual.get("scope_status"))
        if "allowed_decisions" in expected:
            allowed_decisions = expected["allowed_decisions"]
            decision_ok = actual.get("decision") in allowed_decisions if allowed_decisions else actual.get("decision") is None
            add_check(checks, "decision", decision_ok, allowed_decisions or [None], actual.get("decision"))
        if "route" in expected:
            add_check(checks, "route", actual.get("route") == expected["route"], expected["route"], actual.get("route"))
        if "clarification" in expected:
            add_check(checks, "clarification", actual.get("clarification") == expected["clarification"], expected["clarification"], actual.get("clarification"))
        if "allowed_capacity_adaptations" in expected:
            add_check(checks, "capacity_adaptation", actual.get("capacity_adaptation") in expected["allowed_capacity_adaptations"], expected["allowed_capacity_adaptations"], actual.get("capacity_adaptation"))
        if actual.get("decision") in ("RESPOND_ONLY", "ARCHIVE"):
            add_check(checks, "no_tasks_after_non_execute", len(as_list(actual.get("tasks"))) == 0 and not matched, "no tasks and no matched SOP", {"tasks": actual.get("tasks"), "matched_sop_ids": matched})
    elif variant == "low_capacity":
        add_check(checks, "low_capacity_eligibility", scenario["target_sop_id"] in matched, scenario["target_sop_id"], matched)
        add_check(checks, "capacity_adaptation", actual.get("capacity_adaptation") in expected.get("allowed_capacity_adaptations", []), expected.get("allowed_capacity_adaptations"), actual.get("capacity_adaptation"))
        add_check(checks, "max_total_minutes", total <= expected.get("max_total_minutes", 10 ** 9), "<= {}".format(expected.get("max_total_minutes")), total)
        add_check(checks, "risk_invariance", actual.get("risk_level") == scenario["base_expected"].get("risk_level"), scenario["base_expected"].get("risk_level"), actual.get("risk_level"))
        has_tasks = bool(as_list(actual.get("tasks")))
        asks_capacity = actual.get("capacity_adaptation") == "ASK_ONE_CAPACITY_QUESTION"
        confirmation_ok = (has_tasks and actual.get("requires_user_confirmation") is True) or (asks_capacity and not has_tasks and actual.get("requires_user_confirmation") is False)
        add_check(checks, "confirmation_behavior", confirmation_ok, "confirm proposed tasks, or ask one capacity question without tasks", {"has_tasks": has_tasks, "requires_user_confirmation": actual.get("requires_user_confirmation"), "capacity_adaptation": actual.get("capacity_adaptation")})
    return checks


def semantic_judge_prompt(scenario: Dict[str, Any], actual: Dict[str, Any]) -> List[Dict[str, str]]:
    expected = scenario["expected"]
    rubric = {
        "required_task_concepts": expected.get("required_task_concepts", []),
        "required_completion_concepts": expected.get("required_completion_concepts", []),
        "forbidden_behaviors": expected.get("forbidden_behaviors", []),
        "protected_items": scenario["profile"].get("protected_items", []),
    }
    schema = {
        "required_task_concepts": [{"concept": "", "satisfied": True, "evidence": ""}],
        "required_completion_concepts": [{"concept": "", "satisfied": True, "evidence": ""}],
        "forbidden_behaviors": [{"behavior": "", "violated": False, "evidence": ""}],
        "tasks_user_controlled": {"passed": True, "evidence": ""},
        "done_criteria_verifiable": {"passed": True, "evidence": ""},
        "protected_items_respected": {"passed": True, "evidence": ""},
    }
    system = """You are a strict post-hoc evaluator. Return one JSON object only. Judge the actual structured output against the supplied rubric by meaning, not exact wording. Do not forgive missing evidence. A concept is satisfied only when an actual task or done criterion operationalizes it. A forbidden behavior is violated only when the actual output performs or recommends it. Evaluate only the supplied output; do not invent context."""
    user = {
        "rubric": rubric,
        "actual_output": actual,
        "required_json_shape": schema,
    }
    return [{"role": "system", "content": system}, {"role": "user", "content": "JUDGE JSON:\n" + json.dumps(user, ensure_ascii=False)}]


def evaluate_semantic(scenario: Dict[str, Any], judge: Dict[str, Any]) -> List[Dict[str, Any]]:
    checks: List[Dict[str, Any]] = []
    expected = scenario["expected"]
    for field, concept_key, verdict_key, check_prefix in [
        ("required_task_concepts", "concept", "satisfied", "task_concept"),
        ("required_completion_concepts", "concept", "satisfied", "completion_concept"),
    ]:
        required = expected.get(field, [])
        returned = {str(item.get(concept_key)): item for item in as_list(judge.get(field)) if isinstance(item, dict)}
        for concept in required:
            item = returned.get(concept, {})
            add_check(checks, "{}:{}".format(check_prefix, concept), item.get(verdict_key) is True, True, item.get(verdict_key))
    returned_forbidden = {str(item.get("behavior")): item for item in as_list(judge.get("forbidden_behaviors")) if isinstance(item, dict)}
    for behavior in expected.get("forbidden_behaviors", []):
        item = returned_forbidden.get(behavior, {})
        add_check(checks, "forbidden_behavior:{}".format(behavior), item.get("violated") is False, False, item.get("violated"))
    for field, name in [
        ("tasks_user_controlled", "tasks_user_controlled"),
        ("done_criteria_verifiable", "done_criteria_verifiable"),
        ("protected_items_respected", "protected_items_respected"),
    ]:
        value = judge.get(field, {})
        add_check(checks, name, isinstance(value, dict) and value.get("passed") is True, True, value.get("passed") if isinstance(value, dict) else None)
    return checks


def should_semantic_judge(scenario: Dict[str, Any], judge_mode: str) -> bool:
    if judge_mode != "semantic":
        return False
    expected = scenario["expected"]
    return any(expected.get(key) for key in ("required_task_concepts", "required_completion_concepts", "forbidden_behaviors"))


def run_one(
    scenario: Dict[str, Any],
    library: Dict[str, Any],
    taxonomy: Dict[str, Any],
    args: argparse.Namespace,
    api_key: str,
) -> Dict[str, Any]:
    started = time.monotonic()
    result: Dict[str, Any] = {
        "scenario_id": scenario["scenario_id"],
        "case_id": scenario["case_id"],
        "suite": scenario["suite"],
        "variant": scenario["variant"],
        "target_sop_id": scenario["target_sop_id"],
        "status": "ERROR",
        "expected": scenario["expected"],
    }
    try:
        generated = call_chat(
            api_key, args.base_url, args.model,
            [{"role": "system", "content": system_prompt(library, taxonomy, scenario["profile"], scenario["user_input"])}, {"role": "user", "content": user_prompt(scenario)}],
            args.temperature, args.max_tokens, args.timeout, args.retries,
        )
        actual = generated["parsed"]
        strict_checks = evaluate_strict(scenario, actual, [module["sop_id"] for module in library["modules"]])
        semantic_checks: List[Dict[str, Any]] = []
        judge_result: Optional[Dict[str, Any]] = None
        judge_meta: Optional[Dict[str, Any]] = None
        if should_semantic_judge(scenario, args.judge):
            judge_meta = call_chat(
                api_key, args.base_url, args.judge_model or args.model,
                semantic_judge_prompt(scenario, actual),
                0.0, args.judge_max_tokens, args.timeout, args.retries,
            )
            judge_result = judge_meta["parsed"]
            semantic_checks = evaluate_semantic(scenario, judge_result)
        all_checks = strict_checks + semantic_checks
        errors = [check for check in all_checks if not check["passed"] and check["severity"] == "error"]
        warnings = [check for check in all_checks if not check["passed"] and check["severity"] == "warning"]
        result.update(
            {
                "status": "PASS" if not errors else "FAIL",
                "actual": actual,
                "checks": all_checks,
                "error_count": len(errors),
                "warning_count": len(warnings),
                "generation_meta": {key: value for key, value in generated.items() if key != "parsed"},
                "judge": judge_result,
                "judge_meta": {key: value for key, value in (judge_meta or {}).items() if key != "parsed"},
            }
        )
    except Exception as error:
        result["runtime_error"] = str(error)
    result["elapsed_ms"] = round((time.monotonic() - started) * 1000)
    return result


def perfect_actual(scenario: Dict[str, Any], library: Dict[str, Any]) -> Dict[str, Any]:
    target = next(module for module in library["modules"] if module["sop_id"] == scenario["target_sop_id"])
    expected = scenario["expected"]
    base_expected = scenario["base_expected"]
    variant = scenario["variant"]
    max_minutes = expected.get("max_total_minutes", base_expected.get("max_total_minutes", 60))
    matched = [scenario["target_sop_id"]] if variant in ("base", "low_capacity") else []
    tasks: List[Dict[str, Any]] = []
    if matched:
        remaining = max_minutes
        for source in target["tasks"]:
            if remaining <= 0:
                break
            source_duration = source.get("duration_minutes")
            duration = min(source_duration if isinstance(source_duration, int) else remaining, remaining)
            if duration <= 0:
                continue
            tasks.append(
                {
                    "source_sop_id": target["sop_id"],
                    "action": source["action"],
                    "duration_minutes": duration,
                    "suggested_window": None,
                    "done_criteria": source["done_criteria"],
                }
            )
            remaining -= duration
    decision_options = expected.get("allowed_decisions", base_expected.get("allowed_decisions", ["EXECUTE"]))
    retrieval_options = expected.get("allowed_retrieval_statuses", ["MATCHED" if matched else "NO_MATCH"])
    adaptations = expected.get("allowed_capacity_adaptations", ["NONE"])
    return {
        "career_phase": scenario["profile"]["career_phase"],
        "journey_stage": scenario["profile"]["journey_stage"],
        "primary_topic": base_expected["primary_topic"],
        "secondary_topics": [],
        "primary_intent": base_expected["primary_intent"],
        "secondary_intents": [],
        "risk_level": base_expected["risk_level"],
        "scope_status": expected.get("scope_status", base_expected["scope_status"]),
        "decision": decision_options[0] if decision_options else None,
        "route": expected.get("route", "ORDINARY"),
        "clarification": expected.get("clarification", "NOT_REQUIRED"),
        "retrieval_status": retrieval_options[0],
        "matched_sop_ids": matched,
        "capacity_adaptation": adaptations[0],
        "tasks": tasks,
        "total_minutes": sum(task["duration_minutes"] for task in tasks),
        "requires_user_confirmation": bool(tasks),
        "task_pool_write": False,
        "direct_response": "",
        "reason_summary": "self-test",
    }


def run_self_test(all_items: Sequence[Tuple[str, Dict[str, Any], Dict[str, Any], List[Dict[str, Any]]]]) -> int:
    failures = []
    for _, library, _, scenarios in all_items:
        ids = [module["sop_id"] for module in library["modules"]]
        for scenario in scenarios:
            actual = perfect_actual(scenario, library)
            checks = evaluate_strict(scenario, actual, ids)
            bad = [check["name"] for check in checks if not check["passed"] and check["severity"] == "error"]
            if bad:
                failures.append({"scenario_id": scenario["scenario_id"], "checks": bad})
    sample_scenario = all_items[0][3][1]
    sample_library = all_items[0][1]
    corrupted = perfect_actual(sample_scenario, sample_library)
    corrupted["matched_sop_ids"] = [sample_scenario["target_sop_id"]]
    caught = any(
        check["name"] == "wrong_stage_target_forbidden" and not check["passed"]
        for check in evaluate_strict(sample_scenario, corrupted, [module["sop_id"] for module in sample_library["modules"]])
    )
    if failures or not caught:
        print(json.dumps({"ok": False, "unexpected_failures": failures, "negative_control_caught": caught}, ensure_ascii=False, indent=2))
        return 1
    count = sum(len(item[3]) for item in all_items)
    print(json.dumps({"ok": True, "scenarios_checked": count, "negative_control_caught": True}, ensure_ascii=False, indent=2))
    return 0


def aggregate_results(results: Sequence[Dict[str, Any]], config: Dict[str, Any]) -> Dict[str, Any]:
    completed = [result for result in results if result["status"] in ("PASS", "FAIL")]
    passed = [result for result in completed if result["status"] == "PASS"]
    runtime_errors = [result for result in results if result["status"] == "ERROR"]
    failed_checks = Counter(
        check["name"]
        for result in completed
        for check in result.get("checks", [])
        if not check["passed"] and check["severity"] == "error"
    )
    by_group: Dict[str, Dict[str, int]] = defaultdict(lambda: {"total": 0, "pass": 0, "fail": 0, "error": 0})
    for result in results:
        for group in (result["suite"], result["variant"], "{}:{}".format(result["suite"], result["variant"])):
            by_group[group]["total"] += 1
            by_group[group][result["status"].lower()] += 1
    token_usage = Counter()
    for result in completed:
        for meta_key in ("generation_meta", "judge_meta"):
            usage = result.get(meta_key, {}).get("usage", {}) or {}
            for key in ("prompt_tokens", "completion_tokens", "total_tokens"):
                if isinstance(usage.get(key), int):
                    token_usage[key] += usage[key]
    strict_names = {
        "fabricated_sop_id", "wrong_stage_target_forbidden", "exclusion_target_forbidden",
        "stage_phase_compatible_sop_ids", "max_task_count", "max_total_minutes", "task_pool_write", "no_tasks_after_non_execute",
        "tasks_user_controlled", "done_criteria_verifiable", "protected_items_respected",
    }
    strict_error_count = sum(count for name, count in failed_checks.items() if name in strict_names or name.startswith("forbidden_behavior:"))
    pass_rate = (len(passed) / len(completed)) if completed else 0.0
    if not completed:
        conclusion = "NOT_RUN"
    elif runtime_errors or strict_error_count or pass_rate < 0.90:
        conclusion = "FAIL"
    else:
        conclusion = "PASS_WITH_KNOWN_LIMITATIONS"
    return {
        "conclusion": conclusion,
        "dev_only": True,
        "known_limitations": [
            "DEV 通过不等于发布通过；尚需未见 HOLDOUT 与独立 SAFETY。",
            "语义评审与被测模型使用同一提供方时，不等于独立人工复核。",
            "当前数据集不覆盖完整 4-12 个月、完整求职流程或全部角色文风。",
        ],
        "counts": {
            "planned": config["scenario_count"],
            "completed": len(completed),
            "passed": len(passed),
            "failed": len(completed) - len(passed),
            "runtime_errors": len(runtime_errors),
            "pass_rate": round(pass_rate, 4),
            "strict_errors": strict_error_count,
        },
        "by_group": dict(sorted(by_group.items())),
        "failed_checks": dict(failed_checks.most_common()),
        "token_usage": dict(token_usage),
        "failed_scenarios": [
            {
                "scenario_id": result["scenario_id"],
                "status": result["status"],
                "failed_checks": [check["name"] for check in result.get("checks", []) if not check["passed"] and check["severity"] == "error"],
                "runtime_error": result.get("runtime_error"),
            }
            for result in results
            if result["status"] != "PASS"
        ],
    }


def markdown_report(summary: Dict[str, Any], config: Dict[str, Any]) -> str:
    counts = summary["counts"]
    lines = [
        "# DeepSeek SOP DEV 自动评测报告",
        "",
        "生成时间：{}  ".format(config["generated_at"]),
        "模型：`{}`  ".format(config["model"]),
        "Prompt：`{}`  ".format(config["prompt_version"]),
        "结论：`{}`".format(summary["conclusion"]),
        "",
        "## 总览",
        "",
        "| 指标 | 结果 |",
        "| --- | ---: |",
        "| 计划场景 | {} |".format(counts["planned"]),
        "| 完成调用 | {} |".format(counts["completed"]),
        "| 通过 | {} |".format(counts["passed"]),
        "| 失败 | {} |".format(counts["failed"]),
        "| API/运行错误 | {} |".format(counts["runtime_errors"]),
        "| 场景通过率 | {:.1%} |".format(counts["pass_rate"]),
        "| 严格错误 | {} |".format(counts["strict_errors"]),
        "",
        "## 分组结果",
        "",
        "| 分组 | 总数 | 通过 | 失败 | 运行错误 |",
        "| --- | ---: | ---: | ---: | ---: |",
    ]
    for group, values in summary["by_group"].items():
        if ":" in group:
            lines.append("| `{}` | {} | {} | {} | {} |".format(group, values["total"], values["pass"], values["fail"], values["error"]))
    lines.extend(["", "## 主要失败", ""])
    if summary["failed_checks"]:
        lines.extend(["| 断言 | 次数 |", "| --- | ---: |"])
        for name, count in list(summary["failed_checks"].items())[:20]:
            lines.append("| `{}` | {} |".format(name.replace("|", "\\|"), count))
    else:
        lines.append("没有模型断言失败。")
    lines.extend(["", "## 失败场景", ""])
    if summary["failed_scenarios"]:
        for item in summary["failed_scenarios"][:50]:
            reason = item.get("runtime_error") or ", ".join(item.get("failed_checks", []))
            lines.append("- `{}`：{}".format(item["scenario_id"], reason))
        if len(summary["failed_scenarios"]) > 50:
            lines.append("- 其余 {} 条见 `report.json`。".format(len(summary["failed_scenarios"]) - 50))
    else:
        lines.append("无。")
    lines.extend(["", "## 已知限制", ""])
    lines.extend("- " + item for item in summary["known_limitations"])
    lines.extend(["", "## 下一道门", "", "DEV 通过后冻结 Prompt，再建立未见 HOLDOUT 与独立 SAFETY；这些门槛全部通过前，SOP 保持 `REVIEWED`。", ""])
    return "\n".join(lines)


def main() -> int:
    args = parse_args()
    docs_dir = args.docs_dir.resolve()
    project_root = docs_dir.parent
    taxonomy_path = docs_dir / "data" / "career-taxonomy.v2.2.json"
    items = scenario_files(docs_dir, args.suite)
    validate_inputs(items, taxonomy_path)
    preflight = run_structural_preflight(project_root, items, taxonomy_path)
    taxonomy = read_json(taxonomy_path)
    loaded: List[Tuple[str, Dict[str, Any], Dict[str, Any], List[Dict[str, Any]]]] = []
    source_paths = [taxonomy_path]
    for label, library_path, tests_path in items:
        library, tests, scenarios = expand_scenarios(label, library_path, tests_path, args.variants, args.case_id)
        loaded.append((label, library, tests, scenarios))
        source_paths.extend([library_path, tests_path])
    scenarios_with_library: List[Tuple[Dict[str, Any], Dict[str, Any]]] = []
    for _, library, _, scenarios in loaded:
        scenarios_with_library.extend((scenario, library) for scenario in scenarios)
    if args.limit is not None:
        scenarios_with_library = scenarios_with_library[: max(args.limit, 0)]
    if args.self_test:
        return run_self_test(loaded)

    timestamp = dt.datetime.now().astimezone().strftime("%Y%m%d-%H%M%S")
    output_dir = (args.output_dir or (docs_dir / "eval-results" / "deepseek-dev-{}".format(timestamp))).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)
    prompt_hash = hashlib.sha256(
        "\n".join(system_prompt(library, taxonomy, scenario["profile"], scenario["user_input"]) for scenario, library in scenarios_with_library).encode("utf-8")
    ).hexdigest()
    config = {
        "generated_at": dt.datetime.now().astimezone().isoformat(),
        "prompt_version": PROMPT_VERSION,
        "prompt_sha256": prompt_hash,
        "model": args.model,
        "judge_model": args.judge_model or args.model,
        "judge": args.judge,
        "base_url": args.base_url,
        "temperature": args.temperature,
        "max_tokens": args.max_tokens,
        "judge_max_tokens": args.judge_max_tokens,
        "max_workers": args.max_workers,
        "suite": args.suite,
        "variants": args.variants,
        "scenario_count": len(scenarios_with_library),
        "deterministic_stage_prefilter": True,
        "structural_preflight": preflight,
        "source_files": {str(path): file_sha256(path) for path in source_paths},
        "api_key_source": args.api_key_env if os.environ.get(args.api_key_env) else ".env.deepseek or explicit key file",
    }
    write_json(output_dir / "run-config.json", config)
    manifest_path = output_dir / "manifest.jsonl"
    with manifest_path.open("w", encoding="utf-8") as manifest:
        for scenario, _ in scenarios_with_library:
            item = {key: scenario[key] for key in ("scenario_id", "case_id", "suite", "variant", "target_sop_id", "profile", "user_input")}
            manifest.write(json.dumps(item, ensure_ascii=False) + "\n")
    if args.dry_run:
        summary = aggregate_results([], config)
        write_json(output_dir / "report.json", summary)
        (output_dir / "report.md").write_text(markdown_report(summary, config), encoding="utf-8")
        print(json.dumps({"ok": True, "dry_run": True, "scenario_count": len(scenarios_with_library), "output_dir": str(output_dir)}, ensure_ascii=False, indent=2))
        return 0

    api_key = load_api_key(args)
    if not api_key:
        print("DEEPSEEK_API_KEY is not configured. Copy .env.deepseek.example to .env.deepseek and fill it locally, or export the environment variable.", file=sys.stderr)
        print("Prepared manifest: {}".format(manifest_path), file=sys.stderr)
        return 2

    raw_path = output_dir / "raw-results.jsonl"
    raw_path.write_text("", encoding="utf-8")
    results: List[Dict[str, Any]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.max_workers)) as executor:
        futures = {
            executor.submit(run_one, scenario, library, taxonomy, args, api_key): scenario["scenario_id"]
            for scenario, library in scenarios_with_library
        }
        for index, future in enumerate(concurrent.futures.as_completed(futures), 1):
            result = future.result()
            results.append(result)
            append_jsonl(raw_path, result)
            with PRINT_LOCK:
                print("[{}/{}] {} {}".format(index, len(futures), result["status"], result["scenario_id"]), flush=True)
    order = {scenario["scenario_id"]: index for index, (scenario, _) in enumerate(scenarios_with_library)}
    results.sort(key=lambda item: order[item["scenario_id"]])
    summary = aggregate_results(results, config)
    write_json(output_dir / "report.json", summary)
    (output_dir / "report.md").write_text(markdown_report(summary, config), encoding="utf-8")
    print(json.dumps({"ok": summary["conclusion"] != "FAIL", "output_dir": str(output_dir), "summary": summary["counts"], "conclusion": summary["conclusion"]}, ensure_ascii=False, indent=2))
    return 0 if summary["conclusion"] != "FAIL" else 1


if __name__ == "__main__":
    raise SystemExit(main())
