// =============================================================================
// 安全温室场景数据（数据驱动：UI 只读取 scenario，不硬编码关卡逻辑）
// 所有合约均为教学靶场：EDUCATIONAL / TESTNET ONLY，不接真实资产。
// =============================================================================

export type LabId = "lab-1" | "lab-2" | "lab-3";

export type ScenarioCategory = "REENTRANCY" | "ACCESS" | "SIGNATURE" | "NFT" | "TX";

export type AttackTraceStep = {
  index: number;
  depth: number;
  caller: string;
  callee: string;
  valueMon: string;
  bankBalance: number;
  attackerBalance: number;
  stateUpdated: boolean;
  note: string;
  highlightLine?: number;
};

export type PatchOption = {
  id: string;
  label: string;
  description: string;
  code: string[];
  correct: boolean;
  feedback: string;
};

export type LabChoiceQuestion = {
  prompt: string;
  options: { id: string; label: string }[];
  correct: string;
  success: string;
  failure: string;
};

export type LabScenario = {
  id: string;
  labId: LabId;
  title: string;
  category: ScenarioCategory;
  difficulty: 1 | 2 | 3 | 4;
  scenarioVersion: string;
  order: number;
  brief: string;
  objective: string;
  ruleId: string;
  contractName: string;
  contractAddress: string;
  code: string[];
  /** 可接受的危险行（1-based） */
  dangerLines: number[];
  identify: LabChoiceQuestion;
  followUp: LabChoiceQuestion;
  patchOptions: PatchOption[];
  /** 重入关卡才有攻击回放 */
  trace: AttackTraceStep[];
  traceIntro: string;
  verifyNote: string;
  signGuardSampleId?: string;
  /** 完成后温室进入的阶段 */
  greenhouseStage: "frame-repaired" | "secured";
};

// ---------------------------------------------------------------------------
// 行号辅助：从源码推导，避免硬编码偏移
// ---------------------------------------------------------------------------

function lineOf(code: string[], needle: string): number {
  const index = code.findIndex((line) => line.includes(needle));
  return index < 0 ? 1 : index + 1;
}

export function scenarioLineOf(scenario: LabScenario, needle: string) {
  return lineOf(scenario.code, needle);
}

// ---------------------------------------------------------------------------
// 源码片段
// ---------------------------------------------------------------------------

const VULNERABLE_BANK_CODE = [
  "// SPDX-License-Identifier: MIT",
  "pragma solidity ^0.8.24;",
  "",
  "/// @title GreenhouseVault · 教学漏洞合约（EDUCATIONAL / TESTNET ONLY）",
  "contract GreenhouseVault {",
  "    mapping(address => uint256) public balances;",
  "",
  "    function deposit() external payable {",
  "        balances[msg.sender] += msg.value;",
  "    }",
  "",
  "    // 目标：找出为什么攻击者可以反复提款",
  "    function withdraw() external {",
  "        uint256 amount = balances[msg.sender];",
  '        require(amount > 0, "no balance");',
  '        (bool ok, ) = msg.sender.call{value: amount}("");',
  '        require(ok, "transfer failed");',
  "        balances[msg.sender] = 0;",
  "    }",
  "}",
];

const PATCHED_BANK_CODE = [
  "// SPDX-License-Identifier: MIT",
  "pragma solidity ^0.8.24;",
  "",
  "contract GreenhouseVaultGuarded {",
  "    mapping(address => uint256) public balances;",
  "",
  "    function deposit() external payable {",
  "        balances[msg.sender] += msg.value;",
  "    }",
  "",
  "    function withdraw() external {",
  "        uint256 amount = balances[msg.sender];",
  '        require(amount > 0, "no balance");',
  "        // Checks-Effects-Interactions：先更新状态，再外部调用",
  "        balances[msg.sender] = 0;",
  '        (bool ok, ) = msg.sender.call{value: amount}("");',
  '        require(ok, "transfer failed");',
  "    }",
  "}",
];

const BAD_MINT_CODE = [
  "// SPDX-License-Identifier: MIT",
  "pragma solidity ^0.8.24;",
  "",
  "contract SeedToken {",
  '    string public name = "Seed Token";',
  "    mapping(address => uint256) public balanceOf;",
  "    uint256 public totalSupply;",
  "",
  "    // 目标：找出为什么任何人都能凭空造币",
  "    function mint(address to, uint256 amount) external {",
  "        balanceOf[to] += amount;",
  "        totalSupply += amount;",
  "    }",
  "",
  "    function transfer(address to, uint256 amount) external returns (bool) {",
  "        balanceOf[msg.sender] -= amount;",
  "        balanceOf[to] += amount;",
  "        return true;",
  "    }",
  "}",
];

