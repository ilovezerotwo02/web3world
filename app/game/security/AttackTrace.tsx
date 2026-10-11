"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

export type AttackTraceStepView = {
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

/**
 * Attack Trace 播放器：固定步骤顺序，展示调用深度、调用方、被调用方、
 * 转账金额、两侧余额以及状态是否已更新。
 */
export function AttackTrace({
  steps,
  intro,
  maxBankBalance,
  maxAttackerBalance,
}: {
  steps: AttackTraceStepView[];
  intro: string;
  maxBankBalance: number;
  maxAttackerBalance: number;
}) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const current = steps[Math.min(cursor, steps.length - 1)];

  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => {
      setCursor((value) => {
        if (value >= steps.length - 1) {
          setPlaying(false);
          return value;
        }
        return value + 1;
      });
    }, 620);
    return () => window.clearTimeout(timer);
  }, [playing, cursor, steps.length]);

  const reset = useCallback(() => {
    setPlaying(false);
    setCursor(0);
  }, []);

  const bankWidth = useMemo(
    () => (maxBankBalance === 0 ? 0 : (current.bankBalance / maxBankBalance) * 100),
    [current.bankBalance, maxBankBalance],
  );
  const attackerWidth = useMemo(
    () => (maxAttackerBalance === 0 ? 0 : (current.attackerBalance / maxAttackerBalance) * 100),
    [current.attackerBalance, maxAttackerBalance],
  );

  return (
    <div className="sec-trace" aria-label="攻击回放调用轨迹">
      <div className="sec-trace-head">
        <div>
          <span>ATTACK TRACE</span>
          <b>
            STEP {current.index + 1} / {steps.length}
          </b>
        </div>
        <div className="sec-trace-actions">
          <button className="pixel-button ghost" onClick={reset} type="button">
            ↺ 重置
          </button>
          <button
            className="pixel-button secondary"
            type="button"
            onClick={() => setPlaying((value) => !value)}
            disabled={cursor >= steps.length - 1 && !playing}
          >
            {playing ? "⏸ 暂停" : "▶ 播放回放"}
          </button>
          <button
            className="pixel-button primary"
            type="button"
            onClick={() => setCursor((value) => Math.min(steps.length - 1, value + 1))}
            disabled={cursor >= steps.length - 1}
          >
            下一步 →
          </button>
        </div>
      </div>

      <p className="sec-trace-intro">{intro}</p>

      <div className="sec-trace-grid">
        <dl className="sec-trace-stats">
          <div>
            <dt>CALL DEPTH</dt>
            <dd>{current.depth}</dd>
          </div>
          <div>
            <dt>CALLER</dt>
            <dd>{current.caller}</dd>
          </div>
          <div>
            <dt>CALLEE</dt>
            <dd>{current.callee}</dd>
          </div>
          <div>
            <dt>VALUE</dt>
            <dd>{current.valueMon} ETH</dd>
          </div>
          <div>
            <dt>BANK BALANCE</dt>
            <dd>{current.bankBalance} ETH</dd>
          </div>
          <div>
            <dt>ATTACKER BALANCE</dt>
            <dd>{current.attackerBalance} ETH</dd>
          </div>
          <div className={current.stateUpdated ? "is-safe" : "is-danger"}>
            <dt>STATE UPDATED ?</dt>
            <dd>{current.stateUpdated ? "YES" : "NO"}</dd>
          </div>
        </dl>

        <div className="sec-trace-balances">
          <div className="sec-balance-row">
            <span>Vault</span>
            <div className="sec-balance-bar">
              <i className="is-vault" style={{ width: `${bankWidth}%` }} />
            </div>
            <b>{current.bankBalance} ETH</b>
          </div>
          <div className="sec-balance-row">
            <span>Attacker</span>
            <div className="sec-balance-bar">
              <i className="is-attacker" style={{ width: `${attackerWidth}%` }} />
            </div>
            <b>{current.attackerBalance} ETH</b>
          </div>
          <p className="sec-trace-note">{current.note}</p>
        </div>
      </div>

      <ol className="sec-trace-log">
        {steps.slice(0, cursor + 1).map((step) => (
          <li
            key={step.index}
            className={step.index === cursor ? "is-current" : ""}
            style={{ paddingLeft: 8 + step.depth * 14 }}
          >
            <span>#{step.index + 1}</span>
            <code>
              {step.caller} → {step.callee}
            </code>
            {step.valueMon !== "0" && <em>+{step.valueMon} ETH</em>}
          </li>
        ))}
      </ol>
    </div>
  );
}
