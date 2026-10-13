// Node dialogs, backups, notifications, and coordinated view refreshes.
window.Editor = (function () {
  let dialog = null;
  let action = null;
  let nodeId = null;

  function notify(message, isError) {
    const status = document.getElementById("app-status");
    status.hidden = false;
    status.classList.toggle("is-error", !!isError);
    document.getElementById("status-message").textContent = message;
  }

  function refreshViews(selectedId, structureChanged = true) {
    if (structureChanged) {
      window.GraphView.refresh(selectedId || null);
      window.TreeView.refresh();
    }
    window.SearchView.refresh();
    window.ProgressPanel.refresh();
    if (selectedId && window.NODE_MAP[selectedId]) {
      window.TreeView.highlightNode(selectedId);
      window.NotePanel.show(selectedId);
    } else {
      window.NotePanel.hide();
    }
  }

  function openNodeDialog(nextAction, id) {
    if (!window.NotePanel.canLeave()) return;
    action = nextAction;
    nodeId = id || null;
    const node = window.NODE_MAP[nodeId];
    if (action !== "add" && !node) return;
    const titles = { add: "新增知识点", rename: "重命名节点", move: "移动节点", delete: "删除节点" };
    document.getElementById("dialog-title").textContent = titles[action];
    document.getElementById("node-form").reset();
    document.getElementById("dialog-error").textContent = "";
    document.getElementById("name-field").hidden = !["add", "rename"].includes(action);
    document.getElementById("parent-field").hidden = !["add", "move"].includes(action);
    document.getElementById("new-note-fields").hidden = action !== "add";
    const name = document.getElementById("node-name");
    name.value = action === "rename" ? node.name : "";
    name.required = ["add", "rename"].includes(action);
    name.disabled = !name.required;
    const parent = document.getElementById("node-parent");
    parent.replaceChildren(new Option("无父节点（顶层模块）", ""));
    const excluded = new Set(action === "move" ? window.EditStore.collectDescendants(nodeId) : []);
    for (const candidate of window.NODES) {
      if (excluded.has(candidate.id)) continue;
      parent.appendChild(new Option("　".repeat(Math.min(candidate.level - 1, 8)) + candidate.name, candidate.id));
    }
    parent.value = action === "move" ? (node.parent || "") : (id || "");
    const message = document.getElementById("dialog-description");
    message.textContent = action === "delete"
      ? "将删除「" + node.name + "」及 " + (window.EditStore.collectDescendants(nodeId).length - 1) + " 个子节点。历史打卡和云端图片保留，删除后可用先前备份在空白配置中恢复。"
      : action === "move" ? "选择新的归属，自身及子节点已从选项中排除。" : "内容保存在当前浏览器中，可导出备份。";
    const submit = document.getElementById("dialog-submit");
    submit.textContent = action === "delete" ? "确认删除" : "保存";
    submit.className = action === "delete" ? "btn-danger" : "btn-primary";
    dialog.showModal();
    if (name.required) name.focus();
    else if (action === "move") parent.focus();
    else document.getElementById("dialog-cancel").focus();
  }

  function submit(event) {
    event.preventDefault();
    try {
      const name = document.getElementById("node-name").value.trim();
      const parentId = document.getElementById("node-parent").value || null;
      let selectedId = nodeId;
      if (action === "add") {
        selectedId = window.EditStore.addNode(name, parentId, {
          summary: document.getElementById("new-summary").value.trim(),
          points: document.getElementById("new-points").value.split("\n").map(point => point.trim()).filter(Boolean)
        });
      }
      if (action === "rename") window.EditStore.renameNode(nodeId, name);
      if (action === "move" && !window.EditStore.moveNode(nodeId, parentId)) throw new Error("不能移动到自身、子节点或不存在的节点");
      if (action === "delete") {
        selectedId = window.NODE_MAP[nodeId].parent;
        window.EditStore.deleteNode(nodeId);
      }
      dialog.close();
      refreshViews(selectedId);
      notify(action === "delete" ? "节点已删除，历史打卡记录已保留" : "修改已保存");
    } catch (error) {
      document.getElementById("dialog-error").textContent = error.message;
    }
  }

  function exportBackup() {
    try {
      const data = window.EditStore.exportData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = "java-review-backup-" + new Date().toISOString().replace(/[:.]/g, "-") + ".json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      notify("备份已导出，包含节点修改、笔记、掌握程度和打卡记录");
    } catch (error) { notify(error.message, true); }
  }

  async function importBackup(event) {
    const input = event.target;
    const file = input.files[0];
    if (!file) return;
    try {
      if (!window.NotePanel.canLeave()) return;
      if (file.size > 5 * 1024 * 1024) throw new Error("备份文件过大，请选择小于 5 MB 的 JSON 文件");
      const data = JSON.parse(await file.text());
      const result = window.EditStore.importData(data);
      if (!result.ok) throw new Error(result.message);
      refreshViews(window.NotePanel.getCurrentId());
      notify("导入完成：新增 " + result.stats.nodes + " 个节点、" + result.stats.notes + " 篇笔记。已有笔记保留，打卡合并去重。");
    } catch (error) {
      notify(error instanceof SyntaxError ? "文件不是有效的 JSON 备份" : error.message, true);
    } finally { input.value = ""; }
  }

  function init() {
    dialog = document.getElementById("node-dialog");
    document.getElementById("workspace-date").textContent = new Date().toLocaleDateString("zh-CN", { month: "long", day: "numeric", weekday: "short" });
    document.querySelectorAll("[data-open-node]").forEach(button => {
      button.addEventListener("click", () => window.GraphView.selectNode(button.dataset.openNode));
    });
    document.getElementById("add-node").addEventListener("click", () => openNodeDialog("add"));
    document.getElementById("graph-add-node").addEventListener("click", () => openNodeDialog("add", window.GraphView.getSelectedId()));
    document.getElementById("graph-delete-node").addEventListener("click", () => {
      const selectedId = window.GraphView.getSelectedId();
      if (selectedId) openNodeDialog("delete", selectedId);
    });
    document.getElementById("graph-reset").addEventListener("click", () => window.GraphView.resetView());
    document.getElementById("export-data").addEventListener("click", exportBackup);
    document.getElementById("import-data").addEventListener("click", () => document.getElementById("import-file").click());
    document.getElementById("import-file").addEventListener("change", importBackup);
    document.getElementById("node-form").addEventListener("submit", submit);
    document.getElementById("dialog-cancel").addEventListener("click", () => dialog.close());
    document.getElementById("status-dismiss").addEventListener("click", () => { document.getElementById("app-status").hidden = true; });
    const warnings = window.AppStorage.takeWarnings();
    if (warnings.length) notify(warnings.join(" "), true);
  }

  return { init, openNodeDialog, notify, refreshViews };
})();
