"use client";

import { useMemo, useState } from "react";
import type { Hash } from "viem";
import { connectInjectedWallet } from "../lib/protocols";
import type { FarmProgress } from "./progress";

type BadgeCourseId = "web3" | "monad" | "contract";
type ClaimPhase =
  | "idle"
  | "connecting"
  | "signing"
  | "syncing"
  | "checking"
  | "minting"
  | "success"
  | "error";

type ApiResult = {
  error?: string;
  mintingRecord?: {
    id: string;
    status: string;
  };
  tokenId?: string | null;
  txHash?: Hash | null;
  contractAddress?: string | null;
  chainId?: number | null;
  explorerUrl?: string | null;
};

type ClaimResult = {
  address: string;
  tokenId: string | null;
  txHash: Hash | null;
  contractAddress: string | null;
  chainId: number | null;
  explorerUrl: string | null;
};

const STATUS_LABELS = [
  "无资格",
  "可以领取",
  "连接钱包",
  "签名证明",
  "同步记录",
  "平台验证",
  "链上确认",
  "铸造成功",
];

const PHASE_INDEX: Record<ClaimPhase, number> = {
  idle: 1,
  connecting: 2,
  signing: 3,
  syncing: 4,
  checking: 5,
  minting: 6,
  success: 7,
  error: 1,
};

async function readApi<T extends { error?: string }>(response: Response) {
  const payload = (await response.json()) as T;
  if (!response.ok) {
    throw new Error(payload.error ?? `请求失败（${response.status}）`);
  }
  return payload;
}

function shortValue(value: string) {
  if (value.length <= 20) return value;
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function NftClaimPanel({
  courseId,
  progress,
  eligible,
}: {
  courseId: BadgeCourseId;
  progress: FarmProgress;
  eligible: boolean;
}) {
  const [phase, setPhase] = useState<ClaimPhase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const busy = !["idle", "error", "success"].includes(phase);
  const activeIndex = eligible ? PHASE_INDEX[phase] : 0;
  const actionLabel = useMemo(() => {
    if (!eligible) return "完成课程后可领取";
    if (phase === "success") return "已经铸造到钱包";
    if (phase === "error") return "重新连接并领取";
    if (phase === "connecting") return "正在连接钱包…";
    if (phase === "signing") return "请在钱包中签名…";
    if (phase === "syncing") return "正在同步完成记录…";
    if (phase === "checking") return "平台正在验证资格…";
    if (phase === "minting") return "平台代付 Gas 并铸造…";
    return "连接钱包并领取 ERC-721";
  }, [eligible, phase]);

  async function claim() {
    if (!eligible || busy || phase === "success") return;
    setError(null);
    setResult(null);
    try {
      setPhase("connecting");
      const connection = await connectInjectedWallet();

      const challenge = await readApi<{
        error?: string;
        challengeId: string;
        message: string;
      }>(
        await fetch("/api/wallet/challenge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address: connection.address }),
        }),
      );

      setPhase("signing");
      const signature = await connection.walletClient.signMessage({
        account: connection.address,
        message: challenge.message,
      });
      const session = await readApi<{
        error?: string;
        token: string;
      }>(
        await fetch("/api/wallet/challenge", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            challengeId: challenge.challengeId,
            address: connection.address,
            signature,
          }),
        }),
      );
      const authorization = `Bearer ${session.token}`;

      setPhase("syncing");
      await readApi<{ error?: string }>(
        await fetch("/api/checkpoint", {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ courseId, state: progress }),
        }),
      );

      setPhase("checking");
      const qualification = await readApi<ApiResult>(
        await fetch("/api/nft", {
          method: "POST",
          headers: {
            Authorization: authorization,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            courseId,
            walletAddress: connection.address,
          }),
        }),
      );
      if (!qualification.mintingRecord) {
        throw new Error("平台没有返回铸造记录");
      }

      let minted = qualification;
      if (qualification.mintingRecord.status !== "confirmed") {
        setPhase("minting");
        minted = await readApi<ApiResult>(
          await fetch("/api/nft", {
            method: "PUT",
            headers: {
              Authorization: authorization,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              mintingId: qualification.mintingRecord.id,
            }),
          }),
        );
      }

      setResult({
        address: connection.address,
        tokenId: minted.tokenId ?? null,
        txHash: minted.txHash ?? null,
        contractAddress: minted.contractAddress ?? null,
        chainId: minted.chainId ?? null,
        explorerUrl: minted.explorerUrl ?? null,
      });
      setPhase("success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "领取失败，请稍后重试");
      setPhase("error");
    }
  }

  return (
    <>
      <ol className="nft-status-flow" aria-label="NFT 领取状态">
        {STATUS_LABELS.map((status, index) => (
          <li
            className={index < activeIndex ? "complete" : index === activeIndex ? "active" : ""}
            key={status}
            aria-current={index === activeIndex ? "step" : undefined}
          >
            {status}
          </li>
        ))}
      </ol>

      {result && phase === "success" ? (
        <div className="nft-chain-result" role="status">
          <div><small>状态</small><b>ERC-721 已铸造到学员钱包</b></div>
          <div><small>Token ID</small><b>{result.tokenId ?? "链上已存在"}</b></div>
          <div><small>接收地址</small><code title={result.address}>{shortValue(result.address)}</code></div>
          {result.txHash && <div><small>交易哈希</small><code title={result.txHash}>{shortValue(result.txHash)}</code></div>}
          {result.contractAddress && <div><small>合约地址</small><code title={result.contractAddress}>{shortValue(result.contractAddress)}</code></div>}
          {result.chainId && <div><small>网络</small><b>Monad Testnet · {result.chainId}</b></div>}
          {result.explorerUrl && (
            <a className="pixel-button secondary" href={result.explorerUrl} target="_blank" rel="noreferrer">
              在区块浏览器查看
            </a>
          )}
        </div>
      ) : (
        <div className="service-state nft-live-state">
          <span className="chain-badge">Monad Testnet · 平台代付 Gas</span>
          <h3>{eligible ? "签名只用于证明接收地址" : "尚未获得铸造资格"}</h3>
          <p>
            {eligible
              ? "平台会同步并验证课程完成记录，再用平台钱包将不可转让的 ERC-721 学习徽章铸造到你的钱包。签名本身不会发送交易或消耗 MON。"
              : "完成本课程的理论、挑战、最终验证并收获果实后，即可连接钱包领取。"}
          </p>
          {error && <p className="nft-claim-error" role="alert">{error}</p>}
          <button
            className="pixel-button primary wide"
            data-autofocus
            disabled={!eligible || busy || phase === "success"}
            onClick={claim}
          >
            {actionLabel}
          </button>
        </div>
      )}
    </>
  );
}
