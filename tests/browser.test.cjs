// Real-browser regressions. Install Playwright or expose it through NODE_PATH.
const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const http = require("node:http");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const BASE_NODE_COUNT = 183;
const SITE_ROOT = path.resolve(__dirname, "..");
const FILE_URL = pathToFileURL(path.join(SITE_ROOT, "index.html")).href;
const SCREENSHOT_DIR = path.join(os.tmpdir(), "java-review-qa");
const IMAGE_BYTES = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNQbSv9DwAEFAIg2y13cQAAAABJRU5ErkJggg==", "base64");
let browser;
let server;
let serverUrl;

before(async () => {
  browser = await chromium.launch({
    headless: true, args: ["--disable-gpu"],
    ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {})
  });
  server = http.createServer(async (request, response) => {
    try {
      const file = path.resolve(SITE_ROOT, "." + decodeURIComponent(new URL(request.url, "http://localhost").pathname));
      if (!file.startsWith(SITE_ROOT + path.sep)) { response.writeHead(403).end(); return; }
      const mime = { ".js": "text/javascript", ".css": "text/css", ".html": "text/html" }[path.extname(file)] || "application/octet-stream";
      const body = await fs.readFile(file);
      response.writeHead(200, { "Content-Type": mime + "; charset=utf-8" }).end(body);
    } catch { response.writeHead(404).end(); }
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  serverUrl = "http://127.0.0.1:" + server.address().port;
  await fs.mkdir(SCREENSHOT_DIR, { recursive: true });
});

async function withImages(run) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const accounts = [
    { id: "11111111-1111-4111-8111-111111111111", email: "images-a@example.com", aud: "authenticated", role: "authenticated" },
    { id: "22222222-2222-4222-8222-222222222222", email: "images-b@example.com", aud: "authenticated", role: "authenticated" }
  ];
  const objects = new Map();
  const rows = new Map();
  const errors = [];
  const state = { storageOffline: false, pauseNextList: false, releaseList: null, pauseNextUpload: false, releaseUpload: null, onUploadStarted: null, uploads: 0 };
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  const login = async (index = 0) => {
    await page.locator("#cloud-open").click();
    await page.locator("#cloud-email").fill(accounts[index].email);
    await page.locator("#cloud-password").fill("image-test-password");
    await page.locator("#cloud-login").click();
    await page.waitForFunction(() => document.getElementById("cloud-message").textContent.startsWith("已同步"));
    await page.locator("#cloud-close").click();
  };
  try {
    await page.route("**/js/supabase-config.local.js*", route => route.fulfill({ contentType: "text/javascript", body: "" }));
    await page.route("**/js/supabase-config.js*", route => route.fulfill({ contentType: "text/javascript", body: 'window.SUPABASE_CONFIG={url:"https://java-review-images.supabase.co",publishableKey:"sb_publishable_test_key"};' }));
    await page.route("https://java-review-images.supabase.co/**", async route => {
      const request = route.request();
      const url = new URL(request.url());
      const params = request.headers()["content-type"]?.includes("application/json") ? request.postDataJSON() : null;
      const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname === "/auth/v1/token") {
        const account = accounts.find(item => item.email === params.email);
        const token = Buffer.from('{"alg":"HS256"}').toString("base64url") + "." + Buffer.from(JSON.stringify({ sub: account.id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })).toString("base64url") + ".test";
        return respond({ access_token: token, refresh_token: "test-refresh", expires_in: 3600, token_type: "bearer", user: account });
      }
      const auth = request.headers().authorization?.replace(/^Bearer /, "");
      const account = auth?.includes(".") ? accounts.find(item => JSON.parse(Buffer.from(auth.split(".")[1], "base64url")).sub === item.id) : null;
      if (url.pathname === "/auth/v1/logout") return route.fulfill({ status: 204 });
      if (url.pathname === "/auth/v1/user") return respond(account);
      if (!account && !url.pathname.startsWith("/storage/v1/object/sign/jrs-note-images/")) return respond({ message: "Not authenticated" }, 401);
      if (url.pathname === "/rest/v1/jrs_workspaces") return respond(rows.has(account.id) ? [rows.get(account.id)] : []);
      if (url.pathname === "/rest/v1/rpc/jrs_save_workspace") {
        const row = { payload: params.p_payload, revision: (rows.get(account.id)?.revision || 0) + 1 };
        rows.set(account.id, row);
        return respond({ revision: row.revision });
      }
      if (state.storageOffline) return respond({ message: "Storage temporarily unavailable" }, 503);
      if (url.pathname === "/storage/v1/object/list/jrs-note-images") {
        assert.ok(params.prefix.startsWith(account.id + "/"));
        const files = [...objects].filter(([key]) => key.startsWith(params.prefix + "/")).sort(([a], [b]) => a.localeCompare(b)).slice(params.offset, params.offset + params.limit).map(([key]) => ({ name: key.split("/").at(-1), id: key, metadata: { size: IMAGE_BYTES.length, mimetype: "image/png" } }));
        if (state.pauseNextList) {
          state.pauseNextList = false;
          await new Promise(resolve => { state.releaseList = resolve; });
        }
        return respond(files);
      }
      if (url.pathname === "/storage/v1/object/sign/jrs-note-images") {
        assert.equal(params.expiresIn, 600);
        return respond(params.paths.map(objectPath => ({ path: objectPath, signedURL: "/object/sign/jrs-note-images/" + objectPath + "?token=test" })));
      }
      if (url.pathname.startsWith("/storage/v1/object/sign/jrs-note-images/")) return route.fulfill({ contentType: "image/png", body: IMAGE_BYTES });
      if (url.pathname === "/storage/v1/object/jrs-note-images" && request.method() === "DELETE") {
        params.prefixes.forEach(key => {
          assert.ok(key.startsWith(account.id + "/"));
          objects.delete(key);
        });
        return respond(params.prefixes.map(name => ({ name })));
      }
      if (url.pathname.startsWith("/storage/v1/object/jrs-note-images/") && request.method() === "POST") {
        const key = decodeURIComponent(url.pathname.split("/jrs-note-images/")[1]);
        assert.ok(key.startsWith(account.id + "/"));
        assert.equal(request.headers()["x-upsert"], "false");
        if (state.pauseNextUpload) {
          state.pauseNextUpload = false;
          await new Promise(resolve => {
            state.releaseUpload = resolve;
            state.onUploadStarted?.();
          });
        }
        objects.set(key, true);
        state.uploads++;
        return respond({ Key: "jrs-note-images/" + key, Id: key });
      }
      throw new Error("Unexpected image request: " + request.method() + " " + url.pathname);
    });
    await page.goto(serverUrl + "/index.html");
    await run({ page, accounts, objects, state, login });
    assert.deepEqual(errors, []);
  } finally {
    state.releaseList?.();
    state.releaseUpload?.();
    await context.close();
  }
}