const REPLAY_CLAIM_CODE = [
  "// SPDX-License-Identifier: MIT",
  "pragma solidity ^0.8.24;",
  "",
  "/// @title RewardClaim · 教学重放靶场（EDUCATIONAL / TESTNET ONLY）",
  "contract RewardClaim {",
  "    address public signer;",
  "    mapping(address => uint256) public claimed;",
  "",
  "    constructor(address signerAddress) {",
  "        signer = signerAddress;",
  "    }",
  "",
  "    // 目标：找出为什么同一张签名凭证可以被使用两次",
  "    function claim(address to, uint256 amount, bytes memory signature) external {",
  "        bytes32 digest = keccak256(abi.encodePacked(to, amount));",
  "        address recovered = _verifySignature(digest, signature);",
  '        require(recovered == signer, "bad signature");',
  "        claimed[to] += amount;",
  "    }",
  "",
  "    function _verifySignature(bytes32 digest, bytes memory signature) internal pure returns (address) {",
  "        return address(0);",
  "    }",
  "}",
];

const TX_ORIGIN_CODE = [
  "// SPDX-License-Identifier: MIT",
  "pragma solidity ^0.8.24;",
  "",
  "/// @title OwnerVault · 教学钓鱼靶场（EDUCATIONAL / TESTNET ONLY）",
  "contract OwnerVault {",
  "    address public owner;",
  "    mapping(address => uint256) public balances;",
  "",
  "    constructor() {",
  "        owner = msg.sender;",
  "    }",
  "",
  "    function deposit() external payable {",
  "        balances[msg.sender] += msg.value;",
  "    }",
  "",
  "    // 目标：找出为什么用户点了恶意合约后，钱包会被掏空",
  "    function withdrawAll() external {",
  '        require(tx.origin == owner, "not owner");',
  "        payable(owner).transfer(address(this).balance);",
  "    }",
  "}",
];

// ---------------------------------------------------------------------------
// Lab 1（Hero Lab）：重入攻击
// ---------------------------------------------------------------------------

