# OpenClaw Bridge v3 Protocol Update

## 问题

Bridge 无法连接到 OpenClaw Gateway，错误信息：`device signature invalid`

## 根本原因

我们声明使用协议版本 3（`minProtocol: 3, maxProtocol: 3`），但设备认证载荷使用的是 v2 格式。OpenClaw Gateway 会首先尝试验证 v3 载荷，失败后才会尝试 v2，但由于我们声明了 v3，应该使用 v3 格式。

## 解决方案

### 1. 升级到 v3 载荷格式

**旧格式 (v2)**:
```
v2|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce
```

**新格式 (v3)**:
```
v3|deviceId|clientId|clientMode|role|scopes|signedAtMs|token|nonce|platform|deviceFamily
```

### 2. 实现 normalize_device_metadata

根据 OpenClaw 规范，`normalizeDeviceMetadataForAuth` 函数：

- Trims whitespace
- **只转换 ASCII 大写字母 (A-Z) 为小写**
- **保留所有其他字符不变**
- 空值返回空字符串

**实现**:
```rust
fn normalize_device_metadata(s: &str) -> String {
    s.chars()
        .map(|c| {
            if ('A'..='Z').contains(&c) {
                char::from_u32(c as u32 + 32).unwrap_or(c)
            } else {
                c
            }
        })
        .collect()
}
```

### 3. 更新 connect request

添加 `deviceFamily` 到 `client` 参数：
```json
{
  "client": {
    "id": "gateway-client",
    "version": "0.2.0",
    "platform": "linux",
    "deviceFamily": "server",
    "mode": "backend"
  }
}
```

### 4. 调试日志

添加详细日志输出：
- Device auth payload (完整载荷字符串)
- Device signature (base64url 编码的签名)

## 验证

使用 Node.js 验证签名逻辑：
```javascript
const crypto = require('crypto');

// 载荷
const payload = "v3|...";

// 公钥 (hex)
const publicKeyHex = "...";

// 签名 (base64url)
const signatureBase64Url = "...";

// 创建 SPKI 格式的公钥
const ED25519_SPKI_PREFIX = Buffer.from("302a300506032b6570032100", "hex");
const publicKeyBuffer = Buffer.from(publicKeyHex, 'hex');
const spkiPublicKey = Buffer.concat([ED25519_SPKI_PREFIX, publicKeyBuffer]);

const publicKey = crypto.createPublicKey({
    key: spkiPublicKey,
    type: 'spki',
    format: 'der'
});

// 验证签名
const isValid = crypto.verify(null, Buffer.from(payload, 'utf8'), publicKey, signatureBuffer);
console.log("Signature valid:", isValid);  // true
```

## 提交历史

- 04fc9c2 - fix: implement v3 device auth protocol with correct normalization
- d53f6e6 - docs: enhance CLAUDE.md with comprehensive development guidance

## 测试

重新运行 bridge：
```bash
cargo build --release
RUST_LOG=info ./target/release/openclaw-bridge run
```

查看日志中的设备认证载荷和签名，确认格式正确。
