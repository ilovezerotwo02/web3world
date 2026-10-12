"use client";

import { useEffect, useMemo, useState } from "react";
import { cancelFrame, requestFrame } from "../animation-frame";
import { LABS, getScenario, scenariosForLab } from "../../../lib/security/scenarios";
import type { StepName } from "../../../lib/security/session-steps";
import { AuditReportPanel } from "./AuditReportPanel";
import { FarmBotGuardianPanel } from "./FarmBotGuardianPanel";
import { ReentrancyLab } from "./ReentrancyLab";
import { SecurityJourney, type JourneyStage } from "./SecurityJourney";
import { SecurityLabRunner } from "./SecurityLabRunner";
import { SecurityPassportPanel } from "./SecurityPassportPanel";
import { SignGuardPanel } from "./SignGuardPanel";
import { syncLabToServer } from "./security-api";
import { WebSecurityTrainingPanel } from "./WebSecurityTrainingPanel";
import {
  GREENHOUSE_STAGE_COPY,
  GREENHOUSE_STAGE_FRAME,
  scenarioUnlocked,
  securityCompletion,
  securityLabPassed,
  securityLabStage,
  type SecurityAction,
} from "./security-progress";
import type { SecurityLabStepAnswer, SecurityProgress } from "./types";

type TabKey = "journey" | "web-security" | "lab-1" | "lab-2" | "lab-3" | "signguard" | "audit" | "passport" | "farmbot";

const TABS: Array<{ key: TabKey; label: string }> = [
  { key: "journey", label: "安全路线" },
  { key: "web-security", label: "Web 安全训练场" },
  { key: "lab-1", label: "Lab 1 · 重入" },
  { key: "lab-2", label: "Lab 2 · 权限与签名" },
  { key: "lab-3", label: "Lab 3 · 用户侧" },
  { key: "signguard", label: "SignGuard 安检门" },
  { key: "audit", label: "最终综合审计" },
  { key: "passport", label: "Security Passport" },
  { key: "farmbot", label: "FarmBot Guardian" },
];

const LAB_INDEX_BY_TAB: Record<"lab-1" | "lab-2" | "lab-3", number> = {
  "lab-1": 0,
  "lab-2": 1,
  "lab-3": 2,
};

