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
  importData: json => ipcRenderer.invoke("question-bank:import", { json })
}));