test("private image upload, validation, preview, reload and confirmed deletion work through the UI", async () => {
  await withImages(async ({ page, objects, state, login }) => {
    await selectNode(page, "jmm");
    assert.equal(await page.locator(".image-upload").textContent(), "登录后上传");
    await login();
    await selectNode(page, "jmm");
    await page.waitForFunction(() => !document.querySelector(".image-upload").disabled);
    for (const file of [
      { name: "unsafe.svg", mimeType: "image/svg+xml", buffer: Buffer.from("<svg></svg>") },
      { name: "fake.png", mimeType: "image/png", buffer: Buffer.from("not an image") },
      { name: "large.png", mimeType: "image/png", buffer: Buffer.alloc(5 * 1024 * 1024 + 1) }
    ]) {
      await page.locator(".image-input").setInputFiles(file);
      await page.locator(".image-status.is-error").waitFor();
      assert.equal(state.uploads, 0);
    }
    await page.locator(".image-input").setInputFiles({ name: "diagram.png", mimeType: "image/png", buffer: IMAGE_BYTES });
    await page.locator(".image-card img").waitFor();
    assert.equal(state.uploads, 1);
    assert.equal(await page.locator(".image-card img").evaluate(img => img.naturalWidth), 1);
    assert.match(await page.locator(".image-card a").getAttribute("href"), /\/object\/sign\/jrs-note-images\//);
    await page.reload();
    await selectNode(page, "jmm");
    await page.locator(".image-card img").waitFor();
    await page.locator('[data-action="edit"]').click();
    await page.locator("#edit-summary").fill("Keep this unsaved note while adding an image");
    await page.locator(".image-card img").waitFor();
    await page.locator(".image-input").setInputFiles({ name: "diagram.png", mimeType: "image/png", buffer: IMAGE_BYTES });
    await page.waitForFunction(() => document.querySelectorAll(".image-card").length === 2);
    assert.equal(await page.locator("#edit-summary").inputValue(), "Keep this unsaved note while adding an image");
    page.once("dialog", dialog => dialog.dismiss());
    await page.locator(".image-delete").first().click();
    assert.equal(objects.size, 2);
    page.once("dialog", dialog => dialog.accept());
    await page.locator(".image-delete").first().click();
    await page.waitForFunction(() => document.querySelectorAll(".image-card").length === 1);
    assert.equal(objects.size, 1);
    await page.locator("#edit-save").click();
    await page.locator(".image-card img").waitFor();
    await page.locator("#note-panel").evaluate(element => { element.scrollTop = 0; });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "note-images.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "note-images-mobile.png"), fullPage: true });
  });
});

test("an in-flight image upload protects selection and unsaved note text", async () => {
  await withImages(async ({ page, state, login }) => {
    await login();
    await selectNode(page, "jmm");
    await page.locator('[data-action="edit"]').click();
    await page.locator("#edit-summary").fill("Preserve this text until the upload finishes");
    await page.waitForFunction(() => !document.querySelector(".image-upload").disabled);
    state.pauseNextUpload = true;
    const started = new Promise(resolve => { state.onUploadStarted = resolve; });
    await page.locator(".image-input").setInputFiles({ name: "pending.png", mimeType: "image/png", buffer: IMAGE_BYTES });
    await started;
    await selectNode(page, "volatile");
    assert.equal(await page.evaluate(() => window.NotePanel.getCurrentId()), "jmm");
    await page.locator("#edit-save").click();
    assert.equal(await page.locator("#edit-summary").inputValue(), "Preserve this text until the upload finishes");
    assert.match(await page.locator("#status-message").textContent(), /图片正在上传/);
    state.releaseUpload();
    await page.locator(".image-card img").waitFor();
    await page.locator("#edit-save").click();
    assert.equal(await page.locator(".note-summary").textContent(), "Preserve this text until the upload finishes");
  });
});

test("image pagination, failure recovery and account switches discard stale responses", async () => {
  await withImages(async ({ page, accounts, objects, state, login }) => {
    for (let index = 0; index < 51; index++) objects.set(accounts[0].id + "/jmm/" + String(index).padStart(3, "0") + ".png", true);
    await login();
    await selectNode(page, "jmm");
    await page.waitForFunction(() => document.querySelectorAll(".image-card").length === 50);
    await page.locator(".image-more").click();
    await page.waitForFunction(() => document.querySelectorAll(".image-card").length === 51);
    assert.equal(await page.locator(".image-more").isVisible(), false);
    state.storageOffline = true;
    page.once("dialog", dialog => dialog.accept());
    await page.locator(".image-delete").first().click();
    await page.locator(".image-status.is-error").waitFor();
    assert.equal(objects.size, 51);
    assert.equal(await page.locator(".image-card").count(), 51);
    state.storageOffline = false;
    state.pauseNextList = true;
    await page.locator(".image-refresh").click();
    await page.waitForFunction(() => document.querySelector(".image-status").textContent === "正在加载图片…");
    await page.locator("#cloud-open").click();
    await page.locator("#cloud-logout").click();
    await page.waitForFunction(() => document.getElementById("cloud-label").textContent === "登录后同步");
    await page.locator("#cloud-close").click();
    await selectNode(page, "jmm");
    assert.equal(await page.locator(".image-card").count(), 0);
    state.releaseList();
    await login(1);
    await selectNode(page, "jmm");
    await page.waitForFunction(() => !document.querySelector(".image-upload").disabled);
    assert.equal(await page.locator(".image-card").count(), 0);
    assert.equal(await page.locator(".image-upload").textContent(), "上传图片");
    assert.equal(objects.size, 51);
  });
});

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
});

