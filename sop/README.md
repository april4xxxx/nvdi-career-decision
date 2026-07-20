# 职场新人 SOP 主库

本目录是当前项目内唯一可编辑、可审核、可回滚的职场新人 SOP 主库。外部统一产品文档目录只作为本次迁移来源和历史归档，不再作为运行保障。

## 文件职责

- `04-职场新人SOP库.json`：22 个模块的权威源文件。
- `data/career-taxonomy.v2.2.json`：阶段、主题、意图、风险与范围枚举。
- `04-SOP字段规范.md`：冻结字段和状态生命周期。
- `07-入职SOP测试案例.json`：22 个模块的 DEV Golden 家族。
- `08-首批ACTIVE模块HOLDOUT测试案例.json`：首批四模块的未见测试。
- `09-首批ACTIVE模块SAFETY测试案例.json`：首批四模块的安全优先测试。
- `10-首批ACTIVE模块发布记录.json`：选择依据、门禁和发布决定。
- `eval-results/`：真实模型与本地预检的可审计结果。

`api/_generated/sop-runtime.js` 是生成产物，不是主库，也不能反向作为备份。

## 当前状态

主库完整包含 22 个模块，当前仍全部为 `REVIEWED`。四个首批模块已经通过历史真实 DEV 的 16 个场景以及项目内结构、阶段、排除条件和回归测试；新的 HOLDOUT 与 SAFETY 均已完成 16 场景结构展开和本地确定性回归。用户已授权外部评测，但系统级租户策略仍禁止向 DeepSeek 传输项目 SOP 与合成评测数据，因此外部模型门未执行，发布记录继续阻断，运行包保持为空。

## 本地校验

```bash
python3 skills/build-newcomer-sop/scripts/validate_sop.py \
  --library 'sop/04-职场新人SOP库.json' \
  --taxonomy sop/data/career-taxonomy.v2.2.json \
  --tests 'sop/07-入职SOP测试案例.json'

npm test
```

## 激活规则

只有发布记录中 DEV、HOLDOUT、SAFETY 和程序回归全部为 `PASS`，才允许同时：

1. 将获准模块状态改为 `ACTIVE`；
2. 将库级状态改为 `ACTIVE`；
3. 更新库版本；
4. 重新生成 `api/_generated/sop-runtime.js`；
5. 确认运行包只包含获准模块。

禁止为了 Demo 跳过门禁，也禁止直接编辑生成文件。
