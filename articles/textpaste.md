---
title: S-TextPaste：零信任端到端加密，量子时代亦不可破的文本粘贴工具
slug: s-textpaste
tags: ["安全", "加密", "开源", "Cloudflare", "前端", "React", "TypeScript", "隐私", "后端", "教程"]
categories: ["技术", "编程", "教程"]
description: "零信任端到端加密文本粘贴工具深度解析——三层嵌套加密、抗量子攻击、67轮KDF、AES-256-GCM + HMAC完整性校验"
date: 2026-07-19
featuredImage: "/media/og-image.svg"
draft: false
---

# S-TextPaste：零信任端到端加密，量子时代亦不可破的文本粘贴工具

当"复制粘贴"遇上量子安全。

## 引言

在数据泄露频发的今天，我们每天都在各种平台之间复制粘贴文本——密码、私钥、机密信息、私人对话……这些内容在传输和存储过程中，随时可能被中间人截获或被服务商违规查看。传统的"加密传输"往往依赖服务端的信任，但服务端本身可能被攻破，也可能"主动"查看你的数据。

**S-TextPaste** 正是为了解决这一痛点而生。它是一个开源的、零信任端到端加密的文本粘贴工具，官方 slogan 直击核心——**"零信任端到端加密，量子时代亦不可破"**。所有加密操作均在用户浏览器中完成，服务端永远无法解密或恢复你的数据。

> 在线体验地址：https://wbfx.stop666.dpdns.org

---

## 一、核心功能：不只是"粘贴"，更是"安全传输"

S-TextPaste 本质上是一个"加密文本便签"服务，但它与普通 Pastebin 类工具有着本质区别：

- **端到端加密**：明文在离开你的浏览器之前就已经完成加密，服务端只存储密文。
- **密码保护**：你可以为每一条粘贴内容设置密码，只有知道密码的人才能解密查看。
- **阅后即焚**：支持设置"查看后自动销毁"，敏感信息看完即消失。
- **限时与限次**：可设置过期时间和最大查看次数，双重生命周期控制。
- **自定义 ID**：你可以为自己的粘贴内容指定一个易记的 ID。
- **删除令牌**：创建时返回删除令牌（delete_token），凭此可随时手动删除。

### 使用场景

| 场景 | 说明 |
|------|------|
| 分享密码/密钥 | 加密后分享，指定密码+阅后即焚，对方查看后自动销毁 |
| 传输机密文档片段 | 加密粘贴，设置过期时间，过期自动清理 |
| 临时 API Token | 开发调试时安全传递 Token，限次查看防止泄露 |
| 私密对话 | 加密内容 + 密码保护，服务端无法查看内容 |
| 跨设备文本传输 | 加密后通过 ID 提取，中间链路无法解密 |

---

## 二、加密架构：三层防护，抗量子攻击

这是 S-TextPaste 最硬核的部分。它没有使用常规的单层 AES 加密，而是设计了一套**三层嵌套加密 + HMAC 完整性校验**的架构：

### 密钥派生（KDF）—— 67 轮链式迭代

从用户密码开始，经过**四条完全不同的推导路径**，生成三个独立密钥：

| 派生路径 | 轮数 | 输出长度 | 用途 |
|---|---|---|---|
| derive512 | 12 轮 | 512-bit | 基础密钥 |
| derive1024A | 24 轮 | 1024-bit | PQ 密钥 A |
| derive1024B | 24 轮 | 1024-bit | PQ 密钥 B |
| deriveHMAC | 7 轮 | 256-bit | HMAC 完整性密钥 |

每一轮**同时使用 SHA-256 和 MD5**，通过 XOR 交织进行链式迭代。这种设计大幅增加了暴力破解的难度——即便量子计算机问世，1024-bit 的密钥空间也足以让其望而却步。

### 三层加密流程

```
明文
  ├─ [Layer 1] DEK(随机32字节) ──AES-256-GCM──→ ciphertext_L1
  ├─ [Layer 2] PQ密钥A(1024bit) ──AES-256-GCM──→ ciphertext_L2
  ├─ [Layer 3] PQ密钥B(1024bit) ──AES-256-GCM──→ ciphertext_L3
  └─ HMAC-SHA-256(integrityKey, 全载荷) ────→ 防篡改标签
```

加密流程的核心逻辑是：

1. **第一层**：使用随机生成的 DEK（数据加密密钥）通过 AES-256-GCM 加密明文
2. **第二层**：用 PQ 密钥 A（1024-bit）加密第一层的密文
3. **第三层**：用 PQ 密钥 B（1024-bit）加密第二层的密文
4. **完整性**：用独立的 HMAC 密钥对全部载荷生成防篡改标签

解密时反向操作：先验证 HMAC（任何篡改立即拒绝），然后逐层解密。**错误密码会导致 HMAC 或 AES-GCM 认证失败，解密立即中止**——攻击者连"密码对不对"都无从得知。

---

## 三、安全特性一览

| 特性 | 实现方式 |
|---|---|
| 加密算法 | AES-256-GCM（认证加密） |
| 完整性校验 | HMAC-SHA-256 全载荷校验 |
| 密钥长度 | 512-bit 基础 + 1024-bit × 2 |
| KDF 轮数 | 67 轮链式迭代 |
| 传输安全 | HTTPS 强制（Cloudflare） |
| 内容安全策略 | default-src 'self' |
| 链接爆破防护 | 32 字符随机 ID（64^32 组合空间） |
| 速率限制 | 30 次/分钟/IP |
| 删除令牌 | SHA-256 哈希存储，不可逆 |
| 密码锁定 | 连续 5 次错误后拒绝 |
| 内容泄露防护 | React Router state 内存传递，不出现在 URL |
| 载荷元数据 | salt/mode/hint 全部嵌入密文 |

