# 女皇入朝：SOP 字段规范 V2.2

版本：sop.v2.2<br>
冻结日期：2026-07-19<br>
状态：FROZEN<br>
适用文件：`04-职场新人SOP库.json`、`05-职场求职SOP库.json`

## 1. 冻结结论

两套 SOP 库共用同一模块结构，但分别维护库版本、阶段、内容和评测。运行时只读取本规范列出的字段；未声明字段不得自行加入。

本次冻结的是字段结构，不代表迁入内容已经完成质量评审。字段新增、删除、改名、类型变化或枚举变化，必须升级 `schema_version`，并同步检查 PRD、AI 编排契约、分类字典和评测说明。

## 2. 库级字段

| 字段 | 类型 | 必填 | 规则 |
| --- | --- | --- | --- |
| `library_id` | string | 是 | 库的稳定唯一 ID |
| `schema_version` | string | 是 | 当前固定为 `sop.v2.2` |
| `version` | string | 是 | 当前库内容版本 |
| `status` | enum | 是 | `STRUCTURE_ONLY / MIGRATED_DRAFT / ACTIVE / RETIRED` |
| `updated_at` | date | 是 | `YYYY-MM-DD` |
| `description` | string | 是 | 库的范围摘要 |
| `content_priority` | enum | 是 | `PRIMARY / SECONDARY` |
| `scope` | object | 是 | 本库包含和排除的业务范围 |
| `stages` | array | 是 | 阶段代码及建设状态 |
| `selection_rules` | object | 是 | 检索数量、规划周期和用户确认规则 |
| `modules` | array | 是 | SOP 模块；允许为空 |

`stages[].status` 只表示该阶段的内容建设进度，使用 `TO_DEFINE / PARTIAL_REVIEWED / REVIEWED`。其中 `PARTIAL_REVIEWED` 表示已有部分已审阅模块，但尚不足以宣称阶段内容完整；是否参与运行时检索仍以模块自身的 `status` 为准。

## 3. 模块字段

字段顺序也作为统一写入顺序。

| 顺序 | 字段 | 类型 | 必填 | 规则 |
| ---: | --- | --- | --- | --- |
| 1 | `sop_id` | string | 是 | 全库唯一，发布后不可复用 |
| 2 | `version` | string | 是 | 模块内容版本；迁入未评审内容使用 `1.0.0-migrated` |
| 3 | `status` | enum | 是 | `MIGRATED_DRAFT / REVIEWED / ACTIVE / RETIRED` |
| 4 | `title` | string | 是 | 用户可理解的行动主题 |
| 5 | `career_phase` | enum | 是 | `job_seeking / preboarding / posthire` |
| 6 | `journey_stages` | string[] | 是 | 至少一个，必须来自分类字典 |
| 7 | `primary_topic` | string | 是 | 一个主主题，必须来自分类字典 |
| 8 | `secondary_topics` | string[] | 是 | 0-2 个，不得重复主主题 |
| 9 | `supported_intents` | string[] | 是 | 1-3 个，必须来自分类字典 |
| 10 | `content_priority` | enum | 是 | `core / extended / secondary / event_only / routing_only` |
| 11 | `retrieval_tags` | string[] | 是 | 补充检索标签；统一使用小写 snake_case |
| 12 | `recommendation_priority` | enum | 是 | `REQUIRED_CANDIDATE / OPTIONAL / CONDITIONAL` |
| 13 | `applicable_when` | string[] | 是 | 适用条件；至少一条 |
| 14 | `not_applicable_when` | string[] | 是 | 排除条件；至少一条 |
| 15 | `estimated_minutes` | integer/null | 是 | 整个模块的初始估时；无法预估时为 `null` |
| 16 | `tasks` | array | 是 | 1-5 个候选步骤，按执行顺序排列 |

## 4. 任务字段

| 字段 | 类型 | 必填 | 规则 |
| --- | --- | --- | --- |
| `action` | string | 是 | 用户本人可控制的单一动作 |
| `duration_minutes` | integer/null | 是 | 预计投入分钟数；随实际交付变化时可为 `null` |
| `done_criteria` | string | 是 | 可检查的完成标准，不能只写“等待对方回复” |

运行时可以裁剪、拆细或合并任务，但不能改写原 SOP。精力档位在任务裁剪并结合用户容量后计算，不固化在模块字段中。

## 5. 空值与数组规则

- 必填表示字段必须存在，不等于字段不能为空。
- `secondary_topics` 和 `retrieval_tags` 可以是空数组。
- `estimated_minutes`、`duration_minutes` 只有在投入取决于真实交付规模时才可为 `null`。
- `applicable_when`、`not_applicable_when`、`journey_stages`、`supported_intents` 和 `tasks` 不得为空。
- 不使用空字符串代替 `null`。

## 6. 运行时库不包含的字段

以下字段不进入两套运行时 SOP JSON：

- `source_ids`
- `evidence_level`
- `sources`
- `references`
- `source_notes`
- 作者、账号、链接、平台和引用摘录

## 7. 状态流转

```text
STRUCTURE_ONLY（仅库级）
MIGRATED_DRAFT → REVIEWED → ACTIVE → RETIRED
```

- `MIGRATED_DRAFT`：已完成结构迁入和分类映射，尚未逐条内容评审。
- `REVIEWED`：内容、适用性、排除条件、时长和完成标准已审阅。
- `ACTIVE`：通过检索与任务生成评测，可被线上默认召回。
- `RETIRED`：保留 ID 和版本记录，但不再参与检索。

## 8. 发布前校验

每次发布至少检查：

1. `sop_id` 唯一；
2. 所有阶段、主题和意图均存在于分类字典；
3. 主主题不出现在辅助主题中；
4. 模块只使用本规范字段；
5. 每个动作由用户本人控制；
6. 每个任务有时长字段和完成标准；
7. 排除条件不会被 AI 绕过；
8. 单次召回不超过 3 个模块；
9. 求职库与入职库不交叉召回；
10. 运行时 JSON 不出现第 6 节列出的字段。
