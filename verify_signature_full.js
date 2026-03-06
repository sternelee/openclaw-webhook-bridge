const crypto = require('crypto');

// 从日志和 identity.json 提取的数据
const publicKeyHex = "b31e76d1a9384926632d6e0a85487f4595ba6da695d74a059a95d2150fc70dfd";
const privateKeyHex = "7e80b19fade5260953a1be4aac85d44cd89e75226167ba62bce6d175c3e0dd6f";
const payload = "v3|a62bbd19323f130a977eeb99ceb5e334719caebe50af26553312bddbd4f9a66a|gateway-client|backend|operator|operator.read,operator.write,operator.admin|1772793565914|ff8c9ce1d0c69a6652498147a71d2eba9127176e462f0232|49b6b843-5862-4894-b2ef-92ff92ba44a7|linux|server";
const signatureBase64Url = "NzMjZF3DX2JUQ-77FAgltqnfxnQSDX10tG1ncJ4libE56ySONBUDFNz_IJ3FkOc-YsxdP_w6Zk9U43vuH6AYAA";

console.log("=== Testing Ed25519 Signature ===\n");
console.log("Payload:", payload);
console.log("Payload length:", payload.length);
console.log("\nPublic Key (hex):", publicKeyHex);
console.log("Private Key (hex):", privateKeyHex);
console.log("Signature (base64url):", signatureBase64Url);

// ED25519 SPKI prefix
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");

// 从 hex 创建 Buffer
const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');
const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');

console.log("\nPublic Key buffer length:", publicKeyBuffer.length);
console.log("Private Key buffer length:", privateKeyBuffer.length);

// 创建 SPKI 格式的公钥
const spkiPublicKey = Buffer.concat([ED25519_SPKI_PREFIX, publicKeyBuffer]);
console.log("\nSPKI Public Key (hex):", spkiPublicKey.toString('hex'));

// 创建公钥对象
const publicKey = crypto.createPublicKey({
    key: spkiPublicKey,
    type: 'spki',
    format: 'der'
});

console.log("✅ Public key object created");
console.log("   Type:", publicKey.type);
console.log("   Asymmetric Key Type:", publicKey.asymmetricKeyType);

// 解码签名
function base64UrlDecode(str) {
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

const signatureBuffer = base64UrlDecode(signatureBase64Url);
console.log("\nSignature buffer length:", signatureBuffer.length);

// 验证签名
const payloadBuffer = Buffer.from(payload, 'utf8');
const isValid = crypto.verify(null, payloadBuffer, publicKey, signatureBuffer);

console.log("\n=== Verification Result ===");
console.log("Signature valid:", isValid);

if (!isValid) {
    console.log("\n❌ Signature verification failed!");
    console.log("\nLet's try creating a new signature with the same private key...");

    // 创建私钥对象并签名
    // Ed25519 私钥格式：32 bytes seed
    // Node.js 需要完整的 64 bytes 私钥（seed + public key）
    // 我们需要手动构建

    // 使用 seed 创建完整的 Ed25519 私钥
    const fullPrivateKey = Buffer.concat([
        privateKeyBuffer,  // 32 bytes seed
        publicKeyBuffer    // 32 bytes public key
    ]);

    console.log("\nFull private key (hex):", fullPrivateKey.toString('hex'));
    console.log("Full private key length:", fullPrivateKey.length);

    // 创建 PKCS#8 格式的私钥
    // Ed25519 私钥 PKCS#8 前缀
    const ED25519_PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");
    const pkcs8PrivateKey = Buffer.concat([ED25519_PKCS8_PREFIX, fullPrivateKey]);

    console.log("PKCS#8 private key (hex):", pkcs8PrivateKey.toString('hex'));

    const privateKeyObj = crypto.createPrivateKey({
        key: pkcs8PrivateKey,
        type: 'pkcs8',
        format: 'der'
    });

    console.log("✅ Private key object created");

    // 使用私钥签名
    const newSignature = crypto.sign(null, payloadBuffer, privateKeyObj);
    console.log("\nNew signature (base64):", newSignature.toString('base64'));
    console.log("New signature (base64url):", newSignature.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''));
    console.log("New signature length:", newSignature.length);

    // 验证新签名
    const isNewValid = crypto.verify(null, payloadBuffer, publicKey, newSignature);
    console.log("\nNew signature valid:", isNewValid);
} else {
    console.log("\n✅ Signature is valid!");
    console.log("The problem might be elsewhere in the handshake process.");
}