const REENTRANCY_TRACE: AttackTraceStep[] = [
  {
    index: 0,
    depth: 0,
    caller: "attacker EOA",
    callee: "Vault.attack()",
    valueMon: "0",
    bankBalance: 7,
    attackerBalance: 0,
    stateUpdated: false,
    note: "攻击者先存入 1 ETH，然后开始攻击。Vault 里共有 7 ETH。",
  },
  {
    index: 1,
    depth: 1,
    caller: "attacker EOA",
    callee: "Vault.withdraw()",
    valueMon: "0",
    bankBalance: 7,
    attackerBalance: 0,
    stateUpdated: false,
    note: "进入 withdraw()：读出 balances[attacker] = 1 ETH，此时状态尚未清零。",
    highlightLine: 14,
  },
  {
    index: 2,
    depth: 2,
    caller: "Vault",
    callee: "attacker.receive()",
    valueMon: "1",
    bankBalance: 6,
    attackerBalance: 1,
    stateUpdated: false,
    note: "Vault 把 1 ETH 发给攻击者（低层 call 转账）。",
    highlightLine: 16,
  },
  {
    index: 3,
    depth: 2,
    caller: "attacker.receive()",
    callee: "Vault.withdraw()",
    valueMon: "0",
    bankBalance: 6,
    attackerBalance: 1,
    stateUpdated: false,
    note: "攻击者在 receive() 里再次调用 withdraw()：Bank 状态还没更新。",
    highlightLine: 16,
  },
  {
    index: 4,
    depth: 3,
    caller: "Vault",
    callee: "attacker.receive()",
    valueMon: "1",
    bankBalance: 5,
    attackerBalance: 2,
    stateUpdated: false,
    note: "第二次提款成功：balances[attacker] 仍然是 1 ETH。",
  },
  {
    index: 5,
    depth: 3,
    caller: "attacker.receive()",
    callee: "Vault.withdraw()",
    valueMon: "0",
    bankBalance: 5,
    attackerBalance: 2,
    stateUpdated: false,
    note: "循环继续。每一次回调都能通过 require(amount > 0)。",
  },
  {
    index: 6,
    depth: 4,
    caller: "Vault",
    callee: "attacker.receive()",
    valueMon: "1",
    bankBalance: 4,
    attackerBalance: 3,
    stateUpdated: false,
    note: "Vault 余额被逐格抽走：4 ETH。",
  },
  {
    index: 7,
    depth: 4,
    caller: "attacker.receive()",
    callee: "Vault.withdraw()",
    valueMon: "0",
    bankBalance: 4,
    attackerBalance: 3,
    stateUpdated: false,
    note: "低层 call 返回值虽被检查，但检查发生在循环之后。",
  },
  {
    index: 8,
    depth: 5,
    caller: "Vault",
    callee: "attacker.receive()",
    valueMon: "1",
    bankBalance: 3,
    attackerBalance: 4,
    stateUpdated: false,
    note: "攻击者继续提款。",
  },
  {
    index: 9,
    depth: 5,
    caller: "attacker.receive()",
    callee: "Vault.withdraw()",
    valueMon: "0",
    bankBalance: 3,
    attackerBalance: 4,
    stateUpdated: false,
    note: "状态依然没有清零。",
  },
  {
    index: 10,
    depth: 6,
    caller: "Vault",
    callee: "attacker.receive()",
    valueMon: "1",
    bankBalance: 2,
    attackerBalance: 5,
    stateUpdated: false,
    note: "余额只剩 2 ETH。",
  },
  {
    index: 11,
    depth: 6,
    caller: "Vault",
    callee: "attacker.receive()",
    valueMon: "1",
    bankBalance: 1,
    attackerBalance: 6,
    stateUpdated: false,
    note: "余额只剩 1 ETH。",
  },
  {
    index: 12,
    depth: 6,
    caller: "Vault",
    callee: "attacker.receive()",
    valueMon: "1",
    bankBalance: 0,
    attackerBalance: 7,
    stateUpdated: false,
    note: "Vault 余额归零，攻击者拿到 7 ETH。",
  },
  {
    index: 13,
    depth: 0,
    caller: "Vault",
    callee: "balances[attacker] = 0",
    valueMon: "0",
    bankBalance: 0,
    attackerBalance: 7,
    stateUpdated: true,
    note: "全部调用返回后，余额状态才被清零——已经太晚了。",
    highlightLine: 18,
  },
];

// ---------------------------------------------------------------------------
// 场景定义
// ---------------------------------------------------------------------------

