const path = require("node:path");
const fs = require("node:fs");
const { app, BrowserWindow, dialog, ipcMain, safeStorage, session, Menu } = require("electron");
const { createQuestionStore } = require("./question-store.cjs");
const { createCloudService } = require("./cloud-service.cjs");
const { createDiagnostic: createDiagnosticData } = require("./diagnostics.cjs");

const APP_ROOT = path.resolve(__dirname, "..");
const DESKTOP_PAGE = path.join(APP_ROOT, "desktop.html");
const APP_ICON = app.isPackaged
  ? path.join(process.resourcesPath, "app-icon.png")
  : path.join(APP_ROOT, "assets", "app-icon.png");
const SEED_PATH = path.join(APP_ROOT, "data", "questions.json");
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
let store;
let cloudService;
let mainWindow;
const hasSingleInstanceLock = app.requestSingleInstanceLock();

if (!hasSingleInstanceLock) app.quit();
else app.on("second-instance", () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

function createDiagnostic(eventName, error) {
  return createDiagnosticData({
    eventName,
    error,
    appVersion: app.getVersion(),
    platform: process.platform,
    architecture: process.arch,
    electron: process.versions.electron,
    node: process.versions.node
  });
}

async function exportDiagnostic(eventName, error) {
  const result = await dialog.showSaveDialog(mainWindow, {
    title: "导出脱敏诊断信息",
    defaultPath: "java-review-diagnostic-" + new Date().toISOString().slice(0, 10) + ".json",
    filters: [{ name: "JSON 诊断信息", extensions: ["json"] }]
  });
  if (result.canceled || !result.filePath) return;
  fs.writeFileSync(result.filePath, JSON.stringify(createDiagnostic(eventName, error), null, 2), { encoding: "utf8", mode: 0o600 });
}

function saveLocalJsonSnapshot(kind, snapshot) {
  const backupDir = path.join(app.getPath("userData"), "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = kind + "-" + stamp + ".json";
  const backupPath = path.join(backupDir, filename);
  const tempPath = backupPath + ".tmp";
  const file = fs.openSync(tempPath, "wx", 0o600);
  try {
    fs.writeFileSync(file, JSON.stringify(snapshot, null, 2), "utf8");
    fs.fsyncSync(file);
  } finally {
    fs.closeSync(file);
  }
  fs.renameSync(tempPath, backupPath);
  const snapshots = fs.readdirSync(backupDir)
    .filter(name => /^(pre-import|pre-cloud-restore)-.*\.json$/.test(name))
    .sort()
    .reverse();
  for (const oldSnapshot of snapshots.slice(10)) fs.unlinkSync(path.join(backupDir, oldSnapshot));
  return backupPath;
}

function assertLocalFrame(event) {
  const frameUrl = event.senderFrame?.url || "";
  if (!frameUrl.startsWith("file://") || !frameUrl.includes("desktop.html")) {
    throw new Error("拒绝来自非本地应用页面的请求");
  }
}

function registerIpcHandlers() {
  const handle = (channel, callback) => {
    ipcMain.handle(channel, (event, payload) => {
      assertLocalFrame(event);
      return callback(payload);
    });
  };
  handle("question-bank:bootstrap", () => ({
    knowledgeBases: store.getKnowledgeBases(),
    categories: store.getCategories(),
    questions: store.listQuestions(),
    stats: store.getReviewStats(),
    legacySummary: store.getLegacySummary()
  }));
  handle("question-bank:list", options => store.listQuestions(options || {}));
  handle("question-bank:categories", () => store.getCategories());
  handle("question-bank:knowledge-bases", () => store.getKnowledgeBases());
  handle("question-bank:knowledge-base:save", payload => store.saveKnowledgeBase(payload));
  handle("question-bank:knowledge-base:delete", id => store.deleteKnowledgeBase(id));
  handle("question-bank:category:save", payload => store.saveCategory(payload));
  handle("question-bank:category:delete", id => store.deleteCategory(id));
  handle("question-bank:category:move", payload => store.moveCategory(payload));
  handle("question-bank:save", question => store.saveQuestion(question));
  handle("question-bank:delete", id => store.deleteQuestion(id));
  handle("question-bank:restore", id => store.restoreQuestion(id));
  handle("question-bank:due", options => store.listQuestions({ ...(options || {}), scope: "due" }));
  handle("question-bank:review", payload => store.recordReview(payload));
  handle("question-bank:history", options => store.getReviewHistory(options || {}));
  handle("question-bank:stats", options => store.getReviewStats(options || {}));
  handle("question-bank:legacy-summary", () => store.getLegacySummary());
  handle("question-bank:export", async () => {
    const result = await dialog.showSaveDialog(mainWindow, {
      title: "导出题库备份",
      defaultPath: "java-interview-bank-" + new Date().toISOString().slice(0, 10) + ".json",
      filters: [{ name: "JSON 备份", extensions: ["json"] }]
    });
    if (result.canceled || !result.filePath) return { canceled: true };
    const fs = require("node:fs");
    fs.writeFileSync(result.filePath, JSON.stringify(store.exportData(), null, 2), "utf8");
    return { canceled: false, filePath: result.filePath };
  });
  handle("question-bank:import", payload => {
    if (!payload || typeof payload.json !== "string" || Buffer.byteLength(payload.json, "utf8") > MAX_IMPORT_BYTES) {
      throw new Error("备份文件超过 20 MB 或内容无效");
    }
    let data;
    try { data = JSON.parse(payload.json); } catch { throw new Error("备份文件不是有效的 JSON"); }
    saveLocalJsonSnapshot("pre-import", store.exportData());
    return store.importData(data);
  });
  handle("cloud:status", () => cloudService.getStatus());
  handle("cloud:save-config", payload => cloudService.saveConfig(payload));
  handle("cloud:sign-up", payload => cloudService.signUp(payload));
  handle("cloud:sign-in", payload => cloudService.signIn(payload));
  handle("cloud:sign-in-token", payload => cloudService.signInWithToken(payload));
  handle("cloud:sign-in-anonymous", () => cloudService.signInAnonymously());
  handle("cloud:sign-out", () => cloudService.signOut());
  handle("cloud:upload", () => cloudService.uploadBackup(store.exportData()));
  handle("cloud:list", () => cloudService.listBackups());
  handle("cloud:restore", async payload => {
    const remote = await cloudService.downloadBackup(payload?.revision ?? null);
    const localBackup = store.exportData();
    const backupPath = saveLocalJsonSnapshot("pre-cloud-restore", localBackup);
    const result = store.importData(remote.backup);
    return { ...result, backupPath, revision: remote.revision, updatedAt: remote.updatedAt };
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 960,
    minHeight: 680,
    show: false,
    backgroundColor: "#f4f7f5",
    title: "Java 面试题库",
    icon: APP_ICON,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
  });
  mainWindow.webContents.on("render-process-gone", (_event, details) => {
    if (details.reason === "clean-exit") return;
    dialog.showMessageBox(mainWindow, { type: "warning", title: "应用页面意外退出", message: "可以导出不包含题库和数据库的诊断信息，检查后自行提交。", buttons: ["导出诊断", "关闭"] })
      .then(({ response }) => response === 0 && exportDiagnostic("render-process-gone", details.reason));
  });
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  mainWindow.webContents.on("will-navigate", (event, url) => {
    try {
      const targetPath = path.resolve(decodeURIComponent(new URL(url).pathname.replace(/^\/[A-Za-z]:/, match => match.slice(1))));
      if (targetPath.toLowerCase() !== DESKTOP_PAGE.toLowerCase()) event.preventDefault();
    } catch { event.preventDefault(); }
  });
  mainWindow.once("ready-to-show", () => mainWindow.show());
  mainWindow.loadFile(DESKTOP_PAGE);
  if (!app.isPackaged && process.env.JAVA_REVIEW_DEVTOOLS === "1") {
    mainWindow.webContents.openDevTools({ mode: "detach" });
  }
}

app.whenReady().then(async () => {
  if (!hasSingleInstanceLock) return;
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (details, callback) => {
    callback({ cancel: true });
  });
  try {
    store = await createQuestionStore({ dataDir: app.getPath("userData"), seedPath: SEED_PATH });
    if (process.env.JAVA_REVIEW_SMOKE_TEST === "1") {
      const categories = store.getCategories();
      const smoke = store.saveQuestion({
        categoryId: categories[0].id,
        question: "Packaged persistence smoke test",
        answer: "This temporary record must survive a database reopen.",
        tags: ["smoke"]
      });
      store.recordReview({ questionId: smoke.id, grade: "good" });
      store.close();
      store = await createQuestionStore({ dataDir: app.getPath("userData"), seedPath: SEED_PATH });
      const reopened = store.listQuestions().find(question => question.id === smoke.id);
      if (store.listQuestions().length !== 184 || !reopened || store.getReviewHistory().length !== 1) {
        throw new Error("Packaged SQLite persistence smoke test failed");
      }
      store.deleteQuestion(smoke.id);
      store.close();
      store = null;
      app.quit();
      return;
    }
    cloudService = createCloudService({
      dataDir: app.getPath("userData"),
      safeStorage,
      developmentConfigPath: app.isPackaged ? null : path.join(APP_ROOT, "js", "supabase-config.local.js")
    });
    registerIpcHandlers();
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: "帮助", submenu: [
      { label: "导出诊断信息…", click: () => exportDiagnostic("user-request", "用户手动导出") },
      { type: "separator" },
      { label: "隐私说明", click: () => dialog.showMessageBox(mainWindow, { type: "info", title: "隐私说明", message: "应用不会自动发送遥测或题库数据。诊断信息仅在你主动导出后保存到所选位置，请检查内容后再自行提交。" }) }
    ] }]));
    createWindow();
  } catch (error) {
    dialog.showErrorBox("Java 面试题库启动失败", error.message || String(error));
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && store) createWindow();
});

process.on("uncaughtException", error => {
  dialog.showMessageBox(mainWindow, { type: "error", title: "应用遇到错误", message: "可以导出脱敏诊断信息。诊断不会自动发送。", buttons: ["导出诊断", "关闭"] })
    .then(({ response }) => response === 0 && exportDiagnostic("uncaught-exception", error))
    .finally(() => app.quit());
});

app.on("before-quit", () => {
  store?.close();
  store = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