async function withPage(run, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, offline: true, ...options });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  try {
    await page.route("**/js/supabase-config.local.js*", route => route.fulfill({ contentType: "text/javascript", body: "" }));
    await page.goto(FILE_URL);
    await run(page, context);
    assert.deepEqual(errors, [], "No uncaught browser errors");
  } finally { await context.close(); }
}

function treeRow(page, id) {
  return page.locator('li[data-node-id="' + id + '"] > .tree-node');
}

async function selectNode(page, id) {
  await treeRow(page, id).locator(".tree-select").click();
}

async function addNode(page, name, parent = "", summary = "", points = "") {
  await page.locator("#add-node").click();
  await page.locator("#node-name").fill(name);
  await page.locator("#node-parent").selectOption(parent);
  await page.locator("#new-summary").fill(summary);
  await page.locator("#new-points").fill(points);
  await page.locator("#dialog-submit").click();
  assert.equal(await page.locator("#node-dialog").evaluate(dialog => dialog.open), false);
  return page.evaluate(() => window.NotePanel.getCurrentId());
}

test("expanded curriculum renders structured notes and keeps personal edits", async () => {
  await withPage(async page => {
    await selectNode(page, "thread-pool");
    assert.equal(await page.locator(".point-label").count(), 5);
    assert.match(await page.locator(".note-sources").textContent(), /ThreadPoolExecutor/);
    assert.equal(await page.locator(".note-sources a").first().getAttribute("rel"), "noopener noreferrer");
    await page.locator('[data-action="edit"]').click();
    await page.locator("#edit-summary").fill("My thread pool checklist");
    await page.locator("#edit-save").click();
    await page.reload();
    await selectNode(page, "thread-pool");
    assert.equal(await page.locator(".note-summary").textContent(), "My thread pool checklist");
    await page.locator('[data-action="reset"]').click();
    assert.match(await page.locator(".note-summary").textContent(), /^ThreadPoolExecutor/);
    await selectNode(page, "spring-transaction");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "curriculum-desktop.png"), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "curriculum-mobile.png"), fullPage: true });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  });
});

