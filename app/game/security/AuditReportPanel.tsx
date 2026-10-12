"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { cancelFrame, requestFrame } from "../animation-frame";
import { FINAL_AUDIT_SCENARIO } from "../../../lib/security/scenarios";
import { evaluateFinalAudit, type FindingDraft } from "../../../lib/security/scoring";
import { buildAuditReport, reportIdFromHash, reportToMarkdown, withReportHash, type AuditReport } from "../../../lib/security/report";
import { FindingForm } from "./FindingForm";
import {
  generateServerReport,
  startServerSession,
  submitFindingToServer,
} from "./security-api";

const FINDINGS_STORAGE_KEY = "monad-pixel-farm:v1:security-audit-findings";
export const MAX_FINDINGS = 6;

type StoredFindings = FindingDraft[];

function readStoredFindings(): StoredFindings {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(FINDINGS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredFindings;
    return Array.isArray(parsed) ? parsed.slice(0, MAX_FINDINGS) : [];
  } catch {
    return [];
  }
}

export function AuditReportPanel({
  labsPassed,
  replayPassed,
  walletAddress,
  auditor,
  onAuditComplete,
}: {
  labsPassed: [boolean, boolean, boolean];
  replayPassed: boolean;
  walletAddress: string | null;
  auditor: string;
  onAuditComplete: (payload: {
    passed: boolean;
    score: number;
    reportId: string | null;
    reportHash: string | null;
    falsePositivePenalty: number;
  }) => void;
}) {
  const [findings, setFindings] = useState<StoredFindings>([]);
  const [hydrated, setHydrated] = useState(false);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [serverReportId, setServerReportId] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<"idle" | "syncing" | "synced" | "local">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestFrame(() => {
      setFindings(readStoredFindings());
      setHydrated(true);
    });
    return () => cancelFrame(frame);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(FINDINGS_STORAGE_KEY, JSON.stringify(findings));
    } catch {
      // ignore storage failure
    }
  }, [findings, hydrated]);

  const labsOk = labsPassed.every(Boolean);
  const evaluation = useMemo(
    () => evaluateFinalAudit(findings, { labsPassed: labsOk, replayPassed }),
    [findings, labsOk, replayPassed],
  );

  function addFinding(finding: FindingDraft) {
    setFindings((values) => [...values, finding].slice(0, MAX_FINDINGS));
    setReport(null);
  }

  function removeFinding(index: number) {
    setFindings((values) => values.filter((_, position) => position !== index));
    setReport(null);
  }

  const generate = useCallback(async () => {
    setError(null);
    setSyncState("syncing");
    const local = await withReportHash(
      buildAuditReport({
        auditor,
        walletAddress,
        findings,
        evaluation,
        replayPassed,
      }),
    );
    setReport(local);
    const markdown = reportToMarkdown(local);
    const blobUrl = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    setDownloadUrl(blobUrl);

    // 有会话 token 时，把审计流程同步到 D1，并由服务端权威生成报告
    const session = await startServerSession(FINAL_AUDIT_SCENARIO.id);
    if (!session?.ok || !session.data?.sessionId) {
      setSyncState("local");
      setError("未检测到已验证的钱包会话，报告已按同一套确定性规则在本地生成。");
      onAuditComplete({
        passed: local.passes,
        score: local.score,
        reportId: null,
        reportHash: local.reportHash,
        falsePositivePenalty: evaluation.breakdown.penalty,
      });
      return;
    }

    const sessionId = session.data.sessionId;
    for (const finding of findings) {
      await submitFindingToServer(sessionId, {
        title: finding.title,
        type: finding.vulnType,
        severity: finding.severity,
        evidenceLines: finding.evidenceLines,
        rootCause: finding.rootCause,
        impact: finding.impact,
        fix: finding.remediation,
      });
    }

    const server = await generateServerReport({
      sessionId,
      auditor,
      walletAddress,
      findings: findings as unknown as Array<Record<string, unknown>>,
    });
    if (!server?.ok || !server.data) {
      setSyncState("local");
      setError("未检测到已验证的钱包会话，报告已按同一套确定性规则在本地生成。");
      onAuditComplete({
        passed: local.passes,
        score: local.score,
        reportId: null,
        reportHash: local.reportHash,
        falsePositivePenalty: evaluation.breakdown.penalty,
      });
      return;
    }

    setSyncState("synced");
    setServerReportId(server.data.reportId);
    if (server.data.report) {
      setReport(server.data.report as AuditReport);
    }
    onAuditComplete({
      passed: server.data.passed,
      score: server.data.score,
      reportId: server.data.reportId,
      reportHash: server.data.reportHash,
      falsePositivePenalty: evaluation.breakdown.penalty,
    });
  }, [auditor, evaluation, findings, onAuditComplete, replayPassed, walletAddress]);

  const reportLabel = report?.reportHash ? reportIdFromHash(report.reportHash) : null;

  return (
    <div className="panel-stack sec-audit">
      <header className="sec-audit-head">
        <div>
          <span>FINAL AUDIT · {FINAL_AUDIT_SCENARIO.scenarioVersion}</span>
          <h2>{FINAL_AUDIT_SCENARIO.title}</h2>
          <p>
            给一份组合型合约做一次小型审计：找出至少 {FINAL_AUDIT_SCENARIO.requiredFindingCodes.length} 个关键问题，
            提交结构化 Finding，系统用确定性规则判分（阈值 {FINAL_AUDIT_SCENARIO.passThreshold}/100）。
          </p>
        </div>
        <div className="sec-audit-pre">
          <span className={labsPassed[0] ? "is-ok" : ""}>Lab 1 {labsPassed[0] ? "✓" : "—"}</span>
          <span className={labsPassed[1] ? "is-ok" : ""}>Lab 2 {labsPassed[1] ? "✓" : "—"}</span>
          <span className={labsPassed[2] ? "is-ok" : ""}>Lab 3 {labsPassed[2] ? "✓" : "—"}</span>
          <span className={replayPassed ? "is-ok" : ""}>Reentrancy 回归 {replayPassed ? "✓" : "—"}</span>
        </div>
      </header>

      {!labsOk && (
        <div className="inline-note">
          <span>✦</span>
          <p>可以先提交 Finding 练习，但回归验证分会等到三个 Lab 全部通过后才会给满。</p>
        </div>
      )}

      <FindingForm onSubmit={addFinding} disabled={findings.length >= MAX_FINDINGS} />

      <div className="sec-finding-list">
        <header>
          <b>已提交 Finding（{findings.length} / {MAX_FINDINGS}）</b>
          {findings.length > 0 && (
            <button className="text-danger" type="button" onClick={() => { setFindings([]); setReport(null); }}>
              清空
            </button>
          )}
        </header>
        {findings.length === 0 ? (
          <p className="sec-quiet">还没有提交 Finding。可以先看右侧代码，再从最有把握的问题开始。</p>
        ) : (
          <ol>
            {findings.map((finding, index) => {
              const item = evaluation.evaluations[index];
              return (
                <li key={`${finding.title}-${index}`} className={item?.matchedCode ? "is-matched" : "is-miss"}>
                  <div>
                    <b>{item?.matchedCode ? `${item.matchedCode} · ` : ""}{finding.title || "（未命名）"}</b>
                    <span>{finding.severity} · 行 {finding.evidenceLines.join(",") || "-"}</span>
                  </div>
                  <p>{item?.message ?? ""}</p>
                  <button type="button" className="pixel-button ghost" onClick={() => removeFinding(index)}>
                    删除
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </div>

      <div className="sec-score">
        <div className="sec-score-value">
          <b>{evaluation.score}</b>
          <span>/ 100 · {evaluation.passed ? "PASS" : "未通过"}</span>
        </div>
        <ul className="sec-score-breakdown">
          <li><span>漏洞识别</span><b>{evaluation.breakdown.identification} / 30</b></li>
          <li><span>根因理解</span><b>{evaluation.breakdown.rootCause} / 25</b></li>
          <li><span>修复方案</span><b>{evaluation.breakdown.remediation} / 20</b></li>
          <li><span>回归验证</span><b>{evaluation.breakdown.regression} / 15</b></li>
          <li><span>风险表达</span><b>{evaluation.breakdown.expression} / 10</b></li>
          <li><span>误报扣分</span><b>-{evaluation.breakdown.penalty}</b></li>
        </ul>
        {evaluation.missingRequired.length > 0 && (
          <p className="sec-quiet">关键问题仍缺少：{evaluation.missingRequired.join("、")}</p>
        )}
      </div>

      {error && <div className="feedback feedback-gentle" role="alert"><span>✦</span><p>{error}</p></div>}

      <button
        className="pixel-button primary wide"
        type="button"
        onClick={generate}
        disabled={findings.length === 0 || syncState === "syncing"}
      >
        {syncState === "syncing" ? "正在生成审计报告…" : "生成 Audit Report"}
      </button>

      {report && (
        <div className="sec-report" aria-live="polite">
          <header>
            <div>
              <span>WEB3 SECURITY AUDIT REPORT</span>
              <h3>{reportLabel ?? "#PENDING"}</h3>
            </div>
            <div className="sec-report-meta">
              <span>Score {report.score}/100</span>
              <span>{report.passes ? "PASS" : "FAIL"}</span>
              <span>{syncState === "synced" ? "服务端已记录（D1）" : "本地生成（未登录时）"}</span>
            </div>
          </header>
          <p className="sec-break">Report Hash (sha256): {report.reportHash}</p>
          <div className="sec-report-summary">
            <span>Critical {report.summary.critical}</span>
            <span>High {report.summary.high}</span>
            <span>Medium {report.summary.medium}</span>
            <span>Low {report.summary.low}</span>
            <span>Regression {replayPassed ? "Passed" : "Failed"}</span>
          </div>

          <div className="sec-share-card">
            <b>MONAD SECURITY PASSPORT</b>
            <ul>
              <li><span>Reentrancy</span><b>{labsPassed[0] ? "PASSED" : "—"}</b></li>
              <li><span>Access Control</span><b>{labsPassed[1] ? "PASSED" : "—"}</b></li>
              <li><span>Transaction Guard</span><b>{labsPassed[2] ? "PASSED" : "—"}</b></li>
              <li><span>Audit Challenge</span><b>{report.score}/100</b></li>
            </ul>
            <small>
              Report {reportLabel ?? "#PENDING"} · Monad Testnet
              {serverReportId ? ` · 服务端报告 ${serverReportId.slice(0, 8)}` : ""}
            </small>
          </div>

          <div className="panel-actions">
            {downloadUrl && (
              <a className="pixel-button secondary" href={downloadUrl} download={`audit-report-${(report.reportHash ?? "local").slice(0, 8)}.md`}>
                下载 Markdown 报告
              </a>
            )}
            {serverReportId && (
              <a className="pixel-button ghost" href={`/api/security/report/${serverReportId}?format=md`}>
                从服务端下载
              </a>
            )}
          </div>
          <p className="quiet-note">{report.disclaimer}</p>
        </div>
      )}
    </div>
  );
}
