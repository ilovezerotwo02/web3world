"use client";

/** Before / After 修复对比（教学用最小 Diff 视图） */
export function CodeDiff({
  before,
  after,
  title = "修复 Diff",
}: {
  before: string[];
  after: string[];
  title?: string;
}) {
  return (
    <div className="sec-diff" aria-label={title}>
      <div className="sec-diff-head">
        <span>❌ Before（危险）</span>
        <span>✅ After（修复）</span>
      </div>
      <div className="sec-diff-body">
        <pre className="is-before">
          {before.map((line, index) => (
            <code key={`before-${index}`} className="is-removed">{`- ${line}`}</code>
          ))}
        </pre>
        <pre className="is-after">
          {after.map((line, index) => (
            <code key={`after-${index}`} className="is-added">{`+ ${line}`}</code>
          ))}
        </pre>
      </div>
    </div>
  );
}
