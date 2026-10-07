"use client";

import { useEffect, useRef, useState } from "react";
import {
  FISH_SPECIES,
  createDemoFishingReceipt,
  fishForCast,
  hashChoices,
  hashSuffix,
  recordFishingCatch,
  type FishSpecies,
  type FishingProgress,
  type FishingReceipt,
} from "./fishing";
import {
  FISHING_CHAIN,
  connectFishingWallet,
  fishingTransactionUrl,
  fishingWalletErrorMessage,
  formatFishingWalletAddress,
  hasInjectedFishingWallet,
  performRealFishingCast,
  readConnectedFishingWallet,
  switchFishingWalletToMonad,
  watchFishingWallet,
  type FishingWalletSnapshot,
} from "./fishing-chain";

type FishingPhase = "idle" | "casting" | "pending" | "verify" | "caught";

type FishingPanelProps = {
  progress: FishingProgress;
  onProgress: (progress: FishingProgress) => void;
  onMessage: (message: string, tone?: "success" | "warning" | "info") => void;
};

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function FishSprite({ fish, locked = false }: { fish: FishSpecies; locked?: boolean }) {
  return (
    <span
      className={`fish-sprite fish-${fish.id} ${locked ? "is-locked" : ""}`}
      role="img"
      aria-label={locked ? `尚未发现的鱼类，线索：${fish.eyebrow}` : fish.name}
    >
      {/* Pixel sprites must preserve nearest-neighbor rendering and bypass image optimization. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={fish.spriteSrc} alt="" draggable={false} />
    </span>
  );
}

export function FishingPanel({ progress, onProgress, onMessage }: FishingPanelProps) {
  const [tab, setTab] = useState<"pond" | "book">("pond");
  const [phase, setPhase] = useState<FishingPhase>("idle");
  const [fish, setFish] = useState<FishSpecies>(() => fishForCast(progress.totalCatches));
  const [receipt, setReceipt] = useState<FishingReceipt | null>(null);
  const [broadcastHash, setBroadcastHash] = useState("");
  const [selectedHash, setSelectedHash] = useState("");
  const [error, setError] = useState("");
  const [confirmReal, setConfirmReal] = useState(false);
  const [walletAvailable, setWalletAvailable] = useState<boolean | null>(null);
  const [walletPending, setWalletPending] = useState(false);
  const [wallet, setWallet] = useState<FishingWalletSnapshot | null>(null);
  const [insightPassed, setInsightPassed] = useState(false);
  const runTokenRef = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const unlocked = FISH_SPECIES.filter((entry) => progress.collection[entry.id].count > 0).length;
  const completion = Math.round((unlocked / FISH_SPECIES.length) * 100);
  const nextFish = fishForCast(progress.totalCatches);

  useEffect(() => {
    panelRef.current?.closest<HTMLElement>(".drawer-scroll")?.scrollTo({ top: 0 });
  }, [tab]);

  useEffect(() => {
    let active = true;
    async function refreshWallet() {
      const available = hasInjectedFishingWallet();
      if (!active) return;
      setWalletAvailable(available);
      if (!available) {
        setWallet(null);
        return;
      }
      try {
        const nextWallet = await readConnectedFishingWallet();
        if (active) setWallet(nextWallet);
      } catch {
        if (active) setWallet(null);
      }
    }
    void refreshWallet();
    const stopWatching = watchFishingWallet(() => void refreshWallet());
    return () => {
      active = false;
      stopWatching();
    };
  }, []);

  async function connectWallet() {
    setWalletPending(true);
    setError("");
    try {
      const nextWallet = await connectFishingWallet();
      setWallet(nextWallet);
      onMessage("钱包已连接，请核对网络后开始链上垂钓。", "success");
    } catch (caught) {
      const message = fishingWalletErrorMessage(caught, "钱包连接没有完成。");
      setError(message);
      onMessage(message, "warning");
    } finally {
      setWalletPending(false);
    }
  }

  async function switchWalletNetwork() {
    setWalletPending(true);
    setError("");
    try {
      const nextWallet = await switchFishingWalletToMonad();
      setWallet(nextWallet);
      onMessage(`钱包已切换到 ${FISHING_CHAIN.name}。`, "success");
    } catch (caught) {
      const message = fishingWalletErrorMessage(caught, "网络切换没有完成。");
      setError(message);
      onMessage(message, "warning");
    } finally {
      setWalletPending(false);
    }
  }

  function prepareCast() {
    const nextFish = fishForCast(progress.totalCatches);
    setFish(nextFish);
    setReceipt(null);
    setBroadcastHash("");
    setSelectedHash("");
    setInsightPassed(false);
    setError("");
    return nextFish;
  }

  async function startDemoCast() {
    prepareCast();
    const token = ++runTokenRef.current;
    setPhase("casting");
    await wait(620);
    if (token !== runTokenRef.current) return;
    setPhase("pending");
    await wait(980);
    if (token !== runTokenRef.current) return;
    const nextReceipt = createDemoFishingReceipt(progress.totalCatches);
    setReceipt(nextReceipt);
    setBroadcastHash(nextReceipt.txHash);
    setPhase("verify");
  }

  async function startRealCast() {
    if (!wallet) {
      setConfirmReal(false);
      setError("请先连接钱包账户。");
      return;
    }
    prepareCast();
    setConfirmReal(false);
    setPhase("casting");
    try {
      const nextReceipt = await performRealFishingCast(wallet.address, (hash) => {
        setBroadcastHash(hash);
        setPhase("pending");
      });
      setReceipt(nextReceipt);
      setPhase("verify");
    } catch (caught) {
      const message = fishingWalletErrorMessage(caught, "真实交易没有完成。");
      setError(message);
      setPhase("idle");
      onMessage(message, "warning");
    }
  }

  function verifyHash(choice: string) {
    if (!receipt) return;
    setSelectedHash(choice);
    if (choice !== hashSuffix(receipt.txHash)) {
      setError("这段哈希不属于当前回执，再对照一次末 6 位。");
      return;
    }
    const next = recordFishingCatch(progress, fish.id, receipt);
    onProgress(next);
    setError("");
    setPhase("caught");
    onMessage(`${fish.name}已经收入图鉴`, "success");
  }

  function resetCast() {
    runTokenRef.current += 1;
    setPhase("idle");
    setReceipt(null);
    setBroadcastHash("");
    setSelectedHash("");
    setError("");
    setInsightPassed(false);
  }

  return (
    <div className="panel-stack fishing-panel" ref={panelRef}>
      <div className="fishing-heading">
        <div><span>池塘实践区 · 十种鱼类</span><h1>把交易确认变成一次垂钓</h1><p>普通练习不消耗 Gas；真实练习只会在你二次确认后请求钱包签名。</p></div>
        <div className="fishing-count"><b>{progress.totalCatches}</b><span>总渔获</span></div>
      </div>

      <div className="fishing-collection-progress" aria-label={`鱼类图鉴完成 ${completion}%`}>
        <div><span>图鉴进度</span><b>{unlocked} / {FISH_SPECIES.length}</b></div>
        <i><span style={{ width: `${completion}%` }} /></i>
        <small>{unlocked === FISH_SPECIES.length ? "十种鱼类已经全部发现" : `下一条线索 · ${nextFish.eyebrow}`}</small>
      </div>

      <div className="fishing-tabs" role="tablist" aria-label="池塘与鱼类图鉴">
        <button className={tab === "pond" ? "active" : ""} onClick={() => setTab("pond")} role="tab" aria-selected={tab === "pond"}>池塘垂钓</button>
        <button className={tab === "book" ? "active" : ""} onClick={() => setTab("book")} role="tab" aria-selected={tab === "book"}>鱼类图鉴 {unlocked}/{FISH_SPECIES.length}</button>
      </div>

      {tab === "pond" ? (
        <>
          <div className={`fishing-scene phase-${phase}`} aria-live="polite">
            <div className="pond-ripples"><i /><i /><i /></div>
            <span className="fishing-rod" aria-hidden="true" />
            <span className="fishing-line" aria-hidden="true" />
            <span className="fishing-bobber" aria-hidden="true" />
            {(phase === "verify" || phase === "caught") && <FishSprite fish={fish} />}
            <div className="fishing-scene-copy">
              <small>{phase === "idle" ? "准备抛竿" : phase === "casting" ? "正在广播动作" : phase === "pending" ? "等待交易确认" : phase === "verify" ? "核对本次回执" : "渔获已确认"}</small>
              <b>{phase === "idle" ? "池塘很安静，选择一种练习方式" : phase === "casting" ? "浮标划过水面……" : phase === "pending" ? "Pending · 还不能把鱼收入图鉴" : phase === "verify" ? "确认这条鱼确实属于你的交易" : `${fish.name}进入图鉴`}</b>
            </div>
          </div>

          {phase === "idle" && (
            <div className="fishing-actions-card">
              <div><span>推荐 · 第 {(progress.totalCatches % FISH_SPECIES.length) + 1} 种鱼</span><b>演示回执练习</b><p>体验广播、Pending、确认和哈希核验，不连接钱包。本次线索：{nextFish.eyebrow}。</p><button className="pixel-button primary" onClick={startDemoCast}>开始普通垂钓</button></div>
              <div className="wallet-practice-card">
                <span>可选链上实践</span>
                <b>{FISHING_CHAIN.name}</b>
                <p>连接浏览器钱包并发送一笔 0 {FISHING_CHAIN.currency} 自转交易，会消耗少量测试网 Gas。</p>
                <div className={`wallet-connection-state ${wallet?.chainId === FISHING_CHAIN.id ? "is-ready" : ""}`}>
                  <i aria-hidden="true" />
                  <div>
                    <small>{walletAvailable === null ? "正在检测钱包" : !walletAvailable ? "未检测到浏览器钱包" : !wallet ? "钱包尚未连接" : wallet.chainId === FISHING_CHAIN.id ? "已连接 · 网络正确" : `已连接 · 当前 Chain ID ${wallet.chainId}`}</small>
                    <strong>{wallet ? formatFishingWalletAddress(wallet.address) : FISHING_CHAIN.name}</strong>
                  </div>
                </div>
                {!wallet ? (
                  <button className="pixel-button ghost" disabled={walletPending || walletAvailable !== true} onClick={connectWallet}>{walletPending ? "等待钱包授权" : walletAvailable === false ? "需要浏览器钱包" : "连接钱包"}</button>
                ) : wallet.chainId !== FISHING_CHAIN.id ? (
                  <button className="pixel-button ghost" disabled={walletPending} onClick={switchWalletNetwork}>{walletPending ? "正在切换网络" : `切换到 ${FISHING_CHAIN.name}`}</button>
                ) : (
                  <button className="pixel-button ghost" onClick={() => setConfirmReal(true)}>开始链上垂钓</button>
                )}
              </div>
            </div>
          )}

          {confirmReal && (
            <div className="real-cast-confirm" role="dialog" aria-modal="true" aria-label="确认真实测试网练习">
              <span className="chain-badge">CHAIN ID {FISHING_CHAIN.id}</span>
              <h2>确认发送真实测试网交易？</h2>
              <p>钱包 {wallet ? formatFishingWalletAddress(wallet.address) : "尚未连接"} 会向自己的地址发送 0 {FISHING_CHAIN.currency}。交易不会转走代币，但会消耗测试网 Gas。拒绝签名不会影响课程和图鉴。</p>
              <div><button className="pixel-button ghost" onClick={() => setConfirmReal(false)}>先等等</button><button className="pixel-button primary" onClick={startRealCast}>确认并打开钱包</button></div>
            </div>
          )}

          {(phase === "casting" || phase === "pending") && (
            <div className="receipt-pending" role="status">
              <span className="pending-pulse" />
              <div><b>{phase === "casting" ? "等待钱包或演示广播" : "交易已经广播，等待区块回执"}</b><p>{broadcastHash ? `${broadcastHash.slice(0, 12)}…${broadcastHash.slice(-8)}` : "浮标会在回执出现后发光。"}</p></div>
              {broadcastHash && <a href={fishingTransactionUrl(broadcastHash as `0x${string}`)} target="_blank" rel="noreferrer">查看交易 ↗</a>}
            </div>
          )}

          {phase === "verify" && receipt && (
            <div className="hash-verification">
              <div className="receipt-metrics">
                <div><span>回执类型</span><b>{receipt.mode === "chain" ? "真实测试网" : "演示数据"}</b></div>
                <div><span>区块高度</span><b>{receipt.blockNumber.toLocaleString()}</b></div>
                <div><span>Gas Used</span><b>{receipt.gasUsed.toLocaleString()}</b></div>
                <div><span>确认耗时</span><b>{receipt.confirmationMs} ms</b></div>
              </div>
              <h2>哪一段是这笔交易哈希的末 6 位？</h2>
              <p className="hash-full">{receipt.txHash}</p>
              {receipt.mode === "chain" && <a className="receipt-explorer-link" href={fishingTransactionUrl(receipt.txHash as `0x${string}`)} target="_blank" rel="noreferrer">在 Monadscan 查看完整交易 ↗</a>}
              <div className="hash-options">
                {hashChoices(receipt.txHash).map((choice) => <button className={selectedHash === choice ? "selected" : ""} key={choice} onClick={() => verifyHash(choice)}>{choice}</button>)}
              </div>
              {error && <p className="fishing-error" role="alert">{error}</p>}
            </div>
          )}

          {phase === "caught" && receipt && (
            <div className="catch-result">
              <FishSprite fish={fish} />
              <div><span>{fish.eyebrow}</span><h2>发现 · {fish.name}</h2><div className="fish-meta"><b>{fish.rarity}</b><b>{"★".repeat(fish.difficulty)} 难度</b></div><p>{fish.lesson}</p></div>
              <div className="receipt-insight">
                <b>动态回执问题</b>
                <p>这次回执包含区块 {receipt.blockNumber.toLocaleString()}，最能证明什么？</p>
                <button className={insightPassed ? "is-correct" : ""} onClick={() => setInsightPassed(true)}>交易已经进入区块，并能再次通过 RPC 核验</button>
                <button onClick={() => setError("动画结束不等于链上确认，真正依据是交易回执。")}>页面动画结束就等于链上成功</button>
                {insightPassed && <small>✓ 已把本次真实数据和交易生命周期联系起来</small>}
              </div>
              {error && <p className="fishing-error" role="alert">{error}</p>}
              <div className="catch-actions"><button className="pixel-button ghost" onClick={() => setTab("book")}>查看图鉴</button><button className="pixel-button primary" onClick={resetCast}>再钓一次</button></div>
            </div>
          )}

          {error && phase === "idle" && <p className="fishing-error" role="alert">{error}</p>}
        </>
      ) : (
        <FishBook progress={progress} />
      )}
    </div>
  );
}

function FishBook({ progress }: { progress: FishingProgress }) {
  const unlockedCount = FISH_SPECIES.filter((fish) => progress.collection[fish.id].count > 0).length;
  return (
    <div className="fish-book">
      <div className="fish-book-summary"><span>回执池塘图鉴</span><b>{progress.totalCatches} 次核验 · {unlockedCount}/{FISH_SPECIES.length} 种已发现</b><small>鱼类按照垂钓顺序解锁，完成第 10 次核验后开启整轮循环。</small></div>
      <div className="fish-book-grid">
        {FISH_SPECIES.map((fish, index) => {
          const entry = progress.collection[fish.id];
          const unlocked = entry.count > 0;
          return (
            <article className={`fish-book-card ${unlocked ? "is-unlocked" : "is-locked"}`} key={fish.id}>
              <span className="fish-book-number">{String(index + 1).padStart(2, "0")}</span>
              <FishSprite fish={fish} locked={!unlocked} />
              <div><span>{unlocked ? fish.eyebrow : fish.habit}</span><h2>{unlocked ? fish.name : "神秘鱼影"}</h2>{unlocked && <div className="fish-meta"><b>{fish.rarity}</b><b>{"★".repeat(fish.difficulty)}</b></div>}<p>{unlocked ? fish.description : `完成第 ${index + 1} 次回执核验后发现`}</p>{unlocked && <small>{fish.lesson}</small>}</div>
              <b>{unlocked ? `× ${entry.count}` : "未发现"}</b>
            </article>
          );
        })}
      </div>
      <div className="agent-handoff"><span>Agent 动态验证</span><b>等待模型服务配置</b><p>图鉴已保存真实回执上下文，但仓库目前没有模型提供商、模型标识符或服务密钥配置，因此不会伪造 Agent 评分。</p></div>
    </div>
  );
}
