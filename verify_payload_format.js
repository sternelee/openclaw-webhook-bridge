const crypto = require('crypto');

// OpenClaw 的 buildDeviceAuthPayloadV3 实现
function normalizeDeviceMetadataForAuth(value) {
  if (typeof value !== "string") {
    return "";
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }
  // Only lowercase ASCII uppercase letters (A-Z)
  return trimmed.replace(/[A-Z]/g, (char) =>
    String.fromCharCode(char.charCodeAt(0) + 32)
  );
}

function buildDeviceAuthPayloadV3(params) {
  const scopes = params.scopes.join(",");
  const token = params.token ?? "";
  const platform = normalizeDeviceMetadataForAuth(params.platform);
  const deviceFamily = normalizeDeviceMetadataForAuth(params.deviceFamily);
  return [
    "v3",
    params.deviceId,
    params.clientId,
    params.clientMode,
    params.role,
    scopes,
    String(params.signedAtMs),
    token,
    params.nonce,
    platform,
    deviceFamily,
  ].join("|");
}

// 从日志中提取的参数
const params = {
  deviceId: "a62bbd19323f130a977eeb99ceb5e334719caebe50af26553312bddbd4f9a66a",
  clientId: "gateway-client",
  clientMode: "backend",
  role: "operator",
  scopes: ["operator.read", "operator.write", "operator.admin"],
  signedAtMs: 1772793565914,
  token: "ff8c9ce1d0c69a6652498147a71d2eba9127176e462f0232",
  nonce: "49b6b843-5862-4894-b2ef-92ff92ba44a7",
  platform: "linux",
  deviceFamily: "server",
};

const payload = buildDeviceAuthPayloadV3(params);
console.log("OpenClaw payload:");
console.log(payload);
console.log("\nPayload from Rust:");
console.log("v3|a62bbd19323f130a977eeb99ceb5e334719caebe50af26553312bddbd4f9a66a|gateway-client|backend|operator|operator.read,operator.write,operator.admin|1772793565914|ff8c9ce1d0c69a6652498147a71d2eba9127176e462f0232|49b6b843-5862-4894-b2ef-92ff92ba44a7|linux|server");

console.log("\nMatch:", payload === "v3|a62bbd19323f130a977eeb99ceb5e334719caebe50af26553312bddbd4f9a66a|gateway-client|backend|operator|operator.read,operator.write,operator.admin|1772793565914|ff8c9ce1d0c69a6652498147a71d2eba9127176e462f0232|49b6b843-5862-4894-b2ef-92ff92ba44a7|linux|server");
