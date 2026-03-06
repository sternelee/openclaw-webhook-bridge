const publicKeyBase64Url = "sx520ak4SSZjLW4KhUh_RZW6baaV10oFmpXSFQ_HDf0";
const privateKeyBase64Url = "foCxn63lJglTob5KrIXUTNiedSJhZ7pivObRdcPg3W8";

// Decode base64url
function base64UrlDecode(str) {
    return Buffer.from(str.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

const publicKey = base64UrlDecode(publicKeyBase64Url);
const privateKey = base64UrlDecode(privateKeyBase64Url);

console.log("From identity.json:");
console.log("Public Key (base64url):", publicKeyBase64Url);
console.log("Public Key (hex):", publicKey.toString('hex'));
console.log("Private Key (base64url):", privateKeyBase64Url);
console.log("Private Key (hex):", privateKey.toString('hex'));

console.log("\nFrom logs:");
console.log("Public Key (hex):", "b31e76d1a9384926632d6e0a85487f4595ba6da695d74a059a95d2150fc70dfd");
console.log("Private Key (hex):", "7e80b19fade5260953a1be4aac85d44cd89e75226167ba62bce6d175c3e0dd6f");

console.log("\nPublic key match:", publicKey.toString('hex') === "b31e76d1a9384926632d6e0a85487f4595ba6da695d74a059a95d2150fc70dfd");
console.log("Private key match:", privateKey.toString('hex') === "7e80b19fade5260953a1be4aac85d44cd89e75226167ba62bce6d175c3e0dd6f");
