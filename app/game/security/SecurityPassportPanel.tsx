"use client";

import { useMemo, useState } from "react";
import type { Hash } from "viem";
import { connectInjectedWallet } from "../../lib/protocols";
import { writeSessionToken } from "../session";
import { SECURITY_BADGE_NAME, SECURITY_BADGE_TYPE_ID, SECURITY_TRACK_VERSION } from "../../../lib/security/passport";

type Phase =
  | "idle"
  | "connecting"
  | "signing"
  | "verifying"
  | "minting"
  | "success"
  | "error";

const PHASE_LABEL: Record<Phase, string> = {
  idle: "连接钱包并领取 Security Passport",
  connecting: "正在连接钱包…",
  signing: "请在钱包中签名…",
  verifying: "平台正在校验安全能力记录…",
  minting: "平台代付 Gas 并铸造…",
  success: "已经铸造到钱包",
  error: "重新连接并领取",
};

type ClaimResult = {
  address: string;
  tokenId: string | null;
  txHash: Hash | null;
  contractAddress: string | null;
  explorerUrl: string | null;
};

async function readApi<T extends { error?: string }>(response: Response) {
  const payload = (await response.json()) as T;
  if (!response.ok) throw new Error(payload.error ?? `请求失败（${response.status}）`);
  return payload;
}

function short(value: string) {
  return value.length <= 20 ? value : `${value.slice(0, 10)}…${value.slice(-8)}`;
}