export const SECURITY_SCENARIOS: LabScenario[] = [
  {
    id: "reentrancy-bank-v1",
    labId: "lab-1",
    title: "重复提款（Reentrancy）",
    category: "REENTRANCY",
    difficulty: 1,
    scenarioVersion: "1.0.0",
    order: 1,
    brief:
      "温室的资金库合约先转账、后记账。攻击者可以在收到 ETH 的回调里再次调用 withdraw()，把同一份余额反复取走。",
    objective: "找出为什么攻击者可以反复提款，并用 Checks-Effects-Interactions 修好它。",
    ruleId: "SOL-REENT-001",
    contractName: "GreenhouseVault",
    contractAddress: "0x000000000000000000000000000000000000ba5e",
    code: VULNERABLE_BANK_CODE,
    dangerLines: [16, 18],
    identify: {
      prompt: "哪一行让攻击者有机会“重复闯入”？",
      options: [
        { id: "a", label: "第 15 行 require(amount > 0)" },
        { id: "b", label: "第 16 行 先发钱、第 18 行才清零余额" },
        { id: "c", label: "第 9 行 deposit() 里的 += msg.value" },
      ],
      correct: "b",
      success: "正确。外部调用发生在状态更新之前，就是重入的入口。",
      failure: "再想想：哪一步的“顺序”出了问题？",
    },
    followUp: {
      prompt: "补上 ReentrancyGuard 能彻底消除这类风险吗？",
      options: [
        { id: "a", label: "能，加锁之后所有重入都会被挡住" },
        { id: "b", label: "能挡住重入，但仍需正确的调用顺序与返回值检查" },
        { id: "c", label: "不能，加锁完全没用" },
      ],
      correct: "b",
      success: "对。加锁是有效防线，但顺序（CEI）与返回值检查同样重要。",
      failure: "锁只是一层防线，不是全部答案。",
    },
    patchOptions: [
      {
        id: "patch-a",
        label: "方案 A：保持“先转账、后清零”，只加 require(amount > 0)",
        description: "顺序不变，只在取值后多一次校验。",
        code: [
          '        require(amount > 0, "no balance");',
          '        (bool ok, ) = msg.sender.call{value: amount}("");',
          '        require(ok, "transfer failed");',
          "        balances[msg.sender] = 0;",
        ],
        correct: false,
        feedback:
          "攻击仍然成功：回调发生在清零之前，require(amount > 0) 依然为真，Vault 会被继续抽干。",
      },
      {
        id: "patch-b",
        label: "方案 B：Checks-Effects-Interactions（先清零，再转账）",
        description: "把状态更新提到外部调用之前。",
        code: [
          '        require(amount > 0, "no balance");',
          "        balances[msg.sender] = 0;",
          '        (bool ok, ) = msg.sender.call{value: amount}("");',
          '        require(ok, "transfer failed");',
        ],
        correct: true,
        feedback:
          "正确。第二次进入时 balances[msg.sender] 已经是 0，require 会失败，攻击被挡住。",
      },
      {
        id: "patch-c",
        label: "方案 C：只引入 ReentrancyGuard 的 nonReentrant 装饰器，不动顺序",
        description: "用互斥锁阻止重入。",
        code: [
          "    function withdraw() external nonReentrant {",
          "        uint256 amount = balances[msg.sender];",
          '        (bool ok, ) = msg.sender.call{value: amount}("");',
          '        require(ok, "transfer failed");',
          "        balances[msg.sender] = 0;",
          "    }",
        ],
        correct: true,
        feedback:
          "也可以。nonReentrant 会拦住回调，但课程推荐优先使用 CEI，把顺序本身写对。",
      },
    ],
    trace: REENTRANCY_TRACE,
    traceIntro:
      "固定 14 步调用轨迹：CALL DEPTH / CALLER / CALLEE / VALUE / 两侧余额 / STATE UPDATED，全部由确定性状态机生成。",
    verifyNote: "修复后同一份攻击轨迹会重新跑一遍：第二次 withdraw() 必须失败。",
    greenhouseStage: "frame-repaired",
  },
  {
    id: "access-control-mint-v1",
    labId: "lab-2",
    title: "谁都可以 Mint？（访问控制缺失）",
    category: "ACCESS",
    difficulty: 2,
    scenarioVersion: "1.0.0",
    order: 2,
    brief:
      "SeedToken 的 mint() 没有任何权限控制，任何人调用都能凭空获得代币，总量与价值都会归零。",
    objective: "找出缺失的访问控制，并想清楚 onlyOwner 是否代表绝对安全。",
    ruleId: "SOL-AUTH-001",
    contractName: "SeedToken",
    contractAddress: "0x0000000000000000000000000000000000005eed",
    code: BAD_MINT_CODE,
    dangerLines: [10],
    identify: {
      prompt: "mint() 危险在哪里？",
      options: [
        { id: "a", label: "缺少访问控制，任何地址都可以调用" },
        { id: "b", label: "没有检查 amount > 0" },
        { id: "c", label: "用了 += 而不是 = " },
      ],
      correct: "a",
      success: "正确。没有 onlyOwner / 角色检查，任何人都能凭空造币。",
      failure: "重点不在数值校验，而在“谁能调用”。",
    },
    followUp: {
      prompt: "加上 onlyOwner 之后，这个合约就绝对安全了吗？",
      options: [
        { id: "a", label: "是，加了权限检查就没有风险了" },
        { id: "b", label: "不是，Owner 私钥泄露后仍是单点风险" },
        { id: "c", label: "不是，应该把 mint 直接删掉" },
      ],
      correct: "b",
      success: "对。权限控制解决了“谁能调用”，但 Owner 私钥仍然是中心化单点。",
      failure: "权限检查只解决了“谁能调用”，没有解决私钥单点风险。",
    },
    patchOptions: [
      {
        id: "patch-a",
        label: "方案 A：加 onlyOwner",
        description: "把铸造权限收敛到 Owner。",
        code: [
          "    function mint(address to, uint256 amount) external onlyOwner {",
          "        balanceOf[to] += amount;",
          "        totalSupply += amount;",
          "    }",
        ],
        correct: true,
        feedback:
          "正确方向。但要在报告里补充：Owner 私钥泄露后仍可无限铸币，属于中心化风险。",
      },
      {
        id: "patch-b",
        label: "方案 B：加 require(amount > 0)",
        description: "只校验数量。",
        code: [
          "    function mint(address to, uint256 amount) external {",
          '        require(amount > 0, "zero amount");',
          "        balanceOf[to] += amount;",
          "        totalSupply += amount;",
          "    }",
        ],
        correct: false,
        feedback: "攻击者仍然可以用任意 amount 调用 mint()，问题没有解决。",
      },
      {
        id: "patch-c",
        label: "方案 C：改为内部函数 + 可审计事件",
        description: "缩小可见性并补充事件。",
        code: [
          "    function _mint(address to, uint256 amount) internal onlyOwner {",
          "        balanceOf[to] += amount;",
          "        totalSupply += amount;",
          "        emit Minted(to, amount);",
          "    }",
        ],
        correct: true,
        feedback: "也可以：缩小可见性 + 事件可审计，仍然保留 Owner 单点风险提示。",
      },
    ],
    trace: [],
    traceIntro: "该场景不需要调用栈回放，重点是权限边界与授权额度判断。",
    verifyNote: "回归测试：修复后未授权地址调用 mint() 必须 revert。",
    signGuardSampleId: "unlimited-approval",
    greenhouseStage: "secured",
  },
  {
    id: "signature-replay-v1",
    labId: "lab-2",
    title: "同一张签名用两次（Signature Replay）",
    category: "SIGNATURE",
    difficulty: 3,
    scenarioVersion: "1.0.0",
    order: 3,
    brief:
      "领奖凭证只对 (to, amount) 做签名，没有 nonce、没有 deadline、没有链上域分离，因此同一张凭证可以被重复提交。",
    objective: "找出为什么同一签名可以被重复使用，并补上 nonce / deadline / domain。",
    ruleId: "SOL-SIGN-001",
    contractName: "RewardClaim",
    contractAddress: "0x0000000000000000000000000000000000000c1a",
    code: REPLAY_CLAIM_CODE,
    dangerLines: [14, 15],
    identify: {
      prompt: "为什么第二次提交同样的签名仍然会成功？",
      options: [
        { id: "a", label: "因为签名内容里没有 nonce / deadline，服务端也无法判断是否用过" },
        { id: "b", label: "因为 keccak256 不安全" },
        { id: "c", label: "因为 claimed[to] += amount 写错了" },
      ],
      correct: "a",
      success: "正确。缺少 nonce / deadline / domain separation，签名就是一张可以重复使用的凭证。",
      failure: "注意签名内容里“缺了什么”，而不是哈希算法本身。",
    },
    followUp: {
      prompt: "如果签名里加上 chainId，最直接防住的是什么？",
      options: [
        { id: "a", label: "同一签名被搬到另一条链上重放" },
        { id: "b", label: "同一签名在同一条链上重复使用" },
        { id: "c", label: "签名被伪造" },
      ],
      correct: "a",
      success: "对。chainId 域分离解决跨链重放，链内重放要靠 nonce。",
      failure: "chainId 解决的是“跨链”重放。",
    },
    patchOptions: [
      {
        id: "patch-a",
        label: "方案 A：加入 nonce + deadline + EIP-712 domain",
        description: "完整的防重放结构。",
        code: [
          "    function claim(address to, uint256 amount, uint256 nonce, uint256 deadline, bytes memory signature) external {",
          '        require(block.timestamp <= deadline, "expired");',
          '        require(!usedNonce[nonce], "nonce used");',
          "        usedNonce[nonce] = true;",
          "        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(to, amount, nonce, deadline)));",
          "        require(_verifySignature(digest, signature) == signer, \"bad signature\");",
          "        claimed[to] += amount;",
          "    }",
        ],
        correct: true,
        feedback: "正确。nonce 防链内重放，deadline 限制时效，domain/chainId 防跨链重放。",
      },
      {
        id: "patch-b",
        label: "方案 B：只加 require(claimed[to] == 0)",
        description: "用业务状态兜底。",
        code: [
          '        require(claimed[to] == 0, "already claimed");',
          "        claimed[to] += amount;",
        ],
        correct: false,
        feedback: "只能挡住同一地址的第二次领取，换一个地址或换一笔金额仍然可以重放。",
      },
      {
        id: "patch-c",
        label: "方案 C：把状态改成 claimed[to] = amount",
        description: "改成覆盖赋值。",
        code: ["        claimed[to] = amount;"],
        correct: false,
        feedback: "赋值方式不解决重放问题，签名仍然可以被重复提交。",
      },
    ],
    trace: [],
    traceIntro: "该场景使用隔离模拟器：第一次成功 → 第二次（危险实现）仍成功 → 修复后第二次失败。",
    verifyNote: "回归测试：修复后第二次提交同一签名必须 revert。",
    greenhouseStage: "secured",
  },
  {
    id: "tx-origin-phish-v1",
    labId: "lab-3",
    title: "tx.origin 钓鱼链路",
    category: "TX",
    difficulty: 3,
    scenarioVersion: "1.0.0",
    order: 4,
    brief:
      "OwnerVault 用 tx.origin 做鉴权。用户点击恶意合约后，恶意合约调用 withdrawAll()，tx.origin 仍然是用户本人。",
    objective: "找出错误鉴权方式，并解释 NFT setApprovalForAll 与它的区别。",
    ruleId: "SOL-TXORIGIN-001",
    contractName: "OwnerVault",
    contractAddress: "0x00000000000000000000000000000000000f15c0",
    code: TX_ORIGIN_CODE,
    dangerLines: [18],
    identify: {
      prompt: "为什么用户只是点了一个恶意合约，钱包就被掏空？",
      options: [
        { id: "a", label: "因为 require(tx.origin == owner) 会把“原始发起人”当作鉴权依据" },
        { id: "b", label: "因为 transfer 转账失败了" },
        { id: "c", label: "因为 owner 变量是 public 的" },
      ],
      correct: "a",
      success: "正确。tx.origin 是整条调用链的最初发起者，恶意合约可以作为中间人通过检查。",
      failure: "关注鉴权条件用的是哪个变量。",
    },
    followUp: {
      prompt: "approve(spender, tokenId) 与 setApprovalForAll(operator, true) 的范围差别是？",
      options: [
        { id: "a", label: "approve 授权单个 NFT，setApprovalForAll 授权该系列全部 NFT" },
        { id: "b", label: "两者完全一样" },
        { id: "c", label: "setApprovalForAll 只授权一枚，approve 授权全部" },
      ],
      correct: "a",
      success: "对。一个是单枚，一个是整系列，风险级别完全不同。",
      failure: "从“授权的范围”来比较两者。",
    },
    patchOptions: [
      {
        id: "patch-a",
        label: "方案 A：改用 msg.sender 鉴权",
        description: "检查直接调用者。",
        code: [
          "    function withdrawAll() external {",
          '        require(msg.sender == owner, "not owner");',
          "        payable(owner).transfer(address(this).balance);",
          "    }",
        ],
        correct: true,
        feedback: "正确。恶意合约调用时 msg.sender 是恶意合约本身，鉴权失败。",
      },
      {
        id: "patch-b",
        label: "方案 B：保留 tx.origin，但增加 amount > 0",
        description: "只加数值校验。",
        code: [
          '        require(tx.origin == owner && address(this).balance > 0, "not owner");',
        ],
        correct: false,
        feedback: "钓鱼链路依然成立，amount 校验和鉴权没有关系。",
      },
      {
        id: "patch-c",
        label: "方案 C：同时判断 tx.origin 和 msg.sender",
        description: "require(tx.origin == owner && msg.sender == owner)。",
        code: [
          '        require(tx.origin == owner && msg.sender == owner, "not owner");',
        ],
        correct: true,
        feedback: "可以挡住钓鱼，但仍然应该直接使用 msg.sender，避免误用 tx.origin。",
      },
    ],
    trace: [],
    traceIntro: "调用链：Owner 钱包 → 恶意合约 → OwnerVault.withdrawAll()，tx.origin 依然是 Owner。",
    verifyNote: "回归测试：修复后由恶意合约发起的调用必须 revert。",
    signGuardSampleId: "nft-approval-for-all",
    greenhouseStage: "secured",
  },
];

