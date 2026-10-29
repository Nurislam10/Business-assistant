const crypto = require("crypto");

function safeEqual(left, right) {
  const a = Buffer.from(left || "");
  const b = Buffer.from(right || "");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createSignature(rawBody, appSecret) {
  return `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
}

function verifySignature(rawBody, signature, appSecret) {
  if (!appSecret || !signature || !signature.startsWith("sha256=")) return false;
  return safeEqual(createSignature(rawBody, appSecret), signature);
}

module.exports = { createSignature, verifySignature };