特别注意最后一点：**salt、mode、hint、algorithm 全部嵌入 encrypted_payload 内部**。API 返回的只有加密载荷和生命周期字段，没有任何可用于破解的元数据暴露在外。

---

## 四、技术架构：现代全栈的典范

S-TextPaste 采用了一套相当现代的技术栈：

| 层级 | 技术 |
|---|---|
| 前端框架 | React 18 + TypeScript |
| 构建工具 | Vite 5 |
| 代码编辑器 | CodeMirror 6 |
| Markdown 渲染 | marked + highlight.js + Mermaid + KaTeX |
| 安全过滤 | DOMPurify |
| 加密 | Web Crypto API（浏览器原生） |
| 后端运行时 | Cloudflare Workers |
| 后端框架 | Hono 4 |
| 数据库 | Cloudflare D1（SQLite） |
| 部署工具 | Wrangler CLI |

**加密完全在客户端完成**，使用浏览器原生的 Web Crypto API——这意味着密钥永远不会离开你的设备，服务端根本接触不到明文。

项目结构清晰，分为 Cloudflare Worker 后端（Hono 框架）和 React 18 前端两大模块。前端包含完整的加密解密逻辑（crypto.ts）、创建/查看/解密页面以及中/英文国际化支持。

---

## 五、部署方式

S-TextPaste 提供了多种部署方式，满足不同场景需求：

### 1. 一键部署（Cloudflare）
点击 README 中的一键部署按钮，Cloudflare 自动完成全部流程，部署后立即可用（内存模式）。

### 2. D1 数据库持久化
部署后通过 Cloudflare Dashboard 添加 D1 Database Binding，变量名设为 `DB`，Worker 会自动检测并切换到 D1 持久化存储。

### 3. 本地开发

```bash
# 终端1 — 后端
cd worker && node server.js

# 终端2 — 前端
cd frontend && npm install && npm run dev
```

### 4. Cloudflare Workers 部署（推荐）

```bash
git clone https://github.com/stop666two/S-TextPaste
cd S-TextPaste
npx wrangler d1 create s-textpaste-db
# 编辑 wrangler.toml，填入 database_id
npm install && npm run build && npx wrangler deploy
```

### 5. 自建服务器
使用 Node.js 运行 `worker/server.js`，前端通过 Nginx 代理。

---

## 六、API 文档

S-TextPaste 提供了完整的 REST API：

### 创建粘贴

```
POST /api/paste
Content-Type: application/json

{
  "payload": "<encrypted_data>",
  "expires_in": 3600,
  "max_views": 5,
  "burn_after_reading": false,
  "custom_id": "my-note"
}
```

**响应**：

```json
{
  "id": "abc123...",
  "delete_token": "del_xyz...",
  "expires_at": 1720000000
}
```

**参数说明**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| payload | string | 是 | 浏览器端加密后的密文（Base64） |
| password_hint | string | 否 | 密码提示（也会被加密嵌入 payload） |
| expires_in | number | 否 | 过期时间（秒），默认 86400 |
| max_views | number | 否 | 最大查看次数 |
| burn_after_reading | boolean | 否 | 是否阅后即焚 |
| custom_id | string | 否 | 自定义 ID（需唯一） |

### 获取粘贴

```
GET /api/paste/:id
```

**响应**：返回加密载荷和生命周期状态，不含解密密钥。

### 记录查看

```
POST /api/paste/:id/view
```

触发计数和阅后即焚逻辑。

### 删除粘贴

```
DELETE /api/paste/:id
Authorization: Bearer <delete_token>
```

---

## 七、与其他工具对比

| 特性 | S-TextPaste | Pastebin | GitHub Gist | PrivateBin |
|------|-------------|----------|-------------|------------|
| 端到端加密 | ✅ 是 | ❌ 否 | ❌ 否 | ✅ 是 |
| 抗量子加密 | ✅ 是 | ❌ 否 | ❌ 否 | ❌ 否 |
| 三层嵌套加密 | ✅ 是 | ❌ 否 | ❌ 否 | ❌ 否 |
| 阅后即焚 | ✅ 是 | ❌ 否 | ❌ 否 | ✅ 是 |
| 密码保护 | ✅ 是 | ❌ 否 | ❌ 否 | ✅ 是 |
| 自定义 ID | ✅ 是 | ❌ 否 | ❌ 否 | ❌ 否 |
| 开源 | ✅ MIT | ❌ 否 | ❌ 否 | ✅ 是 |
| 一键部署 | ✅ Cloudflare | — | — | ❌ 需服务器 |

---

## 八、写在最后

在"隐私即人权"的今天，S-TextPaste 的价值不仅仅在于它是一个好用的工具，更在于它所代表的理念：

1. **零信任**：不依赖对任何服务端的信任，安全由密码学保证
2. **抗量子**：前瞻性地考虑了量子计算对现有加密体系的威胁
3. **开源透明**：代码完全开源（MIT 许可证），任何人都可以审查、自部署
4. **开箱即用**：一键部署到 Cloudflare，个人也能轻松拥有自己的安全 Pastebin

当然，项目也给出了明确的免责声明：所有加密在浏览器中完成，服务端无法解密；用户须自行保管密码——**密码丢失则数据永久不可恢复**。这正是零信任的代价，也是零信任的承诺。

如果你对隐私安全、密码学应用或现代全栈开发感兴趣，S-TextPaste 是一个值得关注和研究的项目。

<https://github.com/stop666two/S-TextPaste>
