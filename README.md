# Java 面试题库

[![Windows CI](https://github.com/iamliyangjing/java-review-site/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/iamliyangjing/java-review-site/actions/workflows/ci.yml)
![Platform: Windows](https://img.shields.io/badge/platform-Windows-0078D4?logo=windows)
![License: MIT for original code only](https://img.shields.io/badge/license-MIT%20%28code%20only%29-blue)

一款面向 Java 面试复习的 Windows 桌面题库。按分类整理问题，用间隔复习安排巩固节奏，并在本机维护题目、复习计划和历史记录。桌面应用离线运行，数据保存在本机，不需要账号或云服务。

> 当前内置 131 道题目，覆盖 183 个知识分类。题库和学习资料不属于项目的 MIT 代码许可，详情见[许可与内容说明](#许可与内容说明)。

## 功能

- 按知识分类浏览和搜索题目；可新增、编辑、删除题目，并从回收站恢复已删除题目
- 复习到期题、错题或指定分类；查看答案后按“忘了、困难、良好、简单”自评并安排下次复习
- 按日期和分类筛选复习历史，查看掌握情况
- 将题库、复习排期和历史记录导出为 JSON，也可从 JSON 或旧版网站 v1 备份导入
- 通过本机 SQLite 持久化数据；应用更新不会覆盖个人题目和复习记录
- 提供 Windows 安装版和便携版构建方式

## 下载与安装

目前尚未发布正式 GitHub Release。Windows CI 成功完成后，可在 [Actions 工作流](https://github.com/iamliyangjing/java-review-site/actions/workflows/ci.yml)打开最新运行记录，并从 Artifacts 下载 `java-review-windows`。压缩包中包含安装版和便携版构建产物。

安装版可选择安装位置，并创建开始菜单和桌面快捷方式。便携版无需安装。应用数据保存在当前 Windows 用户的本机应用数据目录；卸载或更换电脑前，请先从应用内导出 JSON 备份。

## 从源码运行

### 环境要求

- Windows 10 或更高版本
- Node.js 22.12 或更高版本
- npm（随 Node.js 安装）

### 启动开发版

```powershell
git clone https://github.com/iamliyangjing/java-review-site.git
cd java-review-site
npm ci
npm run dev
```

首次安装依赖或首次开发/构建时需要网络下载 npm 包和 Electron 运行时。打包完成后，桌面应用运行和复习不需要网络。

### 运行测试和构建

```powershell
npx playwright install chromium
npm test
npm run build
```

`npm test` 运行项目测试；Playwright 首次运行前需安装 Chromium。`npm run build` 会生成 Windows NSIS 安装程序和便携版，文件输出到 `release/`。也可以单独运行 `npm run build:installer` 或 `npm run build:portable`。

GitHub Actions 会在推送、Pull Request 和手动触发时安装依赖、执行高危漏洞审计、运行测试并构建 Windows 产物。

## 项目结构

```text
electron/                 Electron 主进程、预加载接口和本地题库存储
js/desktop-renderer.cjs   桌面端界面逻辑
desktop.html              桌面应用页面
data/questions.json       首次启动导入的内置题库
tests/                    自动化测试
scripts/                  题库生成等维护脚本
index.html                旧版浏览器知识图谱入口
js/notes/                 旧版浏览器端学习笔记
supabase/migrations/      旧版浏览器云功能的数据库迁移
vendor/                   旧版浏览器端使用的第三方发行文件及许可说明
```

桌面版与仓库保留的旧版浏览器知识图谱是两套独立入口。桌面版使用本机 SQLite，不连接 Supabase。旧版页面可通过本地 HTTP 服务访问；登录、云同步和图片存储是可选的 Supabase 功能。

如需启用旧版页面的云功能，请复制配置模板并填写自己的项目 URL 和 publishable/anon key：

```powershell
Copy-Item js/supabase-config.js js/supabase-config.local.js
```

本地配置文件已加入 `.gitignore`。请勿在前端或提交记录中放入 Supabase secret 或 service-role key，并为云端表和 Storage 配置适当的 RLS 策略。新克隆项目默认不会连接 Supabase 项目。

## 参与贡献

欢迎通过 Issue 讨论问题、内容建议和功能改进，也欢迎提交 Pull Request。提交前请：

1. 对较大的功能先开 Issue 讨论预期行为和实现范围。
2. 在独立分支中进行改动，并保持提交范围清晰。
3. 运行 `npm ci` 和 `npm test`；涉及构建配置时，再运行 `npm run build`。
4. 不要提交个人数据库、备份文件、`js/supabase-config.local.js`、密钥或构建产物。

## 许可与内容说明

根目录 [LICENSE](LICENSE) 中的 MIT 许可**仅适用于本项目贡献者原创的软件代码**，包括应用、脚本、测试和数据库迁移代码。它不适用于 README 等项目文档、面试题、学习笔记、分类和题目数据、图片或其他非代码内容。

题库与笔记参考了《图解 Java》《图解网络》《图解系统》等资料，相关出处尽量保留在内容中。题库、笔记、图片及引用资料仍受各自权利和许可约束；MIT 代码许可不授予这些内容的再分发权。`vendor/` 中的 ECharts、Supabase JS 等第三方组件依据各自随附的许可说明使用。转载或再分发前，请先核实对应内容的授权条件。
