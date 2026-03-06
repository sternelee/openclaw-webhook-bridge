const crypto = require('crypto');

// 从日志中提取的数据
const deviceId = "a62bbd19323f130a977eeb99ceb5e334719caebe50af26553312bddbd4f9a66a";
const publicKeyHex = "b31e76d1a9384926632d6e0a85487f4595ba6da695d74a059a95d2150fc70dfd";
const privateKeyHex = "7e80b19fade5260953a1be4aac85d44cd89e75226167ba62bce6d175c3e0dd6f";
const payload = "v3|a62bbd19323f130a977eeb99ceb5e334719caebe50af26553312bddbd4f9a66a|gateway-client|backend|operator|operator.read,operator.write,operator.admin|1772793565914|ff8c9ce1d0c69a6652498147a71d2eba9127176e462f0232|49b6b843-5862-4894-b2ef-92ff92ba44a7|linux|server";
const signatureBase64Url = "NzMjZF3DX2JUQ-77FAgltqnfxnQSDX10tG1ncJ4libE56ySONBUDFNz_IJ3FkOc-YsxdP_w6Zk9U43vuH6AYAA";

console.log("=== Testing Ed25519 Signature ===\n");
console.log("Payload:", payload);
console.log("Payload length:", payload.length);
console.log("Public Key (hex):", publicKeyHex);
console.log("Signature (base64url):", signatureBase64Url);
console.log();

// 将公钥从 hex 转换为 Buffer
const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');
console.log("Public Key buffer length:", publicKeyBuffer.length);

// 将签名从 base64url 转换为 Buffer
const signatureBuffer = Buffer.from(signatureBase64Url.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
console.log("Signature buffer length:", signatureBuffer.length);

// OpenClaw 使用 SPKI 格式的公钥
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const spkiKey = Buffer.concat([ED25519_SPKI_PREFIX, publicKeyBuffer]);

// 创建公钥对象
const publicKey = crypto.createPublicKey({
    key: spkiKey,
    type: 'spki',
    format: 'der'
});

// 验证签名
const payloadBuffer = Buffer.from(payload, 'utf8');
const isValid = crypto.verify(null, payloadBuffer, publicKey, signatureBuffer);

console.log();
console.log("=== Verification Result ===");
console.log("Signature valid:", isValid);

if (!isValid) {
    console.log("\n❌ Signature verification failed!");
    console.log("This means the Rust signature doesn't match what OpenClaw expects.");
    console.log("\nLet's try to create a new signature and verify it...");

    // 使用私钥创建新签名
    const privateKeyBuffer = Buffer.from(privateKeyHex, 'hex');
    const privateKey = crypto.createPrivateKey({
        key: Buffer.concat([
            Buffer.from("302e020100300506032b657004220420", "hex"),
            privateKeyBuffer
        ]),
        type: 'pkcs8',
        format: 'der'
    });

    const newSignature = crypto.sign(null, payloadBuffer, privateKey);
    console.log("New signature (base64):", newSignature.toString('base64'));
    console.log("New signature (base64url):", newSignature.toString('base64url'));

    const newIsValid = crypto.verify(null, payloadBuffer, publicKey, newSignature);
    console.log("New signature valid:", newIsValid);
} else {
    console.log("\n✅ Signature is valid!");
    console.log("The problem might be elsewhere in the handshake process.");
}