export const LABS: Array<{
  id: LabId;
  title: string;
  subtitle: string;
  scenarioIds: string[];
  greenhouseStage: "frame-repaired" | "secured";
  unlockNote: string;
}> = [
  {
    id: "lab-1",
    title: "Lab 1 · 合约调用与重入防线",
    subtitle: "重入攻击 · 调用顺序 · 返回值检查",
    scenarioIds: ["reentrancy-bank-v1"],
    greenhouseStage: "frame-repaired",
    unlockNote: "智能合约课程收获后解锁",
  },
  {
    id: "lab-2",
    title: "Lab 2 · ERC20 权限、签名与密钥风险",
    subtitle: "权限缺失 · 签名重放 · 无限授权",
    scenarioIds: ["access-control-mint-v1", "signature-replay-v1"],
    greenhouseStage: "secured",
    unlockNote: "完成 Lab 1 后解锁",
  },
  {
    id: "lab-3",
    title: "Lab 3 · NFT / DApp 用户侧攻击面",
    subtitle: "tx.origin 钓鱼 · setApprovalForAll",
    scenarioIds: ["tx-origin-phish-v1"],
    greenhouseStage: "secured",
    unlockNote: "完成 Lab 2 后解锁",
  },
];

export function getScenario(id: string) {
  return SECURITY_SCENARIOS.find((scenario) => scenario.id === id) ?? null;
}