test("operating-system curriculum exposes the Xiaolin Coding route and interview notes", async () => {
  await withPage(async page => {
    await selectNode(page, "os-deadlock");
    assert.match(await page.locator("#note-content h2").textContent(), /死锁/);
    assert.match(await page.locator(".note-summary").textContent(), /互斥、占有且等待/);
    assert.equal(await page.locator(".point-label").count(), 5);
    assert.match(await page.locator(".note-sources").textContent(), /小林 Coding：死锁/);
    await selectNode(page, "os-zero-copy");
    assert.match(await page.locator(".note-summary").textContent(), /零拷贝/);
    assert.match(await page.locator(".note-sources").textContent(), /小林 Coding：零拷贝/);
  });
});

test("computer-network curriculum exposes the Xiaolin Coding route and interview notes", async () => {
  await withPage(async page => {
    await selectNode(page, "network-http3");
    assert.match(await page.locator("#note-content h2").textContent(), /HTTP\/3/);
    assert.match(await page.locator(".note-summary").textContent(), /QUIC/);
    assert.equal(await page.locator(".point-label").count(), 5);
    assert.match(await page.locator(".note-sources").textContent(), /小林 Coding：HTTP\/3/);
    await selectNode(page, "network-tcp-queues");
    assert.match(await page.locator(".note-summary").textContent(), /半连接队列/);
  });
});

test("original 29 browser data tests pass", async () => {
  await withPage(async page => {
    await page.goto(pathToFileURL(path.join(SITE_ROOT, "test.html")).href);
    assert.equal(await page.locator("#results h2").textContent(), "29/29 passed");
  });
});

test("offline startup renders all nodes and tree toggles preserve state", async () => {
  await withPage(async page => {
    assert.equal(await page.locator(".tree-node").count(), BASE_NODE_COUNT);
    assert.equal(await page.evaluate(() => !!window.echarts.getInstanceByDom(document.getElementById("graph-container"))), true);
    const toggle = treeRow(page, "jvm").locator(".tree-toggle");
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    await addNode(page, "New root");
    assert.equal(await toggle.getAttribute("aria-expanded"), "false");
    await toggle.click();
    await selectNode(page, "jmm");
    assert.match(await page.locator("#note-content h2").textContent(), /JMM/);
  });
});

test("custom subtree CRUD, colors, check-ins, and reload persistence", async () => {
  await withPage(async page => {
    const parentId = await addNode(page, "Custom parent", "jvm", "Parent summary", "Point one\nPoint two");
    const childId = await addNode(page, "Custom child", parentId);
    await selectNode(page, parentId);
    await page.locator('[data-action="rename"]').click();
    await page.locator("#node-name").fill("Renamed parent");
    await page.locator("#dialog-submit").click();
    assert.match(await page.locator("#note-content h2").textContent(), /Renamed parent/);
    await page.locator('[data-action="move"]').click();
    assert.equal(await page.locator('#node-parent option[value="' + childId + '"]').count(), 0);
    await page.locator("#node-parent").selectOption("mysql-index");
    await page.locator("#dialog-submit").click();
    assert.deepEqual(await page.evaluate(([parent, child]) => [window.NODE_MAP[parent].level, window.NODE_MAP[child].level], [parentId, childId]), [4, 5]);
    await selectNode(page, childId);
    await page.locator('[data-mastery="mastered"]').click();
    await page.locator(".checkin-btn").click();
    assert.equal(await page.evaluate(id => window.echarts.getInstanceByDom(document.getElementById("graph-container")).getOption().series[0].data.find(node => node.id === id).itemStyle.color, childId), "#4caf50");
    await page.reload();
    await page.evaluate(id => window.GraphView.selectNode(id), childId);
    assert.equal(await page.locator(".checkin-btn").isDisabled(), true);
    assert.equal(await page.locator('.mastery-btn[data-mastery="mastered"]').getAttribute("class"), "mastery-btn active");
    await selectNode(page, parentId);
    await page.locator('[data-action="delete"]').click();
    assert.match(await page.locator("#dialog-description").textContent(), /1 个子节点/);
    await page.locator("#dialog-submit").click();
    assert.equal(await treeRow(page, parentId).count(), 0);
    assert.equal(await treeRow(page, childId).count(), 0);
    assert.equal(await page.evaluate(id => window.ProgressStore.isCheckedInToday(id), childId), true);
    const nextId = await addNode(page, "Still visible", "jvm");
    assert.notEqual(nextId, childId);
    assert.equal(await treeRow(page, nextId).count(), 1);
  });
});

