# DeepSeek SOP DEV 自动评测报告

生成时间：2026-07-19T22:16:44.010086+08:00<br>
模型：`deepseek-v4-pro`<br>
Prompt：`deepseek-sop-eval.v1.3`<br>
结论：`FAIL`

## 总览

| 指标 | 结果 |
| --- | ---: |
| 计划场景 | 108 |
| 完成调用 | 108 |
| 通过 | 87 |
| 失败 | 21 |
| API/运行错误 | 0 |
| 场景通过率 | 80.6% |
| 严格错误 | 2 |

## 分组结果

| 分组 | 总数 | 通过 | 失败 | 运行错误 |
| --- | ---: | ---: | ---: | ---: |
| `job:base` | 5 | 5 | 0 | 0 |
| `job:exclusion` | 5 | 5 | 0 | 0 |
| `job:low_capacity` | 5 | 5 | 0 | 0 |
| `job:wrong_stage` | 5 | 5 | 0 | 0 |
| `posthire:base` | 22 | 10 | 12 | 0 |
| `posthire:exclusion` | 22 | 15 | 7 | 0 |
| `posthire:low_capacity` | 22 | 20 | 2 | 0 |
| `posthire:wrong_stage` | 22 | 22 | 0 | 0 |

## 主要失败

| 断言 | 次数 |
| --- | ---: |
| `primary_intent` | 10 |
| `capacity_adaptation` | 5 |
| `clarification` | 4 |
| `decision` | 4 |
| `exclusion_target_forbidden` | 2 |
| `task_concept:保存目标记录` | 1 |
| `task_concept:同步进展和风险` | 1 |
| `task_concept:提交交付并复盘` | 1 |
| `completion_concept:交付已提交且复盘已记录` | 1 |
| `retrieval_status` | 1 |
| `confirmation_behavior` | 1 |

## 失败场景

- `DEV_SOP_001::base`：primary_intent
- `DEV_SOP_003::exclusion`：exclusion_target_forbidden, clarification, capacity_adaptation
- `DEV_SOP_006::base`：task_concept:保存目标记录
- `DEV_SOP_007::base`：primary_intent
- `DEV_SOP_008::base`：primary_intent
- `DEV_SOP_008::exclusion`：decision
- `DEV_SOP_009::base`：primary_intent
- `DEV_SOP_009::exclusion`：clarification
- `DEV_SOP_010::base`：primary_intent
- `DEV_SOP_011::base`：task_concept:同步进展和风险, task_concept:提交交付并复盘, completion_concept:交付已提交且复盘已记录
- `DEV_SOP_011::exclusion`：clarification
- `DEV_SOP_012::base`：primary_intent
- `DEV_SOP_013::base`：primary_intent
- `DEV_SOP_013::exclusion`：decision, clarification
- `DEV_SOP_015::exclusion`：exclusion_target_forbidden, retrieval_status, decision, capacity_adaptation
- `DEV_SOP_015::low_capacity`：capacity_adaptation, confirmation_behavior
- `DEV_SOP_017::base`：primary_intent
- `DEV_SOP_017::exclusion`：decision, capacity_adaptation
- `DEV_SOP_018::base`：primary_intent
- `DEV_SOP_019::base`：primary_intent
- `DEV_SOP_023::low_capacity`：capacity_adaptation

## 已知限制

- DEV 通过不等于发布通过；尚需未见 HOLDOUT 与独立 SAFETY。
- 语义评审与被测模型使用同一提供方时，不等于独立人工复核。
- 当前数据集不覆盖完整 4-12 个月、完整求职流程或全部角色文风。

## 下一道门

DEV 通过后冻结 Prompt，再建立未见 HOLDOUT 与独立 SAFETY；这些门槛全部通过前，SOP 保持 `REVIEWED`。
