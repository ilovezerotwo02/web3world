"use client";

import { GREENHOUSE_STAGE_COPY } from "../security/security-progress";
import type { GreenhouseStage } from "../security/types";

export type SecurityModuleContext = "courses" | "land" | "pond" | "seeds";

const MODULE_COPY: Record<
  SecurityModuleContext,
  {
    eyebrow: string;
    title: string;
    body: string;
    checks: string[];
    action: string;
  }
> = {
  courses: {
    eyebrow: "WEB3 SECURITY · 知识塔",
    title: "每条课程路线先确认安全边界",
    body: "课程路线同时训练 Web3 基础判断：识别网络、权限、签名和回执，不把一张前端卡片当成链上事实。",
    checks: [
      "课程入口与当前解锁状态必须一致",
      "学习流程不索取私钥、助记词或无限授权",
      "进入下一关前先完成安全复盘与验证",
    ],
    action: "进入 Web3 安全训练场",
  },
  land: {
    eyebrow: "WEB3 SECURITY · 课程土地",
    title: "先过安全田埂，再让知识作物生长",
    body: "每一格课程土地都绑定一条安全边界：确认课程来源、种子状态和学习结果，不把前端进度当成链上事实。",
    checks: [
      "课程格位与当前种子必须一一对应",
      "播种和学习流程不会索取私钥或助记词",
      "完成章节后再进入挑战与回归验证",
    ],
    action: "进入 Web3 安全训练场",
  },
  pond: {
    eyebrow: "WEB3 SECURITY · 回执池塘",
    title: "每条鱼都要经过回执和网络核验",
    body: "池塘不只记录渔获，也训练你识别 Chain ID、交易哈希、回执状态和 SignGuard 风险结论。",
    checks: [
      "先核对 Monad Testnet 与 Chain ID 10143",
      "哈希末 6 位核验通过后才计入图鉴",
      "真实回执进入 SignGuard 前必须主动分析",
    ],
    action: "打开安全训练场与 SignGuard",
  },
  seeds: {
    eyebrow: "WEB3 SECURITY · 种子小铺",
    title: "知识种子也要检查来源和授权边界",
    body: "课程种子只来自已解锁的学习路线；陌生空投、未知合约和要求导入私钥的种子，一律不进入背包。",
    checks: [
      "种子只能由课程解锁流程发放",
      "合约卷轴对应固定教学 ABI 和靶场",
      "任何领取流程都不会要求私钥或助记词",
    ],
    action: "查看五类 Web 安全训练",
  },
};

export function Web3SecurityModule({
  context,
  securityStage,
  onOpenSecurity,
}: {
  context: SecurityModuleContext;
  securityStage: GreenhouseStage;
  onOpenSecurity: () => void;
}) {
  const copy = MODULE_COPY[context];
  const stageCopy = GREENHOUSE_STAGE_COPY[securityStage];
  const locked = securityStage === "locked";

  return (
    <section className={`web3-security-module context-${context} stage-${securityStage}`} aria-label={`${copy.eyebrow}安全模块`}>
      <header className="web3-security-module-head">
        <div>
          <span>{copy.eyebrow}</span>
          <h2>{copy.title}</h2>
        </div>
        <b className="web3-security-stage">{locked ? "训练场锁定" : stageCopy.label}</b>
      </header>
      <p>{copy.body}</p>
      <ul>
        {copy.checks.map((check) => <li key={check}><span aria-hidden="true">✓</span>{check}</li>)}
      </ul>
      <div className="web3-security-module-foot">
        <small>{locked ? "完成智能合约课程并收获后，废弃温室会开放完整 Lab。" : `当前温室：${stageCopy.label}`}</small>
        <button className="pixel-button ghost" type="button" onClick={onOpenSecurity}>{copy.action}</button>
      </div>
    </section>
  );
}
