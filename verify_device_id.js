const crypto = require('crypto');

// 从日志中提取的公钥
const publicKeyHex = "b31e76d1a9384926632d6e0a85487f4595ba6da695d74a059a95d2150fc70dfd";
const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');

// 计算设备 ID (SHA256 of public key)
const deviceId = crypto.createHash('sha256').update(publicKeyBuffer).digest('hex');

console.log("Expected Device ID:   a62bbd19323f130a977eeb99ceb5e334719caebe50af26553312bddbd4f9a66a");
console.log("Computed Device ID:", deviceId);
console.log("Match:", deviceId === "a62bbd19323f130a977eeb99ceb5e334719caebe50af26553312bddbd4f9a66a");
