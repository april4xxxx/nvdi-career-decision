# QA Report: 演示模式与 AI 任务投放

## Metadata

- Date: 2026-07-21
- Target: `http://localhost:4175/`
- Tier: Standard
- Framework: Vanilla JavaScript SPA
- Scope: 场景空态任务范例、左下角“演示”全流程巡览、演示任务投放与清场
- Areas visited: 御前推演、朝堂、六部、御花园、民间、钦天监、心流模式、藏书阁、珍宝阁
- Automated tests: 59 passed, 0 failed

## Summary

| Severity | Found | Fixed | Deferred |
| --- | ---: | ---: | ---: |
| Critical | 0 | 0 | 0 |
| High | 2 | 2 | 0 |
| Medium | 0 | 0 | 0 |
| Low | 0 | 0 | 0 |

- Baseline health score: 89/100
- Final health score: 100/100
- Console health after fixes: 0 errors; only the normal application startup log remained.
- PR summary: QA found 2 issues, fixed 2, health score 89 → 100.

## Verified Product Behavior

1. 朝堂、六部、御花园、民间、钦天监在没有真实待办时均显示“任务范例”卡。
2. 范例卡点击后只展开议事对话，不显示“呈报完成”，不冒充真实待办。
3. 全流程巡览依次走过：行业分享追问与朱批、课程决策、心流模式、藏书阁、珍宝阁。
4. 行业分享生成 2 项主线任务并投往朝堂；课程决策生成 2 项探索任务并投往御花园。
5. 演示结束后徽标自动消失，朝堂和御花园的演示任务被清理，空态范例卡恢复。

## ISSUE-001: 演示输入后报 `App.demo.isRunning is not a function`

- Severity: High
- Category: Functional
- Reproduction: 从左下角“演示”选择“全流程巡览”，等待系统输入行业分享问题。
- Before: 对话气泡直接显示运行时错误，决策流程被阻断。
- Root cause: 跨模块以可调用方法判断演示状态，运行时状态形态不稳定。
- Fix: 演示模块统一维护 `App.demo.active` 布尔状态，对话和任务生成只读取该状态。
- Fix status: Verified
- Commit: `01daebc`
- Files changed: `js/demo.js`, `js/conversation.js`, `js/data.js`, `index.html`, `tests/tooling.test.js`
- After: 干净会话中重跑后没有运行时错误，能正常出现追问和决策奏折。

## ISSUE-002: 追问选项丢失原情景，行业分享被生成为六部通用任务

- Severity: High
- Category: Functional / Content
- Reproduction: 在行业分享追问中选择“准备时间实在不够”，然后同意奏折。
- Before: 本地演示引擎只重新分析选项文字，生成“完成第一小步”的日常任务并投往六部。
- Root cause: `ctx.scenarioId` 已被保存，但本地 `brain.analyze` 在追问后没有继续使用它。
- Fix: 追问后优先根据 `scenarioId` 续接原情景，只在没有可用情景时才走通用分析。
- Fix status: Verified
- Commit: `0de48a4`
- Files changed: `js/data.js`, `tests/store-economy.test.js`
- After: 行业分享稳定生成“定选题 + 列一页大纲”和“备稿并自己试讲一遍”，两项均投往朝堂。

## Top 3 Things to Fix

No unresolved issues remain in the requested scope.

