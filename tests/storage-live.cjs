// Run against disposable, confirmed test accounts supplied through the environment.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { randomUUID } = require("node:crypto");
const { createClient } = vm.runInThisContext(fs.readFileSync(path.join(__dirname, "../vendor/supabase.min.js"), "utf8") + ";supabase;");
const context = { window: {} };
const localConfigPath = path.join(__dirname, "../js/supabase-config.local.js");
const configPath = fs.existsSync(localConfigPath) ? localConfigPath : path.join(__dirname, "../js/supabase-config.js");
vm.runInNewContext(fs.readFileSync(configPath, "utf8"), context);
const config = context.window.SUPABASE_CONFIG;
const accounts = JSON.parse(process.env.JRS_STORAGE_QA_ACCOUNTS || "[]");
const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNQbSv9DwAEFAIg2y13cQAAAABJRU5ErkJggg==", "base64");

async function main() {
  assert.equal(accounts.length, 2, "Supply two disposable accounts; never use a personal account");
  const clients = accounts.map(() => createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } }));
  const anonymous = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const uploaded = [];
  try {
    for (const [index, client] of clients.entries()) {
      const result = await client.auth.signInWithPassword({ email: accounts[index].email, password: accounts[index].password });
      assert.equal(result.error, null, result.error?.message);
      assert.equal(result.data.user.id, accounts[index].id);
    }
    const bucket = clients[0].storage.from("jrs-note-images");
    const other = clients[1].storage.from("jrs-note-images");
    const guest = anonymous.storage.from("jrs-note-images");
    const prefix = accounts[0].id + "/jmm";
    const file = prefix + "/" + randomUUID() + ".png";
    const upload = await bucket.upload(file, bytes, { contentType: "image/png", upsert: false });
    assert.equal(upload.error, null, upload.error?.message);
    uploaded.push(file);
    const listed = await bucket.list(prefix);
    assert.equal(listed.error, null);
    assert.ok(listed.data.some(item => item.name === file.split("/").at(-1)));
    const signed = await bucket.createSignedUrl(file, 60);
    assert.equal(signed.error, null);
    const response = await fetch(signed.data.signedUrl);
    assert.equal(response.status, 200);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), bytes);
    assert.equal((await guest.list(prefix)).data?.length || 0, 0);
    assert.ok((await guest.createSignedUrl(file, 60)).error);
    assert.equal((await other.list(prefix)).data?.length || 0, 0);
    assert.ok((await other.download(file)).error);
    assert.ok((await other.createSignedUrl(file, 60)).error);
    await other.remove([file]);
    assert.equal((await bucket.download(file)).error, null, "Cross-account deletion must not remove the owner's file");
    assert.ok((await other.upload(prefix + "/forbidden.png", bytes, { contentType: "image/png" })).error);
    assert.ok((await bucket.upload(prefix + "/forbidden.svg", Buffer.from("<svg></svg>"), { contentType: "image/svg+xml" })).error);
    assert.ok((await bucket.upload(prefix + "/too-large.png", Buffer.alloc(5242881), { contentType: "image/png" })).error);
    assert.equal((await bucket.remove([file])).error, null);
    assert.equal((await bucket.list(prefix)).data.length, 0);
    console.log("PASS: real upload, list, signed image, delete, account isolation, anonymous denial, MIME and size limits");
  } finally {
    if (uploaded.length) {
      const cleanup = await clients[0].storage.from("jrs-note-images").remove(uploaded);
      assert.equal(cleanup.error, null, "Disposable image cleanup must succeed");
    }
    for (const client of clients) await client.auth.signOut({ scope: "local" });
  }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
