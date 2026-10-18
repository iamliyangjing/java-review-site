(() => {
  const api = window.questionBank;
  const state = {
    knowledgeBases: [],
    categories: [],
    questions: [],
    reviewQueue: [],
    reviewCursor: 0,
    reviewMode: "due",
    reviewCategory: "",
    bankCategory: "",
    activeKnowledgeBaseId: localStorage.getItem("activeKnowledgeBaseId") || "",
    bankQuery: "",
    trashOpen: false,
    editingId: null,
    editingKnowledgeBaseId: null,
    editingCategoryId: null,
    cloudBackups: [],
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

  function activeCategories() {
    return state.categories.filter(category => category.knowledgeBaseId === state.activeKnowledgeBaseId);
  }

  function fillCategorySelect(select, selected = "", includeAll = true) {
    const options = [];
    if (includeAll) options.push('<option value="">全部分类</option>');
    for (const category of activeCategories()) {
      const prefix = category.level > 1 ? "　" + "— ".repeat(Math.min(category.level - 1, 3)) : "";
      options.push('<option value="' + escapeHtml(category.id) + '">' + prefix + escapeHtml(category.name) + "</option>");
    }
    select.innerHTML = options.join("");
    if (selected && activeCategories().some(category => category.id === selected)) select.value = selected;
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
    state.knowledgeBases = snapshot.knowledgeBases || [];
    state.categories = snapshot.categories;
    state.questions = snapshot.questions;
    if (!state.knowledgeBases.length) state.knowledgeBases = [{ id: "kb-java-review", name: "Java 面试复习", description: "" }];
    if (!state.knowledgeBases.some(item => item.id === state.activeKnowledgeBaseId)) state.activeKnowledgeBaseId = state.knowledgeBases[0].id;
    localStorage.setItem("activeKnowledgeBaseId", state.activeKnowledgeBaseId);
    if (!activeCategories().some(item => item.id === state.reviewCategory)) state.reviewCategory = "";
    if (!activeCategories().some(item => item.id === state.bankCategory)) state.bankCategory = "";
    renderCategoryNavigation();
    renderStats(await api.getReviewStats({ knowledgeBaseId: state.activeKnowledgeBaseId }));
    renderKnowledgeBasePicker();
    fillCategorySelect($("#review-category"), state.reviewCategory);
    fillCategorySelect($("#bank-category"), state.bankCategory);
    fillCategorySelect($("#history-category"));
    fillCategorySelect($("#question-category"), state.bankCategory || activeCategories()[0]?.id || "", false);
    if (options.reloadReview !== false && $("#review-view").classList.contains("active")) await loadReviewQueue();
    if ($("#bank-view").classList.contains("active")) await renderBank();
  }

  function renderCategoryNavigation() {
    const categories = activeCategories().filter(category => !category.deletedAt);
    const categoryByParent = new Map();
    for (const category of categories) {
      const key = category.parentId || "";
      if (!categoryByParent.has(key)) categoryByParent.set(key, []);
      categoryByParent.get(key).push(category);
    }
    for (const siblings of categoryByParent.values()) siblings.sort((first, second) => first.sortOrder - second.sortOrder || first.name.localeCompare(second.name, "zh-CN"));
    const ordered = [];
    const visit = (parentId, depth) => {
      for (const category of categoryByParent.get(parentId || "") || []) {
        ordered.push({ ...category, depth });
        visit(category.id, depth + 1);
      }
    };
    visit(null, 0);
    const moduleList = $("#module-list");
    moduleList.innerHTML = ordered.map(category => {
      const categoryIds = descendantsFor(category.id);
      const count = state.questions.filter(question => question.knowledgeBaseId === state.activeKnowledgeBaseId && categoryIds.has(question.categoryId)).length;
      return '<div class="category-tree-row depth-' + Math.min(category.depth, 5) + '" draggable="true" data-category-row="' + escapeHtml(category.id) + '">' +
        '<button class="module-filter category-select' + (state.bankCategory === category.id ? " active" : "") + '" type="button" data-category="' + escapeHtml(category.id) + '" title="拖到其他目录可调整顺序或层级">' +
        '<span class="module-dot"></span><span>' + escapeHtml(category.name) + '</span><b>' + count + '</b></button>' +
        '<button class="tree-action" type="button" data-add-child="' + escapeHtml(category.id) + '" title="新建子分类" aria-label="在' + escapeHtml(category.name) + '下新建子分类">＋</button>' +
        '<button class="tree-action" type="button" data-rename-category="' + escapeHtml(category.id) + '" title="重命名分类" aria-label="重命名' + escapeHtml(category.name) + '">⋯</button>' +
        '<button class="tree-action tree-danger" type="button" data-delete-category="' + escapeHtml(category.id) + '" title="删除分类" aria-label="删除' + escapeHtml(category.name) + '">×</button></div>';
    }).join("");
    const activeQuestions = state.questions.filter(question => question.knowledgeBaseId === state.activeKnowledgeBaseId);
    $("#all-count").textContent = activeQuestions.length;
    $("#all-category-filter").classList.toggle("active", !state.bankCategory);
    $("#module-list").querySelectorAll("[data-category]").forEach(button => button.addEventListener("click", () => {
      state.bankCategory = button.dataset.category;
      $("#bank-category").value = state.bankCategory;
      setView("bank");
      renderCategoryNavigation();
    }));
  }

  function renderKnowledgeBasePicker() {
    const select = $("#knowledge-base-select");
    select.innerHTML = state.knowledgeBases.map(item => '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.name) + '</option>').join("");
    select.value = state.activeKnowledgeBaseId;
    $("#edit-knowledge-base").disabled = !state.activeKnowledgeBaseId;
    $("#delete-knowledge-base").hidden = state.knowledgeBases.length < 2 || state.knowledgeBases.find(item => item.id === state.activeKnowledgeBaseId)?.origin === "builtin";
    $("#add-question").disabled = activeCategories().length === 0;
    $("#add-question").title = activeCategories().length ? "新增面试题" : "请先在此知识库中新建分类";
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
    const knowledgeBaseId = state.activeKnowledgeBaseId;
    let questions = mode === "due"
      ? await api.getDueQuestions({ knowledgeBaseId })
      : await api.listQuestions({ ...(mode === "wrong" ? { scope: "wrong" } : {}), knowledgeBaseId });
    questions = filteredByCategory(questions, state.reviewCategory);
    if (mode === "all") questions = questions.slice().sort(() => Math.random() - 0.5);
    state.reviewQueue = questions;
    state.reviewCursor = 0;
    renderReviewCard();
    const dueCount = mode === "due" ? questions.length : await api.listQuestions({ scope: "due", knowledgeBaseId }).then(list => list.length);
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
    const sources = (question.sources || []).map(source => '<li>' + escapeHtml(source.title) + ' · ' + escapeHtml(source.url) + '</li>').join("");
    const answer = revealed
      ? '<div class="answer-area"><div class="answer-label">答案解析</div>' + escapeHtml(question.answer) + (sources ? '<div class="answer-label">参考来源</div><ul class="question-sources">' + sources + '</ul>' : '') + '</div><div class="grade-panel"><p class="grade-prompt">你对这道题的掌握程度如何？</p><div class="grade-buttons">' +
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
    const items = await api.listQuestions({ scope, query: state.bankQuery, knowledgeBaseId: state.activeKnowledgeBaseId });
    const filtered = state.trashOpen ? items : filteredByCategory(items, state.bankCategory);
    $("#bank-result-count").textContent = filtered.length + " 道题";
    $("#trash-count").textContent = await api.listQuestions({ scope: "deleted", knowledgeBaseId: state.activeKnowledgeBaseId }).then(list => list.length);
    $("#open-trash").innerHTML = state.trashOpen ? "返回题库" : '回收站 <span id="trash-count">' + $("#trash-count").textContent + "</span>";
    $("#question-list").innerHTML = filtered.length ? filtered.map(question => {
      const tags = question.tags.slice(0, 3).map(tag => '<span class="tag">' + escapeHtml(tag) + "</span>").join("");
      const sources = (question.sources || []).map(source => '<li>' + escapeHtml(source.title) + ' · ' + escapeHtml(source.url) + '</li>').join("");
      const action = state.trashOpen
        ? '<button class="icon-action" type="button" data-restore-id="' + escapeHtml(question.id) + '" title="恢复题目">↶</button>'
        : '<button class="icon-action" type="button" data-edit-id="' + escapeHtml(question.id) + '" title="编辑题目">✎</button><button class="icon-action delete" type="button" data-delete-id="' + escapeHtml(question.id) + '" title="移入回收站">×</button>';
      const dueText = question.dueAt ? "下次复习 " + formatDate(question.dueAt, { month: "numeric", day: "numeric" }) : "尚未复习";
      return '<article class="question-row"><div class="question-row-content"><div class="question-row-meta"><span class="topic-pill">' + escapeHtml(question.categoryName) +
        '</span><span>' + escapeHtml(dueText) + '</span><span class="tags">' + tags + '</span></div><h3>' + escapeHtml(question.question) +
        '</h3><p class="question-row-preview">' + escapeHtml(question.answer.replace(/\s+/g, " ").slice(0, 190)) + '</p>' + (sources ? '<ul class="question-sources">' + sources + '</ul>' : '') + '</div><div class="row-actions">' + action + "</div></article>";
    }).join("") : '<div class="empty-list"><strong>' + (state.trashOpen ? "回收站是空的" : activeCategories().length ? "没有找到匹配的题目" : "这个知识库还没有分类") + "</strong>" + (state.trashOpen ? "删除的题目会在这里等待恢复。" : activeCategories().length ? "调整筛选条件，或者新增一道自己的题目。" : "先点击左侧“新建分类”，再添加自己的题目。") + "</div>";
  }

  async function renderHistory() {
    const options = {
      categoryId: $("#history-category").value,
      knowledgeBaseId: state.activeKnowledgeBaseId,
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

  function openKnowledgeBaseEditor(knowledgeBase = null) {
    state.editingKnowledgeBaseId = knowledgeBase?.id || null;
    $("#knowledge-base-dialog-title").textContent = knowledgeBase ? "编辑知识库" : "新建知识库";
    $("#knowledge-base-name").value = knowledgeBase?.name || "";
    $("#knowledge-base-description").value = knowledgeBase?.description || "";
    $("#knowledge-base-error").textContent = "";
    $("#knowledge-base-dialog").showModal();
    $("#knowledge-base-name").focus();
  }

  async function saveKnowledgeBase(event) {
    event.preventDefault();
    try {
      const saved = await api.saveKnowledgeBase({
        id: state.editingKnowledgeBaseId || undefined,
        name: $("#knowledge-base-name").value,
        description: $("#knowledge-base-description").value
      });
      state.activeKnowledgeBaseId = saved.id;
      state.bankCategory = "";
      state.reviewCategory = "";
      $("#knowledge-base-dialog").close();
      await refreshData();
      showToast(state.editingKnowledgeBaseId ? "知识库已更新" : "知识库已创建");
    } catch (error) { $("#knowledge-base-error").textContent = error.message; }
  }

  function openCategoryEditor({ category = null, parentId = null } = {}) {
    state.editingCategoryId = category?.id || null;
    $("#category-dialog-title").textContent = category ? "重命名分类" : "新建分类";
    $("#category-name").value = category?.name || "";
    $("#category-name-error").textContent = "";
    fillCategorySelect($("#category-parent"), parentId || "", true);
    $("#category-parent-field").hidden = Boolean(category);
    $("#category-parent").disabled = Boolean(category);
    $("#category-parent").hidden = Boolean(category);
    $("#category-dialog").showModal();
    $("#category-name").focus();
  }

  async function saveCategory(event) {
    event.preventDefault();
    try {
      await api.saveCategory({
        id: state.editingCategoryId || undefined,
        knowledgeBaseId: state.activeKnowledgeBaseId,
        parentId: $("#category-parent").value || null,
        name: $("#category-name").value
      });
      $("#category-dialog").close();
      await refreshData();
      showToast(state.editingCategoryId ? "分类已重命名" : "分类已创建");
      state.editingCategoryId = null;
    } catch (error) { $("#category-name-error").textContent = error.message; }
  }

  async function deleteCategory(id) {
    const category = state.categories.find(item => item.id === id);
    if (!category) return;
    openConfirm("删除分类？", "「" + category.name + "」仅在没有子目录和题目时可以删除。若其中还有题目，请先编辑题目并移动到其他分类。", "删除分类", async () => {
      await api.deleteCategory(id);
      if (state.bankCategory === id) state.bankCategory = "";
      if (state.reviewCategory === id) state.reviewCategory = "";
      await refreshData();
      showToast("分类已删除");
    });
  }

  async function moveCategoryFromDrop(event, targetRow) {
    event.preventDefault();
    const categoryId = event.dataTransfer.getData("text/category-id");
    const targetId = targetRow?.dataset.categoryRow;
    if (!categoryId || !targetId || categoryId === targetId) return;
    const bounds = targetRow.getBoundingClientRect();
    const relativeY = (event.clientY - bounds.top) / bounds.height;
    const position = relativeY < 0.25 ? "before" : relativeY > 0.75 ? "after" : "inside";
    try {
      await api.moveCategory({ categoryId, targetId, position });
      await refreshData();
      showToast(position === "inside" ? "分类已移入子目录" : "目录顺序已更新");
    } catch (error) { showToast(error.message, true); }
  }

  function openQuestionEditor(question = null) {
    state.editingId = question?.id || null;
    $("#question-dialog-title").textContent = question ? "编辑面试题" : "新增面试题";
    $("#question-form-error").textContent = "";
    fillCategorySelect($("#question-category"), question?.categoryId || state.bankCategory || state.reviewCategory || activeCategories()[0]?.id, false);
    $("#question-text").value = question?.question || "";
    $("#question-answer").value = question?.answer || "";
    $("#question-tags").value = question?.tags?.join("，") || "";
    $("#question-sources").value = (question?.sources || []).map(source => source.title + " | " + source.url).join("\n");
    $("#question-dialog").showModal();
    $("#question-text").focus();
  }

  async function saveQuestion(event) {
    event.preventDefault();
    try {
      const input = {
        id: state.editingId || undefined,
        categoryId: $("#question-category").value,
        question: $("#question-text").value,
        answer: $("#question-answer").value,
        tags: $("#question-tags").value.split(/[，,]/).map(tag => tag.trim()).filter(Boolean),
        sources: $("#question-sources").value.split("\n").map(line => line.trim()).filter(Boolean).map(line => {
          const separator = line.indexOf("|");
          if (separator < 1) throw new Error("参考来源请使用“标题 | HTTPS 链接”格式");
          return { title: line.slice(0, separator).trim(), url: line.slice(separator + 1).trim() };
        })
      };
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
        : "导入备份会完整替换当前知识库、分类、题目、复习计划和历史记录。建议先导出当前备份。继续？");
      if (!accepted) return;
      const result = await api.importData(json);
      await refreshData();
      showToast(legacy
        ? "旧版记录已导入：" + result.importedQuestions + " 道题，" + result.importedCheckins + " 条历史打卡"
        : "备份已恢复：" + result.knowledgeBases + " 个知识库、" + result.questions + " 道题、" + result.reviews + " 条复习记录");
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
    $("#cloud-anonymous-sign-in").disabled = !status.configured || status.signedIn;
    $("#cloud-sign-out").hidden = !status.signedIn;
    $("#upload-cloud-backup").disabled = !status.signedIn;
    $("#restore-cloud-backup").disabled = !status.signedIn;
    $("#cloud-backup-version").disabled = !status.signedIn;
  }

  async function refreshCloudBackups() {
    const select = $("#cloud-backup-version");
    if (!state.cloudStatus.signedIn) {
      state.cloudBackups = [];
      select.innerHTML = '<option value="">最新版本</option>';
      return;
    }
    state.cloudBackups = await api.listCloudBackups();
    select.innerHTML = '<option value="">最新版本</option>' + state.cloudBackups.map(item =>
      '<option value="' + item.revision + '">v' + item.revision + ' · ' + escapeHtml(formatDate(item.createdAt, { year: "numeric", month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })) + '</option>'
    ).join("");
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
      ? "已登录 " + state.cloudStatus.email + "。云端仅在你手动上传或恢复时读写；日常复习仍保存在本机。"
      : state.cloudStatus.configured
        ? "项目配置已保存。登录同一 Supabase 用户后即可上传或恢复个人快照。"
        : "尚未配置 Supabase。填写 Project URL 和 Publishable key 后保存即可。");
    updateCloudControls();
    await refreshCloudBackups();
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
      setCloudMessage("已登录 " + result.email + "。现在可手动上传或恢复快照。");
    } catch (error) { setCloudMessage(error.message, true); }
  }

  async function signInToCloudWithToken() {
    try {
      const result = await api.cloudSignInWithToken({
        accessToken: $("#cloud-access-token").value,
        refreshToken: $("#cloud-refresh-token").value
      });
      $("#cloud-access-token").value = "";
      $("#cloud-refresh-token").value = "";
      await refreshCloudStatus();
      setCloudMessage("Supabase 用户 Token 已验证并登录：" + result.email + "。会话已加密保存在本机。");
    } catch (error) { setCloudMessage(error.message, true); }
  }

  async function createAnonymousCloudIdentity() {
    try {
      await api.cloudSignInAnonymously();
      await refreshCloudStatus();
      setCloudMessage("本机匿名云端身份已创建并登录。令牌由 Supabase 自动生成并加密保存在本机；此身份不能自动跨设备迁移。");
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
    openConfirm("创建云端备份？", "将为当前本机题库创建一个新版本，云端只保留最近 10 个版本。", "上传备份", async () => {
      try {
        setCloudMessage("正在上传本机题库…");
        const result = await api.uploadCloudBackup();
        await refreshCloudBackups();
        setCloudMessage("上传完成。云端版本 " + result.revision + "，保留最近 10 个版本。");
        showToast("本机题库已备份到 Supabase");
      } catch (error) { setCloudMessage(error.message, true); }
    }, false);
  }

  function restoreCloudBackup() {
    openConfirm("用云端备份替换本机题库？", "恢复会完整替换本机题目、复习计划和历史记录。应用会先在本机自动保存一份恢复前备份。", "恢复云端备份", async () => {
      try {
        setCloudMessage("正在下载并恢复云端题库…");
        const selectedRevision = $("#cloud-backup-version").value;
        const result = await api.restoreCloudBackup(selectedRevision ? Number(selectedRevision) : null);
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
    $("#knowledge-base-form").addEventListener("submit", saveKnowledgeBase);
    $("#category-form").addEventListener("submit", saveCategory);
    $("#add-knowledge-base").addEventListener("click", () => openKnowledgeBaseEditor());
    $("#edit-knowledge-base").addEventListener("click", () => openKnowledgeBaseEditor(state.knowledgeBases.find(item => item.id === state.activeKnowledgeBaseId)));
    $("#delete-knowledge-base").addEventListener("click", () => {
      const knowledgeBase = state.knowledgeBases.find(item => item.id === state.activeKnowledgeBaseId);
      if (!knowledgeBase) return;
      openConfirm("删除知识库？", "「" + knowledgeBase.name + "」只有在所有分类删除后才能删除。删除操作可从本地备份中恢复。", "删除知识库", async () => {
        await api.deleteKnowledgeBase(knowledgeBase.id);
        state.activeKnowledgeBaseId = state.knowledgeBases.find(item => item.id !== knowledgeBase.id)?.id || "";
        state.bankCategory = "";
        state.reviewCategory = "";
        await refreshData();
        showToast("知识库已删除");
      });
    });
    $("#knowledge-base-select").addEventListener("change", async event => {
      state.activeKnowledgeBaseId = event.target.value;
      state.bankCategory = "";
      state.reviewCategory = "";
      state.trashOpen = false;
      localStorage.setItem("activeKnowledgeBaseId", state.activeKnowledgeBaseId);
      await refreshData();
    });
    $("#add-category").addEventListener("click", () => openCategoryEditor());
    $("#all-category-filter").addEventListener("click", () => {
      state.bankCategory = "";
      $("#bank-category").value = "";
      setView("bank");
      renderCategoryNavigation();
    });
    $("#module-list").addEventListener("click", event => {
      const addChild = event.target.closest("[data-add-child]");
      const rename = event.target.closest("[data-rename-category]");
      const remove = event.target.closest("[data-delete-category]");
      if (addChild) openCategoryEditor({ parentId: addChild.dataset.addChild });
      else if (rename) openCategoryEditor({ category: state.categories.find(item => item.id === rename.dataset.renameCategory) });
      else if (remove) deleteCategory(remove.dataset.deleteCategory);
    });
    $("#module-list").addEventListener("dragstart", event => {
      const row = event.target.closest("[data-category-row]");
      if (!row) return;
      event.dataTransfer.setData("text/category-id", row.dataset.categoryRow);
      event.dataTransfer.effectAllowed = "move";
      row.classList.add("dragging");
    });
    $("#module-list").addEventListener("dragover", event => {
      const row = event.target.closest("[data-category-row]");
      if (!row) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
      row.classList.add("drop-target");
    });
    $("#module-list").addEventListener("dragleave", event => event.target.closest("[data-category-row]")?.classList.remove("drop-target"));
    $("#module-list").addEventListener("drop", event => moveCategoryFromDrop(event, event.target.closest("[data-category-row]")));
    $("#module-list").addEventListener("dragend", () => document.querySelectorAll(".category-tree-row").forEach(row => row.classList.remove("dragging", "drop-target")));
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
    $("#cloud-token-sign-in").addEventListener("click", signInToCloudWithToken);
    $("#cloud-anonymous-sign-in").addEventListener("click", createAnonymousCloudIdentity);
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
