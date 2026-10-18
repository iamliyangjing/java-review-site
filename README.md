# Java 面试题库

[![Windows CI](https://github.com/iamliyangjing/java-review-site/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/iamliyangjing/java-review-site/actions/workflows/ci.yml)
![Windows 10+ x64](https://img.shields.io/badge/platform-Windows%2010%2B%20x64-0078D4?logo=windows)
![Code: MIT](https://img.shields.io/badge/code-MIT-blue)
![Question content: CC BY 4.0](https://img.shields.io/badge/question%20content-CC%20BY%204.0-green)

离线优先的 Windows Java 面试复习桌面应用。题目、复习计划和历史记录保存在本机 SQLite；按 SM-2 间隔复习；可新增、编辑、删除、恢复题目；JSON 备份可随时导出。Supabase 是用户自备的可选手动备份目的地，不参与日常离线使用。

## 功能

- 183 道原创复习题，覆盖 183 个现有分类；每题显示参考资料链接
- 多知识库管理；分类可新增、重命名、删除、拖动排序并嵌套为多级目录
- 分类筛选、全文搜索、自定义题目、编辑和回收站恢复
- 到期题、错题和自由练习，四档自评及复习历史
- SQLite 单实例写入保护、schema 版本迁移、完整性检查和启动恢复
- 旧本地数据库会自动迁移到知识库结构；v1/v2 JSON 备份仍可导入
- 本机滚动备份最多保留 10 个，导入/云恢复前保留当前数据
- 手动 Supabase 备份，最近 10 个云端快照可选择恢复；按用户隔离并检测过期版本
- 不发送遥测；崩溃诊断只在本机生成，需用户主动导出和提交

## 获取与运行

项目采用 Beta 优先的发布节奏。正式 GitHub Release 发布前，请从本仓库的 Actions Artifacts 下载验证版。发行包会提供 Windows 安装版和便携版、SHA-256 校验文件及变更记录。

首次启动时 Windows 可能提示应用未签名。请只从本仓库的 Releases 下载，并在运行前核对 SHA-256；本项目当前不签名，也不包含自动更新器。

### 从源码启动

要求 Windows 10 或更高版本、Node.js 22.12+ 和 npm。

```powershell
git clone https://github.com/iamliyangjing/java-review-site.git
cd java-review-site
npm ci
npm start
```

安装依赖及首次构建需要互联网。已构建桌面应用的复习、编辑、历史和本机备份不需要网络。

### 测试与构建

```powershell
npx playwright install chromium
npm test
npm run build
```

`release/` 输出 NSIS 安装包和便携版。推送、PR 和 Actions 手动运行都会执行 Windows 测试、依赖审计和打包冒烟。

## Supabase 手动备份

云端功能是手动快照备份，不是实时双向同步。用户需要自行创建 Supabase 项目，在 SQL Editor 依次运行：

1. [20261014120000_desktop_cloud_backups.sql](supabase/migrations/20261014120000_desktop_cloud_backups.sql)
2. [20261015120000_desktop_backup_history.sql](supabase/migrations/20261015120000_desktop_backup_history.sql)

再在应用中配置项目 URL 和 Publishable key（`sb_publishable_...`），用 Supabase Auth 登录。不要使用 secret 或 service-role key。每次上传创建新的版本，服务端按 RLS 与认证用户隔离，并只保留最近 10 个快照。恢复前应用会将现有本机库导出为 JSON。云端冲突或迁移缺失时，上传/恢复会报错，不会静默覆盖。

云端快照包含全部知识库、分类、题目与复习记录；新电脑恢复时会替换本机数据，不会自动合并两边改动。建议一次只在一台设备编辑，上传后再到另一台设备恢复。完整配置、申请 Publishable key 和操作步骤见[云端备份指南](docs/SUPABASE_GUIDE.md)。

也可以在云端登录区域展开“使用自己的 Supabase 用户 Token 登录”，粘贴同一个 Supabase Auth 会话中的 Access Token 与 Refresh Token。这里只接受 `authenticated` 用户 JWT；项目 Publishable/Secret key 和 Supabase Dashboard Personal Access Token 都不是用户会话令牌，不能用于此处。成功后会话通过 Windows 系统安全存储加密保存。

如不想输入邮箱或密码，可点击“免密码创建云端身份”。需先在 Supabase Dashboard 的 Authentication 设置中启用匿名登录。匿名身份使用独立的用户 ID 和 RLS 隔离，但只能在当前安装中恢复；当前桌面端没有匿名身份关联邮箱的界面，因此跨设备使用请直接登录一个可验证的 Supabase Auth 账号，并保留本地 JSON 备份。Supabase 建议对匿名注册启用 CAPTCHA 以降低滥用风险；当前桌面客户端还没有 CAPTCHA 挑战界面，因此启用项目级强制 CAPTCHA 时，匿名登录不可用。

登录令牌在 Windows 支持时使用系统加密保存在本机。更换设备前请额外导出 JSON 文件；云端快照仅在手动操作时读写。

## 项目结构

```text
electron/                 Electron 主进程、安全桥接、本机 SQLite 与 Supabase 服务
desktop.html              桌面界面
js/desktop-renderer.cjs   桌面界面逻辑
data/questions.json       内置题目、分类和逐题参考链接
supabase/migrations/      Supabase 手动备份数据库迁移
docs/                     Supabase 配置与快照备份指南
tests/                    自动化测试
scripts/                  题库生成与打包冒烟测试
index.html                桌面版项目说明页
```

## 题库授权

原创题目与答案解析采用 [CC BY 4.0](CONTENT-LICENSE.md)。逐题参考链接指向各项目/标准维护方的原始文档；引用页面的版权与许可仍归各自权利人。复用时请署名、链接 CC BY 4.0，并注明修改。

应用源代码采用 [MIT](LICENSE)，仅适用于项目原创软件代码。隐私说明见 [PRIVACY.md](PRIVACY.md)，安全问题见 [SECURITY.md](SECURITY.md)。

## 参与贡献

欢迎提交 Bug、来源勘误和功能改进。提交前运行 `npm ci`、`npm test`；涉及构建时运行 `npm run build`。请勿提交本机 SQLite、JSON 备份、诊断文件、Supabase 凭据或构建产物。
