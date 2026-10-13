# Java 面试题库

一个面向 Windows 的离线 Java 面试复习桌面应用。安装后无需网络即可浏览题库、按间隔复习、维护自己的题目并查看复习记录。首次启动内置 131 道题和 183 个知识分类。

## 功能

- 按分类浏览、搜索、新增、编辑和删除题目；删除的题目可以从回收站恢复
- 按到期时间、错题或分类开始复习，按“忘了、困难、良好、简单”安排下次复习
- 查看按日期和分类筛选的复习历史
- 将题目、排期和复习记录导出为 JSON，或从 JSON/旧版网站 v1 备份恢复
- 数据保存在本机 SQLite；应用更新不会覆盖个人编辑

## 开发与构建

需要 Windows、Node.js 22.12 或更高版本和 npm。在项目目录运行：

```powershell
npm ci
npm run dev
```

首次运行开发或构建命令时会按需下载 Electron 运行时；打包后的应用运行无需网络。

运行完整测试并构建 Windows 安装程序和便携版：

```powershell
npx playwright install chromium
npm test
npm run build
```

生成文件位于 `release/`。GitHub Actions 会在推送、Pull Request 和手动触发时运行测试、构建，并保存安装包作为工作流产物。

桌面应用运行时不发出网络请求。安装版和便携版都把数据库保存在 Electron 的本机 `userData` 目录；卸载前请先导出备份。

## 旧版浏览器知识图谱

仓库仍保留早期的浏览器知识图谱，入口为 `index.html`，内置目录与笔记可本地浏览。该页面的登录、云同步和图片存储是可选的 Supabase 功能，与离线桌面应用分开。

如果要启用浏览器版云功能，将 `js/supabase-config.js` 复制为 `js/supabase-config.local.js`，再填写自己的项目 URL 和 publishable key，并通过本地 HTTP 服务访问页面：

```powershell
Copy-Item js/supabase-config.js js/supabase-config.local.js
```

本地配置文件已加入 `.gitignore`。浏览器端只允许使用 publishable/anon key，并须在 Supabase 开启合适的 RLS 策略；禁止把 secret 或 service-role key 写入前端、提交记录或公开仓库。新克隆项目默认不连接任何 Supabase 项目。

迁移 SQL 位于 `supabase/migrations/`。运行实时 Storage 验证前，需要提供两个一次性测试账号给 `npm run test:live-storage`；不要使用个人账号。该检查不会被常规 `npm test` 或 CI 自动执行。

## 题库与内容

`data/questions.json` 是桌面端首次启动导入的内置题库；`scripts/build-question-seed.cjs` 可从项目内的笔记数据重新生成它。浏览器版的分类和笔记保存在 `js/data.js` 与 `js/notes/`。

学习笔记包含对《图解 Java》《图解网络》《图解系统》等资料的整理与参考链接。项目内的 ECharts 和 Supabase JS 浏览器发行文件、许可证说明保存在 `vendor/`。公开仓库前，请确认你有权按选定的分发条款发布全部题库、笔记、图片和第三方资源。

## 许可证

尚未添加项目级 `LICENSE`。确定仓库公开范围和题库内容的授权方式后，再选择适用的许可证。
