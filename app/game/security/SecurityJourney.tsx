"use client";

export type JourneyStage = {
  key: "learn" | "break" | "fix" | "guard" | "prove";
  label: string;
  title: string;
  detail: string;
  done: boolean;
  active: boolean;
};

/** Learn → Break → Fix → Guard → Prove 五步旅程导航 */
export function SecurityJourney({
  stages,
  onSelect,
}: {
  stages: JourneyStage[];
  onSelect: (key: JourneyStage["key"]) => void;
}) {
  return (
    <ol className="sec-journey" aria-label="安全学习旅程">
      {stages.map((stage, index) => (
        <li key={stage.key} className={[stage.done ? "is-done" : "", stage.active ? "is-active" : ""].filter(Boolean).join(" ")}>
          <button type="button" onClick={() => onSelect(stage.key)} aria-current={stage.active ? "step" : undefined}>
            <span className="sec-journey-index">{stage.done ? "✓" : index + 1}</span>
            <b>{stage.label}</b>
            <small>{stage.title}</small>
            <em>{stage.detail}</em>
          </button>
        </li>
      ))}
    </ol>
  );
}