export function SecurityGreenhousePanel({
  progress,
  dispatch,
  contractHarvested,
  walletAddress,
  recentFishingTxHash,
  auditor,
  initialTab = "journey",
  onMessage,
}: {
  progress: SecurityProgress;
  dispatch: (action: SecurityAction) => void;
  contractHarvested: boolean;
  walletAddress: string | null;
  recentFishingTxHash: string | null;
  auditor: string;
  initialTab?: TabKey;
  onMessage: (message: string, tone?: "success" | "warning" | "info") => void;
}) {
  const [tab, setTab] = useState<TabKey>(initialTab);
  const [lab2Scenario, setLab2Scenario] = useState("access-control-mint-v1");

  useEffect(() => {
    const frame = requestFrame(() => {
      dispatch({ type: "unlock" });
    });
    return () => cancelFrame(frame);
  }, [dispatch]);

  const stage = securityLabStage(progress);
  const completion = securityCompletion(progress);
  const stageCopy = GREENHOUSE_STAGE_COPY[stage];

  const journeyStages: JourneyStage[] = useMemo(
    () => [
      {
        key: "learn",
        label: "LEARN",
        title: "学习链上行为",
        detail: contractHarvested ? "已完成智能合约课程" : "先完成智能合约课程",
        done: contractHarvested,
        active: !contractHarvested,
      },
      {
        key: "break",
        label: "BREAK",
        title: "亲手让漏洞发生",
        detail: "Lab 1 · 攻击回放",
        done: securityLabPassed(progress, 0),
        active: contractHarvested && !securityLabPassed(progress, 0),
      },
      {
        key: "fix",
        label: "FIX",
        title: "修复并回归验证",
        detail: "Lab 2 / Lab 3",
        done: securityLabPassed(progress, 1) && securityLabPassed(progress, 2),
        active: securityLabPassed(progress, 0) && !(securityLabPassed(progress, 1) && securityLabPassed(progress, 2)),
      },
      {
        key: "guard",
        label: "GUARD",
        title: "把知识用到真实交易",
        detail: "SignGuard 交易安检门",
        done: progress.finalAudit.status === "passed",
        active: securityLabPassed(progress, 1) && securityLabPassed(progress, 2) && progress.finalAudit.status !== "passed",
      },
      {
        key: "prove",
        label: "PROVE",
        title: "审计报告与能力凭证",
        detail: progress.badgeEligible ? "可以领取 Security Passport" : "等待审计通过",
        done: progress.finalAudit.status === "passed",
        active: progress.finalAudit.status === "passed",
      },
    ],
    [contractHarvested, progress],
  );

  function handleJourneySelect(key: JourneyStage["key"]) {
    if (key === "learn") setTab("journey");
    if (key === "break") setTab("lab-1");
    if (key === "fix") setTab("lab-2");
    if (key === "guard") setTab("signguard");
    if (key === "prove") setTab(progress.finalAudit.status === "passed" ? "passport" : "audit");
  }

  async function handleLabComplete(
    scenarioId: string,
    payload: { passed: boolean; score: number; answers: SecurityLabStepAnswer },
  ) {
    dispatch({
      type: "complete-scenario",
      scenarioId,
      score: payload.score,
      passed: payload.passed,
    });
    if (!payload.passed) {
      onMessage("这一步还没有完全通过，可以返回重做关键步骤", "warning");
      return;
    }
    onMessage(`实验完成 · ${payload.score} 分`);
    const sync = await syncLabToServer(scenarioId, payload.answers);
    if (sync === "synced") {
      dispatch({ type: "mark-synced", scenarioId });
      onMessage("结果已同步到服务端（D1）", "info");
    }
  }

  function renderLab(labIndex: number) {
    const lab = LABS[labIndex];
    if (!lab) return null;
    const scenarios = scenariosForLab(lab.id);
    const selected = lab.id === "lab-2" ? lab2Scenario : scenarios[0]?.id;
    const scenario = selected ? getScenario(selected) : null;

    return (
      <div className="sec-lab-wrap">
        <div className="sec-lab-switch">
          {scenarios.map((entry) => (
            <button
              key={entry.id}
              type="button"
              className={selected === entry.id ? "is-active" : ""}
              onClick={() => lab.id === "lab-2" && setLab2Scenario(entry.id)}
            >
              <b>{entry.title}</b>
              <span>
                {progress.scenarios[entry.id]?.status === "passed"
                  ? `已完成 · ${progress.scenarios[entry.id]?.score} 分`
                  : scenarioUnlocked(progress, entry.id)
                    ? "可以开始"
                    : "未解锁"}
              </span>
            </button>
          ))}
        </div>
        {scenario ? (
          scenarioUnlocked(progress, scenario.id) ? (
            lab.id === "lab-1" ? (
              <ReentrancyLab
                onComplete={(payload) => handleLabComplete(scenario.id, payload)}
                onStepSynced={(step: StepName) => dispatch({ type: "set-step", scenarioId: scenario.id, step })}
              />
            ) : (
              <SecurityLabRunner
                scenario={scenario}
                onComplete={(payload) => handleLabComplete(scenario.id, payload)}
                onStepSynced={(step: StepName) => dispatch({ type: "set-step", scenarioId: scenario.id, step })}
              />
            )
          ) : (
            <div className="service-state">
              <h3>这一关还没有解锁</h3>
              <p>{lab.unlockNote}。Lab 必须按顺序解锁，先完成上一关。</p>
            </div>
          )
        ) : null}
      </div>
    );
  }

  return (
    <div className="panel-stack sec-greenhouse">
      <header className="sec-greenhouse-head">
        <div
          className={`sec-greenhouse-art stage-${stage}`}
          role="img"
          aria-label={`安全温室当前状态：${stageCopy.label}`}
          style={{ backgroundPositionX: `${(GREENHOUSE_STAGE_FRAME[stage] / 2) * 100}%` }}
        />
        <div>
          <span>WEB3 安全温室 · {stageCopy.label}</span>
          <h2>web3world 安全温室</h2>
          <p>{stageCopy.detail}</p>
          <div className="sec-greenhouse-meta">
            <span>Lab {completion.done}/{completion.total}</span>
            <span>Final Audit {completion.finalAuditPassed ? "PASS" : "—"}</span>
            <span>{progress.badgeEligible ? "Passport 可领取" : "Passport 未满足"}</span>
          </div>
        </div>
      </header>

      <nav className="sec-tabs is-wrap" aria-label="安全温室功能">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            className={tab === entry.key ? "active" : ""}
            aria-current={tab === entry.key ? "page" : undefined}
            onClick={() => setTab(entry.key)}
          >
            {entry.label}
          </button>
        ))}
      </nav>

      {tab === "journey" && (
        <div className="panel-stack">
          <SecurityJourney stages={journeyStages} onSelect={handleJourneySelect} />
          <div className="sec-lab-cards">
            {LABS.map((lab, index) => {
              const passed = securityLabPassed(progress, index);
              const unlocked = lab.scenarioIds.some((id) => scenarioUnlocked(progress, id));
              return (
                <article key={lab.id} className={[passed ? "is-done" : "", unlocked ? "is-open" : "is-locked"].join(" ")}>
                  <b>{lab.title}</b>
                  <p>{lab.subtitle}</p>
                  <span>{passed ? "已完成" : unlocked ? "可以开始" : lab.unlockNote}</span>
                  <button
                    className="pixel-button secondary"
                    type="button"
                    onClick={() => setTab(lab.id)}
                  >
                    {passed ? "回顾这一关" : "进入关卡"}
                  </button>
                </article>
              );
            })}
          </div>
          <div className="inline-note">
            <span>✦</span>
            <p>
              安全 Rules Engine 用于教学型静态检查，结果不替代专业审计；所有靶场只使用平台内置教学合约，
              仅限测试网 / 本地沙箱，不接受任意真实协议作为攻击目标。
            </p>
          </div>
        </div>
      )}

      {tab === "web-security" && <WebSecurityTrainingPanel />}

      {(tab === "lab-1" || tab === "lab-2" || tab === "lab-3") && (
        <>
          {!contractHarvested && (
            <div className="feedback feedback-gentle" role="status">
              <span>✦</span>
              <p>建议先收获智能合约课程果实再挑战安全 Lab，课程知识会直接用到这里的代码阅读。</p>
            </div>
          )}
          {renderLab(LAB_INDEX_BY_TAB[tab as "lab-1" | "lab-2" | "lab-3"])}
        </>
      )}

      {tab === "signguard" && (
        <SignGuardPanel recentFishingTxHash={recentFishingTxHash} />
      )}

      {tab === "audit" && (
        <AuditReportPanel
          labsPassed={progress.labsPassed}
          replayPassed={securityLabPassed(progress, 0)}
          walletAddress={walletAddress}
          auditor={auditor}
          onAuditComplete={(payload) =>
            dispatch({
              type: "complete-audit",
              score: payload.score,
              passed: payload.passed,
              reportId: payload.reportId,
              reportHash: payload.reportHash,
              falsePositivePenalty: payload.falsePositivePenalty,
            })
          }
        />
      )}

      {tab === "passport" && (
        <SecurityPassportPanel
          contractHarvested={contractHarvested}
          labsPassed={progress.labsPassed}
          finalAuditPassed={progress.finalAudit.status === "passed"}
          finalScore={progress.finalAudit.score}
          reportHash={progress.finalAudit.reportHash}
          auditor={auditor}
          onMessage={onMessage}
        />
      )}

      {tab === "farmbot" && <FarmBotGuardianPanel />}
    </div>
  );
}
