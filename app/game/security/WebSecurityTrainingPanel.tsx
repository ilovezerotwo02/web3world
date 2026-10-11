"use client";

import { useState } from "react";
import {
  WEB_SECURITY_SCENARIOS,
  type WebSecurityScenario,
} from "../../../lib/security/web-scenarios";

const SEVERITY_LABEL: Record<WebSecurityScenario["severity"], string> = {
  MEDIUM: "中风险",
  HIGH: "高风险",
  CRITICAL: "严重风险",
};

export function WebSecurityTrainingPanel() {
  const [selectedId, setSelectedId] = useState<WebSecurityScenario["id"]>("xss-reflected");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const selected = WEB_SECURITY_SCENARIOS.find((scenario) => scenario.id === selectedId) ?? WEB_SECURITY_SCENARIOS[0];
  const answerId = answers[selected.id];
  const selectedOption = selected.options.find((option) => option.id === answerId);
  const completedCount = Object.values(completed).filter(Boolean).length;

  function chooseAnswer(optionId: string) {
    const option = selected.options.find((entry) => entry.id === optionId);
    if (!option) return;
    setAnswers((current) => ({ ...current, [selected.id]: optionId }));
    if (option.correct) {
      setCompleted((current) => ({ ...current, [selected.id]: true }));
    }
  }

  return (
    <section className="sec-web-training" aria-label="Web 安全训练场">
      <header className="sec-web-head">
        <div>
          <span>WEB SECURITY TRAINING</span>
          <h2>Web 安全训练场</h2>
          <p>
            这条路线专门训练 Web 应用边界：输入、会话、授权、数据库和服务器出站请求。
            所有题目都是本地模拟，不会向真实目标发送请求。
          </p>
        </div>
        <div className="sec-web-progress" aria-label={`已完成 ${completedCount}/${WEB_SECURITY_SCENARIOS.length} 个 Web 安全主题`}>
          <b>{completedCount}/{WEB_SECURITY_SCENARIOS.length}</b>
          <span>主题已掌握</span>
        </div>
      </header>

      <div className="sec-web-topic-list" role="tablist" aria-label="Web 安全主题">
        {WEB_SECURITY_SCENARIOS.map((scenario) => (
          <button
            key={scenario.id}
            type="button"
            role="tab"
            aria-selected={scenario.id === selected.id}
            className={scenario.id === selected.id ? "is-active" : ""}
            onClick={() => setSelectedId(scenario.id)}
          >
            <span>{completed[scenario.id] ? "✓" : "0"}</span>
            <b>{scenario.title}</b>
            <small>{scenario.category}</small>
          </button>
        ))}
      </div>

      <article className="sec-web-case">
        <header className="sec-web-case-head">
          <div>
            <span>{selected.category} · {SEVERITY_LABEL[selected.severity]}</span>
            <h3>{selected.title}</h3>
            <p>{selected.summary}</p>
          </div>
          <code>{selected.request}</code>
        </header>

        <div className="sec-web-grid">
          <div className="sec-web-column">
            <h4>1 · 找到危险信号</h4>
            <p>{selected.goal}</p>
            <div className="sec-web-signal">
              <b>观察到</b>
              <span>{selected.signal}</span>
            </div>
            <pre><code>{selected.codeBefore.join("\n")}</code></pre>
          </div>
          <div className="sec-web-column">
            <h4>2 · 修复边界</h4>
            <p><b>根因：</b>{selected.rootCause}</p>
            <p><b>影响：</b>{selected.impact}</p>
            <div className="sec-web-fix">
              <b>修复方向</b>
              <span>{selected.fix}</span>
            </div>
            <pre className="is-safe"><code>{selected.codeAfter.join("\n")}</code></pre>
          </div>
        </div>

        <div className="sec-web-verify">
          <h4>3 · 回归验证</h4>
          <p>{selected.verify}</p>
          <fieldset>
            <legend>{selected.question}</legend>
            <div className="sec-web-options">
              {selected.options.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={[
                    answerId === option.id ? "is-picked" : "",
                    answerId === option.id && option.correct ? "is-correct" : "",
                    answerId === option.id && !option.correct ? "is-wrong" : "",
                  ].filter(Boolean).join(" ")}
                  onClick={() => chooseAnswer(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </fieldset>
          {selectedOption && (
            <div className={selectedOption.correct ? "sec-web-result is-pass" : "sec-web-result is-fail"} role="status">
              <b>{selectedOption.correct ? "VERIFY PASS" : "再检查一次边界"}</b>
              <span>{selectedOption.feedback}</span>
            </div>
          )}
        </div>
      </article>

      <footer className="sec-web-boundary">
        <b>训练边界</b>
        <span>只展示安全模拟代码；不提供真实目标、真实凭据或外部探测入口。Web 安全知识与链上安全实验分开判定。</span>
      </footer>
    </section>
  );
}
