const crypto = require('crypto');

// ED25519 SPKI prefix from OpenClaw
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

// 从日志中提取的公钥 (base64url)
const publicKeyBase64Url = "sx52SONBUDFNz_IJ3FkOc-YsxdP_w6Zk9U43vuH6AYAA";

// 解码 base64url
function base64UrlDecode(str) {
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

// 创建 SPKI 格式的公钥
const publicKeyBuffer = Buffer.concat([ED25519_SPKI_PREFIX, base64UrlDecode(publicKeyBase64Url)]);

console.log("ED25519 SPKI Prefix (hex):", ED25519_SPKI_PREFIX.toString('hex'));
console.log("Public Key (base64url):", publicKeyBase64Url);
console.log("Public Key decoded (hex):", base64UrlDecode(publicKeyBase64Url).toString('hex'));
console.log("Full SPKI public key (hex):", publicKeyBuffer.toString('hex'));
console.log("Full SPKI length:", publicKeyBuffer.length);

// 使用 Node.js crypto 创建公钥对象
const publicKey = crypto.createPublicKey({
    key: publicKeyBuffer,
    type: 'spki',
    format: 'der'
});

console.log("\n✅ Public key object created successfully");
console.log("Public key type:", publicKey.type);
console.log("Public key asymmetric key type:", publicKey.asymmetricKeyType);

// 提取原始公钥字节
const exportedSpki = publicKey.export({ type: 'spki', format: 'der' });
console.log("\nExported SPKI (hex):", exportedSpki.toString('hex'));
console.log("Exported SPKI length:", exportedSpki.length);

// 验证前缀
const prefixMatch = exportedSpki.subarray(0, ED25519_SPKI_PREFIX.length).equals(ED25519_SPKI_PREFIX);
console.log("\nPrefix match:", prefixMatch);

// 提取公钥字节
const rawPublicKey = exportedSpki.subarray(ED25519_SPKI_PREFIX.length);
console.log("Raw public key (hex):", rawPublicKey.toString('hex'));
console.log("Expected (from logs):", "b31e76d1a9384926632d6e0a85487f4595ba6da695d74a059a95d2150fc70dfd");
console.log("Match:", rawPublicKey.toString('hex') === "b31e76d1a9384926632d6e0a85487f4595ba6da695d74a059a95d2150fc70dfd");
