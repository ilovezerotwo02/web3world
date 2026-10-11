"use client";

import { useState } from "react";
import type { SignGuardResult } from "./types";

const DECISION_LABEL: Record<SignGuardResult["decision"], string> = {
  ALLOW: "ALLOW · 可以继续",
  REVIEW: "REVIEW · 签名前逐项确认",
  BLOCK: "BLOCK · 不要签名",
};

const PERMISSION_LABEL: Record<string, string> = {
  ERC20_APPROVAL: "ERC20 支配额度",
  NFT_ALL: "NFT 系列全量权限",
  NATIVE_TRANSFER: "原生资产（MON）转移",
  UNKNOWN: "无法解释的调用",
};

/**
 * SignGuard 结果卡：先给 BLOCK / REVIEW / ALLOW，再给分数与技术证据。
 * 新手先看到人话，高级用户可以展开原始 selector / calldata。
 */
export function RiskDecisionCard({
  result,
  rawData,
  rawValue,
  target,
}: {
  result: SignGuardResult;
  rawData: string;
  rawValue: string;
  target: string;
}) {
  const [showWhy, setShowWhy] = useState(false);
  const tone = result.decision.toLowerCase();

  return (
    <article className={`sec-decision sec-decision-${tone}`} aria-live="polite">
      <header className="sec-decision-head">
        <span className="sec-decision-badge">{DECISION_LABEL[result.decision]}</span>
        <div className="sec-decision-meta">
          <span>严重级别 {result.severity}</span>
          <span>置信度 {result.confidence}</span>
          {result.knownContract && <span className="is-known">KNOWN CONTRACT</span>}
        </div>
      </header>

      <h3>{result.summary}</h3>
      <p className="sec-decision-advice">{result.recommendedAction}</p>

      <div className="sec-decision-columns">
        <div>
          <h4>你会交出什么权限</h4>
          {result.permissions.length === 0 ? (
            <p className="sec-quiet">这笔交易没有申请新的长期权限。</p>
          ) : (
            <ul className="sec-permission-list">
              {result.permissions.map((permission, index) => (
                <li key={`${permission.kind}-${index}`}>
                  <b>{PERMISSION_LABEL[permission.kind] ?? permission.kind}</b>
                  {permission.target && <code>{permission.target}</code>}
                  {permission.amount && <em>额度 {permission.amount}</em>}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h4>命中的规则</h4>
          {result.triggeredRules.length === 0 ? (
            <p className="sec-quiet">没有命中已知的高风险规则，但这不代表交易绝对安全。</p>
          ) : (
            <ul className="sec-rule-list">
              {result.triggeredRules.map((rule) => (
                <li key={rule.id}>
                  <b>
                    {rule.id} · {rule.title}
                  </b>
                  <span>{rule.evidence}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <button className="pixel-button ghost" type="button" onClick={() => setShowWhy((value) => !value)}>
        {showWhy ? "收起技术证据" : "Why? 展开技术证据"}
      </button>

      {showWhy && (
        <div className="sec-why">
          <div>
            <small>目标地址</small>
            <code>{target}</code>
          </div>
          <div>
            <small>selector</small>
            <code>{result.decoded?.selector ?? "0x（无 calldata）"}</code>
          </div>
          <div>
            <small>方法</small>
            <code>{result.decoded?.signature ?? "unknown"}</code>
          </div>
          <div>
            <small>value</small>
            <code>{rawValue} wei</code>
          </div>
          <div className="is-wide">
            <small>raw calldata</small>
            <code className="sec-break">{rawData}</code>
          </div>
          {result.decoded?.args && Object.keys(result.decoded.args).length > 0 && (
            <div className="is-wide">
              <small>解码参数</small>
              <ul className="sec-args">
                {Object.entries(result.decoded.args).map(([key, value]) => (
                  <li key={key}>
                    <b>{key}</b>
                    <code>{value}</code>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
