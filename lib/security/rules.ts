// =============================================================================
// 安全规则引擎定义（纯规则，无副作用）
// - TX_* 规则：基于交易上下文（TxContext）判断签名前风险
// - SOL_* 规则：基于 Solidity 源码的确定性静态检查，用于教学靶场
// 本文件不访问 DOM / D1 / RPC / LLM，便于单元测试。
// =============================================================================

import { isKnownCourseContract, lookupSelector } from "./selectors";
import type {
  SecurityRule,
  SourceFinding,
  SourceRule,
  TxContext,
} from "./types";

export type { SourceFinding } from "./types";

// ---------------------------------------------------------------------------
// 交易前风险规则（SignGuard）
// ---------------------------------------------------------------------------

export const TX_RULES: SecurityRule[] = [
  {
    id: "TX-001",
    title: "Unlimited ERC20 Approval",
    category: "TX",
    severity: "HIGH",
    decision: "BLOCK",
    explanation:
      "这笔交易正在把接近无限额度的 ERC20 支配权交给另一个地址，而不是本次实际需要的数量。",
    remediation:
      "只授权本次实际需要的额度，或在完成操作后把授权额度改回 0。",
    match(ctx) {
      return (
        ctx.decoded?.signature === "approve(address,uint256)" &&
        ctx.decoded.args?.amount === "unlimited"
      );
    },
    evidence(ctx) {
      const spender = ctx.decoded?.args?.spender ?? "unknown";
      return `approve(spender=${spender}, amount=MaxUint256)`;
    },
  },
  {
    id: "TX-002",
    title: "NFT setApprovalForAll",
    category: "TX",
    severity: "HIGH",
    decision: "BLOCK",
    explanation:
      "该操作不是授权一枚 NFT，而是授权对方操作这个系列中你持有的全部 NFT。",
    remediation:
      "优先使用单枚 approve(tokenId)，仅在完全信任该 operator 时才使用 setApprovalForAll。",
    match(ctx) {
      return (
        ctx.decoded?.signature === "setApprovalForAll(address,bool)" &&
        ctx.decoded.args?.approved === "true"
      );
    },
    evidence(ctx) {
      const operator = ctx.decoded?.args?.operator ?? "unknown";
      return `setApprovalForAll(operator=${operator}, approved=true)`;
    },
  },
  {
    id: "TX-003",
    title: "Unknown Selector + Native Value",
    category: "TX",
    severity: "MEDIUM",
    decision: "REVIEW",
    explanation:
      "系统无法确认目标方法的语义，同时这笔交易会转移原生资产。这不是“恶意”的结论，而是“无法解释”。",
    remediation:
      "先向项目方确认方法语义，再决定是否签名；不要把无法解释的调用直接签掉。",
    match(ctx) {
      const unknownSelector =
        ctx.selector !== null &&
        (!lookupSelector(ctx.selector) || ctx.decoded?.unknown === true);
      let hasValue = false;
      try {
        hasValue = BigInt(ctx.value || "0") > 0n;
      } catch {
        hasValue = false;
      }
      return unknownSelector && hasValue;
    },
    evidence(ctx) {
      return `selector=${ctx.selector ?? "0x（空 calldata）"} value=${ctx.value} wei`;
    },
  },
  {
    id: "TX-004",
    title: "Chain Mismatch",
    category: "TX",
    severity: "CRITICAL",
    decision: "BLOCK",
    explanation:
      "当前钱包网络与用户期望的网络不一致，交易可能被发送到错误的链上。",
    remediation:
      "先把钱包网络切换到 Monad Testnet（Chain ID 10143），再重新发起交易。",
    match(ctx) {
      return ctx.chainId !== ctx.expectedChainId;
    },
    evidence(ctx) {
      return `wallet chainId=${ctx.chainId} · expected=${ctx.expectedChainId}`;
    },
  },
  {
    id: "TX-005",
    title: "Known Course Contract",
    category: "TX",
    severity: "INFO",
    explanation:
      "目标地址属于本项目已验证的教学合约。系统仍会逐项展示方法、金额与权限，不会因为白名单跳过检查。",
    remediation: "仍然逐项确认 method / value / permission 后再签名。",
    match(ctx) {
      return isKnownCourseContract(ctx.to, ctx.knownContracts) !== null;
    },
    evidence(ctx) {
      return `known contract: ${isKnownCourseContract(ctx.to, ctx.knownContracts) ?? ""} (${ctx.to ?? ""})`;
    },
  },
];

// ---------------------------------------------------------------------------
// 源码静态规则（教学靶场 / Final Audit）
// ---------------------------------------------------------------------------

const STATE_WRITE_RE =
  /\b(?:balances|balanceOf|balancesOf|_balances|deposits|amounts)\s*\[[^\]]*\]\s*(?:-=|\+=|=|--|\+\+)/;