export function SecurityPassportPanel({
  contractHarvested,
  labsPassed,
  finalAuditPassed,
  finalScore,
  reportHash,
  auditor,
  onMessage,
}: {
  contractHarvested: boolean;
  labsPassed: [boolean, boolean, boolean];
  finalAuditPassed: boolean;
  finalScore: number;
  reportHash: string | null;
  auditor: string;
  onMessage: (message: string, tone?: "success" | "warning" | "info") => void;
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ClaimResult | null>(null);
  const [serverNote, setServerNote] = useState<string | null>(null);

  const checklist = useMemo(
    () => [
      { label: "智能合约课程已收获", ok: contractHarvested },
      { label: "Lab 1 · 重入与调用顺序", ok: labsPassed[0] },
      { label: "Lab 2 · 权限与签名", ok: labsPassed[1] },
      { label: "Lab 3 · 用户侧攻击面", ok: labsPassed[2] },
      { label: "Final Audit 通过", ok: finalAuditPassed },
      { label: "钱包地址已验证", ok: phase === "success" },
    ],
    [contractHarvested, labsPassed, finalAuditPassed, phase],
  );

  const localEligible = contractHarvested && labsPassed.every(Boolean) && finalAuditPassed;
  const busy = !["idle", "error", "success"].includes(phase);

  async function claim() {
    if (!localEligible || busy) return;
    setError(null);
    setServerNote(null);
    try {
      setPhase("connecting");
      const connection = await connectInjectedWallet();

      const challenge = await readApi<{ challengeId: string; message: string }>(
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
      const session = await readApi<{ token: string }>(
        await fetch("/api/wallet/challenge", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ challengeId: challenge.challengeId, address: connection.address, signature }),
        }),
      );
      writeSessionToken(session.token);
      const authorization = `Bearer ${session.token}`;

      setPhase("verifying");
      const eligibility = await readApi<{
        eligible: boolean;
        missing?: string[];
        score?: number;
        reportHash?: string | null;
        message?: string;
      }>(
        await fetch("/api/security/passport/eligibility", {
          method: "POST",
          headers: { Authorization: authorization, "Content-Type": "application/json" },
          // 服务端不信任客户端标记：资格完全由 D1 中的记录重新计算
          body: JSON.stringify({}),
        }),
      );
      if (!eligibility.eligible) {
        setServerNote(
          `服务端还没有完整的记录：${(eligibility.missing ?? []).join("、")}。` +
            "请确认智能合约课程已完成并同步，且三个 Lab 与 Final Audit 是在连接钱包后完成的（这样结果才会写入 D1）。",
        );
        setPhase("error");
        return;
      }

      const qualification = await readApi<{
        mintingRecord?: { id: string; status: string };
        tokenId?: string | null;
        txHash?: Hash | null;
        contractAddress?: string | null;
        explorerUrl?: string | null;
      }>(
        await fetch("/api/nft", {
          method: "POST",
          headers: { Authorization: authorization, "Content-Type": "application/json" },
          body: JSON.stringify({ courseId: "security", walletAddress: connection.address }),
        }),
      );
      if (!qualification.mintingRecord) throw new Error("平台没有返回铸造记录");

      let minted = qualification;
      if (qualification.mintingRecord.status !== "confirmed") {
        setPhase("minting");
        minted = await readApi<typeof qualification>(
          await fetch("/api/nft", {
            method: "PUT",
            headers: { Authorization: authorization, "Content-Type": "application/json" },
            body: JSON.stringify({ mintingId: qualification.mintingRecord.id }),
          }),
        );
      }

      setResult({
        address: connection.address,
        tokenId: minted.tokenId ?? null,
        txHash: minted.txHash ?? null,
        contractAddress: minted.contractAddress ?? null,
        explorerUrl: minted.explorerUrl ?? null,
      });
      setPhase("success");
      onMessage("Web3 Security Guardian 已铸造到钱包");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "领取失败，请稍后重试");
      setPhase("error");
    }
  }

  const displayScore = finalScore;

  return (
    <div className="panel-stack sec-passport">
      <header className="sec-passport-head">
        <div>
          <span>SECURITY PASSPORT · Type ID {SECURITY_BADGE_TYPE_ID}</span>
          <h2>{SECURITY_BADGE_NAME}</h2>
          <p>
            它不是普通的“看完课程”徽章，而是绑定漏洞复现、修复回归与交易风险实验结果的可验证安全能力凭证，
            只保存报告摘要与哈希，不上链整份报告。
          </p>
        </div>
        <div className="sec-passport-score">
          <b>{displayScore}</b>
          <span>Audit Score</span>
          <small>Track {SECURITY_TRACK_VERSION}</small>
        </div>
      </header>

      <ul className="sec-checklist">
        {checklist.map((item) => (
          <li key={item.label} className={item.ok ? "is-ok" : ""}>
            <span>{item.ok ? "✓" : "·"}</span>
            {item.label}
          </li>
        ))}
      </ul>

      {reportHash && (
        <p className="sec-break">Report Hash：{reportHash}</p>
      )}

      {serverNote && <div className="feedback feedback-gentle" role="alert"><span>✦</span><p>{serverNote}</p></div>}
      {error && <div className="feedback feedback-danger" role="alert"><span>!</span><p>{error}</p></div>}

      {result && phase === "success" ? (
        <div className="nft-chain-result" role="status">
          <div><small>状态</small><b>Security Passport 已铸造</b></div>
          <div><small>Token ID</small><b>{result.tokenId ?? "链上已存在"}</b></div>
          <div><small>接收地址</small><code title={result.address}>{short(result.address)}</code></div>
          {result.txHash && <div><small>交易哈希</small><code title={result.txHash}>{short(result.txHash)}</code></div>}
          <div><small>Auditor</small><b>{auditor}</b></div>
          {result.explorerUrl && (
            <a className="pixel-button secondary" href={result.explorerUrl} target="_blank" rel="noreferrer">
              在区块浏览器查看
            </a>
          )}
        </div>
      ) : (
        <div className="service-state nft-live-state">
          <span className="chain-badge">Monad Testnet · typeId {SECURITY_BADGE_TYPE_ID} · 不可转让</span>
          <h3>{localEligible ? "签名只用于证明接收地址" : "还没有满足领取条件"}</h3>
          <p>
            {localEligible
              ? "平台会从 D1 重新校验你的安全实验与审计报告记录，再用平台钱包把不可转让的安全能力凭证铸造到你的地址。签名不会发送交易，也不会消耗 MON。"
              : "先完成三个 Lab 与最终综合审计，再把结果同步到服务端，就可以领取这枚凭证。"}
          </p>
          <button
            className="pixel-button primary wide"
            type="button"
            disabled={!localEligible || busy}
            onClick={claim}
          >
            {PHASE_LABEL[phase]}
          </button>
        </div>
      )}

      <p className="quiet-note">
        该徽章只记录“完成过哪些安全实验、审计得分与报告哈希”，不是金融资产，也不代表对任何真实项目的安全背书。
      </p>
    </div>
  );
}
