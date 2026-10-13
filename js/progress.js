// Progress persistence: mastery levels + daily check-ins, stored in localStorage.
window.ProgressStore = (function () {
  const KEY_MASTERY = "jrs_mastery";
  const KEY_CHECKINS = "jrs_checkins";

  function load(key, fallback, strict = false) {
    return window.AppStorage[strict ? "readStrict" : "read"](key, fallback,
      key === KEY_MASTERY ? window.AppStorage.mastery : window.AppStorage.checkins);
  }

  function save(key, value) {
    window.AppStorage.write(key, value);
  }

  function today() {
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  return {
    getMastery(nodeId) { return load(KEY_MASTERY, {})[nodeId] || "unlearned"; },
    setMastery(nodeId, level) {
      if (!window.NODE_MAP[nodeId] || !["unlearned", "learning", "mastered"].includes(level)) {
        throw new Error("无效的节点或掌握程度");
      }
      const m = load(KEY_MASTERY, {}, true);
      m[nodeId] = level;
      save(KEY_MASTERY, m);
    },
    getAllMastery() { return load(KEY_MASTERY, {}); },
    checkIn(nodeId) {
      if (!window.NODE_MAP[nodeId]) throw new Error("节点不存在或已删除");
      const c = load(KEY_CHECKINS, {}, true);
      const t = today();
      if (!c[t]) c[t] = [];
      if (!c[t].includes(nodeId)) c[t].push(nodeId);
      save(KEY_CHECKINS, c);
    },
    isCheckedInToday(nodeId) {
      const c = load(KEY_CHECKINS, {});
      return (c[today()] || []).includes(nodeId);
    },
    getTodayCount() { return (load(KEY_CHECKINS, {})[today()] || []).length; },
    getCheckins() { return load(KEY_CHECKINS, {}); },
    getMasteryStats() {
      const m = load(KEY_MASTERY, {});
      const stats = { unlearned: 0, learning: 0, mastered: 0 };
      for (const n of window.NODES) {
        stats[m[n.id] || "unlearned"]++;
      }
      return stats;
    }
  };
})();

// Progress panel: today count, mastery stats, and a 12-week calendar heatmap.
window.ProgressPanel = (function () {
  let todayCountEl = null;
  let statsEl = null;
  let heatmapEl = null;

  const MASTERY_LABEL = { unlearned: "未学", learning: "学习中", mastered: "已掌握" };
  const MASTERY_COLOR = { unlearned: "#9e9e9e", learning: "#ffb300", mastered: "#4caf50" };

  function init() {
    todayCountEl = document.getElementById("today-count");
    statsEl = document.getElementById("mastery-stats");
    heatmapEl = document.getElementById("heatmap");
    refresh();
  }

  function refresh() {
    if (!todayCountEl) return;
    todayCountEl.textContent = "今日已复习 " + window.ProgressStore.getTodayCount() + " 个节点";
    const roots = window.NODES.filter(node => node.parent === null).length;
    document.getElementById("library-count").textContent = window.NODES.length;
    document.getElementById("graph-total").textContent = window.NODES.length + " 个知识点，" + roots + " 个主题。找到你的下一站。";
    renderStats();
    renderHeatmap();
  }

  function renderStats() {
    const stats = window.ProgressStore.getMasteryStats();
    const total = window.NODES.length;
    let html = "";
    const percent = total ? Math.round(stats.mastered / total * 100) : 0;
    document.getElementById("mastery-ratio").textContent = percent + "%";
    const progress = document.getElementById("mastery-progress");
    progress.max = total || 1;
    progress.value = stats.mastered;
    for (const level of ["unlearned", "learning", "mastered"]) {
      html += '<div class="mastery-stat" data-level="' + level + '"><strong>' + stats[level] +
        '</strong><span><i style="background:' + MASTERY_COLOR[level] + '"></i>' + MASTERY_LABEL[level] + "</span></div>";
    }
    statsEl.innerHTML = html;
  }

  // Render last 12 weeks (84 days) as a grid; color intensity = reviewed count.
  function renderHeatmap() {
    const checkins = window.ProgressStore.getCheckins();
    const today = new Date();
    let html = '<div class="heatmap-grid">';
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const key = fmtDate(d);
      const count = (checkins[key] || []).length;
      const level = count === 0 ? 0 : count <= 2 ? 1 : 2;
      html += '<div class="heatmap-cell heatmap-l' + level + '" data-date="' + key +
        '" data-count="' + count + '" title="' + key + "：" + count + " 个节点\"></div>";
    }
    html += "</div>";
    heatmapEl.innerHTML = html;
  }

  function fmtDate(d) {
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return d.getFullYear() + "-" + mm + "-" + dd;
  }

  return { init, refresh };
})();