export function scenariosForLab(labId: LabId) {
  return SECURITY_SCENARIOS.filter((scenario) => scenario.labId === labId);
}

export const PATCHED_BANK_SOURCE = PATCHED_BANK_CODE.join("\n");
export const VULNERABLE_BANK_SOURCE = VULNERABLE_BANK_CODE.join("\n");

// ---------------------------------------------------------------------------
// Final Audit：综合审计靶场
// ---------------------------------------------------------------------------

const FINAL_AUDIT_CODE = [
  "// SPDX-License-Identifier: MIT",
  "pragma solidity ^0.8.24;",
  "",
  "/// @title GreenhouseVault v1 · 综合审计靶场（EDUCATIONAL / TESTNET ONLY）",
  "contract GreenhouseVaultAudit {",
  "    address public owner;",
  "    mapping(address => uint256) public balances;",
  "",
  "    constructor() {",
  "        owner = msg.sender;",
  "    }",
  "",
  "    function deposit() external payable {",
  "        balances[msg.sender] += msg.value;",
  "    }",
  "",
  "    function withdraw() external {",
  "        uint256 amount = balances[msg.sender];",
  '        require(amount > 0, "no balance");',
  '        (bool ok, ) = msg.sender.call{value: amount}("");',
  '        require(ok, "transfer failed");',
  "        balances[msg.sender] = 0;",
  "    }",
  "",
  "    function mint(address to, uint256 amount) external {",
  "        balances[to] += amount;",
  "    }",
  "",
  "    function claimReward(address to, uint256 amount, bytes memory signature) external {",
  "        bytes32 digest = keccak256(abi.encodePacked(to, amount));",
  "        address recovered = _verifySignature(digest, signature);",
  '        require(recovered == owner, "bad signature");',
  "        balances[to] += amount;",
  "    }",
  "",
  "    function emergencyWithdraw(uint256 amount) external {",
  '        require(tx.origin == owner, "not owner");',
  "        payable(owner).transfer(amount);",
  "    }",
  "",
  "    function forward(address target, bytes calldata payload) external payable {",
  "        target.call{value: msg.value}(payload);",
  "    }",
  "",
  "    function _verifySignature(bytes32 digest, bytes memory signature) internal pure returns (address) {",
  "        return address(0);",
  "    }",
  "}",
];

