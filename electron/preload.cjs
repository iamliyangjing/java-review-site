const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("questionBank", Object.freeze({
  bootstrap: () => ipcRenderer.invoke("question-bank:bootstrap"),
  listQuestions: options => ipcRenderer.invoke("question-bank:list", options),
  getCategories: () => ipcRenderer.invoke("question-bank:categories"),
  saveQuestion: question => ipcRenderer.invoke("question-bank:save", question),
  deleteQuestion: id => ipcRenderer.invoke("question-bank:delete", id),
  restoreQuestion: id => ipcRenderer.invoke("question-bank:restore", id),
  getDueQuestions: options => ipcRenderer.invoke("question-bank:due", options),
  recordReview: payload => ipcRenderer.invoke("question-bank:review", payload),
  getReviewHistory: options => ipcRenderer.invoke("question-bank:history", options),
  getReviewStats: () => ipcRenderer.invoke("question-bank:stats"),
  getLegacySummary: () => ipcRenderer.invoke("question-bank:legacy-summary"),
  exportData: () => ipcRenderer.invoke("question-bank:export"),
  importData: json => ipcRenderer.invoke("question-bank:import", { json }),
  getCloudStatus: () => ipcRenderer.invoke("cloud:status"),
  saveCloudConfig: config => ipcRenderer.invoke("cloud:save-config", config),
  cloudSignUp: credentials => ipcRenderer.invoke("cloud:sign-up", credentials),
  cloudSignIn: credentials => ipcRenderer.invoke("cloud:sign-in", credentials),
  cloudSignOut: () => ipcRenderer.invoke("cloud:sign-out"),
  uploadCloudBackup: () => ipcRenderer.invoke("cloud:upload"),
  restoreCloudBackup: () => ipcRenderer.invoke("cloud:restore")
}));
