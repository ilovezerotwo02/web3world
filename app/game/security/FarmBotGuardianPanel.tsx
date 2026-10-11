"use client";

import { useState } from "react";
import {
  DEFAULT_FARM_POLICY,
  FARM_BOT_DEMO_PROPOSALS,
  evaluatePolicy,
  type PolicyDecision,
} from "../../../lib/security/agent-policy";

/**
 * FarmBot Guardian：AI 只把自然语言意图转成结构化 Proposal，
 * 是否允许执行由确定性 Policy Engine 决定，最后仍需要用户确认。
 */
export function FarmBotGuardianPanel() {
  const [activeId, setActiveId] = useState(FARM_BOT_DEMO_PROPOSALS[0].id);
  const [decision, setDecision] = useState<PolicyDecision | null>(() => {
    const first = FARM_BOT_DEMO_PROPOSALS[0];
    return evaluatePolicy(DEFAULT_FARM_POLICY, first.proposal);
  });
  const [intent, setIntent] = useState("");
  const [agentNote, setAgentNote] = useState<string | null>(null);

  const active = FARM_BOT_DEMO_PROPOSALS.find((entry) => entry.id === activeId) ?? FARM_BOT_DEMO_PROPOSALS[0];

  function run(id: string) {
    const sample = FARM_BOT_DEMO_PROPOSALS.find((entry) => entry.id === id);
    if (!sample) return;
    setActiveId(id);
    setAgentNote(null);
    setDecision(evaluatePolicy(DEFAULT_FARM_POLICY, sample.proposal));
  }

  async function proposeFromIntent() {
    if (!intent.trim()) return;
    try {
      const response = await fetch("/api/security/agent/propose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent }),
      });
      const payload = (await response.json()) as {
        proposal?: { contract: string; value?: string; data?: string };
        error?: string;
        note?: string;
      };
      if (!response.ok || !payload.proposal) {
        setAgentNote(payload.error ?? "无法把这句话转成结构化提案。");
        return;
      }
      setAgentNote(payload.note ?? null);
      setDecision(
        evaluatePolicy(DEFAULT_FARM_POLICY, {
          intent,
          contract: payload.proposal.contract,
          value: payload.proposal.value,
          data: payload.proposal.data,
        }),
      );
    } catch {
      setAgentNote("Agent 服务不可用，已保持规则模式；主流程不受影响。");
    }
  }

  return (
    <div className="panel-stack sec-farmbot">
      <header className="sec-farmbot-head">
        <div>
          <span>FARMBOT GUARDIAN · P1 / AI Track</span>
          <h2>给自动化助手设置权限边界</h2>
          <p>
            Agent 提案不会直接发送。流程固定为：Agent Proposal → SignGuard → Policy Engine → Allow / Block → 用户确认。
            AI 只负责把自然语言变成结构化提案，安全判断完全由确定性策略引擎完成。
          </p>
        </div>
      </header>

      <div className="sec-policy-card">
        <b>当前策略（白名单）</b>
        <ul>
          <li>每日最多支出：{(Number(DEFAULT_FARM_POLICY.maxNativeValuePerDay) / 1e18).toFixed(2)} MON</li>
          <li>允许合约：SeedShop（教学沙箱）</li>
          <li>允许方法：buySeed / deposit</li>
          <li>无限 approve：NEVER</li>
          <li>NFT setApprovalForAll：NEVER</li>
          <li>陌生合约 / 陌生 selector：BLOCK</li>
          <li>用户确认：REQUIRED</li>
        </ul>
      </div>

      <div className="sec-sample-grid">
        {FARM_BOT_DEMO_PROPOSALS.map((sample) => (
          <button key={sample.id} type="button" className={sample.id === activeId ? "is-active" : ""} onClick={() => run(sample.id)}>
            <b>{sample.title}</b>
            <span>{sample.description}</span>
          </button>
        ))}
      </div>

      <div className="sec-form">
        <label className="is-wide">
          <span>或者直接用自然语言描述一个意图</span>
          <input
            value={intent}
            onChange={(event) => setIntent(event.target.value)}
            placeholder="例如：帮我买一颗种子 / 帮我 approve 这个地址"
          />
        </label>
        <button className="pixel-button secondary" type="button" onClick={proposeFromIntent}>
          让 Agent 生成结构化提案
        </button>
      </div>
      {agentNote && <div className="inline-note"><span>✦</span><p>{agentNote}</p></div>}

      {decision && (
        <article className={`sec-decision sec-decision-${decision.decision.toLowerCase()}`}>
          <header className="sec-decision-head">
            <span className="sec-decision-badge">
              {decision.decision === "BLOCK" ? "BLOCK · 拒绝执行" : decision.decision === "REVIEW" ? "REVIEW · 等待用户确认" : "ALLOW · 可以执行"}
            </span>
            <div className="sec-decision-meta">
              <span>提案：{active.title}</span>
              {decision.triggeredPolicyIds.length > 0 && <span>命中 {decision.triggeredPolicyIds.join(" / ")}</span>}
            </div>
          </header>
          <ul className="sec-rule-list">
            {decision.reasons.map((reason) => (
              <li key={reason}>
                <b>{decision.allowed ? "通过" : "阻断"}</b>
                <span>{reason}</span>
              </li>
            ))}
          </ul>
          <p className="sec-decision-advice">
            {decision.allowed
              ? "策略允许该提案，但仍需要你在钱包里明确确认后才会发送。"
              : "Policy Engine 已经阻断这笔动作，FarmBot 不能绕过策略直接执行。"}
          </p>
        </article>
      )}

      <p className="quiet-note">
        所有 Agent 动作限定在测试网教学沙箱；系统不接收私钥 / 助记词，也不会替用户自动签名。
      </p>
    </div>
  );
}