export type AuditTarget = {
  code: string;
  title: string;
  vulnType: string;
  expectedSeverity: "critical" | "high" | "medium" | "low";
  ruleId: string;
  evidenceLines: number[];
  /** 根因关键词分组：每组至少命中一个（不区分大小写） */
  rootCauseGroups: string[][];
  remediationKeywords: string[];
  required: boolean;
};

function auditLines(needles: string[]): number[] {
  const result: number[] = [];
  needles.forEach((needle) => {
    FINAL_AUDIT_CODE.forEach((line, index) => {
      if (line.includes(needle)) result.push(index + 1);
    });
  });
  return Array.from(new Set(result)).sort((a, b) => a - b);
}

export const FINAL_AUDIT_SCENARIO = {
  id: "greenhouse-vault-audit-v1",
  title: "最终综合审计 · GreenhouseVault Audit",
  scenarioVersion: "1.0.0",
  contractName: "GreenhouseVaultAudit",
  contractAddress: "0x000000000000000000000000000000000000ba5e",
  trackVersion: "2026.1",
  passThreshold: 70,
  requiredFindingCodes: ["F-01", "F-02", "F-03"],
  code: FINAL_AUDIT_CODE,
  targets: [
    {
      code: "F-01",
      title: "withdraw() 外部调用先于状态更新（重入）",
      vulnType: "reentrancy",
      expectedSeverity: "high",
      ruleId: "SOL-REENT-001",
      evidenceLines: auditLines(['msg.sender.call{value: amount}', "balances[msg.sender] = 0;"]),
      rootCauseGroups: [
        ["外部调用", "external call", "先转账", "call 在", "调用先于"],
        ["状态更新", "清零", "state", "balances"],
      ],
      remediationKeywords: ["cei", "checks-effects-interactions", "先清零", "先更新", "reentrancyguard", "nonreentrant", "加锁"],
      required: true,
    },
    {
      code: "F-02",
      title: "mint() 缺少访问控制",
      vulnType: "access-control",
      expectedSeverity: "critical",
      ruleId: "SOL-AUTH-001",
      evidenceLines: auditLines(["function mint(address to, uint256 amount)"]),
      rootCauseGroups: [
        ["缺少", "没有", "missing", "无访问控制", "未加"],
        ["访问控制", "权限", "onlyowner", "onlyminter", "role"],
      ],
      remediationKeywords: ["onlyowner", "onlyminter", "角色", "role", "访问控制"],
      required: true,
    },
    {
      code: "F-03",
      title: "claimReward() 签名缺少 nonce / deadline / domain",
      vulnType: "signature-replay",
      expectedSeverity: "high",
      ruleId: "SOL-SIGN-001",
      evidenceLines: auditLines(["claimReward", "_verifySignature(digest, signature)"]),
      rootCauseGroups: [
        ["签名", "signature", "凭证"],
        ["重放", "replay", "重复使用", "重复提交"],
      ],
      remediationKeywords: ["nonce", "deadline", "domain", "chainid", "eip-712", "eip712"],
      required: true,
    },
    {
      code: "F-04",
      title: "emergencyWithdraw() 使用 tx.origin 鉴权",
      vulnType: "tx-origin",
      expectedSeverity: "high",
      ruleId: "SOL-TXORIGIN-001",
      evidenceLines: auditLines(["tx.origin == owner"]),
      rootCauseGroups: [
        ["tx.origin"],
        ["鉴权", "访问控制", "钓鱼", "phishing"],
      ],
      remediationKeywords: ["msg.sender"],
      required: false,
    },
    {
      code: "F-05",
      title: "forward() 未检查低级 call 返回值",
      vulnType: "unchecked-call",
      expectedSeverity: "medium",
      ruleId: "SOL-CALL-001",
      evidenceLines: auditLines(["target.call{value: msg.value}(payload)"]),
      rootCauseGroups: [
        ["返回值", "return value", "未检查", "没有检查", "unchecked"],
      ],
      remediationKeywords: ["require", "检查", "check"],
      required: false,
    },
  ] as AuditTarget[],
};

