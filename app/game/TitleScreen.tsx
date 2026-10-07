"use client";

import { useEffect, useRef } from "react";

type TitleScreenProps = {
  menuOpen: boolean;
  restartConfirmOpen: boolean;
  hydrated: boolean;
  hasSavedJourney: boolean;
  courseLabel: string;
  nextActionLabel: string;
  onRevealMenu: () => void;
  onStart: () => void;
  onContinue: () => void;
  onRequestRestart: () => void;
  onCancelRestart: () => void;
  onConfirmRestart: () => void;
  onExit: () => void;
};

export function TitleScreen({
  menuOpen,
  restartConfirmOpen,
  hydrated,
  hasSavedJourney,
  courseLabel,
  nextActionLabel,
  onRevealMenu,
  onStart,
  onContinue,
  onRequestRestart,
  onCancelRestart,
  onConfirmRestart,
  onExit,
}: TitleScreenProps) {
  const screenRef = useRef<HTMLElement>(null);
  const menuRef = useRef<HTMLElement>(null);
  const confirmRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (restartConfirmOpen) {
      confirmRef.current?.querySelector<HTMLButtonElement>("[data-autofocus]")?.focus();
      return;
    }
    if (menuOpen) {
      menuRef.current?.querySelector<HTMLButtonElement>("button:not([disabled])")?.focus();
      return;
    }
    screenRef.current?.focus();
  }, [menuOpen, restartConfirmOpen]);

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      if (restartConfirmOpen) onCancelRestart();
      else if (menuOpen) onExit();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [menuOpen, onCancelRestart, onExit, restartConfirmOpen]);

  function revealFromKeyboard(event: React.KeyboardEvent<HTMLElement>) {
    if (menuOpen || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    onRevealMenu();
  }

  return (
    <section
      ref={screenRef}
      className={`title-screen ${menuOpen ? "is-menu-open" : ""}`}
      aria-label="Monad 像素农场标题画面"
      tabIndex={-1}
      onClick={() => {
        if (!menuOpen && hydrated) onRevealMenu();
      }}
      onKeyDown={revealFromKeyboard}
    >
      <div className="title-sky-glow" aria-hidden="true" />
      <div className="title-wordmark" aria-label="MONAD 像素农场">
        <span className="title-gem" aria-hidden="true">M</span>
        <div>
          <small>LEARN · GROW · VERIFY</small>
          <h1>MONAD</h1>
          <b>像素农场</b>
        </div>
      </div>

      <div className="title-world-caption">
        <span>知识会发芽，验证会结果</span>
        <p>在一座可探索的像素农场里学习 Web3、Monad 与智能合约。</p>
      </div>

      <span className="title-farmer" aria-hidden="true" />

      {!menuOpen && (
        <button
          className="title-enter-prompt"
          type="button"
          disabled={!hydrated}
          onClick={(event) => {
            event.stopPropagation();
            onRevealMenu();
          }}
        >
          <span aria-hidden="true">✦</span>
          {hydrated ? "点击空白处开始" : "正在读取农场记录…"}
        </button>
      )}

      {menuOpen && (
        <section
          ref={menuRef}
          className="title-menu-capsule"
          role="dialog"
          aria-modal="true"
          aria-label="学习主菜单"
          onClick={(event) => event.stopPropagation()}
        >
          <header>
            <div><span>农场记录</span><b>{hasSavedJourney ? courseLabel : "新的旅程"}</b></div>
            <p>{hasSavedJourney ? `下一步 · ${nextActionLabel}` : "从第 1 格 Web3 通识课程田开始播种。"}</p>
          </header>
          <div className="title-menu-actions">
            <button className="is-primary" type="button" onClick={onStart}>
              <span aria-hidden="true">▶</span><b>开始学习</b><small>{hasSavedJourney ? "保留进度，自由进入农场" : "进入农场创建第一份记录"}</small>
            </button>
            <button type="button" disabled={!hasSavedJourney} onClick={onContinue}>
              <span aria-hidden="true">➜</span><b>继续学习</b><small>{hasSavedJourney ? "自动带路到当前任务" : "完成首次学习后开放"}</small>
            </button>
            <button className="is-danger" type="button" onClick={onRequestRestart}>
              <span aria-hidden="true">↻</span><b>重新学习</b><small>清空本地记录，从第 1 格开始</small>
            </button>
            <button type="button" onClick={onExit}>
              <span aria-hidden="true">×</span><b>退出学习</b><small>返回纯标题画面</small>
            </button>
          </div>
          <footer><kbd>Enter</kbd> 选择　<kbd>Esc</kbd> 返回标题</footer>
        </section>
      )}

      {restartConfirmOpen && (
        <div className="title-confirm-backdrop" role="presentation" onClick={onCancelRestart}>
          <section
            ref={confirmRef}
            className="title-restart-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="title-restart-heading"
            aria-describedby="title-restart-description"
            onClick={(event) => event.stopPropagation()}
          >
            <span aria-hidden="true">!</span>
            <div>
              <h2 id="title-restart-heading">确认重新学习？</h2>
              <p id="title-restart-description">课程、田地、钓鱼图鉴和人物位置的本地记录都会清空，这个操作无法撤销。</p>
            </div>
            <div className="title-confirm-actions">
              <button data-autofocus type="button" onClick={onCancelRestart}>保留记录</button>
              <button className="is-danger" type="button" onClick={onConfirmRestart}>确认重新开始</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
