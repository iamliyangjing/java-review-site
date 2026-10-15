const { test } = require("node:test");
const assert = require("node:assert/strict");
const { createDiagnostic } = require("../electron/diagnostics.cjs");

test("diagnostic export strips account secrets, email, local paths, and user content fields", () => {
  const diagnostic = createDiagnostic({
    eventName: "uncaught-exception",
    error: new Error("failed for reviewer@example.com token=refresh123 sb_secret_service123 C:\\Users\\reviewer\\bank.sqlite"),
    appVersion: "1.0.0-beta.1",
    platform: "win32",
    architecture: "x64",
    electron: "44.7.0",
    node: "22.20.0"
  });
  const serialized = JSON.stringify(diagnostic);
  assert.doesNotMatch(serialized, /reviewer@example\.com|refresh123|sb_secret_service123|C:\\\\Users/);
  assert.deepEqual(Object.keys(diagnostic).sort(), [
    "appVersion", "architecture", "electron", "error", "event", "generatedAt", "node", "platform", "stack"
  ]);
});
