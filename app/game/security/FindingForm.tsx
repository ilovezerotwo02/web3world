"use client";

import { useState } from "react";
import { FINAL_AUDIT_SCENARIO } from "../../../lib/security/scenarios";
import { SEVERITY_OPTIONS } from "../../../lib/security/scenarios";
import type { FindingDraft } from "../../../lib/security/scoring";
import { requestAgentReview } from "./security-api";

const EMPTY: FindingDraft = {
  title: "",
  vulnType: "",
  severity: "high",
  evidenceLines: [],
  rootCause: "",
  impact: "",
  remediation: "",
};

const TYPE_OPTIONS = [
  { value: "reentrancy", label: "重入（Reentrancy）" },
  { value: "access-control", label: "权限控制缺失（Access Control）" },
  { value: "signature-replay", label: "签名重放（Signature Replay）" },
  { value: "tx-origin", label: "tx.origin 鉴权" },
  { value: "unchecked-call", label: "未检查低级 call 返回值" },
];

/** Final Audit 的 Finding 编辑器：用户像真实审计员一样提交结构化问题描述 */
export function FindingForm({
  onSubmit,
  disabled = false,
}: {
  onSubmit: (finding: FindingDraft) => void;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState<FindingDraft>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [review, setReview] = useState<{
    understood: boolean;
    missingPoints: string[];
    feedback: string;
    followUp: string;
    notice: string;
  } | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);

  function toggleLine(line: number) {
    setDraft((value) => ({
      ...value,
      evidenceLines: value.evidenceLines.includes(line)
        ? value.evidenceLines.filter((entry) => entry !== line)
        : [...value.evidenceLines, line].sort((a, b) => a - b),
    }));
  }

  function validate() {
    if (!draft.title.trim()) return "请填写 Finding 标题。";
    if (!draft.vulnType) return "请选择漏洞类型。";
    if (draft.evidenceLines.length === 0) return "请在右侧代码中点选涉及的行号。";
    if (draft.rootCause.trim().length < 8) return "rootCause 至少需要 8 个字符。";
    if (draft.impact.trim().length < 8) return "impact 至少需要 8 个字符。";
    if (draft.remediation.trim().length < 8) return "fix 至少需要 8 个字符。";
    return null;
  }

  function submit() {
    const message = validate();
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    onSubmit({ ...draft, title: draft.title.trim() });
    setDraft(EMPTY);
    setReview(null);
  }

  async function askAgent() {
    setReviewBusy(true);
    const response = await requestAgentReview({
      title: draft.title,
      type: draft.vulnType,
      severity: draft.severity,
      evidenceLines: draft.evidenceLines,
      rootCause: draft.rootCause,
      impact: draft.impact,
      fix: draft.remediation,
    });
    setReviewBusy(false);
    if (!response?.ok || !response.data) {
      setReview({
        understood: false,
        missingPoints: [],
        feedback: response?.error ?? "AI 评阅暂时不可用，已保持规则评阅模式，不影响通过条件。",
        followUp: "",
        notice: "规则评阅模式",
      });
      return;
    }
    setReview(response.data);
  }

  return (
    <div className="sec-finding-form">
      <div className="sec-form">
        <label className="is-wide">
          <span>Title（一句话说明问题）</span>
          <input
            value={draft.title}
            maxLength={120}
            onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
            placeholder="例如：withdraw() 存在重入风险"
          />
        </label>
        <label>
          <span>漏洞类型</span>
          <select value={draft.vulnType} onChange={(event) => setDraft((value) => ({ ...value, vulnType: event.target.value }))}>
            <option value="">请选择</option>
            {TYPE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Severity</span>
          <select value={draft.severity} onChange={(event) => setDraft((value) => ({ ...value, severity: event.target.value }))}>
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
        <label className="is-wide">
          <span>Root Cause（为什么会发生）</span>
          <textarea
            value={draft.rootCause}
            maxLength={600}
            rows={3}
            onChange={(event) => setDraft((value) => ({ ...value, rootCause: event.target.value }))}
          />
        </label>
        <label className="is-wide">
          <span>Impact（会造成什么后果）</span>
          <textarea
            value={draft.impact}
            maxLength={600}
            rows={3}
            onChange={(event) => setDraft((value) => ({ ...value, impact: event.target.value }))}
          />
        </label>
        <label className="is-wide">
          <span>Remediation（修复方向）</span>
          <textarea
            value={draft.remediation}
            maxLength={600}
            rows={3}
            onChange={(event) => setDraft((value) => ({ ...value, remediation: event.target.value }))}
          />
        </label>
      </div>

      <div className="sec-evidence">
        <div className="sec-evidence-head">
          <b>Evidence Lines</b>
          <span>已选 {draft.evidenceLines.join(" / ") || "（未选择）"}</span>
        </div>
        <ol>
          {FINAL_AUDIT_SCENARIO.code.map((line, index) => {
            const lineNumber = index + 1;
            return (
              <li key={lineNumber} className={draft.evidenceLines.includes(lineNumber) ? "is-picked" : ""}>
                <button type="button" onClick={() => toggleLine(lineNumber)} aria-pressed={draft.evidenceLines.includes(lineNumber)}>
                  <span>{lineNumber}</span>
                  <code>{line}</code>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {error && <div className="feedback feedback-gentle" role="alert"><span>✦</span><p>{error}</p></div>}

      {review && (
        <div className="sec-agent-review" role="status">
          <div>
            <b>{review.understood ? "根因识别正确" : "还需要补充"}</b>
            <small>{review.notice}</small>
          </div>
          <p>{review.feedback}</p>
          {review.missingPoints.length > 0 && <p>缺少要点：{review.missingPoints.join("、")}</p>}
          {review.followUp && <p className="sec-quiet">追问：{review.followUp}</p>}
          <p className="quiet-note">Agent 只做语义评阅与表达建议，是否通过由确定性规则决定。</p>
        </div>
      )}

      <div className="panel-actions">
        <button className="pixel-button ghost" type="button" onClick={askAgent} disabled={reviewBusy}>
          {reviewBusy ? "正在评阅…" : "让安全助教评阅"}
        </button>
        <button className="pixel-button primary" type="button" onClick={submit} disabled={disabled}>
          提交 Finding
        </button>
      </div>
    </div>
  );
}