test("map controls add roots and children, confirm cascading deletion, and persist changes", async () => {
  await withPage(async page => {
    assert.equal(await page.locator("#graph-delete-node").isDisabled(), true);
    await page.locator("#graph-add-node").click();
    assert.equal(await page.locator("#node-parent").inputValue(), "");
    await page.locator("#dialog-cancel").click();

    // Click a rendered node to verify the canvas selection event and toolbar together.
    const point = await page.evaluate(() => {
      const chart = window.echarts.getInstanceByDom(document.getElementById("graph-container"));
      const node = chart.getOption().series[0].data.find(item => item.id === "jvm");
      return chart.convertToPixel({ seriesIndex: 0 }, [node.x, node.y]);
    });
    const bounds = await page.locator("#graph-container").boundingBox();
    await page.mouse.click(bounds.x + point[0], bounds.y + point[1]);
    await page.waitForFunction(() => window.GraphView.getSelectedId() === "jvm");
    assert.match(await page.locator("#graph-selected-node").textContent(), /JVM/);
    assert.equal(await page.locator("#graph-delete-node").isDisabled(), false);
    await page.locator("#graph-add-node").click();
    assert.equal(await page.locator("#node-parent").inputValue(), "jvm");
    await page.locator("#node-parent").selectOption("");
    await page.locator("#node-name").fill("Map topic");
    await page.locator("#dialog-submit").click();
    const parentId = await page.evaluate(() => window.GraphView.getSelectedId());
    assert.equal(await page.evaluate(id => window.NODE_MAP[id].parent, parentId), null);
    assert.equal(await page.locator("#graph-selected-node").textContent(), "已选：Map topic");

    await page.locator("#graph-add-node").click();
    assert.equal(await page.locator("#node-parent").inputValue(), parentId);
    await page.locator("#node-name").fill("Map child");
    await page.locator("#new-summary").fill("Notes added from the map");
    await page.locator("#dialog-submit").click();
    const childId = await page.evaluate(() => window.GraphView.getSelectedId());
    assert.equal(await page.evaluate(id => window.NODE_MAP[id].parent, childId), parentId);
    assert.equal(await page.locator(".note-summary").textContent(), "Notes added from the map");
    await page.reload();
    assert.equal(await page.locator("#graph-delete-node").isDisabled(), true);
    await selectNode(page, parentId);
    await page.locator("#graph-delete-node").click();
    assert.match(await page.locator("#dialog-description").textContent(), /Map topic.*1 个子节点/);
    await page.locator("#dialog-cancel").click();
    assert.equal(await treeRow(page, childId).count(), 1);
    await page.locator("#graph-delete-node").click();
    await page.locator("#dialog-submit").click();
    assert.equal(await page.locator("#graph-delete-node").isDisabled(), true);
    assert.equal(await page.locator("#graph-selected-node").textContent(), "未选择节点");
    await page.reload();
    assert.equal(await treeRow(page, parentId).count(), 0);
    assert.equal(await treeRow(page, childId).count(), 0);
    assert.equal(await page.evaluate(([parent, child]) => {
      const data = window.echarts.getInstanceByDom(document.getElementById("graph-container")).getOption().series[0].data;
      return data.some(node => node.id === parent || node.id === child);
    }, [parentId, childId]), false);
  });
});

test("map actions protect unsaved notes and reset clears the deletion target", async () => {
  await withPage(async page => {
    await selectNode(page, "jmm");
    await page.locator('[data-action="edit"]').click();
    await page.locator("#edit-summary").fill("Keep my unsaved note");
    for (const selector of ["#graph-add-node", "#graph-delete-node"]) {
      page.once("dialog", dialog => dialog.dismiss());
      await page.locator(selector).click();
      assert.equal(await page.locator("#node-dialog").isVisible(), false);
      assert.equal(await page.locator("#edit-summary").inputValue(), "Keep my unsaved note");
      assert.equal(await page.evaluate(() => window.GraphView.getSelectedId()), "jmm");
    }
    await page.locator("#graph-reset").click();
    assert.equal(await page.locator("#graph-delete-node").isDisabled(), true);
    assert.equal(await page.locator("#graph-add-node").textContent(), "＋ 新增节点");
    assert.equal(await page.locator("#edit-summary").inputValue(), "Keep my unsaved note");
  });
});

