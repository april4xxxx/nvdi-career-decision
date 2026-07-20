# SOP 运行时发布门与阻断记录

日期：2026-07-20

## 当前结论

现有 22 个入职后模块仍保持 `REVIEWED`，没有迁移为 `ACTIVE`。运行时发布生成器已接入部署项目，但当前生成结果为：

```json
{
  "release_status": "BLOCKED_NO_ACTIVE_MODULES",
  "module_count": 0
}
```

因此当前线上部署不会召回 22 个正式 SOP。项目主库、taxonomy、DEV、HOLDOUT 和 SAFETY 资产现已保存在本目录，不再依赖外部文档目录才能恢复。

## 已完成的发布基础设施

1. 新增版本化发布生成器，只读取冻结字段。
2. 只有库级状态与模块级状态同时为 `ACTIVE` 时才写入部署包。
3. 服务端按保存的入职阶段硬过滤模块。
4. 排序前先执行整个模块的 `not_applicable_when` 排除门。
5. 单轮最多向模型提供 3 个候选 SOP。
6. 实际使用的模块以 `SOP:<sop_id>｜<title>` 写入奏折来源，并继续传递到地图任务。
7. 生成器没有“强制包含 REVIEWED”或“跳过评测”的开关。

## 首批四模块门禁进展

本轮选择：

- `SOP_KEY_PEOPLE_01`
- `SOP_QUESTION_LOOP_01`
- `SOP_SKILL_GAP_03`
- `SOP_NEXT_90D_04`

这四个模块在历史真实 DeepSeek DEV 中的 base、wrong-stage、exclusion、low-capacity 共 16 个场景全部通过。项目内新增未见 HOLDOUT 与独立 SAFETY 家族，并已通过结构校验和确定性检索回归。

尝试重新运行外部模型评测时，本机权限策略阻止将项目 SOP 和测试样本发送到 DeepSeek。沙箱内第一次运行的 16 个场景全部是 DNS/网络错误，结论为 `NOT_RUN`。用户随后明确授权只发送四个模块、taxonomy 与合成案例，但系统级租户数据治理策略仍拒绝传输。该结果不能算作内容失败或通过，也不能据此激活模块。

详细状态见 `10-首批ACTIVE模块发布记录.json`。

## 历史 DEV 阻断项处理

上一轮真实模型 DEV 共有 108 个场景，87 个通过，仍有两个严格错误：

| 场景 | 原错误 | 当前确定性保护 |
| --- | --- | --- |
| `DEV_SOP_003::exclusion` | 系统权限未开通仍召回 `SOP_TOOL_FLOW_01` | 模型调用前命中排除条件并移除整个模块 |
| `DEV_SOP_015::exclusion` | 尚无成果仍召回 `SOP_ACHIEVEMENT_LOG_03` | 模型调用前命中排除条件并移除整个模块 |

本地回归已经覆盖两个案例，但本地测试不替代真实模型全量 DEV。

评测执行器已升级为 `deepseek-sop-eval.v1.4`，并对入职后 88 个场景完成 dry-run 结构预检：`eval-results/deepseek-dev-20260720-170834/`。预检为 `NOT_RUN`，只证明输入、结构和场景展开有效。

## 仍未满足的 ACTIVE 门槛

1. 在允许此类项目数据外发的评测环境中，对首批四模块重新运行真实模型 DEV。
2. 运行冻结后的 HOLDOUT，不能用结果反向修改 Golden 预期。
3. 独立运行 SAFETY，安全路由必须 100%。
4. 三道外部门禁全部通过后，只把首批四模块和库级状态迁移为 `ACTIVE`；其余18个模块保持 `REVIEWED`。
5. 重新运行生成器和全部程序回归，确认运行包模块数严格为4。

当前 `.env.local` 已配置评测密钥，用户也已明确授权最小范围评测，但系统级租户策略仍禁止外部数据传输。不得把本地程序测试或 dry-run 解释为外部 HOLDOUT/SAFETY 通过。