export const FINAL_AUDIT_SOURCE = FINAL_AUDIT_CODE.join("\n");

/**
 * 会话级场景元数据：既覆盖四个 Lab 场景，也覆盖最终综合审计。
 * 最终审计不用 5 步流程，而是 finding + report 接口。
 */
export type SessionScenarioMeta = {
  id: string;
  title: string;
  category: ScenarioCategory;
  difficulty: 1 | 2 | 3 | 4;
  scenarioVersion: string;
  ruleId: string;
  labId: string;
  kind: "lab" | "final-audit";
};

export function getSessionScenario(id: string): SessionScenarioMeta | null {
  const lab = getScenario(id);
  if (lab) {
    return {
      id: lab.id,
      title: lab.title,
      category: lab.category,
      difficulty: lab.difficulty,
      scenarioVersion: lab.scenarioVersion,
      ruleId: lab.ruleId,
      labId: lab.labId,
      kind: "lab",
    };
  }
  if (id === FINAL_AUDIT_SCENARIO.id) {
    return {
      id: FINAL_AUDIT_SCENARIO.id,
      title: FINAL_AUDIT_SCENARIO.title,
      category: "TX",
      difficulty: 4,
      scenarioVersion: FINAL_AUDIT_SCENARIO.scenarioVersion,
      ruleId: "AUDIT-FINAL",
      labId: "lab-final",
      kind: "final-audit",
    };
  }
  return null;
}

export function isFinalAuditScenario(id: string) {
  return id === FINAL_AUDIT_SCENARIO.id;
}

export const SEVERITY_OPTIONS = ["critical", "high", "medium", "low"] as const;

export const FINDING_FIELD_LIMITS = {
  title: 120,
  rootCause: 600,
  impact: 600,
  remediation: 600,
} as const;