const EXTERNAL_CALL_RE = /\.(?:call|delegatecall|staticcall)\s*(?:\{[^}]*\})?\s*\(/;
const RETURN_CHECK_RE = /(?:require\s*\(\s*(?:ok|success|sent)\b|if\s*\(\s*!\s*(?:ok|success|sent)\b)/;
const CATCH_RE = /(?:bool|\(bool)\s+(?:ok|success|sent)\b/;

const PRIVILEGED_FUNCS = [
  "mint",
  "pause",
  "unpause",
  "setowner",
  "setowneraddress",
  "setminter",
  "withdrawall",
  "sweep",
  "rescue",
  "initialize",
  "burn",
];

const ACCESS_MODIFIER_RE =
  /(onlyOwner|onlyMinter|onlyAdmin|onlyRole|onlyGuardian|_checkOwner|requiresAuth)\b/;
const ACCESS_INLINE_RE =
  /(?:require\s*\(\s*msg\.sender\s*==\s*(?:owner|admin|_owner)|hasRole\s*\(|_checkOwner\s*\()/;

function extractFunctionBodies(source: string) {
  const lines = source.split(/\r?\n/);
  const bodies: Array<{ name: string; header: string; body: string; startLine: number }> = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const match = /function\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(/.exec(line);
    if (!match) continue;
    const name = match[1];
    // 收集 header 直到出现 '{'
    let header = line;
    let cursor = index;
    while (!header.includes("{") && cursor < lines.length - 1) {
      cursor += 1;
      header += ` ${lines[cursor]}`;
    }
    const headerEnd = header.indexOf("{");
    if (headerEnd < 0) continue;
    let depth = 0;
    let body = "";
    let bodyEndLine = cursor;
    const text = header.slice(headerEnd);
    let started = false;
    for (; bodyEndLine < lines.length; bodyEndLine += 1) {
      const current = bodyEndLine === cursor ? text : lines[bodyEndLine];
      for (const character of current) {
        if (character === "{") {
          depth += 1;
          started = true;
        } else if (character === "}") {
          depth -= 1;
        }
      }
      body += `${current}\n`;
      if (started && depth <= 0) break;
    }
    bodies.push({ name, header: header.slice(0, headerEnd), body, startLine: index + 1 });
    index = bodyEndLine;
  }
  return bodies;
}

function lineNumbersOf(source: string, needle: string) {
  const lines = source.split(/\r?\n/);
  const result: number[] = [];
  lines.forEach((line, index) => {
    if (line.includes(needle)) result.push(index + 1);
  });
  return result;
}

export const SOL_RULES: SourceRule[] = [
  {
    id: "SOL-REENT-001",
    title: "外部调用发生在关键状态更新之前",
    category: "SOL",
    severity: "HIGH",
    explanation:
      "合约先向外部地址发起调用，之后才更新调用者余额。攻击者可以在回调中重新进入同一函数，在状态更新前重复提款。",
    remediation:
      "采用 Checks-Effects-Interactions：先更新余额，再发起外部调用；或引入 ReentrancyGuard。",
    detect(source) {
      const bodies = extractFunctionBodies(source);
      for (const fn of bodies) {
        const bodyLines = fn.body.split(/\r?\n/);
        let callLine = -1;
        let writeLine = -1;
        bodyLines.forEach((line, index) => {
          if (callLine < 0 && EXTERNAL_CALL_RE.test(line)) {
            callLine = index;
          }
          if (callLine >= 0 && writeLine < 0 && STATE_WRITE_RE.test(line)) {
            writeLine = index;
          }
        });
        if (callLine >= 0 && writeLine >= 0 && callLine < writeLine) {
          const callText = bodyLines[callLine].trim();
          return {
            ruleId: "SOL-REENT-001",
            severity: "HIGH",
            title: "外部调用发生在关键状态更新之前",
            evidence: `${fn.name}() 中第 ${fn.startLine + callLine} 行先执行外部调用：${callText}`,
            lines: [fn.startLine + callLine, fn.startLine + writeLine],
          };
        }
      }
      return null;
    },
  },
  {
    id: "SOL-AUTH-001",
    title: "高权限函数缺少访问控制",
    category: "SOL",
    severity: "CRITICAL",
    explanation:
      "高权限函数（铸造 / 暂停 / 设置管理员等）没有访问控制，任何地址都可以调用。",
    remediation:
      "为高权限函数添加 onlyOwner / 角色检查，并注意 Owner 私钥泄露后的中心化风险。",
    detect(source) {
      const bodies = extractFunctionBodies(source);
      for (const fn of bodies) {
        if (!PRIVILEGED_FUNCS.includes(fn.name.toLowerCase())) continue;
        const guarded =
          ACCESS_MODIFIER_RE.test(fn.header) || ACCESS_INLINE_RE.test(fn.body);
        if (!guarded) {
          return {
            ruleId: "SOL-AUTH-001",
            severity: "CRITICAL",
            title: "高权限函数缺少访问控制",
            evidence: `${fn.name}() 没有 onlyOwner / 角色检查，任何地址都可以调用`,
            lines: [fn.startLine],
          };
        }
      }
      return null;
    },
  },
  {
    id: "SOL-TXORIGIN-001",
    title: "tx.origin 被用于访问控制判断",
    category: "SOL",
    severity: "HIGH",
    explanation:
      "使用 tx.origin 做鉴权会被钓鱼合约利用：用户点击恶意合约后，恶意合约调用本合约时 tx.origin 仍然是用户地址。",
    remediation: "改用 msg.sender 做访问控制判断。",
    detect(source) {
      const lines = source.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (/tx\.origin/.test(line) && /(require|if|assert)\s*\(/.test(line)) {
          return {
            ruleId: "SOL-TXORIGIN-001",
            severity: "HIGH",
            title: "tx.origin 被用于访问控制判断",
            evidence: `第 ${index + 1} 行：${line.trim()}`,
            lines: [index + 1],
          };
        }
      }
      return null;
    },
  },
  {
    id: "SOL-SIGN-001",
    title: "签名验证缺少 nonce / deadline / domain separation",
    category: "SOL",
    severity: "HIGH",
    explanation:
      "签名验证没有 nonce、deadline 与 chainId 域分离，同一个签名可以被重复使用（重放）或跨链重放。",
    remediation:
      "使用 EIP-712 域分离，加入 nonce 与 deadline，并在验证后标记 nonce 已使用。",
    detect(source) {
      const hasRecover = /(ecrecover|ECDSA\.recover|_verifySignature|verify\()/.test(source);
      if (!hasRecover) return null;
      const missing: string[] = [];
      if (!/nonce/i.test(source)) missing.push("nonce");
      if (!/deadline/i.test(source)) missing.push("deadline");
      if (!/(chainId|domain|DOMAIN_SEPARATOR|EIP712)/.test(source)) {
        missing.push("chainId/domain");
      }
      if (missing.length === 0) return null;
      const signLines = Array.from(
        new Set([
          ...lineNumbersOf(source, "ecrecover"),
          ...lineNumbersOf(source, "_verifySignature"),
          ...lineNumbersOf(source, "ECDSA.recover"),
        ]),
      ).sort((a, b) => a - b);
      return {
        ruleId: "SOL-SIGN-001",
        severity: "HIGH",
        title: "签名验证缺少 nonce / deadline / domain separation",
        evidence: `签名验证缺少：${missing.join("、")}`,
        lines: signLines,
      };
    },
  },
  {
    id: "SOL-CALL-001",
    title: "低级 call 返回值未检查",
    category: "SOL",
    severity: "MEDIUM",
    explanation:
      "低级 call 失败时不会自动回滚，未检查返回值会导致“看似成功、实际失败”的状态不一致。",
    remediation: "检查 call 返回值：require(success, \"call failed\")。",
    detect(source) {
      const lines = source.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (!EXTERNAL_CALL_RE.test(line)) continue;
        const captured = CATCH_RE.test(line);
        const checked = RETURN_CHECK_RE.test(line) || RETURN_CHECK_RE.test(lines[index + 1] ?? "");
        if (!captured && !checked) {
          return {
            ruleId: "SOL-CALL-001",
            severity: "MEDIUM",
            title: "低级 call 返回值未检查",
            evidence: `第 ${index + 1} 行：${line.trim()}`,
            lines: [index + 1],
          };
        }
      }
      return null;
    },
  },
  {
    id: "SOL-RANDOM-001",
    title: "依赖可预测链上变量作为随机源",
    category: "SOL",
    severity: "MEDIUM",
    explanation:
      "block.timestamp / blockhash 等链上变量可被矿工或验证者影响，不能作为安全随机源。",
    remediation: "使用链下 VRF 或提交-揭示（commit-reveal）方案。",
    detect(source) {
      const lines = source.split(/\r?\n/);
      for (let index = 0; index < lines.length; index += 1) {
        const line = lines[index];
        if (/(block\.timestamp|blockhash|block\.prevrandao|block\.difficulty)/.test(line) &&
          /(random|rand|winner|seed|prize|luck)/i.test(line)) {
          return {
            ruleId: "SOL-RANDOM-001",
            severity: "MEDIUM",
            title: "依赖可预测链上变量作为随机源",
            evidence: `第 ${index + 1} 行：${line.trim()}`,
            lines: [index + 1],
          };
        }
      }
      return null;
    },
  },
];

/** 对源码运行全部确定性规则，返回命中的 finding 列表。 */
export function analyzeSource(source: string): SourceFinding[] {
  const findings: SourceFinding[] = [];
  for (const rule of SOL_RULES) {
    const finding = rule.detect(source);
    if (finding) findings.push(finding);
  }
  return findings;
}

export function runTxRules(ctx: TxContext): SecurityRule[] {
  return TX_RULES.filter((rule) => rule.match(ctx));
}

export function findRule(id: string): SecurityRule | SourceRule | null {
  return (
    TX_RULES.find((rule) => rule.id === id) ??
    SOL_RULES.find((rule) => rule.id === id) ??
    null
  );
}
