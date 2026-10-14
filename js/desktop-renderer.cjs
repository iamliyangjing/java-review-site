(() => {
  const api = window.questionBank;
  const state = {
    categories: [],
    questions: [],
    reviewQueue: [],
    reviewCursor: 0,
    reviewMode: "due",
    reviewCategory: "",
    bankCategory: "",
    bankQuery: "",
    trashOpen: false,
    editingId: null,
    confirmCallback: null,
    cloudStatus: { configured: false, signedIn: false },
    toastTimer: null
  };

  const GRADE_LABELS = { again: "忘了", hard: "困难", good: "良好", easy: "简单" };
  const GRADE_HELP = { again: "忘了", hard: "有印象", good: "基本掌握", easy: "很熟悉" };
  const $ = selector => document.querySelector(selector);

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function formatDate(value, options = { month: "long", day: "numeric", weekday: "short" }) {
    return new Intl.DateTimeFormat("zh-CN", options).format(new Date(value));
  }

  function categoryMap() {
    return new Map(state.categories.map(category => [category.id, category]));
  }

  function descendantsFor(categoryId) {
    if (!categoryId) return null;
    const result = new Set([categoryId]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const category of state.categories) {
        if (category.parentId && result.has(category.parentId) && !result.has(category.id)) {
          result.add(category.id);
          changed = true;
        }
      }
    }
    return result;
  }

  function filteredByCategory(items, categoryId) {
    const allowed = descendantsFor(categoryId);
    return allowed ? items.filter(item => allowed.has(item.categoryId)) : items;
  }

  function fillCategorySelect(select, selected = "", includeAll = true) {
    const options = [];
    if (includeAll) options.push('<option value="">全部分类</option>');
    for (const category of state.categories) {
      const prefix = category.level > 1 ? "　" + "— ".repeat(Math.min(category.level - 1, 3)) : "";
      options.push('<option value="' + escapeHtml(category.id) + '">' + prefix + escapeHtml(category.name) + "</option>");
    }
    select.innerHTML = options.join("");
    if (selected && state.categories.some(category => category.id === selected)) select.value = selected;
  }

  function setView(viewName) {
    document.querySelectorAll("[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === viewName));
    document.querySelectorAll("[data-view-panel]").forEach(panel => {
      const active = panel.dataset.viewPanel === viewName;
      panel.classList.toggle("active", active);
      panel.hidden = !active;
    });
    if (viewName === "bank") renderBank();
    if (viewName === "history") renderHistory();
    if (viewName === "review") loadReviewQueue();
  }

  function showToast(message, isError = false) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.toggle("error", isError);
    toast.classList.add("show");
    clearTimeout(state.toastTimer);
    state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  function openConfirm(title, message, label, callback, danger = true) {
    $("#confirm-title").textContent = title;
    $("#confirm-message").textContent = message;
    $("#confirm-action").textContent = label;
    $("#confirm-action").classList.toggle("danger", danger);
    state.confirmCallback = callback;
    $("#confirm-dialog").showModal();
  }

  async function refreshData(options = {}) {
    const snapshot = await api.bootstrap();
    state.categories = snapshot.categories;
    state.questions = snapshot.questions;
    renderCategoryNavigation();
    renderStats(snapshot.stats);
    fillCategorySelect($("#review-category"), state.reviewCategory);
    fillCategorySelect($("#bank-category"), state.bankCategory);
    fillCategorySelect($("#history-category"));
    fillCategorySelect($("#question-category"), state.categories[0]?.id || "", false);
    if (options.reloadReview !== false && $("#review-view").classList.contains("active")) await loadReviewQueue();
    if ($("#bank-view").classList.contains("active")) await renderBank();
  }

  function renderCategoryNavigation() {
    const rootCategories = state.categories.filter(category => category.parentId === null && !category.deletedAt);
    const moduleList = $("#module-list");
    moduleList.innerHTML = rootCategories.map(category => {
      const categoryIds = descendantsFor(category.id);
      const count = state.questions.filter(question => categoryIds.has(question.categoryId)).length;
      return '<button class="module-filter' + (state.bankCategory === category.id ? " active" : "") + '" type="button" data-category="' + escapeHtml(category.id) + '">' +
        '<span class="module-dot"></span><span>' + escapeHtml(category.name) + '</span><b>' + count + "</b></button>";
    }).join("");
    $("#all-count").textContent = state.questions.length;
    $("#module-list").querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => {
      state.bankCategory = button.dataset.category;
      $("#bank-category").value = state.bankCategory;
      setView("bank");
      renderCategoryNavigation();
    }));
  }

  function renderStats(stats) {
    $("#stat-due").textContent = stats.due;
    $("#stat-total").textContent = stats.total;
    $("#stat-reviewed").textContent = stats.reviewedToday;
    $("#stat-streak").textContent = stats.streak;
    $("#nav-due-count").textContent = stats.due;
    $("#today-label").textContent = formatDate(new Date());
  }

  function activeReviewQuestion() {
    return state.reviewQueue[state.reviewCursor] || null;
  }

  async function loadReviewQueue() {
    const mode = state.reviewMode;
    state.answerRevealed = null;
    let questions = mode === "due"
      ? await api.getDueQuestions()
      : await api.listQuestions(mode === "wrong" ? { scope: "wrong" } : {});
    questions = filteredByCategory(questions, state.reviewCategory);
    if (mode === "all") questions = questions.slice().sort(() => Math.random() - 0.5);
    state.reviewQueue = questions;
    state.reviewCursor = 0;
    renderReviewCard();
    const dueCount = mode === "due" ? questions.length : (await api.getReviewStats()).due;
    $("#stat-due").textContent = dueCount;
    $("#nav-due-count").textContent = dueCount;
  }

  function renderReviewCard() {
    const stage = $("#review-stage");
    const question = activeReviewQuestion();
    if (!question) {
      const isDone = state.reviewMode === "due" && !state.reviewCategory;
      stage.innerHTML = '<div class="empty-state"><div class="empty-icon">' + (isDone ? "✓" : "⌕") + '</div><h2>' +
        (state.reviewMode === "due" ? "今天的到期题复习完了" : "当前筛选下没有题目") + '</h2><p>' +
        (state.reviewMode === "due" ? "做得很好。你可以切到错题回顾，或者随机练习巩固其他主题。" : "试试调整分类或复习范围，也可以到题库里新增一道题。") +
        '</p><button class="button primary" type="button" data-switch-mode="all">开始随机练习</button></div>';
      return;
    }
    const revealed = state.answerRevealed === question.id;
    stage.dataset.questionId = question.id;
    stage.dataset.revealed = String(revealed);
    const tags = question.tags.map(tag => '<span class="tag">' + escapeHtml(tag) + "</span>").join("");
    const answer = revealed
      ? '<div class="answer-area"><div class="answer-label">答案解析</div>' + escapeHtml(question.answer) + '</div><div class="grade-panel"><p class="grade-prompt">你对这道题的掌握程度如何？</p><div class="grade-buttons">' +
        Object.entries(GRADE_LABELS).map(([grade, label]) => '<button class="grade-button" type="button" data-grade="' + grade + '" title="' + GRADE_HELP[grade] + '">' + label + "</button>").join("") +
        '</div></div>'
      : '<div class="reveal-wrap"><button class="reveal-button" type="button" data-reveal>显示答案解析 <span aria-hidden="true">↓</span></button></div>';
    stage.innerHTML = '<article class="review-card"><div class="card-meta"><span class="topic-pill">' + escapeHtml(question.categoryName) +
      '</span><span class="tags">' + tags + '</span><span class="card-number">' + (state.reviewCursor + 1) + " / " + state.reviewQueue.length +
      '</span></div><h2 class="review-question">' + escapeHtml(question.question) + '</h2>' + answer + '</article>';
  }

  async function handleGrade(grade) {
    const question = activeReviewQuestion();
    if (!question) return;
    try {
      const result = await api.recordReview({ questionId: question.id, grade });
      state.answerRevealed = null;
      state.reviewQueue.splice(state.reviewCursor, 1);
      if (state.reviewCursor >= state.reviewQueue.length) state.reviewCursor = Math.max(0, state.reviewQueue.length - 1);
      await refreshData({ reloadReview: false });
      renderReviewCard();
      showToast(GRADE_LABELS[grade] + " · 下次复习 " + formatDate(result.dueAt, { year: "numeric", month: "numeric", day: "numeric" }));
    } catch (error) { showToast(error.message, true); }
  }

  async function renderBank() {
    const scope = state.trashOpen ? "deleted" : "all";
    const items = await api.listQuestions({ scope, query: state.bankQuery });
    const filtered = filteredByCategory(items, state.bankCategory);
    $("#bank-result-count").textContent = filtered.length + " 道题";
    $("#trash-count").textContent = await api.listQuestions({ scope: "deleted" }).then(list => list.length);
    $("#open-trash").innerHTML = state.trashOpen ? "返回题库" : '回收站 <span id="trash-count">' + $("#trash-count").textContent + "</span>";
    $("#question-list").innerHTML = filtered.length ? filtered.map(question => {
      const tags = question.tags.slice(0, 3).map(tag => '<span class="tag">' + escapeHtml(tag) + "</span>").join("");
      const action = state.trashOpen
        ? '<button class="icon-action" type="button" data-restore-id="' + escapeHtml(question.id) + '" title="恢复题目">↶</button>'
        : '<button class="icon-action" type="button" data-edit-id="' + escapeHtml(question.id) + '" title="编辑题目">✎</button><button class="icon-action delete" type="button" data-delete-id="' + escapeHtml(question.id) + '" title="移入回收站">×</button>';
      const dueText = question.dueAt ? "下次复习 " + formatDate(question.dueAt, { month: "numeric", day: "numeric" }) : "尚未复习";
      return '<article class="question-row"><div class="question-row-content"><div class="question-row-meta"><span class="topic-pill">' + escapeHtml(question.categoryName) +
        '</span><span>' + escapeHtml(dueText) + '</span><span class="tags">' + tags + '</span></div><h3>' + escapeHtml(question.question) +
        '</h3><p class="question-row-preview">' + escapeHtml(question.answer.replace(/\s+/g, " ").slice(0, 190)) + '</p></div><div class="row-actions">' + action + "</div></article>";
    }).join("") : '<div class="empty-list"><strong>' + (state.trashOpen ? "回收站是空的" : "没有找到匹配的题目") + "</strong>" + (state.trashOpen ? "删除的题目会在这里等待恢复。" : "调整筛选条件，或者新增一道自己的题目。") + "</div>";
  }

  async function renderHistory() {
    const options = {
      categoryId: $("#history-category").value,
      from: $("#history-from").value,
      to: $("#history-to").value
    };
    const entries = await api.getReviewHistory(options);
    $("#history-total").textContent = entries.length;
    $("#history-list").innerHTML = entries.length ? entries.map(entry => {
      const gradeClass = "grade-" + entry.grade;
      return '<article class="history-entry"><time class="history-time">' + escapeHtml(formatDate(entry.reviewedAt, { year: "numeric", month: "short", day: "numeric" })) +
        '<br>' + escapeHtml(formatDate(entry.reviewedAt, { hour: "2-digit", minute: "2-digit" })) + '</time><div class="history-question">' + escapeHtml(entry.question || "（题目已移入回收站）") +
        '<span class="history-category">' + escapeHtml(entry.categoryName) + '</span></div><span class="history-grade ' + gradeClass + '">' + GRADE_LABELS[entry.grade] + "</span></article>";
    }).join("") : '<div class="empty-list"><strong>还没有复习记录</strong>完成一题并进行自评后，记录会出现在这里。</div>';
  }

  function openQuestionEditor(question = null) {
    state.editingId = question?.id || null;
    $("#question-dialog-title").textContent = question ? "编辑面试题" : "新增面试题";
    $("#question-form-error").textContent = "";
    fillCategorySelect($("#question-category"), question?.categoryId || state.bankCategory || state.reviewCategory || state.categories[0]?.id, false);
    $("#question-text").value = question?.question || "";
    $("#question-answer").value = question?.answer || "";
    $("#question-tags").value = question?.tags?.join("，") || "";
    $("#question-dialog").showModal();
    $("#question-text").focus();
  }

  async function saveQuestion(event) {
    event.preventDefault();
    const input = {
      id: state.editingId || undefined,
      categoryId: $("#question-category").value,
      question: $("#question-text").value,
      answer: $("#question-answer").value,
      tags: $("#question-tags").value.split(/[，,]/).map(tag => tag.trim()).filter(Boolean)
    };
    try {
      await api.saveQuestion(input);
      $("#question-dialog").close();
      await refreshData();
      if (!$("#bank-view").classList.contains("active")) setView("bank");
      showToast(state.editingId ? "题目已更新" : "题目已添加到题库");
      state.editingId = null;
    } catch (error) { $("#question-form-error").textContent = error.message; }
  }

  async function deleteQuestion(id) {
    const question = state.questions.find(item => item.id === id);
    if (!question) return;
    openConfirm("移入回收站？", "「" + question.question + "」将从题库和复习队列中隐藏，你可以随时在回收站恢复。", "移入回收站", async () => {
      await api.deleteQuestion(id);
      await refreshData();
      await renderBank();
      showToast("题目已移入回收站");
    });
  }

  async function restoreQuestion(id) {
    try {
      await api.restoreQuestion(id);
      await refreshData();
      await renderBank();
      showToast("题目已恢复");
    } catch (error) { showToast(error.message, true); }
  }

  async function exportBackup() {
    try {
      const result = await api.exportData();
      if (!result.canceled) showToast("备份已导出：" + result.filePath);
    } catch (error) { showToast(error.message, true); }
  }

  async function importBackup(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("备份文件不能超过 20 MB");
      const json = await file.text();
      const parsed = JSON.parse(json);
      const legacy = parsed.version === 1;
      const accepted = window.confirm(legacy
        ? "检测到旧版知识图谱备份。将把笔记中的模拟题和旧版打卡记录合并到桌面题库。继续导入？"
        : "导入 v2 备份会完整替换当前题库、复习计划和历史记录。建议先导出当前备份。继续？");
      if (!accepted) return;
      const result = await api.importData(json);
      await refreshData();
      showToast(legacy
        ? "旧版记录已导入：" + result.importedQuestions + " 道题，" + result.importedCheckins + " 条历史打卡"
        : "题库已从备份恢复：" + result.questions + " 道题、" + result.reviews + " 条复习记录");
    } catch (error) {
      showToast(error instanceof SyntaxError ? "文件不是有效的 JSON 备份" : error.message, true);
    } finally { event.target.value = ""; }
  }

  function setCloudMessage(message, isError = false) {
    const status = $("#cloud-status");
    status.textContent = message;
    status.dataset.state = isError ? "error" : "ready";
  }

  function updateCloudControls() {
    const status = state.cloudStatus;
    $("#cloud-sign-in").disabled = !status.configured || status.signedIn;
    $("#cloud-sign-up").disabled = !status.configured || status.signedIn;
    $("#cloud-sign-out").hidden = !status.signedIn;
    $("#upload-cloud-backup").disabled = !status.signedIn;
    $("#restore-cloud-backup").disabled = !status.signedIn;
  }

  async function refreshCloudStatus(fillConfig = false) {
    state.cloudStatus = await api.getCloudStatus();
    if (fillConfig) {
      $("#cloud-url").value = state.cloudStatus.url || "";
      $("#cloud-key").value = "";
      $("#cloud-key").placeholder = state.cloudStatus.configured
        ? "已保存，留空以保留当前 key"
        : "粘贴 publishable 或 anon key";
    }
    setCloudMessage(state.cloudStatus.signedIn
      ? "已登录 " + state.cloudStatus.email + "。云端操作为手动触发，本地题库仍可离线使用。"
      : state.cloudStatus.configured
        ? "项目配置已保存，登录后即可上传或恢复云端备份。"
        : "尚未配置 Supabase。填写项目 URL 和 publishable/anon key 后保存即可。");
    updateCloudControls();
  }

  async function openCloudDialog() {
    try {
      $("#cloud-error").textContent = "";
      await refreshCloudStatus(true);
      $("#cloud-dialog").showModal();
    } catch (error) { showToast(error.message, true); }
  }

  async function saveCloudConfig() {
    try {
      const result = await api.saveCloudConfig({
        url: $("#cloud-url").value,
        publishableKey: $("#cloud-key").value
      });
      $("#cloud-key").value = "";
      await refreshCloudStatus(true);
      showToast("Supabase 配置已保存在本机");
    } catch (error) { setCloudMessage(error.message, true); }
  }

  async function signUpForCloud() {
    try {
      const result = await api.cloudSignUp({ email: $("#cloud-email").value, password: $("#cloud-password").value });
      $("#cloud-password").value = "";
      await refreshCloudStatus();
      if (result.needsEmailConfirmation) {
        setCloudMessage("注册请求已发送。请先完成 Supabase 邮箱确认，再回到这里登录。");
      } else {
        setCloudMessage("账号已创建并登录：" + result.email);
      }
    } catch (error) { setCloudMessage(error.message, true); }
  }

  async function signInToCloud() {
    try {
      const result = await api.cloudSignIn({ email: $("#cloud-email").value, password: $("#cloud-password").value });
      $("#cloud-password").value = "";
      await refreshCloudStatus();
      setCloudMessage("已登录 " + result.email + "。云端操作为手动触发，本地题库仍可离线使用。");
    } catch (error) { setCloudMessage(error.message, true); }
  }

  async function signOutFromCloud() {
    try {
      await api.cloudSignOut();
      await refreshCloudStatus();
      setCloudMessage("已退出 Supabase 账号；本机题库不受影响。");
    } catch (error) { setCloudMessage(error.message, true); }
  }

  function uploadCloudBackup() {
    openConfirm("覆盖云端备份？", "将上传当前本机题库，并替换该账号已有的云端快照。本机数据不会改变。", "上传并覆盖", async () => {
      try {
        setCloudMessage("正在上传本机题库…");
        const result = await api.uploadCloudBackup();
        setCloudMessage("上传完成。云端版本 " + result.revision + "，时间 " + formatDate(result.uploadedAt, { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) + "。");
        showToast("本机题库已备份到 Supabase");
      } catch (error) { setCloudMessage(error.message, true); }
    }, false);
  }

  function restoreCloudBackup() {
    openConfirm("用云端备份替换本机题库？", "恢复会完整替换本机题目、复习计划和历史记录。应用会先在本机自动保存一份恢复前备份。", "恢复云端备份", async () => {
      try {
        setCloudMessage("正在下载并恢复云端题库…");
        const result = await api.restoreCloudBackup();
        await refreshData();
        setCloudMessage("恢复完成。云端版本 " + result.revision + "；恢复前本机副本已保存到应用数据目录。");
        showToast("云端题库已恢复，本机原数据已备份");
      } catch (error) { setCloudMessage(error.message, true); }
    });
  }

  function wireEvents() {
    document.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => setView(button.dataset.view)));
    $("#add-question").addEventListener("click", () => openQuestionEditor());
    $("#question-form").addEventListener("submit", saveQuestion);
    document.querySelectorAll("[data-close-dialog]").forEach(button => button.addEventListener("click", () => button.closest("dialog").close()));
    $("#confirm-action").addEventListener("click", async () => {
      const callback = state.confirmCallback;
      state.confirmCallback = null;
      $("#confirm-dialog").close();
      try { await callback?.(); } catch (error) { showToast(error.message, true); }
    });
    $("#review-category").addEventListener("change", async event => {
      state.reviewCategory = event.target.value;
      await loadReviewQueue();
    });
    document.querySelectorAll("[data-review-mode]").forEach(button => button.addEventListener("click", async () => {
      state.reviewMode = button.dataset.reviewMode;
      document.querySelectorAll("[data-review-mode]").forEach(item => item.classList.toggle("selected", item === button));
      await loadReviewQueue();
    }));
    $("#bank-category").addEventListener("change", event => {
      state.bankCategory = event.target.value;
      renderCategoryNavigation();
      renderBank();
    });
    $("#bank-search").addEventListener("input", event => {
      state.bankQuery = event.target.value;
      renderBank();
    });
    $("#open-trash").addEventListener("click", async () => {
      state.trashOpen = !state.trashOpen;
      $("#bank-search").value = "";
      state.bankQuery = "";
      await renderBank();
    });
    $("#question-list").addEventListener("click", event => {
      const edit = event.target.closest("[data-edit-id]");
      const remove = event.target.closest("[data-delete-id]");
      const restore = event.target.closest("[data-restore-id]");
      if (edit) openQuestionEditor(state.questions.find(question => question.id === edit.dataset.editId));
      if (remove) deleteQuestion(remove.dataset.deleteId);
      if (restore) restoreQuestion(restore.dataset.restoreId);
    });
    $("#review-stage").addEventListener("click", event => {
      if (event.target.closest("[data-reveal]")) {
        state.answerRevealed = activeReviewQuestion()?.id || null;
        renderReviewCard();
      }
      const gradeButton = event.target.closest("[data-grade]");
      if (gradeButton) handleGrade(gradeButton.dataset.grade);
      const modeButton = event.target.closest("[data-switch-mode]");
      if (modeButton) {
        state.reviewMode = modeButton.dataset.switchMode;
        document.querySelectorAll("[data-review-mode]").forEach(item => item.classList.toggle("selected", item.dataset.reviewMode === state.reviewMode));
        loadReviewQueue();
      }
    });
    $("#history-category").addEventListener("change", renderHistory);
    $("#apply-history-filter").addEventListener("click", renderHistory);
    $("#clear-history-filter").addEventListener("click", () => {
      $("#history-category").value = "";
      $("#history-from").value = "";
      $("#history-to").value = "";
      renderHistory();
    });
    $("#export-backup").addEventListener("click", exportBackup);
    $("#import-backup").addEventListener("click", () => $("#backup-file").click());
    $("#backup-file").addEventListener("change", importBackup);
    $("#cloud-sync").addEventListener("click", openCloudDialog);
    $("#save-cloud-config").addEventListener("click", saveCloudConfig);
    $("#cloud-sign-up").addEventListener("click", signUpForCloud);
    $("#cloud-sign-in").addEventListener("click", signInToCloud);
    $("#cloud-sign-out").addEventListener("click", signOutFromCloud);
    $("#upload-cloud-backup").addEventListener("click", uploadCloudBackup);
    $("#restore-cloud-backup").addEventListener("click", restoreCloudBackup);
  }

  async function main() {
    if (!api) throw new Error("桌面数据接口不可用，请重新启动应用。");
    wireEvents();
    await refreshData();
  }

  main().catch(error => {
    document.body.innerHTML = '<main class="fatal-error"><h1>题库无法启动</h1><p>' + escapeHtml(error.message) + '</p><p>请关闭应用后重新打开。如问题持续，请先保留本机数据文件并联系维护者。</p></main>';
  });
})();
