"use client";

import { useMemo, useState } from "react";
import type { LabScenario } from "../../../lib/security/scenarios";
import {
  evaluateStep,
  STEP_LABELS,
  STEP_ORDER,
  type SessionState,
  type StepName,
} from "../../../lib/security/session-steps";
import type { SecurityLabStepAnswer } from "./types";
import { AttackTrace } from "./AttackTrace";
import { CodeDiff } from "./CodeDiff";

type Phase = StepName;

export function SecurityLabRunner({
  scenario,
  onComplete,
  onStepSynced,
}: {
  scenario: LabScenario;
  onComplete: (payload: {
    passed: boolean;
    score: number;
    answers: SecurityLabStepAnswer;
  }) => void;
  onStepSynced?: (step: StepName) => void;
}) {
  const [phase, setPhase] = useState<Phase>("identify");
  const [pickedLines, setPickedLines] = useState<number[]>([]);
  const [state, setState] = useState<SessionState>({});
  const [feedback, setFeedback] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const traceMax = useMemo(() => {
    const bank = scenario.trace.map((step) => step.bankBalance);
    const attacker = scenario.trace.map((step) => step.attackerBalance);
    return {
      bank: bank.length ? Math.max(...bank) : 1,
      attacker: attacker.length ? Math.max(...attacker) : 1,
    };
  }, [scenario.trace]);

  const patch = scenario.patchOptions.find((option) => option.id === state.patch?.patchId);
  const vulnerableSlice = scenario.code.slice(
    Math.max(0, (scenario.dangerLines[0] ?? 1) - 2),
    (scenario.dangerLines[scenario.dangerLines.length - 1] ?? 4) + 1,
  );

  function toggleLine(line: number) {
    if (phase !== "identify") return;
    setPickedLines((values) =>
      values.includes(line) ? values.filter((value) => value !== line) : [...values, line].sort((a, b) => a - b),
    );
  }

  function buildAnswers(final: SessionState): SecurityLabStepAnswer {
    return {
      lines: pickedLines,
      question: String(final.question?.answer ?? ""),
      followUp: String(final.followup?.answer ?? ""),
      patchId: String(final.patch?.patchId ?? ""),
    };
  }

  function submitStep(step: StepName, answer: Record<string, unknown>, next: Phase | null) {
    const evaluation = evaluateStep(scenario, step, answer, state);
    setState(evaluation.state);
    setFeedback(evaluation.feedback);
    setError(evaluation.ok ? null : "这一步还没有通过，可以再试一次。");
    onStepSynced?.(step);
    if (next) {
      setPhase(next);
      return;
    }
    onComplete({
      passed: evaluation.passed,
      score: evaluation.score,
      answers: buildAnswers(evaluation.state),
    });
  }

  function handleVerify() {
    const evaluation = evaluateStep(scenario, "verify", {}, state);
    setState(evaluation.state);
    setFeedback(evaluation.feedback);
    setError(evaluation.passed ? null : "回归没有通过，请返回选择正确的修复方案。");
    onStepSynced?.("verify");
    setPhase("verify");
    onComplete({
      passed: evaluation.passed,
      score: evaluation.score,
      answers: buildAnswers(evaluation.state),
    });
  }

  const stepIndex = STEP_ORDER.indexOf(phase);

  return (
    <div className="sec-lab">
      <header className="sec-lab-head">
        <div>
          <span>LAB · {scenario.category}</span>
          <h2>{scenario.title}</h2>
          <p>{scenario.brief}</p>
        </div>
        <div className="sec-lab-meta">
          <span>难度 {scenario.difficulty} / 4</span>
          <span>规则 {scenario.ruleId}</span>
          <span>版本 {scenario.scenarioVersion}</span>
        </div>
      </header>

      <ol className="sec-step-rail" aria-label="实验步骤">
        {STEP_ORDER.map((step, index) => (
          <li
            key={step}
            className={index < stepIndex ? "is-done" : index === stepIndex ? "is-active" : ""}
            aria-current={index === stepIndex ? "step" : undefined}
          >
            <span>{index < stepIndex ? "✓" : index + 1}</span>
            <b>{STEP_LABELS[step]}</b>
          </li>
        ))}
      </ol>

      <div className="sec-lab-columns">
        <section className="sec-code-panel" aria-label={`${scenario.contractName} 源码`}>
          <div className="sec-code-head">
            <b>{scenario.contractName}</b>
            <code>{scenario.contractAddress}</code>
          </div>
          <ol className="sec-code">
            {scenario.code.map((line, index) => {
              const lineNumber = index + 1;
              const picked = pickedLines.includes(lineNumber);
              const revealed = phase !== "identify" && scenario.dangerLines.includes(lineNumber);
              return (
                <li
                  key={lineNumber}
                  className={[
                    picked ? "is-picked" : "",
                    revealed ? "is-danger" : "",
                    phase === "identify" ? "is-clickable" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => toggleLine(lineNumber)}
                    disabled={phase !== "identify"}
                    aria-pressed={picked}
                  >
                    <span className="sec-line-no">{lineNumber}</span>
                    <code>{line}</code>
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="sec-code-hint">
            {phase === "identify"
              ? `目标：${scenario.objective}`
              : `危险行：${scenario.dangerLines.join(" / ")}（${scenario.ruleId}）`}
          </p>
        </section>

        <section className="sec-lab-stage">
          {phase === "identify" && (
            <>
              <h3>{STEP_LABELS.identify}</h3>
              <p>点击左侧可疑的代码行（可以多选），然后提交定位。</p>
              <div className="sec-picked">
                已选行：{pickedLines.length ? pickedLines.join(" / ") : "尚未选择"}
              </div>
              <button
                className="pixel-button primary wide"
                type="button"
                onClick={() => submitStep("identify", { lines: pickedLines }, "question")}
                disabled={pickedLines.length === 0}
              >
                提交定位并进入下一步
              </button>
            </>
          )}

          {phase === "question" && (
            <>
              <h3>{STEP_LABELS.question}</h3>
              <p className="sec-question">{scenario.identify.prompt}</p>
              <div className="sec-options">
                {scenario.identify.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={state.question?.answer === option.id ? "is-picked" : ""}
                    onClick={() => submitStep("question", { answer: option.id }, "followup")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {phase === "followup" && (
            <>
              <h3>{STEP_LABELS.followup}</h3>
              <p className="sec-question">{scenario.followUp.prompt}</p>
              <div className="sec-options">
                {scenario.followUp.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={state.followup?.answer === option.id ? "is-picked" : ""}
                    onClick={() => submitStep("followup", { answer: option.id }, "patch")}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {phase === "patch" && (
            <>
              <h3>{STEP_LABELS.patch}</h3>
              {scenario.trace.length > 0 && (
                <>
                  <p className="sec-question">
                    先看一次真实调用轨迹：漏洞是如何发生的？（{scenario.traceIntro}）
                  </p>
                  <AttackTrace
                    steps={scenario.trace}
                    intro={scenario.traceIntro}
                    maxBankBalance={traceMax.bank}
                    maxAttackerBalance={traceMax.attacker}
                  />
                </>
              )}
              <p className="sec-question">选择一个修复方案，然后运行回归验证。</p>
              <div className="sec-patch-list">
                {scenario.patchOptions.map((option) => (
                  <article key={option.id} className={state.patch?.patchId === option.id ? "is-picked" : ""}>
                    <b>{option.label}</b>
                    <p>{option.description}</p>
                    <pre>
                      {option.code.map((line, index) => (
                        <code key={index}>{line}</code>
                      ))}
                    </pre>
                    <button
                      className="pixel-button secondary"
                      type="button"
                      onClick={() => submitStep("patch", { patchId: option.id }, null)}
                    >
                      选择这个方案
                    </button>
                  </article>
                ))}
              </div>
              <button
                className="pixel-button primary wide"
                type="button"
                onClick={handleVerify}
                disabled={!state.patch}
              >
                ▶ REPLAY ATTACK / 运行回归验证
              </button>
            </>
          )}

          {phase === "verify" && (
            <>
              <h3>{STEP_LABELS.verify}</h3>
              {scenario.trace.length > 0 && (
                <CodeDiff before={vulnerableSlice} after={patch?.code ?? []} />
              )}
              <div className={`sec-verdict ${state.verify?.ok ? "is-pass" : "is-fail"}`}>
                <b>{state.verify?.ok ? "ATTACK BLOCKED" : "ATTACK SUCCEEDED"}</b>
                <p>{state.verify?.ok ? "Bank balance protected" : "Vault 余额被重复提取"}</p>
                <span>Regression Test {state.verify?.ok ? "PASS" : "FAIL"}</span>
              </div>
              <div className="sec-lab-feedback">{scenario.verifyNote}</div>
            </>
          )}

          {feedback.length > 0 && (
            <div className={`feedback ${error ? "feedback-gentle" : "feedback-success"}`} role="status">
              <span>{error ? "✦" : "✓"}</span>
              <div>
                {feedback.map((line) => (
                  <p key={line}>{line}</p>
                ))}
              </div>
            </div>
          )}
          {error && <p className="sec-quiet">{error}</p>}
        </section>
      </div>
    </div>
  );
}
