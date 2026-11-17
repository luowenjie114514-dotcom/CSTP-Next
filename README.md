# test 分支 · 测试用途

> **本分支仅用于测试新功能，内容可能不稳定、随时变动或回退。**
> 不要在生产环境或常用工作机上使用本分支的补丁。

---

## 声明

| 项目 | 说明 |
| --- | --- |
| 用途 | 功能试验、回归验证、问题复现 |
| 稳定性 | **不保证**，可能包含未完成或待废弃的实现 |
| 内容 | 可能与 `patch` / `add` 均不同步 |
| 数据安全 | 不保证向后兼容；补丁与回滚可能不配套 |
| 使用者 | 愿意尝鲜并反馈问题的用户 |

---

## 分支定位

| 分支 | 定位 | 稳定性 |
| --- | --- | --- |
| [`patch`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/patch) | 纯前端优化，日常使用 | 稳定 |
| [`add`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/add) | 必要的后端修改，全自动 | 可用，有代价 |
| **`test`（本分支）** | **测试新功能** | **不稳定** |

---

## 使用建议

- 想稳定使用 → 去 [`patch`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/patch)
- 想全自动导入 → 去 [`add`](https://github.com/luowenjie114514-dotcom/CSTP-Next/tree/add)
- 想帮忙试错、反馈 bug → 留在本分支

在本分支遇到问题时，请记录：

1. 使用的提交号（`git rev-parse --short HEAD`）
2. 具体现象与 F12 Console 报错
3. 是否已在其它分支复现

---

## 当前状态

本分支目前与 `main` 同步，尚未合入待测内容。
后续测试补丁会先进入本分支验证，稳定后再移入 `patch` 或 `add`。
