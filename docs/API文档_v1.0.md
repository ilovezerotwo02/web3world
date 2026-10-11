# Monad 像素农场 — API 文档 v1.0

> 前端对接文档。后端运行在 Cloudflare Workers，所有 API 路径以 `/api/` 开头。
> 基础地址：部署后为 `https://monad-pixel-farm.xxx.workers.dev`，本地开发为 `http://localhost:3000`
>
> **P0 联调清单** 见 [P0前端联调清单.md](./P0前端联调清单.md)

---

## 目录

- [通用说明](#通用说明)
- [1. 用户系统](#1-用户系统)
- [2. 课程系统](#2-课程系统)
- [3. 学习进度](#3-学习进度)
- [4. EXP 与等级](#4-exp-与等级)
- [5. 审核与验证](#5-审核与验证)
- [6. 学习档案](#6-学习档案)
- [7. NFT 铸造](#7-nft-铸造)
- [8. 管理面板](#8-管理面板)
- [9. 基础设施](#9-基础设施)
- [10. 前端联调清单](#10-前端联调清单)

---

## 通用说明

### 认证方式

```
Authorization: Bearer <token>
```

- 注册/登录时返回 `token`
- 未认证的接口返回 `401`
- 管理员接口对普通用户返回 `403`
- 维护模式开启时，非管理员接口返回 `503`

### 请求格式

- `Content-Type: application/json`
- 请求体使用 JSON

### 响应格式

```json
// 成功
{ "data": ..., "message": "..." }

// 错误
{ "error": "错误描述" }
```

### HTTP 状态码

| 状态码 | 含义 |
|--------|------|
| 200 | 成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 401 | 未认证（无 token 或 token 失效） |
| 403 | 无权限 |
| 404 | 资源不存在 |
| 409 | 冲突（重复创建等） |
| 503 | 服务不可用（维护模式） |
| 500 | 服务器错误 |

---

## 1. 用户系统

### 1.1 注册 / 登录

注册新用户，如用户名已存在则返回 409。

```
POST /api/auth
```

**请求体：**

```json
{
  "username": "string (必填)",
  "avatarUrl": "string (可选)"
}
```

**响应 200：**

```json
{
  "user": { "id": "uuid", "username": "test_user", "role": "user", "exp": 0, "level": 1 },
  "token": "session-token-string"
}
```

### 1.2 获取当前用户

```
GET /api/auth
```

**Header:** `Authorization: Bearer <token>`

**响应 200：**

```json
{
  "user": { "id": "uuid", "username": "test_user", "role": "user", "exp": 100, "level": 2, "avatarUrl": "..." }
}
```

### 1.3 退出登录

```
DELETE /api/auth
```

**Header:** `Authorization: Bearer <token>`

**响应 200：** `{ "message": "已退出登录" }`

### 1.4 修改个人资料

```
PUT /api/users
```

**Header:** `Authorization: Bearer <token>`

**请求体：**

```json
{
  "username": "string (可选)",
  "avatarUrl": "string (可选)"
}
```

**响应 200：** `{ "user": { ... } }`

### 1.5 钱包地址管理

钱包地址直接作为 `users` 表的字段，不再使用独立的 `wallet_bindings` 表。
查询地址和用户的关系：

```
GET /api/wallet?userId=X
GET /api/wallet?address=0x...
```

**响应：**

```json
{ "user": { "id": "uuid", "username": "test_user", "walletAddress": "0x..." } }
```

设置/修改钱包地址：

```
PUT /api/wallet
```

**Header:** `Authorization: Bearer <token>`

**请求体：**

```json
{ "address": "0x..." }
```

**响应：**

```json
{ "user": { "id": "uuid", "username": "test_user", "walletAddress": "0x..." }, "message": "Wallet bound successfully" }
```

> 首次绑定自动发放 EXP 奖励。修改地址直接覆盖，无需先解绑。

---

## 2. 课程系统

### 2.1 获取课程详情

```
GET /api/courses?courseId=web3
```

**响应 200：**

```json
{
  "course": {
    "id": "web3",
    "slug": "web3",
    "title": "Web3 通识",
    "seedType": "账本星种",
    "cropType": "守护浆果",
    "description": "理解账户、钱包、交易和基础安全，能够判断常见风险。",
    "order": 1,
    "prerequisites": [],
    "status": "available",
    "chapters": [
      {
        "id": "account",
        "number": 1,
        "title": "区块链、账户与地址",
        "pace": "认识 / 破冰",
        "objective": "学完你会知道...",
        "body": "区块链可以理解成...",
        "terms": ["区块链", "钱包地址", "不可篡改"],
        "example": "...",
        "caution": "...",
        "knowledgeCard": { "definition": "...", "reason": "...", "visibleResult": "...", "stateChange": "...", "checkBeforeAction": "..." }
      }
    ],
    "challenges": [
      { "chapterId": "account", "questions": [...] }
    ],
    "quiz": [
      { "id": "fq-web3-1", "questionBlob": { "prompt": "...", "options": [...], "answer": "..." } }
    ]
  }
}
```

---

## 3. 学习进度

### 3.1 获取进度

```
GET /api/progress?userId=X&courseId=Y
```

**响应 200：**

```json
{
  "progress": {
    "started": 1,
    "seedGranted": 0,
    "landCleared": 0,
    "planted": 0,
    "chaptersRead": "[]",
    "challengePassed": "[]",
    "challengeMistakes": "[]",
    "verification": "none",
    "harvested": 0,
    "recentActivity": "[]"
  }
}
```

### 3.2 更新进度（状态机）

```
POST /api/progress
```

**请求体：**

```json
{
  "userId": "uuid",
  "courseId": "web3",
  "action": {
    "type": "start-course | clear-land | plant | complete-theory | challenge-mistake | complete-challenge | start-quiz | pass-verification | harvest | reset",
    "chapter": 0,  // 仅 complete-theory / challenge-mistake / complete-challenge 需要
    "answers": {}   // 仅 complete-challenge / pass-verification 需要
  }
}
```

**action 状态流转：**

| action | 前置条件 | 效果 | EXP 奖励 |
|--------|---------|------|---------|
| `start-course` | 无 | `started=true, seedGranted=true` | 10 |
| `clear-land` | `seedGranted` | `landCleared=true` | 10 |
| `plant` | `landCleared` | `planted=true` | 10 |
| `complete-theory` | `planted`, `chapter` | `chaptersRead[chapter]=true` | 10/章 |
| `complete-challenge` | 全部章节读完 | `challengePassed[chapter]=true` | 20/章+5完美 |
| `start-quiz` | 全部挑战通过 | `verification=quiz` | - |
| `pass-verification` | 全部挑战通过 | `verification=passed` | 50 |
| `harvest` | `verification=passed` | `harvested=true` | 100 |
| `reset` | 任何状态 | 重置为初始 | - |

**响应 200：**

```json
{
  "progress": { "started": 1, "verification": "passed", "harvested": 1, ... },
  "changed": true
}
```

### 3.3 课程复习

```
GET /api/review?courseId=web3
```

**Header:** `Authorization: Bearer <token>`

**响应 200：**

```json
{
  "course": { "id": "web3", "title": "Web3 通识" },
  "chapters": [
    { "id": "account", "number": 1, "title": "区块链、账户与地址", "terms": [...], "knowledgeCard": {...} }
  ],
  "mistakes": {
    "challenges": [...],
    "quiz": [...]
  }
}
```

> 仅已收获课程可复习。

---

## 4. EXP 与等级

### 4.1 查询 EXP 流水

```
GET /api/exp?userId=X
```

**响应 200：**

```json
{
  "records": [
    { "id": "uuid", "userId": "uuid", "amount": 10, "source": "start_course", "referenceId": "web3-start", "createdAt": "..." }
  ]
}
```

### 4.2 查询等级信息

```
GET /api/level
```

**Header:** `Authorization: Bearer <token>`

**响应 200：**

```json
{
  "level": {
    "current": 2,
    "name": "学徒",
    "exp": 250,
    "expToNext": 450,
    "range": { "min": 200, "max": 500 },
    "maxLevel": false,
    "progress": 17
  }
}
```

**等级表：**

| 等级 | 名称 | 所需 EXP |
|------|------|---------|
| 1 | 初来乍到 | 0 |
| 2 | 学徒 | 100 |
| 3 | 探索者 | 250 |
| 4 | 建造师 | 500 |
| 5 | 农场主 | 800 |
| 6 | 园艺大师 | 1200 |
| 7 | 加密园丁 | 1700 |
| 8 | 区块链农夫 | 2300 |
| 9 | 像素领主 | 3000 |
| 10 | Monad 守护者 | 4000 |

### 4.3 排行榜

```
GET /api/leaderboard?limit=50&offset=0
```

**响应 200：**

```json
{
  "leaderboard": [
    { "rank": 1, "id": "uuid", "username": "test_user", "exp": 500, "level": 3, "completedCourses": 2 }
  ],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

---

## 5. 审核与验证

### 5.1 开始审核会话

```
POST /api/audit/start
```

**Header:** `Authorization: Bearer <token>`

**请求体：**

```json
{ "courseId": "web3" }
```

**响应 200：**

```json
{
  "session": {
    "id": "uuid",
    "auditType": "agent | manual",
    "status": "in_progress",
    "items": []
  }
}
```

### 5.2 提交审核项

```
POST /api/audit/submit
```

**Header:** `Authorization: Bearer <token>`

**请求体：**

```json
{
  "courseId": "web3",
  "items": [
    { "question": "区块链是什么？", "answer": "A", "passed": true }
  ]
}
```

### 5.3 查询审核状态

```
GET /api/audit/status?courseId=web3
```

**Header:** `Authorization: Bearer <token>`

### 5.4 切换验证方式

```
POST /api/verification
```

**Header:** `Authorization: Bearer <token>`

**请求体：**

```json
{
  "courseId": "web3",
  "method": "audit | quiz"
}
```

> 切换为 `audit` 时保存 `verification: "audit"`；切换为 `quiz` 时保存 `verification: "quiz"`。

---

## 6. 学习档案

### 6.1 成就档案

```
GET /api/achievements?userId=X
```

**响应 200：**

```json
{
  "achievements": [
    { "id": "uuid", "type": "first_course", "courseId": "web3", "dataBlob": null, "earnedAt": "..." }
  ]
}
```

### 6.2 知识卡回看

```
GET /api/knowledge-cards?courseId=web3
```

**Header:** `Authorization: Bearer <token>`

**响应 200：**

```json
{
  "courseId": "web3",
  "cards": [
    { "chapterNumber": 1, "chapterTitle": "区块链、账户与地址", "terms": [...], "knowledgeCard": {...} }
  ]
}
```

### 6.3 错题回看

```
GET /api/mistakes?courseId=web3
```

**Header:** `Authorization: Bearer <token>`

**响应 200：**

```json
{
  "courseId": "web3",
  "challenges": [
    { "chapterNumber": 1, "answers": {...}, "attemptedAt": "..." }
  ],
  "quiz": [...]
}
```

### 6.4 用户资料（含课程进度和 NFT 信息）

```
GET /api/profile?userId=X
```

**Header:** `Authorization: Bearer <token>`

---

## 7. NFT 铸造

### 7.1 查询 NFT 资格与铸造历史

```
GET /api/nft?userId=X
```

**Header:** `Authorization: Bearer <token>`

**响应 200：**

```json
{
  "qualifications": [
    { "id": "uuid", "courseId": "web3", "status": "eligible", "createdAt": "..." }
  ],
  "mintingHistory": [...],
  "walletAddress": "0x..."  // 从 users 表读取
}
```

### 7.2 提交铸造申请

```
POST /api/nft
```

**Header:** `Authorization: Bearer <token>`

**请求体：**

```json
{
  "userId": "uuid",
  "courseId": "web3",
  "walletAddress": "0x..."
}
```

### 7.3 执行链上铸造（管理员操作）

```
POST /api/admin/nft/:id/approve
```

**Header:** `Authorization: Bearer <token>` (需要 admin 角色)

---

## 8. 管理面板

> 所有管理接口需要管理员 token（`role: "admin"`）

### 8.1 系统状态

```
GET /api/admin/status
```

**响应 200：**

```json
{
  "users": { "total": 10 },
  "courses": { "inProgress": 5, "completed": 3 },
  "agent": { "enabled": true },
  "maintenance": { "enabled": false }
}
```

### 8.2 用户状态查询

```
GET /api/admin/user-status?userId=X
```

### 8.3 修复用户状态

```
POST /api/admin/repair
```

**请求体：**

```json
{
  "userId": "uuid",
  "field": "exp | level | progress.verification | ...",
  "value": 100,
  "reason": "手动修复"
}
```

### 8.4 切换 Agent 审核

```
POST /api/admin/toggle-agent
```

**请求体：** `{ "enabled": true, "reason": "开启 Agent 审核" }`

### 8.5 切换维护模式

```
POST /api/admin/toggle-maintenance
```

**请求体：** `{ "enabled": true, "reason": "系统维护" }`

### 8.6 Agent 状态

```
GET /api/admin/agent-status
```

### 8.7 NFT 铸造状态

```
GET /api/admin/nft-status
```

### 8.8 待审核列表

```
GET /api/admin/audit?status=pending
```

### 8.9 审核配置

```
GET /api/admin/audit/config
```

### 8.10 审核通过

```
POST /api/admin/audit/:id/approve
```

### 8.11 审核拒绝

```
POST /api/admin/audit/:id/reject
```

### 8.12 待铸造列表

```
GET /api/admin/nft?status=pending
```

### 8.13 铸造审批通过

```
POST /api/admin/nft/:id/approve
```

### 8.14 铸造拒绝

```
POST /api/admin/nft/:id/reject
```

---

## 9. 基础设施

### 9.1 保存断点

```
POST /api/checkpoint
```

**Header:** `Authorization: Bearer <token>`

**请求体：**

```json
{
  "courseId": "web3",
  "state": {
    "version": 1,
    "started": true,
    "seedGranted": true,
    "landCleared": true,
    "planted": true,
    "chaptersRead": [true, true, false],
    "challengePassed": [true, false, false],
    "challengeMistakes": [false, false, false],
    "verification": "none",
    "harvested": false,
    "recentActivity": ["完成第 1 章理论"]
  }
}
```

### 9.2 恢复断点

```
GET /api/checkpoint?courseId=web3
```

**Header:** `Authorization: Bearer <token>`

### 9.3 Monad 网络状态

```
GET /api/chain/status
```

### 9.4 合约读取

```
GET /api/chain/contract-read?address=0x...&method=symbol
```

---

## 10. 前端联调清单

> 以下为前端需要对接后端 API 的工作清单。

### 10.1 P0 必须联调

| # | 功能 | 后端 API | 前端当前状态 | 前端需要做的 |
|---|------|---------|-------------|-------------|
| 1 | **用户注册/登录** | `POST /api/auth` | ❌ 无登录页面 | 创建登录/注册页面，调用 auth API，保存 token 到 localStorage |
| 2 | **认证鉴权** | `Authorization: Bearer <token>` | ❌ 无认证 | 所有 API 请求携带 token，401 时跳转登录页 |
| 3 | **课程数据** | `GET /api/courses?courseId=web3` | ⚠️ 使用前端硬编码数据 | 从后端 API 获取课程内容，替换 `course-data.ts` 的硬编码数据 |
| 4 | **进度同步** | `GET/POST /api/progress` | ⚠️ 使用 localStorage | 每次操作后同步到后端，页面加载时从后端恢复进度 |
| 5 | **钱包地址** | `PUT /api/wallet` | ❌ 无连接 | 连接钱包后调用 PUT 设置地址，页面加载时 GET 获取 |
| 6 | **断点恢复** | `GET/POST /api/checkpoint` | ⚠️ 使用 localStorage | 每次操作后保存到后端，页面加载时恢复 |
| 7 | **EXP/等级** | `GET /api/level` | ⚠️ 前端本地计算 | 从后端获取等级信息，替换前端计算逻辑 |
| 8 | **成就系统** | `GET /api/achievements` | ⚠️ 前端本地展示 | 从后端获取成就列表 |
| 9 | **知识卡回看** | `GET /api/knowledge-cards` | ❌ 无独立页面 | 从后端获取知识卡数据，创建知识卡回看页面 |
| 10 | **错题回看** | `GET /api/mistakes` | ❌ 无独立页面 | 从后端获取错题记录，创建错题回看页面 |

### 10.2 P1 后续联调

| # | 功能 | 后端 API | 说明 |
|---|------|---------|------|
| 11 | 验证方式切换 | `POST /api/verification` | 用户选择 quiz 或 audit 验证方式 |
| 12 | 审核系统 | 审核相关 API | 提交审核、查询审核状态 |
| 13 | NFT 铸造 | NFT 相关 API | 提交铸造申请、查询资格 |
| 14 | 管理面板 | 管理相关 API | 页面展示系统状态、用户管理 |
| 15 | 排行榜 | `GET /api/leaderboard` | 创建排行榜页面 |

### 10.3 数据迁移说明

**课程内容数据** 已通过 `scripts/seed-courses.sql` 脚本预置到数据库，运行方式：
```bash
wrangler d1 execute DB --file=scripts/seed-courses.sql
```

包含：
- 3 门课程：Web3 通识、Monad 基础、智能合约（锁定）
- 6 个章节（含完整正文、知识卡、安全提示）
- 9 道挑战题（判断 + 排序）
- 10 道结课小测题

### 10.4 数据库变更

当前 schema 已移除 `wallet_bindings` 表，钱包地址改为 `users.wallet_address` 字段。
运行 `npx drizzle-kit push` 后会自动同步。

---

## EXP 奖励表

| 事件 | 奖励 | 幂等 key |
|------|------|---------|
| 绑定钱包 | 15 | `bind-wallet-{address}` |
| 开始课程 | 10 | `{courseId}-start` |
| 开垦土地 | 5 | `{courseId}-clear` |
| 播种 | 5 | `{courseId}-plant` |
| 阅读章节 | 10/章 | `{courseId}-ch{0\|1\|2}` |
| 通过挑战 | 20/章 | `{courseId}-ch{0\|1\|2}-pass` |
| 挑战完美 | 5/章 | `{courseId}-ch{0\|1\|2}-perfect` |
| 验证通过 | 50 | `{courseId}-verify` |
| 收获作物 | 100 | `{courseId}-harvest` |

---

## 进度状态机

```
[无] → start-course → [已开始, 种子入袋]
  ↓
clear-land → [已开荒]
  ↓
plant → [已播种]
  ↓
complete-theory(chapter) → [章节已读] (可重复)
  ↓
complete-challenge(chapter) → [挑战已过] (可重复)
  ↓
start-quiz → [verification: quiz]
  ↓  (或 pass-verification)
pass-verification → [verification: passed]
  ↓
harvest → [已收获]
```

- 状态转换由 `progressReducer` 在 `lib/progress.ts` 中统一管理
- 所有奖励操作通过 `referenceId` 实现幂等
- 前端和共享同一份状态机代码