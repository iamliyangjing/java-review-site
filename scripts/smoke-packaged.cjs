const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const unpacked = path.join(root, "release", "win-unpacked");
const executable = fs.readdirSync(unpacked).find(name => name.endsWith(".exe") && !name.toLowerCase().includes("uninstall"));
if (!executable) throw new Error("Packaged Electron executable was not found");

const userData = fs.mkdtempSync(path.join(os.tmpdir(), "jrs-packaged-smoke-"));
const child = spawn(path.join(unpacked, executable), ["--user-data-dir=" + userData], {
  env: { ...process.env, JAVA_REVIEW_SMOKE_TEST: "1" },
  windowsHide: true,
  stdio: "inherit"
});

const timeout = setTimeout(() => child.kill(), 60000);
child.once("error", error => {
  clearTimeout(timeout);
  fs.rmSync(userData, { recursive: true, force: true });
  throw error;
});
child.once("exit", (code, signal) => {
  clearTimeout(timeout);
  const databasePath = path.join(userData, "question-bank.sqlite");
  const persisted = fs.existsSync(databasePath) && fs.statSync(databasePath).size > 0;
  fs.rmSync(userData, { recursive: true, force: true });
  if (code !== 0 || signal || !persisted) process.exitCode = 1;
  else process.stdout.write("PASS: packaged app launched offline and retained a review after reopening SQLite.\n");
});