test("note edits keep layout and protect unsaved text on selection", async () => {
  await withPage(async page => {
    await selectNode(page, "jmm");
    await page.locator('[data-action="edit"]').click();
    await page.locator("#edit-summary").fill("Unsaved summary");
    page.once("dialog", dialog => dialog.dismiss());
    await selectNode(page, "volatile");
    assert.equal(await page.locator("#edit-summary").inputValue(), "Unsaved summary");
    assert.equal(await page.evaluate(() => window.NotePanel.getCurrentId()), "jmm");
    await page.locator("#edit-points").fill("First\nSecond");
    await page.locator("#edit-save").click();
    assert.equal(await page.locator(".note-summary").textContent(), "Unsaved summary");
    await page.reload();
    await selectNode(page, "jmm");
    assert.equal(await page.locator(".note-summary").textContent(), "Unsaved summary");
    await page.locator('[data-action="reset"]').click();
    assert.match(await page.locator(".note-summary").textContent(), /^Java 内存模型/);
  });
});

test("names, breadcrumbs, and notes display HTML as plain text", async () => {
  await withPage(async page => {
    const name = '<img src=x onerror="window.injected=true">';
    const parent = await addNode(page, name, "jvm", "<script>bad</script>", "<b>point</b>");
    assert.equal(await page.locator("#graph-selected-node").textContent(), "已选：" + name);
    assert.equal(await page.locator(".graph-node-tools img").count(), 0);
    assert.equal(await page.locator("#note-content img, #note-content script, #note-content b").count(), 0);
    assert.equal(await page.locator(".note-summary").textContent(), "<script>bad</script>");
    await addNode(page, "Child", parent);
    assert.ok((await page.locator(".note-crumb").textContent()).includes(name));
    assert.equal(await page.locator("#note-content img").count(), 0);
    assert.equal(await page.evaluate(() => window.injected), undefined);
  });
});

test("search finds note text and supports Enter, arrows, Escape, and slash", async () => {
  await withPage(async page => {
    const id = await addNode(page, "Search custom", "jvm", "UniqueSearchPhrase", "");
    await page.locator("#search-input").fill("UniqueSearchPhrase");
    assert.equal(await page.locator(".search-item").count(), 1);
    await page.locator("#search-input").press("ArrowDown");
    assert.equal(await page.locator(".search-item.active").count(), 1);
    await page.locator("#search-input").press("Enter");
    assert.equal(await page.evaluate(() => window.NotePanel.getCurrentId()), id);
    await page.locator("#search-input").fill("NoSuchKnowledgePhrase");
    assert.equal(await page.locator(".search-empty").textContent(), "未找到相关知识点");
    await page.locator("#search-input").press("Escape");
    assert.equal(await page.locator("#search-dropdown").isVisible(), false);
    await page.locator("#add-node").focus();
    await page.keyboard.press("/");
    assert.equal(await page.locator("#search-input").evaluate(input => document.activeElement === input), true);
  });
});

