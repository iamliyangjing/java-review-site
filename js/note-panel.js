// Note panel: renders review notes for the selected node, with edit mode.
window.NotePanel = (function () {
  let currentNodeId = null;
  let editSnapshot = null;

  const MASTERY_LABEL = {
    unlearned: "未学",
    learning: "学习中",
    mastered: "已掌握"
  };

  function breadcrumb(nodeId) {
    const parts = [];
    let node = window.NODE_MAP[nodeId];
    while (node && node.parent) {
      node = window.NODE_MAP[node.parent];
      if (node) parts.unshift(node.name);
    }
    return parts.join(" / ");
  }

  function refreshViews(structureChanged = true) {
    window.Editor.refreshViews(currentNodeId, structureChanged);
  }

  function runAction(action) {
    if (window.NoteImages?.isBusy()) {
      window.Editor.notify("图片正在上传或删除，请稍候。");
      return;
    }
    try { action(); } catch (error) { window.Editor.notify(error.message, true); }
  }

  function isDirty() {
    return editSnapshot && (
      document.getElementById("edit-summary")?.value !== editSnapshot.summary ||
      document.getElementById("edit-points")?.value !== editSnapshot.points
    );
  }

  function canLeave() {
    if (window.NoteImages?.isBusy()) {
      window.Editor.notify("图片正在上传或删除，请稍候。");
      return false;
    }
    return !isDirty() || window.confirm("笔记尚未保存，确定放弃修改？");
  }

  function show(nodeId, opts) {
    editSnapshot = null;
    currentNodeId = nodeId;
    const opts2 = opts || {};
    const node = window.NODE_MAP[nodeId];
    if (!node) {
      hide();
      return;
    }
    const note = window.NOTES[nodeId] || { core: false, summary: "", points: [], status: "pending" };

    const empty = document.getElementById("note-empty");
    const content = document.getElementById("note-content");
    empty.style.display = "none";
    content.style.display = "block";

    if (opts2.editMode) {
      renderEditMode(nodeId, node, note, content);
      return;
    }
    renderViewMode(nodeId, node, note, content);
  }

  function renderViewMode(nodeId, node, note, content) {
    const mastery = window.ProgressStore ? window.ProgressStore.getMastery(nodeId) : "unlearned";
    const checkedIn = window.ProgressStore ? window.ProgressStore.isCheckedInToday(nodeId) : false;
    const hasEdits = window.EditStore ? window.EditStore.hasEdits(nodeId) : false;
    const isCustom = window.EditStore ? window.EditStore.isCustom(nodeId) : false;

    const crumb = breadcrumb(nodeId);
    let html = '<div class="note-crumb">' + escapeHtml(crumb || "知识地图") + "</div>";
    html += '<div class="note-meta">';
    html += node.core ? '<span class="topic-badge">核心知识点</span>' : '<span class="topic-badge">复习知识点</span>';
    if (isCustom) html += '<span class="custom-badge">自定义</span>';
    if (hasEdits) html += '<span class="edited-label">已编辑</span>';
    html += "</div><h2>" + escapeHtml(node.name) + "</h2>";

    // Action bar: edit notes / rename / move / delete / restore
    html += '<div class="note-actions">';
    html += '<button class="btn-edit" data-action="edit">编辑笔记</button>';
    html += '<button class="btn-edit" data-action="rename">重命名</button>';
    html += '<button class="btn-edit" data-action="move">移动</button>';
    html += '<button class="btn-danger" data-action="delete">删除</button>';
    if (hasEdits) html += '<button class="btn-edit" data-action="reset">还原</button>';
    html += "</div>";

    // Mastery selector.
    html += '<div class="review-controls"><span class="review-caption">这个知识点，你掌握得如何？</span>';
    html += '<div class="mastery-selector" data-node-id="' + escapeAttr(nodeId) + '">';
    for (const level of ["unlearned", "learning", "mastered"]) {
      html += '<button class="mastery-btn ' + (mastery === level ? "active" : "") +
        '" data-mastery="' + level + '" aria-pressed="' + (mastery === level) + '">' + MASTERY_LABEL[level] + "</button>";
    }
    html += "</div>";

    // Check-in button.
    html += '<button class="checkin-btn" data-node-id="' + escapeAttr(nodeId) + '"' +
      (checkedIn ? " disabled" : "") + ">" +
      (checkedIn ? "今天已完成复习 ✓" : "完成今日复习") + "</button></div>";

    // Note content.
    html += '<section class="note-images" aria-label="知识点图片资料"></section>';
    if (note.status === "pending" || (!note.summary && !note.points.length)) {
      html += '<div class="note-placeholder">内容待补充，写下你的第一条笔记吧。</div>';
    } else {
      if (note.summary) html += '<h3 class="note-section-heading">内容概览</h3><p class="note-summary">' + escapeHtml(note.summary) + "</p>";
      if (note.points && note.points.length > 0) {
        html += '<h3 class="note-section-heading">面试要点</h3><ol class="note-points">';
        for (const pt of note.points) {
          html += /^面试话术[：:]/.test(pt)
            ? '<li class="interview-script"><span class="interview-label">面试表达</span><p>' + escapeHtml(pt.replace(/^面试话术[：:]\s*/, "")) + "</p></li>"
            : /^(知识地图|核心原理|面试重点|实战避坑|版本边界|模拟题)[：:]/.test(pt)
              ? '<li class="structured-point"><span class="point-label">' + escapeHtml(pt.split(/[：:]/)[0]) + '</span><span>' + escapeHtml(pt.replace(/^[^：:]+[：:]\s*/, "")) + "</span></li>"
              : "<li>" + escapeHtml(pt) + "</li>";
        }
        html += "</ol>";
      }
    }

    const sources = window.NOTE_SOURCES?.[nodeId] || [];
    if (sources.length) {
      html += '<div class="note-sources"><h3>参考资料</h3><ul>';
      for (const source of sources) {
        if (!source.url.startsWith("https://")) continue;
        html += '<li><a href="' + escapeAttr(source.url) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(source.label) + " ↗</a></li>";
      }
      html += "</ul></div>";
    }

    content.innerHTML = html;
    window.NoteImages?.mount(content.querySelector(".note-images"), nodeId);

    // Wire action buttons.
    const actions = content.querySelectorAll(".note-actions button");
    for (const btn of actions) {
      btn.addEventListener("click", () => runAction(() => {
        const action = btn.dataset.action;
        if (action === "edit") {
          show(nodeId, { editMode: true });
        } else if (action === "reset") {
          window.EditStore.resetNode(nodeId);
          refreshViews();
          window.Editor.notify("已还原节点内容");
        } else if (action === "rename" || action === "move" || action === "delete") {
          if (window.Editor) window.Editor.openNodeDialog(action, nodeId);
        }
      }));
    }

    // Wire mastery buttons.
    const btns = content.querySelectorAll(".mastery-btn");
    for (const btn of btns) {
      btn.addEventListener("click", () => runAction(() => {
        if (!window.ProgressStore) return;
        window.ProgressStore.setMastery(nodeId, btn.dataset.mastery);
        updateMasteryUI(nodeId);
        const masteryMap = window.ProgressStore.getAllMastery();
        window.GraphView.setMasteryColors(masteryMap);
        window.TreeView.setMasteryDots(masteryMap);
        window.ProgressPanel.refresh();
      }));
    }

    // Wire check-in button.
    const checkinBtn = content.querySelector(".checkin-btn");
    if (checkinBtn) {
      checkinBtn.addEventListener("click", () => runAction(() => {
        if (!window.ProgressStore) return;
        window.ProgressStore.checkIn(nodeId);
        checkinBtn.disabled = true;
        checkinBtn.textContent = "今天已完成复习 ✓";
        if (window.ProgressPanel) window.ProgressPanel.refresh();
      }));
    }
  }

  function renderEditMode(nodeId, node, note, content) {
    let html = "<h2>编辑笔记：" + escapeHtml(node.name) + "</h2>";
    html += '<div class="note-crumb">' + escapeHtml(breadcrumb(nodeId)) + "</div>";
    html += '<label class="edit-label" for="edit-summary">摘要</label>';
    html += '<input type="text" class="edit-input" id="edit-summary" value="' +
      escapeAttr(note.summary || "") + '">';
    html += '<label class="edit-label" for="edit-points">要点（每行一条）</label>';
    html += '<textarea class="edit-textarea" id="edit-points" rows="14">' +
      escapeHtml((note.points || []).join("\n")) + "</textarea>";
    html += '<div class="edit-actions">';
    html += '<button class="btn-primary" id="edit-save">保存笔记</button>';
    html += '<button class="btn-edit" id="edit-cancel">取消</button>';
    html += "</div>";

    html += '<section class="note-images" aria-label="知识点图片资料"></section>';
    content.innerHTML = html;
    window.NoteImages?.mount(content.querySelector(".note-images"), nodeId);
    editSnapshot = { summary: note.summary || "", points: (note.points || []).join("\n") };

    document.getElementById("edit-save").addEventListener("click", () => runAction(() => {
      const summary = document.getElementById("edit-summary").value.trim();
      const points = document.getElementById("edit-points").value
        .split("\n")
        .map(s => s.trim())
        .filter(s => s.length > 0);
      window.EditStore.saveNote(nodeId, { summary: summary, points: points });
      editSnapshot = null;
      refreshViews(false);
      window.Editor.notify("笔记已保存");
    }));

    document.getElementById("edit-cancel").addEventListener("click", () => {
      if (canLeave()) show(nodeId);
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function escapeAttr(str) {
    return escapeHtml(str).replace(/"/g, "&quot;");
  }

  function updateMasteryUI(nodeId) {
    if (!window.ProgressStore) return;
    const level = window.ProgressStore.getMastery(nodeId);
    const btns = document.querySelectorAll('.mastery-selector[data-node-id="' + nodeId + '"] .mastery-btn');
    for (const btn of btns) {
      btn.classList.toggle("active", btn.dataset.mastery === level);
      btn.setAttribute("aria-pressed", String(btn.dataset.mastery === level));
    }
  }

  function hide() {
    window.NoteImages?.unmount();
    editSnapshot = null;
    currentNodeId = null;
    const empty = document.getElementById("note-empty");
    const content = document.getElementById("note-content");
    empty.style.display = "";
    content.style.display = "none";
    content.innerHTML = "";
  }

  window.addEventListener("beforeunload", event => {
    if (!isDirty() && !window.NoteImages?.isBusy()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  return { show, hide, canLeave, isEditing() { return editSnapshot !== null; }, getCurrentId() { return currentNodeId; } };
})();
