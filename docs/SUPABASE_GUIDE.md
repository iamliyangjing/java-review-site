# Supabase 云端备份指南

本应用默认把知识库、题目和复习记录保存在本机 SQLite。Supabase 只保存你手动上传的整库快照；应用不会自动同步，也不会合并两台电脑各自修改的内容。

## 1. 创建项目并复制 Publishable key

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)，创建一个项目并等待数据库就绪。
2. 打开项目的 **Connect** 面板，复制 **Project URL**；也可在 **Settings → API Keys** 查看。
3. 在 **Settings → API Keys → Publishable and secret API keys** 中复制 Publishable key，格式为 `sb_publishable_...`。如果项目只显示旧版 key，旧版 `anon` key 也能使用。
4. 在 Java 面试题库的“云备份”窗口中填写 Project URL 和 Publishable key，点击“保存项目配置”。

桌面应用属于公开客户端，可以使用 Publishable key；这个 key 识别的是应用项目，不是用户身份。它不能替代 Supabase Auth 登录。绝不要把 `sb_secret_...` 或 `service_role` key 放进桌面应用、聊天消息或 GitHub。

## 2. 初始化云备份表

在 Supabase Dashboard 打开 **SQL Editor → New query**，按顺序打开并运行仓库中的两个 SQL 文件：

1. `supabase/migrations/20261014120000_desktop_cloud_backups.sql`
2. `supabase/migrations/20261015120000_desktop_backup_history.sql`

完成后，数据表和保存快照的数据库函数会通过 RLS 按 Supabase 用户隔离。不要关闭这些策略，也不要手动把表设成公开可读。

## 3. 登录云端身份

在应用“云备份”窗口中选择一种方式：

- **邮箱登录**：创建 Supabase Auth 账号并完成登录。要在另一台电脑恢复同一份数据，两台设备必须登录同一个 Supabase 用户。
- **免密码创建云端身份**：先在 Supabase 项目的 **Authentication → Sign In / Providers** 中启用 **Anonymous**，再点应用内的免密码按钮。匿名身份只属于当前安装；卸载、清除应用数据或切换电脑后无法重新找回。它适合单机备份测试，不适合跨设备同步。
- **已有用户 Token**：高级入口要求同一 Auth 会话对应的一对 Access Token 与 Refresh Token。不要从 Dashboard 的 API Keys 页面找这两个令牌。Supabase Dashboard Personal Access Token 是管理项目用的，也不能用于应用用户登录。

跨设备使用建议登录同一个可验证的 Supabase Auth 账号。不要把自己的 Refresh Token 分享给他人。

## 4. 上传与恢复

1. 旧电脑打开“云备份”，登录对应的 Supabase 用户，点击“上传本机题库”。
2. 每次上传创建一个历史版本，云端只保留最近 10 个快照。新版本会基于服务器当前版本检查冲突；如果另一个客户端已经先上传，应用会提示冲突，需先检查版本并重新操作。
3. 新电脑配置相同 Project URL 和 Publishable key，登录同一个 Supabase Auth 用户。
4. 选择要恢复的历史版本并点击“恢复所选版本”。恢复会替换本机知识库、目录、题目、复习计划与历史记录；应用会先在本机留一份恢复前备份。

不要把两台电脑当作同时编辑的实时同步客户端。推荐一次只在一台设备编辑：先上传，另一台设备再恢复。日常也建议使用应用顶部的“导出备份”保存独立 JSON 副本。

## 常见问题

- **Invalid API key**：检查 URL 是否是当前项目的 Project URL，并确认复制的是 Publishable key 或旧版 anon key。
- **找不到备份表或函数**：确认已按顺序执行两份迁移 SQL。
- **匿名登录失败**：确认项目启用了 Anonymous provider。若启用了强制 CAPTCHA，当前桌面版本没有 CAPTCHA 验证界面，请改用邮箱登录。
- **另一台设备看不到匿名账号的备份**：这是 Supabase 匿名用户的设计限制。匿名用户退出、清除本机应用数据或更换设备后无法访问原用户；请使用可验证的 Auth 账号并保留本地 JSON 备份。

Supabase 官方说明：[API Keys](https://supabase.com/docs/guides/getting-started/api-keys) · [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
