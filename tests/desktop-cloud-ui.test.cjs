const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { chromium } = require("playwright");

let browser;

test.before(async () => {
  browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_CHANNEL ? { channel: process.env.BROWSER_CHANNEL } : {})
  });
});
after(async () => { await browser?.close(); });

test("desktop cloud controls configure, sign in, upload, and restore without touching real Supabase", async () => {
  const page = await browser.newPage();
  const desktopPath = path.resolve(__dirname, "../desktop.html").replace(/\\/g, "/");
  const cloudUrl = "https://java-review-test.supabase.co";
  await page.addInitScript(() => {
    const calls = [];
    let cloudStatus = { configured: false, signedIn: false, url: "" };
    window.__cloudCalls = calls;
    window.questionBank = {
      bootstrap: async () => ({ categories: [], questions: [], stats: { total: 0, due: 0, reviewedToday: 0, streak: 0 } }),
      listQuestions: async () => [],
      getCategories: async () => [],
      getDueQuestions: async () => [],
      getReviewStats: async () => ({ due: 0 }),
      getReviewHistory: async () => [],
      saveQuestion: async () => ({}),
      deleteQuestion: async () => ({}),
      restoreQuestion: async () => ({}),
      recordReview: async () => ({ dueAt: new Date().toISOString() }),
      exportData: async () => ({ canceled: true }),
      importData: async () => ({}),
      getCloudStatus: async () => cloudStatus,
      saveCloudConfig: async config => {
        calls.push({ method: "saveConfig", config });
        cloudStatus = { configured: true, signedIn: false, url: config.url };
        return { configured: true, url: config.url };
      },
      cloudSignIn: async credentials => {
        calls.push({ method: "signIn", credentials });
        cloudStatus = { configured: true, signedIn: true, email: credentials.email, url: cloudStatus.url };
        return { authenticated: true, email: credentials.email };
      },
      cloudSignUp: async () => ({ authenticated: false, needsEmailConfirmation: true }),
      cloudSignOut: async () => {
        cloudStatus = { ...cloudStatus, signedIn: false, email: "" };
        return { signedIn: false };
      },
      uploadCloudBackup: async () => {
        calls.push({ method: "upload" });
        return { revision: 1, uploadedAt: new Date().toISOString() };
      },
      restoreCloudBackup: async () => {
        calls.push({ method: "restore" });
        return { revision: 1, updatedAt: new Date().toISOString() };
      }
    };
  });
  try {
    await page.goto("file:///" + desktopPath);
    await page.locator("#cloud-sync").click();
    await page.locator("#cloud-url").fill(cloudUrl);
    await page.locator("#cloud-key").fill("sb_publishable_ui_test_key_1234567890");
    await page.locator("#save-cloud-config").click();
    await page.locator("#cloud-email").fill("reviewer@example.com");
    await page.locator("#cloud-password").fill("safe-test-password");
    await page.locator("#cloud-sign-in").click();
    await page.locator("#cloud-status").getByText("已登录").waitFor();

    await page.locator("#upload-cloud-backup").click();
    await page.locator("#confirm-action").click();
    await page.locator("#cloud-status").getByText("上传完成").waitFor();
    await page.locator("#restore-cloud-backup").click();
    await page.locator("#confirm-action").click();
    await page.locator("#cloud-status").getByText("恢复完成").waitFor();

    const methods = await page.evaluate(() => window.__cloudCalls.map(call => call.method));
    assert.deepEqual(methods, ["saveConfig", "signIn", "upload", "restore"]);
    const sentConfig = await page.evaluate(() => window.__cloudCalls.find(call => call.method === "saveConfig").config);
    assert.equal(sentConfig.url, cloudUrl);
  } finally {
    await page.close();
  }
});