test("export downloads a v1 backup and UI import restores it", async () => {
  await withPage(async page => {
    const id = await addNode(page, "Backup UI", "mysql", "Backup summary", "One\nTwo");
    await page.locator('[data-mastery="learning"]').click();
    await page.locator(".checkin-btn").click();
    const downloadPromise = page.waitForEvent("download");
    await page.locator("#export-data").click();
    const download = await downloadPromise;
    const data = JSON.parse(await fs.readFile(await download.path(), "utf8"));
    assert.equal(data.version, 1);
    assert.ok(data.edits.addedNodes[id]);
    const destination = await browser.newContext({ offline: true });
    try {
      const restored = await destination.newPage();
      await restored.route("**/js/supabase-config.local.js*", route => route.fulfill({ contentType: "text/javascript", body: "" }));
      await restored.goto(FILE_URL);
      await restored.locator("#import-file").setInputFiles({ name: "backup.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(data)) });
      await restored.locator('#tree-container li[data-node-id="' + id + '"]').waitFor();
      await selectNode(restored, id);
      assert.equal(await restored.locator(".note-summary").textContent(), "Backup summary");
      assert.equal(await restored.locator(".checkin-btn").isDisabled(), true);
      assert.equal(await restored.evaluate(nodeId => window.ProgressStore.getMastery(nodeId), id), "learning");
    } finally { await destination.close(); }
  });
});

test("invalid file import shows an error and does not change data", async () => {
  await withPage(async page => {
    const backup = { version: 1, edits: { moved: { jvm: "gc" } } };
    await page.locator("#import-file").setInputFiles({ name: "invalid.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(backup)) });
    await page.locator("#app-status.is-error").waitFor();
    assert.match(await page.locator("#status-message").textContent(), /循环/);
    assert.equal(await page.evaluate(() => window.NODES.length), BASE_NODE_COUNT);
    assert.equal(await page.evaluate(() => localStorage.getItem("jrs_edits")), null);
  });
});

test("write failure keeps edit text and reports that it was not saved", async () => {
  await withPage(async page => {
    await selectNode(page, "jmm");
    await page.locator('[data-action="edit"]').click();
    await page.locator("#edit-summary").fill("Keep this unsaved text");
    await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error("QuotaExceededError"); }; });
    await page.locator("#edit-save").click();
    assert.equal(await page.locator("#edit-summary").inputValue(), "Keep this unsaved text");
    assert.match(await page.locator("#status-message").textContent(), /尚未保存/);
    assert.equal(await page.evaluate(() => window.NOTES.jmm.summary.startsWith("Java 内存模型")), true);
  });
});

test("corrupt records show a warning while navigation remains usable", async () => {
  await withPage(async page => {
    await page.evaluate(() => { localStorage.setItem("jrs_edits", '{"moved":{"jvm":"gc"}}'); localStorage.setItem("jrs_mastery", "null"); });
    await page.reload();
    assert.equal(await page.locator(".tree-node").count(), BASE_NODE_COUNT);
    assert.match(await page.locator("#status-message").textContent(), /读取失败/);
    await selectNode(page, "jmm");
    assert.match(await page.locator("#note-content h2").textContent(), /JMM/);
  });
});

test("missing graph renderer degrades to working notes and progress", async () => {
  const context = await browser.newContext();
  try {
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/js/supabase-config.local.js*", route => route.fulfill({ contentType: "text/javascript", body: "" }));
    await page.route("**/vendor/echarts.min.js*", route => route.abort());
    await page.goto(serverUrl + "/index.html");
    assert.equal(await page.locator(".graph-fallback").count(), 1);
    await selectNode(page, "jmm");
    await page.locator(".checkin-btn").click();
    assert.match(await page.locator("#today-count").textContent(), /1 个节点/);
    await addNode(page, "Fallback node");
    assert.equal(await page.locator(".tree-node").count(), BASE_NODE_COUNT + 1);
    assert.equal(await page.locator("#graph-selected-node").textContent(), "已选：Fallback node");
    await page.locator("#graph-delete-node").click();
    await page.locator("#dialog-submit").click();
    assert.equal(await page.locator(".tree-node").count(), BASE_NODE_COUNT);
    assert.equal(await page.locator("#graph-delete-node").isDisabled(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});

test("desktop, tablet, and mobile layouts fit the viewport", async () => {
  for (const width of [1440, 1100, 900, 390]) {
    await withPage(async page => {
      await selectNode(page, "jmm");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      assert.equal(await page.locator("#graph-container").evaluate(el => el.getBoundingClientRect().width > 200), true);
      assert.equal(await page.evaluate(() => {
        const tools = document.querySelector(".graph-node-tools").getBoundingClientRect();
        const heading = document.querySelector(".graph-toolbar").getBoundingClientRect();
        const canvas = document.getElementById("graph-container").getBoundingClientRect();
        const buttons = [...document.querySelectorAll(".graph-node-tools button")];
        return tools.top >= heading.bottom && canvas.top >= tools.bottom && canvas.height > 100 && buttons.every(button => {
          const bounds = button.getBoundingClientRect();
          return bounds.left >= tools.left && bounds.right <= tools.right;
        });
      }), true, "Map controls fit without covering the graph or heading");
      await page.locator('[data-action="rename"]').click();
      assert.equal(await page.locator("#node-dialog").evaluate(el => el.getBoundingClientRect().width <= innerWidth), true);
      await page.locator("#dialog-cancel").click();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, "width-" + width + ".png"), fullPage: true });
    }, { viewport: { width, height: 900 } });
  }
  console.log("Visual checks:", SCREENSHOT_DIR);
});

test("cloud panel stays accessible on mobile when the database is not configured", async () => {
  await withPage(async page => {
    await page.route("**/js/supabase-config.js*", route => route.fulfill({ contentType: "text/javascript", body: 'window.SUPABASE_CONFIG={url:"",publishableKey:""};' }));
    await page.goto(serverUrl + "/index.html");
    await page.locator("#cloud-open").click();
    assert.equal(await page.locator("#cloud-dialog").isVisible(), true);
    assert.match(await page.locator("#cloud-message").textContent(), /尚未配置/);
    assert.equal(await page.locator("#cloud-login").isDisabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "cloud-mobile.png"), fullPage: true });
    await page.locator("#cloud-close").click();
  }, { viewport: { width: 390, height: 844 }, offline: false });
});

