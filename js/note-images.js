// Image bytes live in private Storage, separate from the JSON workspace backup.
window.NoteImages = (function () {
  const BUCKET = "jrs-note-images";
  const MAX_BYTES = 5 * 1024 * 1024;
  const PAGE_SIZE = 50;
  const EXTENSIONS = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "image/gif": "gif" };
  let client = null;
  let userId = null;
  let generation = 0;
  let busyGeneration = null;
  let current = null;
  let refreshTimer;

  function isBusy() { return busyGeneration === generation; }
  function live(view, epoch) { return current === view && view.element.isConnected && generation === epoch; }
  function message(view, text, error = false) {
    const status = view.element.querySelector(".image-status");
    status.textContent = text;
    status.classList.toggle("is-error", error);
  }
  function controls(view, disabled) {
    view.element.querySelectorAll("button").forEach(button => { button.disabled = disabled; });
  }
  function unmount() {
    clearTimeout(refreshTimer);
    current = null;
  }
  function setAccount(nextClient, account) {
    const nextUserId = account?.id || null;
    if (nextClient === client && nextUserId === userId) return;
    client = nextClient;
    userId = nextUserId;
    generation++;
    if (current?.element.isConnected) mount(current.element, current.nodeId);
  }
  function signedUrl(value) {
    if (!value) return null;
    try {
      const base = new URL(window.SUPABASE_CONFIG.url);
      const url = new URL(value, base);
      return url.origin === base.origin && ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch { return null; }
  }
  function renderCard(view, file, signed, index) {
    const card = document.createElement("figure");
    card.className = "image-card";
    const url = signedUrl(signed?.signedUrl);
    if (url) {
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.title = "查看原图";
      const img = document.createElement("img");
      img.src = url;
      img.alt = (window.NODE_MAP[view.nodeId]?.name || "知识点") + " · 图片 " + index;
      img.loading = "lazy";
      img.addEventListener("error", () => {
        if (live(view, view.epoch)) message(view, "图片加载失败，请点击刷新重试。", true);
      });
      link.appendChild(img);
      card.appendChild(link);
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "image-unavailable";
      placeholder.textContent = "预览暂不可用";
      card.appendChild(placeholder);
    }
    const caption = document.createElement("figcaption");
    const label = document.createElement("span");
    label.textContent = "图片 " + index;
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "image-delete btn-danger";
    remove.textContent = "删除";
    remove.setAttribute("aria-label", "删除图片 " + index);
    remove.addEventListener("click", () => { void deleteImage(view, file.name); });
    caption.append(label, remove);
    card.appendChild(caption);
    return card;
  }
  async function load(view, append = false) {
    const epoch = generation;
    if (!live(view, epoch) || !client || !userId || view.loading || isBusy()) return;
    view.loading = true;
    controls(view, true);
    message(view, "正在加载图片…");
    try {
      const offset = append ? view.count : 0;
      const bucket = client.storage.from(BUCKET);
      const { data: files, error } = await bucket.list(view.prefix, { limit: PAGE_SIZE, offset, sortBy: { column: "name", order: "asc" } });
      if (error) throw error;
      if (!live(view, epoch)) return;
      const images = (files || []).filter(file => file.id);
      let signed = [];
      if (images.length) {
        const result = await bucket.createSignedUrls(images.map(file => view.prefix + "/" + file.name), 600);
        if (result.error) throw result.error;
        signed = result.data || [];
      }
      if (!live(view, epoch)) return;
      const gallery = view.element.querySelector(".image-gallery");
      if (!append) gallery.replaceChildren();
      images.forEach((file, index) => gallery.appendChild(renderCard(view, file, signed[index], offset + index + 1)));
      view.count = offset + (files || []).length;
      view.element.querySelector(".image-more").hidden = (files || []).length < PAGE_SIZE;
      message(view, view.count ? "点击图片查看原图 · 仅当前账号可访问" : "还没有图片，可上传截图或思维导图。");
      clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => { void load(view); }, 8 * 60 * 1000);
    } catch (error) {
      if (live(view, epoch)) message(view, "图片加载失败，请刷新重试：" + error.message, true);
    } finally {
      view.loading = false;
      if (live(view, epoch)) controls(view, false);
    }
  }
  async function upload(view, file) {
    const epoch = generation;
    if (!file || !live(view, epoch) || isBusy() || view.loading || !userId) return;
    busyGeneration = epoch;
    controls(view, true);
    message(view, "正在上传图片…");
    let failure = null;
    try {
      if (!EXTENSIONS[file.type]) throw new Error("请选择 JPG、PNG、WebP 或 GIF 图片。");
      if (!file.size || file.size > MAX_BYTES) throw new Error("单张图片需大于 0 字节且不超过 5 MB。");
      // Decode first so renamed text files cannot masquerade as an image.
      try {
        const bitmap = await createImageBitmap(file);
        bitmap.close();
      } catch { throw new Error("图片内容无效或已损坏，请重新选择。"); }
      if (!live(view, epoch)) return;
      const path = view.prefix + "/" + crypto.randomUUID() + "." + EXTENSIONS[file.type];
      const { error } = await client.storage.from(BUCKET).upload(path, file, { contentType: file.type, cacheControl: "600", upsert: false });
      if (error) throw error;
      if (live(view, epoch)) window.Editor.notify("图片已上传并保存到云端");
    } catch (error) { failure = error; }
    finally {
      if (busyGeneration === epoch) busyGeneration = null;
      if (live(view, epoch)) {
        controls(view, false);
        if (failure) message(view, "上传失败：" + failure.message, true);
        else await load(view);
      }
    }
  }
  async function deleteImage(view, name) {
    const epoch = generation;
    if (!live(view, epoch) || isBusy() || view.loading || !window.confirm("确定删除这张图片吗？删除后无法恢复。")) return;
    busyGeneration = epoch;
    controls(view, true);
    message(view, "正在删除图片…");
    let failure = null;
    try {
      const { error } = await client.storage.from(BUCKET).remove([view.prefix + "/" + name]);
      if (error) throw error;
      if (live(view, epoch)) window.Editor.notify("图片已删除");
    } catch (error) { failure = error; }
    finally {
      if (busyGeneration === epoch) busyGeneration = null;
      if (live(view, epoch)) {
        controls(view, false);
        if (failure) message(view, "删除失败，图片已保留：" + failure.message, true);
        else await load(view);
      }
    }
  }
  function mount(element, nodeId) {
    unmount();
    const view = { element, nodeId, epoch: generation, prefix: userId + "/" + nodeId, count: 0, loading: false };
    current = view;
    element.innerHTML = '<div class="image-heading"><h3>图片资料</h3><div><button type="button" class="image-refresh btn-edit">刷新</button><button type="button" class="image-upload btn-edit">上传图片</button></div></div>' +
      '<input class="image-input" type="file" accept="image/jpeg,image/png,image/webp,image/gif" aria-label="选择笔记图片" hidden>' +
      '<p class="image-help">JPG / PNG / WebP / GIF · 每张最多 5 MB</p>' +
      '<div class="image-gallery"></div><p class="image-status" role="status" aria-live="polite"></p><button type="button" class="image-more btn-edit" hidden>加载更多图片</button>';
    element.querySelector(".image-upload").addEventListener("click", () => {
      if (!userId) { document.getElementById("cloud-open").click(); return; }
      element.querySelector(".image-input").click();
    });
    element.querySelector(".image-input").addEventListener("change", event => {
      const file = event.target.files[0];
      event.target.value = "";
      void upload(view, file);
    });
    element.querySelector(".image-refresh").addEventListener("click", () => { void load(view); });
    element.querySelector(".image-more").addEventListener("click", () => { void load(view, true); });
    if (!userId || !client) {
      element.querySelector(".image-upload").textContent = "登录后上传";
      element.querySelector(".image-refresh").hidden = true;
      message(view, "登录本站账号后，可为这个知识点保存图片。");
    } else void load(view);
  }
  return { mount, unmount, setAccount, isBusy };
})();
