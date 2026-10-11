"use client";

import { useState } from "react";
import {
  analyzeTransaction,
  SIGNGUARD_SAMPLES,
  type AnalyzeTransactionInput,
} from "../../../lib/security/risk-engine";
import { MONAD_TESTNET_CHAIN_ID, type SignGuardResult } from "../../../lib/security/types";
import { RiskDecisionCard } from "./RiskDecisionCard";

type Mode = "sample" | "request" | "txHash";

export function SignGuardPanel({
  recentFishingTxHash = null,
}: {
  recentFishingTxHash?: string | null;
}) {
  const [mode, setMode] = useState<Mode>("sample");
  const [activeId, setActiveId] = useState(SIGNGUARD_SAMPLES[0].id);
  const [chainId, setChainId] = useState(String(MONAD_TESTNET_CHAIN_ID));
  const [target, setTarget] = useState("");
  const [data, setData] = useState("0x");
  const [value, setValue] = useState("0");
  const [txHash, setTxHash] = useState("");
  const [result, setResult] = useState<SignGuardResult | null>(null);
  const [echo, setEcho] = useState<{ target: string; data: string; value: string }>({
    target: "",
    data: "0x",
    value: "0",
  });
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function analyze(input: AnalyzeTransactionInput) {
    const next = analyzeTransaction(input);
    setResult(next);
    setEcho({ target: input.to ?? "", data: input.data ?? "0x", value: input.value ?? "0" });
  }

  function runSample(id: string) {
    const sample = SIGNGUARD_SAMPLES.find((entry) => entry.id === id);
    if (!sample) return;
    setActiveId(id);
    setNotice(null);
    setError(null);
    analyze(sample.input);
  }

  function runRequest() {
    setNotice(null);
    setError(null);
    if (!/^0x[a-fA-F0-9]{40}$/.test(target)) {
      setError("目标地址必须是 0x 开头的 20 字节地址。");
      return;
    }
    if (data && !/^0x([a-fA-F0-9]{2})*$/.test(data)) {
      setError("calldata 必须是 0x 前缀的偶数长度十六进制。");
      return;
    }
    if (!/^[0-9]{1,78}$/.test(value || "0")) {
      setError("value 必须是以 wei 为单位的十进制字符串，例如 5000000000000000。");
      return;
    }
    analyze({
      chainId: Number(chainId) || MONAD_TESTNET_CHAIN_ID,
      to: target,
      data: data || "0x",
      value: value || "0",
    });
  }

  function importRecentFishingTransaction() {
    if (!recentFishingTxHash) return;
    setMode("txHash");
    setTxHash(recentFishingTxHash);
    setResult(null);
    setError(null);
    setNotice("哈希已填入；点击读取并分析后，SignGuard 会重新核验 Monad Testnet 上的交易内容。");
  }

  async function runTxHash() {
    setNotice(null);
    setError(null);
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      setError("交易哈希必须是 32 字节的 0x 哈希。");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/security/tx-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "txHash", chainId: Number(chainId) || MONAD_TESTNET_CHAIN_ID, txHash }),
      });
      const payload = (await response.json()) as {
        result?: SignGuardResult;
        error?: string;
        degraded?: boolean;
        detail?: string;
      };
      if (!response.ok || !payload.result) {
        setError(payload.error ?? "链上读取失败");
        if (payload.degraded) {
          setNotice("真实交易读取降级：可以先使用固定样例或 raw calldata 模式继续学习。");
        }
        return;
      }
      setResult(payload.result);
      setEcho({ target: "(来自链上交易)", data: "(来自链上交易)", value: "(来自链上交易)" });
      setNotice("已读取真实 Monad Testnet 交易并完成规则分析。");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "网络不可用");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="panel-stack sec-signguard">
      <div className="sec-tabs" role="tablist" aria-label="SignGuard 输入方式">
        <button role="tab" aria-selected={mode === "sample"} className={mode === "sample" ? "active" : ""} onClick={() => setMode("sample")}>
          固定样例
        </button>
        <button role="tab" aria-selected={mode === "request"} className={mode === "request" ? "active" : ""} onClick={() => setMode("request")}>
          待签名交易（address + calldata + value）
        </button>
        <button role="tab" aria-selected={mode === "txHash"} className={mode === "txHash" ? "active" : ""} onClick={() => setMode("txHash")}>
          Monad Testnet 交易哈希
        </button>
      </div>

      <div className="sec-fishing-import">
        <div>
          <span>回执池塘 · 最近一次真实交易</span>
          <p>
            {recentFishingTxHash
              ? `${recentFishingTxHash.slice(0, 10)}…${recentFishingTxHash.slice(-8)}`
              : "完成一次真实测试网垂钓后，可在这里导入回执；演示记录不会作为链上交易分析。"}
          </p>
        </div>
        <button
          className="pixel-button secondary"
          type="button"
          disabled={!recentFishingTxHash}
          onClick={importRecentFishingTransaction}
        >
          {recentFishingTxHash ? "导入最近交易" : "等待真实回执"}
        </button>
      </div>

      {mode === "sample" && (
        <div className="sec-sample-grid">
          {SIGNGUARD_SAMPLES.map((sample) => (
            <button
              key={sample.id}
              className={sample.id === activeId ? "is-active" : ""}
              onClick={() => runSample(sample.id)}
              type="button"
            >
              <b>{sample.title}</b>
              <span>{sample.description}</span>
            </button>
          ))}
        </div>
      )}

      {mode === "request" && (
        <div className="sec-form">
          <label>
            <span>chainId（当前钱包网络）</span>
            <input value={chainId} onChange={(event) => setChainId(event.target.value)} inputMode="numeric" />
          </label>
          <label>
            <span>to（目标地址）</span>
            <input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="0x..." spellCheck={false} />
          </label>
          <label>
            <span>value（wei，十进制）</span>
            <input value={value} onChange={(event) => setValue(event.target.value)} inputMode="numeric" />
          </label>
          <label className="is-wide">
            <span>data（calldata）</span>
            <input value={data} onChange={(event) => setData(event.target.value)} spellCheck={false} />
          </label>
          <button className="pixel-button primary" type="button" onClick={runRequest}>
            安检这笔交易
          </button>
        </div>
      )}

      {mode === "txHash" && (
        <div className="sec-form">
          <label className="is-wide">
            <span>Monad Testnet 交易哈希</span>
            <input value={txHash} onChange={(event) => setTxHash(event.target.value)} placeholder="0x..." spellCheck={false} />
          </label>
          <button className="pixel-button primary" type="button" onClick={runTxHash} disabled={busy}>
            {busy ? "正在读取真实交易…" : "读取并分析这笔真实交易"}
          </button>
        </div>
      )}

      {error && <div className="feedback feedback-danger" role="alert"><span>!</span><p>{error}</p></div>}
      {notice && <div className="inline-note"><span>✦</span><p>{notice}</p></div>}

      {result ? (
        <RiskDecisionCard result={result} rawData={echo.data} rawValue={echo.value} target={echo.target} />
      ) : (
        <div className="service-state">
          <h3>先给结论，再给分数</h3>
          <p>
            SignGuard 用人话回答：这笔交易在做什么、谁会获得权限、权限有多大、会发送多少原生资产、
            是否存在无限授权或 NFT 全局授权、目标 selector 是否认识、是否命中安全策略。
          </p>
        </div>
      )}

      <p className="quiet-note">
        风险解释仅帮助用户理解交易意图，不等同于完整智能合约审计或安全保证。SignGuard 不会接收私钥或助记词，也不会替你签名。
      </p>
    </div>
  );
}
