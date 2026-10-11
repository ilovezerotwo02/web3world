// =============================================================================
// 安全实验步骤状态机（服务端与前端共用同一份确定性逻辑）
// 步骤顺序固定：identify → question → followup → patch → verify
// =============================================================================

import { type LabScenario } from "./scenarios";
import { linesOverlap, replayAttack } from "./scoring";

export const STEP_ORDER = ["identify", "question", "followup", "patch", "verify"] as const;
export type StepName = (typeof STEP_ORDER)[number];

export type SessionState = {
  identify?: { lines: number[]; ok: boolean };
  question?: { answer: string; ok: boolean };
  followup?: { answer: string; ok: boolean };
  patch?: { patchId: string; ok: boolean };
  verify?: { replayPassed: boolean; ok: boolean };
};

export type StepEvaluation = {
  step: StepName;
  ok: boolean;
  points: number;
  maxPoints: number;
  score: number;
  feedback: string[];
  complete: boolean;
  passed: boolean;
  nextStep: StepName | null;
  state: SessionState;
  replay?: ReturnType<typeof replayAttack>;
};

const STEP_POINTS: Record<StepName, number> = {
  identify: 30,
  question: 25,
  followup: 10,
  patch: 20,
  verify: 15,
};

export function nextStepAfter(step: StepName): StepName | null {
  const index = STEP_ORDER.indexOf(step);
  return index >= 0 && index < STEP_ORDER.length - 1 ? STEP_ORDER[index + 1] : null;
}

export function evaluateStep(
  scenario: LabScenario,
  step: StepName,
  answer: Record<string, unknown>,
  prior: SessionState = {},
): StepEvaluation {
  const state: SessionState = {
    identify: prior.identify ? { ...prior.identify } : undefined,
    question: prior.question ? { ...prior.question } : undefined,
    followup: prior.followup ? { ...prior.followup } : undefined,
    patch: prior.patch ? { ...prior.patch } : undefined,
    verify: prior.verify ? { ...prior.verify } : undefined,
  };
  const feedback: string[] = [];
  let ok = false;
  let replay: ReturnType<typeof replayAttack> | undefined;

  switch (step) {
    case "identify": {
      const lines = Array.isArray(answer.lines)
        ? (answer.lines as unknown[]).map((value) => Number(value)).filter((value) => Number.isFinite(value))
        : [];
      ok = linesOverlap(lines, scenario.dangerLines);
      state.identify = { lines, ok };
      feedback.push(
        ok
          ? `定位正确：命中危险行 ${scenario.dangerLines.join(" / ")}。`
          : `还需要继续找：危险行位于 ${scenario.dangerLines.join(" / ")}。`,
      );
      break;
    }
    case "question": {
      const value = typeof answer.answer === "string" ? answer.answer : "";
      ok = value === scenario.identify.correct;
      state.question = { answer: value, ok };
      feedback.push(ok ? scenario.identify.success : scenario.identify.failure);
      break;
    }
    case "followup": {
      const value = typeof answer.answer === "string" ? answer.answer : "";
      ok = value === scenario.followUp.correct;
      state.followup = { answer: value, ok };
      feedback.push(ok ? scenario.followUp.success : scenario.followUp.failure);
      break;
    }
    case "patch": {
      const patchId = typeof answer.patchId === "string" ? answer.patchId : "";
      const patch = scenario.patchOptions.find((option) => option.id === patchId);
      ok = Boolean(patch?.correct);
      state.patch = { patchId, ok };
      feedback.push(patch ? patch.feedback : "请选择一个修复方案。");
      if (patch && !patch.correct) {
        feedback.push("可以再选一次：修改会被记录，但只有正确方案才能通过。");
      }
      break;
    }
    case "verify": {
      // 服务端不信任客户端传入的 replayPassed，直接用 patch 正确性推导
      const patched = Boolean(state.patch?.ok);
      replay = replayAttack(patched);
      ok = replay.blocked;
      state.verify = { replayPassed: replay.blocked, ok };
      feedback.push(replay.headline);
      feedback.push(replay.detail);
      feedback.push(`Regression Test ${replay.regression}`);
      break;
    }
    default:
      feedback.push("未知步骤。");
  }

  const score =
    (state.identify?.ok ? STEP_POINTS.identify : 0) +
    (state.question?.ok ? STEP_POINTS.question : 0) +
    (state.followup?.ok ? STEP_POINTS.followup : 0) +
    (state.patch?.ok ? STEP_POINTS.patch : 0) +
    (state.verify?.ok ? STEP_POINTS.verify : 0);

  const complete = Boolean(state.verify);
  const passed = complete && score >= 70;

  return {
    step,
    ok,
    points: ok ? STEP_POINTS[step] : 0,
    maxPoints: STEP_POINTS[step],
    score,
    feedback,
    complete,
    passed,
    nextStep: nextStepAfter(step),
    state,
    replay,
  };
}

/** 供 UI 展示的步骤标题 */
export const STEP_LABELS: Record<StepName, string> = {
  identify: "1 · 找出危险代码行",
  question: "2 · 判断漏洞成因",
  followup: "3 · 边界追问",
  patch: "4 · 选择修复方案",
  verify: "5 · 回归验证",
};
