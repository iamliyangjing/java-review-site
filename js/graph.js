// Graph rendering remains optional when the bundled renderer is unavailable.
window.GraphView = (function () {
  let chart = null;
  let selectedId = null;
  let container = null;
  const MASTERY_COLOR = { unlearned: "#e8f0eb", learning: "#ffb300", mastered: "#4caf50" };
  const MODULE_COLORS = ["#849c73", "#589c94", "#8e8cb4", "#bd9b65", "#729cac", "#ac8f9b", "#81a193", "#bda779", "#839cc0", "#a5ad84", "#9686ab"];

  function getSelectedId() {
    return window.NODE_MAP[selectedId] ? selectedId : null;
  }

  function updateNodeTools() {
    const node = window.NODE_MAP[getSelectedId()];
    const selection = document.getElementById("graph-selected-node");
    const addButton = document.getElementById("graph-add-node");
    const deleteButton = document.getElementById("graph-delete-node");
    if (selection) {
      selection.textContent = node ? "已选：" + node.name : "未选择节点";
      selection.title = node ? node.name : "点击地图或目录选择节点";
    }
    if (addButton) {
      addButton.textContent = node ? "＋ 新增子节点" : "＋ 新增节点";
      addButton.title = node ? "在「" + node.name + "」下新增，也可在弹窗中修改归属" : "新增顶层知识节点";
    }
    if (deleteButton) {
      deleteButton.disabled = !node;
      deleteButton.title = node ? "删除「" + node.name + "」及其子节点" : "请先选择要删除的节点";
    }
  }

  // Arrange each topic as a small constellation; stable positions avoid a tangled map.
  function buildLayout() {
    const roots = window.NODES.filter(node => node.parent === null);
    const width = chart?.getWidth?.() || 700;
    const height = chart?.getHeight?.() || 600;
    const columns = width < 420 ? 2 : width > 800 ? 4 : 3;
    const rows = Math.max(1, Math.ceil(roots.length / columns));
    const cellWidth = width / columns;
    const cellHeight = height / rows;
    const groups = new Map(roots.map(root => [root.id, []]));
    for (const node of window.NODES) {
      let root = node;
      while (root.parent) root = window.NODE_MAP[root.parent];
      groups.get(root.id).push(node);
    }
    const positions = new Map();
    for (const [index, root] of roots.entries()) {
      const x = (index % columns + 0.5) * cellWidth;
      const y = (Math.floor(index / columns) + 0.5) * cellHeight;
      const color = MODULE_COLORS[index % MODULE_COLORS.length];
      positions.set(root.id, { x, y, color });
      const levels = new Map();
      for (const node of groups.get(root.id)) {
        if (node.id === root.id) continue;
        if (!levels.has(node.level)) levels.set(node.level, []);
        levels.get(node.level).push(node);
      }
      const maxDepth = Math.max(1, ...levels.keys()) - root.level;
      const radius = Math.min(cellWidth, cellHeight) * 0.34;
      for (const [level, nodes] of levels) {
        const distance = radius * (0.55 + 0.45 * (level - root.level) / Math.max(1, maxDepth));
        nodes.forEach((node, offset) => {
          const angle = offset / nodes.length * Math.PI * 2 - Math.PI / 2 + (level - root.level - 1) * 0.45;
          positions.set(node.id, { x: x + Math.cos(angle) * distance, y: y + Math.sin(angle) * distance, color });
        });
      }
    }
    return positions;
  }

  function buildNodes(masteryMap) {
    const layout = buildLayout();
    return window.NODES.map(node => ({
      id: node.id, name: node.name,
      x: layout.get(node.id).x, y: layout.get(node.id).y,
      symbolSize: node.level === 1 ? 25 : node.level === 2 ? 12 : 8,
      itemStyle: {
        color: MASTERY_COLOR[masteryMap[node.id]] || MASTERY_COLOR.unlearned,
        borderColor: layout.get(node.id).color, borderWidth: node.level === 1 ? 2 : 1,
        shadowBlur: node.level === 1 ? 6 : 0, shadowColor: "#3359460e"
      },
      emphasis: { label: { show: true }, itemStyle: { borderWidth: 2.5, shadowBlur: 10, shadowColor: "#25867525" } },
      label: {
        show: node.level === 1, fontSize: node.level === 1 ? 11 : 10,
        formatter: params => params.data.name.length > 16 ? params.data.name.slice(0, 16) + "…" : params.data.name,
        position: "bottom", distance: 7,
        color: "#637b6e", backgroundColor: "#fbfdfce8", padding: [3, 5], borderRadius: 4,
        fontWeight: node.level === 1 ? 600 : 400
      }
    }));
  }

  function buildOption(masteryMap) {
    const layout = buildLayout();
    return {
      tooltip: {
        renderMode: "richText", formatter: params => params.data.name || "",
        backgroundColor: "#ffffff", borderColor: "#dce9df", borderWidth: 1,
        textStyle: { color: "#466b55", fontSize: 12 }, padding: [9, 13]
      },
      series: [{
        id: "knowledge", type: "graph", layout: "none", roam: true, draggable: true, zoom: 0.9,
        left: "8%", right: "8%", top: "7%", bottom: "10%",
        scaleLimit: { min: 0.5, max: 3 },
        data: buildNodes(masteryMap), links: window.EDGES.map(edge => ({
          ...edge, lineStyle: { color: layout.get(edge.source).color, opacity: 0.3 }
        })),
        emphasis: { focus: "adjacency", lineStyle: { width: 2 }, label: { show: true } },
        blur: { label: { opacity: 0.6 }, itemStyle: { opacity: 0.55 } },
        lineStyle: { width: 1, curveness: 0.08 }
      }]
    };
  }

  function init(containerId) {
    container = document.getElementById(containerId);
    updateNodeTools();
    if (!window.echarts) {
      const message = document.createElement("div");
      message.className = "graph-fallback";
      message.textContent = "知识图谱暂时无法加载，请重新打开页面或恢复完整项目文件。左侧目录、笔记、编辑和打卡仍可使用。";
      container.replaceChildren(message);
      return;
    }
    chart = window.echarts.init(container);
    chart.setOption(buildOption(window.ProgressStore.getAllMastery()));
    chart.on("click", params => {
      if (params.dataType === "node") selectNode(params.data.id);
    });
    if (window.ResizeObserver) {
      const observer = new ResizeObserver(() => {
        chart.resize();
        chart.setOption({ series: [{ id: "knowledge", data: buildNodes(window.ProgressStore.getAllMastery()) }] });
        if (selectedId) highlightNode(selectedId);
      });
      observer.observe(container);
    } else {
      window.addEventListener("resize", () => chart.resize());
    }
  }

  function selectNode(nodeId) {
    if (!window.NODE_MAP[nodeId]) return false;
    if (window.NotePanel && !window.NotePanel.canLeave()) return false;
    if (chart) chart.dispatchAction({ type: "downplay", seriesIndex: 0 });
    selectedId = nodeId;
    updateNodeTools();
    highlightNode(nodeId);
    window.TreeView?.highlightNode(nodeId);
    window.NotePanel?.show(nodeId);
    if (window.matchMedia?.("(max-width: 640px)").matches) {
      document.getElementById("note-panel").scrollIntoView({ behavior: "smooth", block: "start" });
    }
    return true;
  }

  function highlightNode(nodeId) {
    if (!chart || !window.NODE_MAP[nodeId]) return;
    const dataIndex = window.NODES.findIndex(node => node.id === nodeId);
    chart.dispatchAction({ type: "highlight", seriesIndex: 0, dataIndex });
  }

  function setMasteryColors(masteryMap) {
    if (!chart) return;
    chart.setOption({ series: [{ id: "knowledge", data: buildNodes(masteryMap || {}) }] });
    if (selectedId) highlightNode(selectedId);
  }

  function refresh(nodeId) {
    if (nodeId !== undefined) selectedId = nodeId;
    if (selectedId && !window.NODE_MAP[selectedId]) selectedId = null;
    updateNodeTools();
    if (!chart) return;
    chart.setOption(buildOption(window.ProgressStore.getAllMastery()), { notMerge: true });
    if (selectedId) highlightNode(selectedId);
  }

  function resetView() {
    selectedId = null;
    updateNodeTools();
    if (!chart) return;
    chart.dispatchAction({ type: "downplay", seriesIndex: 0 });
    chart.setOption(buildOption(window.ProgressStore.getAllMastery()), { notMerge: true });
  }

  return { init, selectNode, highlightNode, setMasteryColors, refresh, resetView, getSelectedId };
})();
