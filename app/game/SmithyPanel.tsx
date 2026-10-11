"use client";

import { useState } from "react";
import {
  FORGE_ITEMS,
  getForgeItem,
  type ForgeAction,
  type ForgeItem,
  type ForgeState,
} from "./forge";

function ForgeItemArt({ item, compact = false }: { item: ForgeItem; compact?: boolean }) {
  return (
    <span className={`forge-item-art ${item.artClass} ${compact ? "is-compact" : ""}`} aria-hidden="true">
      <i />
      <b />
    </span>
  );
}

export function SmithyPanel({
  state,
  dispatch,
  onMessage,
}: {
  state: ForgeState;
  dispatch: (action: ForgeAction) => void;
  onMessage: (message: string, tone?: "success" | "warning" | "info") => void;
}) {
  const [selectedId, setSelectedId] = useState(FORGE_ITEMS[0].id);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<"correct" | "wrong" | null>(null);
  const selected = getForgeItem(selectedId) ?? FORGE_ITEMS[0];
  const isUnlocked = state.unlocked.includes(selected.id);

  function selectRecipe(itemId: string) {
    setSelectedId(itemId);
    setAnswer("");
    setFeedback(null);
  }

  function answerQuestion() {
    if (isUnlocked) {
      onMessage(`${selected.name}已经锻造完成，先到装备架穿上它。`, "info");
      return;
    }
    if (!answer) {
      setFeedback("wrong");
      onMessage("先选择一个 Web3 判断。", "warning");
      return;
    }
    if (answer !== selected.question.answer) {
      setFeedback("wrong");
      onMessage("火星熄了一点：这个判断还需要再想一遍。", "warning");
      return;
    }
    dispatch({ type: "forge", itemId: selected.id });
    setFeedback("correct");
    setAnswer("");
    onMessage(`${selected.name}锻造完成，已经放入装备架。`, "success");
  }

  return (
    <div className="panel-stack smithy-panel">
      <SectionTitle />
      <div className="smithy-hero">
        <div className="smithy-anvil" aria-hidden="true"><span /><i /><b /></div>
        <div>
          <span>WEB3WORLD · IRONWORKS</span>
          <h1>铁匠铺 · 把判断锻成装备</h1>
          <p>回答 Web3 知识题，亲手打造一件能提醒你检查网络、权限和外部调用的像素装备。装备可以随时穿上或脱下。</p>
        </div>
        <div className="smithy-score"><b>{state.unlocked.length}</b><span>/ {FORGE_ITEMS.length}</span><small>已锻造</small></div>
      </div>

      <div className="smithy-workbench">
        <div className="smithy-recipes">
          <header><span>锻造图纸</span><b>先选一件装备</b></header>
          {FORGE_ITEMS.map((item) => {
            const unlocked = state.unlocked.includes(item.id);
            return (
              <button
                key={item.id}
                className={`smithy-recipe ${selected.id === item.id ? "is-selected" : ""} ${unlocked ? "is-forged" : ""}`}
                onClick={() => selectRecipe(item.id)}
              >
                <ForgeItemArt item={item} compact />
                <span><b>{item.name}</b><small>{item.slotLabel} · {unlocked ? "已锻造" : "待回答"}</small></span>
                <i aria-hidden="true">{unlocked ? "✓" : "?"}</i>
              </button>
            );
          })}
        </div>

        <section className={`smithy-question ${feedback ? `is-${feedback}` : ""}`} aria-label={`${selected.name}锻造问题`}>
          <div className="smithy-question-head">
            <span>{selected.material} · {selected.slotLabel}</span>
            <b>{isUnlocked ? "图纸已完成" : "知识淬火"}</b>
          </div>
          <ForgeItemArt item={selected} />
          <h2>{selected.name}</h2>
          <p>{selected.description}</p>
          {!isUnlocked ? (
            <>
              <div className="smithy-question-copy"><b>{selected.question.prompt}</b><small>{selected.question.hint}</small></div>
              <div className="smithy-options" role="radiogroup" aria-label={`${selected.name}答案`}>
                {selected.question.options.map((option) => (
                  <button
                    key={option.id}
                    className={answer === option.id ? "is-selected" : ""}
                    role="radio"
                    aria-checked={answer === option.id}
                    onClick={() => {
                      setAnswer(option.id);
                      setFeedback(null);
                    }}
                  >
                    <span>{answer === option.id ? "◆" : "◇"}</span>{option.label}
                  </button>
                ))}
              </div>
              <button className="pixel-button primary wide" onClick={answerQuestion}>回答并锻造</button>
            </>
          ) : (
            <div className="smithy-forged-note">
              <b>锻造完成 · {selected.bonus}</b>
              <small>装备会保存到本地装备架，不会请求钱包、私钥或助记词。</small>
            </div>
          )}
        </section>
      </div>

      <section className="smithy-equipment-rack">
        <header>
          <div><span>装备架</span><h2>穿上你的 Web3 防护套装</h2></div>
          <small>每个部位只能装备一件</small>
        </header>
        <div className="smithy-equipped-grid">
          {(["head", "body", "tool"] as const).map((slot) => {
            const itemId = state.equipped[slot];
            const item = itemId ? getForgeItem(itemId) : null;
            return (
              <article className={`smithy-equipped-slot ${item ? "is-equipped" : ""}`} key={slot}>
                <span className="smithy-slot-label">{slot === "head" ? "头部" : slot === "body" ? "身体" : "工具"}</span>
                {item ? <ForgeItemArt item={item} compact /> : <span className="smithy-empty-slot">空</span>}
                <div><b>{item?.name ?? "还没有装备"}</b><small>{item?.bonus ?? "先在左侧图纸区锻造"}</small></div>
                {item ? (
                  <button className="pixel-button ghost" onClick={() => dispatch({ type: "unequip", slot })}>脱下</button>
                ) : (
                  <button className="pixel-button ghost" onClick={() => {
                    const candidate = FORGE_ITEMS.find((forgeItem) => forgeItem.slot === slot && state.unlocked.includes(forgeItem.id));
                    if (candidate) dispatch({ type: "equip", itemId: candidate.id });
                    else onMessage("这个部位还没有完成对应图纸。", "info");
                  }}>自动装备</button>
                )}
              </article>
            );
          })}
        </div>
        <div className="smithy-inventory">
          {FORGE_ITEMS.filter((item) => state.unlocked.includes(item.id)).map((item) => (
            <div className="smithy-inventory-item" key={item.id}>
              <ForgeItemArt item={item} compact />
              <span><b>{item.name}</b><small>{state.equipped[item.slot] === item.id ? "已穿上" : "在装备架"}</small></span>
              <button className="pixel-button ghost" onClick={() => dispatch({ type: "equip", itemId: item.id })}>穿上</button>
            </div>
          ))}
          {state.unlocked.length === 0 && <p className="quiet-note">回答第一张图纸，装备架就会亮起。</p>}
        </div>
      </section>
    </div>
  );
}

function SectionTitle() {
  return (
    <header className="section-title">
      <div><span>地图地点 · 独立功能建筑</span><h1>铁匠铺</h1></div>
      <span className="pill pill-gold">Web3 知识锻造</span>
    </header>
  );
}