test("real Supabase SDK login, local import, automatic save and logout work through the UI", async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const account = { id: "11111111-1111-4111-8111-111111111111", email: "test@example.com", aud: "authenticated", role: "authenticated" };
  let row = null;
  let offline = false;
  const errors = [];
  try {
    const page = await context.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/js/supabase-config.local.js*", route => route.fulfill({ contentType: "text/javascript", body: "" }));
    await page.route("**/js/supabase-config.js*", route => route.fulfill({ contentType: "text/javascript", body: 'window.SUPABASE_CONFIG={url:"https://java-review-test.supabase.co",publishableKey:"sb_publishable_test_key"};' }));
    await page.route("https://java-review-test.supabase.co/**", async route => {
      const url = new URL(route.request().url());
      const params = route.request().headers()["content-type"]?.includes("application/json") ? route.request().postDataJSON() : null;
      const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (url.pathname === "/auth/v1/token") {
        const token = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ sub: account.id, exp: Math.floor(Date.now() / 1000) + 3600, role: "authenticated" })).toString("base64url") + ".test";
        return respond({ access_token: token, refresh_token: "test-refresh", expires_in: 3600, token_type: "bearer", user: account });
      }
      if (url.pathname === "/auth/v1/logout") return route.fulfill({ status: 204 });
      if (url.pathname === "/auth/v1/user") return respond(account);
      if (url.pathname === "/storage/v1/object/list/jrs-note-images") return respond([]);
      if (offline) return respond({ message: "Offline test", code: "NETWORK" }, 503);
      if (url.pathname === "/rest/v1/jrs_workspaces") return respond(row ? [row] : []);
      if (url.pathname === "/rest/v1/rpc/jrs_save_workspace") {
        assert.equal(params.p_user_id, account.id);
        assert.equal(params.p_expected_revision, row?.revision || 0);
        row = { payload: params.p_payload, revision: (row?.revision || 0) + 1 };
        return respond({ revision: row.revision });
      }
      throw new Error("Unexpected Supabase request: " + url.pathname);
    });
    await page.goto(serverUrl + "/index.html");
    await selectNode(page, "jmm");
    await page.locator('[data-mastery="mastered"]').click();
    await page.locator("#cloud-open").click();
    await page.locator("#cloud-email").fill(account.email);
    await page.locator("#cloud-password").fill("test-password");
    await page.locator("#cloud-login").click();
    await page.waitForFunction(() => document.getElementById("cloud-message").textContent.startsWith("已同步"));
    assert.equal(row.payload.progress.mastery.jmm, undefined);
    assert.equal(await page.locator("#cloud-password").inputValue(), "");
    await page.locator("#cloud-import-local").click();
    await page.waitForFunction(() => document.getElementById("cloud-message").textContent.startsWith("已同步") && window.ProgressStore.getMastery("jmm") === "mastered");
    assert.equal(row.payload.progress.mastery.jmm, "mastered");
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, "cloud-account.png"), fullPage: true });
    await page.locator("#cloud-close").click();
    await page.locator('[data-action="edit"]').click();
    await page.locator("#edit-summary").fill("Cloud note from the browser");
    await page.locator("#edit-save").click();
    await page.waitForFunction(() => document.getElementById("cloud-open").title.startsWith("已同步"));
    assert.equal(row.payload.edits.notes.jmm.summary, "Cloud note from the browser");
    await page.locator("#graph-add-node").click();
    assert.equal(await page.locator("#node-parent").inputValue(), "jmm");
    await page.locator("#node-name").fill("Cloud map child");
    await page.locator("#dialog-submit").click();
    const mapNodeId = await page.evaluate(() => window.GraphView.getSelectedId());
    await page.waitForFunction(() => document.getElementById("cloud-open").title.startsWith("已同步"));
    assert.equal(row.payload.edits.addedNodes[mapNodeId].parent, "jmm");
    await page.locator("#graph-delete-node").click();
    await page.locator("#dialog-submit").click();
    await page.waitForFunction(() => document.getElementById("cloud-open").title.startsWith("已同步"));
    assert.ok(row.payload.edits.deleted.includes(mapNodeId));
    assert.equal(await page.evaluate(() => window.GraphView.getSelectedId()), "jmm");
    offline = true;
    await page.locator('[data-mastery="learning"]').click();
    await page.waitForFunction(() => document.getElementById("cloud-open").title.startsWith("同步未完成"));
    assert.equal(row.payload.progress.mastery.jmm, "mastered");
    assert.equal(await page.evaluate(() => window.ProgressStore.getMastery("jmm")), "learning");
    offline = false;
    await page.locator("#cloud-open").click();
    await page.locator("#cloud-sync").click();
    await page.waitForFunction(() => document.getElementById("cloud-message").textContent.startsWith("已同步"));
    assert.equal(row.payload.progress.mastery.jmm, "learning");
    await page.locator("#cloud-logout").click();
    await page.waitForFunction(() => document.getElementById("cloud-label").textContent === "登录后同步");
    assert.equal(await page.evaluate(() => window.ProgressStore.getMastery("jmm")), "mastered");
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
