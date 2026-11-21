# dsh-session-delete

DeepSeek Harness 插件：从会话和工作区右键菜单中彻底删除本机数据。

## 功能

- **彻底删除会话**：删除会话日志、会话目录、工作区归属、归档和置顶标记。会话仍在运行时，插件会先结束它的运行并释放写入器，不需要重启 DSH。
- **删除工作区及文件夹**：在确认框中显示完整路径，递归删除该工作区的项目文件夹，然后移除 DSH 中的工作区记录。该选项不会自动删除工作区里的会话记录；内置的“删除工作区”仍保持只移除注册的行为。
- 删除前需要二次确认；取消、点击遮罩或按 `Esc` 不会删除内容。

## 安装

通过 DSH 的插件管理器安装本仓库，或执行：

```sh
dsh plugin add github:keminoco-beep/dsh-session-delete
```

安装后刷新页面。

## 安全边界

- Host 端只接受同源的 `POST /api/session-delete` 和 `POST /api/workspace-delete`，并要求 `x-dsh-session-delete: 1` 请求头。
- 会话删除路径来自 `sessionPersistence.stat()` 报告的 artifact location，只允许删除与会话 ID 匹配的目录或文件。
- 工作区路径由 Host 按 `workspaceId` 从注册表查找，不接受客户端直接传入路径；拒绝驱动器根目录、用户主目录、`~/.dsh` 及其子目录、符号链接和包含 `..` 的路径。
- 不删除共享附件缓存 `~/.dsh/attachments`，也不删除其他工作区或会话。

## 卸载

在 DSH 插件管理器中移除 `dsh-session-delete`。已经删除的会话和文件夹无法恢复。

详细说明见 [docs/DETAIL.zh.md](docs/DETAIL.zh.md) 和 [docs/DETAIL.md](docs/DETAIL.md)。
