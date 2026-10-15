function sanitizeText(value) {
  if (typeof value !== "string") return "";
  return value
    .replace(/[A-Z]:\\[^\s)]+/gi, "[本机路径]")
    .replace(/(?:\/[^\s:)]+){2,}/g, "[本机路径]")
    .replace(/(?:token|password|secret|key)=?[^\s&]+/gi, "[已隐藏]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [已隐藏]")
    .replace(/\b(?:sb_secret|sb_publishable)_[A-Za-z0-9_-]+/gi, "[Supabase 密钥已隐藏]")
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[邮箱已隐藏]")
    .replace(/([?&](?:code|token|key|email|password)=)[^&\s]+/gi, "$1[已隐藏]")
    .slice(0, 1000);
}

function sanitizeStack(stack) {
  if (typeof stack !== "string") return "";
  return stack.split("\n").slice(0, 20).map(line => sanitizeText(line).slice(0, 300)).join("\n");
}

function createDiagnostic({ eventName, error, appVersion, platform, architecture, electron, node }) {
  return {
    generatedAt: new Date().toISOString(),
    appVersion,
    platform,
    architecture,
    electron,
    node,
    event: String(eventName).slice(0, 80),
    error: sanitizeText(String(error?.message || error || "Unknown error")),
    stack: sanitizeStack(error?.stack)
  };
}

module.exports = { createDiagnostic, sanitizeText, sanitizeStack };
