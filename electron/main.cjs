const path = require("node:path");
const { app, BrowserWindow, dialog, ipcMain, session } = require("electron");
const { createQuestionStore } = require("./question-store.cjs");

const APP_ROOT = path.resolve(__dirname, "..");
const DESKTOP_PAGE = path.join(APP_ROOT, "desktop.html");
const SEED_PATH = path.join(APP_ROOT, "data", "questions.json");
const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
let store;
let mainWindow;

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
    categories: store.getCategories(),
    questions: store.listQuestions(),
    stats: store.getReviewStats(),
    legacySummary: store.getLegacySummary()
  }));
  handle("question-bank:list", options => store.listQuestions(options || {}));
  handle("question-bank:categories", () => store.getCategories());
  handle("question-bank:save", question => store.saveQuestion(question));
  handle("question-bank:delete", id => store.deleteQuestion(id));
  handle("question-bank:restore", id => store.restoreQuestion(id));
  handle("question-bank:due", options => store.listQuestions({ ...(options || {}), scope: "due" }));
  handle("question-bank:review", payload => store.recordReview(payload));
  handle("question-bank:history", options => store.getReviewHistory(options || {}));
  handle("question-bank:stats", () => store.getReviewStats());
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
    return store.importData(data);
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
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true
    }
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
  session.defaultSession.webRequest.onBeforeRequest({ urls: ["http://*/*", "https://*/*", "ws://*/*", "wss://*/*"] }, (details, callback) => {
    callback({ cancel: true });
  });
  try {
    store = await createQuestionStore({ dataDir: app.getPath("userData"), seedPath: SEED_PATH });
    registerIpcHandlers();
    createWindow();
  } catch (error) {
    dialog.showErrorBox("Java 面试题库启动失败", error.message || String(error));
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0 && store) createWindow();
});

app.on("before-quit", () => {
  store?.close();
  store = null;
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
