# DeepSeek SOP DEV 自动评测报告

生成时间：2026-07-20T18:08:51.919094+08:00<br>
模型：`deepseek-v4-pro`<br>
Prompt：`deepseek-sop-eval.v1.4`<br>
结论：`NOT_RUN`

## 总览

| 指标 | 结果 |
| --- | ---: |
| 计划场景 | 16 |
| 完成调用 | 0 |
| 通过 | 0 |
| 失败 | 0 |
| API/运行错误 | 16 |
| 场景通过率 | 0.0% |
| 严格错误 | 0 |

## 分组结果

| 分组 | 总数 | 通过 | 失败 | 运行错误 |
| --- | ---: | ---: | ---: | ---: |
| `posthire:base` | 4 | 0 | 0 | 4 |
| `posthire:exclusion` | 4 | 0 | 0 | 4 |
| `posthire:low_capacity` | 4 | 0 | 0 | 4 |
| `posthire:wrong_stage` | 4 | 0 | 0 | 4 |

## 主要失败

没有模型断言失败。

## 失败场景

- `DEV_SOP_002::base`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_002::wrong_stage`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_002::exclusion`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_002::low_capacity`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_004::base`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_004::wrong_stage`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_004::exclusion`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_004::low_capacity`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_014::base`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_014::wrong_stage`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_014::exclusion`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_014::low_capacity`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_020::base`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_020::wrong_stage`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_020::exclusion`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>
- `DEV_SOP_020::low_capacity`：API call failed after retries: <urlopen error [Errno 8] nodename nor servname provided, or not known>

## 已知限制

- DEV 通过不等于发布通过；尚需未见 HOLDOUT 与独立 SAFETY。
- 语义评审与被测模型使用同一提供方时，不等于独立人工复核。
- 当前数据集不覆盖完整 4-12 个月、完整求职流程或全部角色文风。

## 下一道门

DEV 通过后冻结 Prompt，再建立未见 HOLDOUT 与独立 SAFETY；这些门槛全部通过前，SOP 保持 `REVIEWED`。
