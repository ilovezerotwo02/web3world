import type { Metadata } from "next";
import { FarmGame } from "./game/FarmGame";

export const metadata: Metadata = {
  title: "web3world · Web3 像素学习世界",
  description: "在可探索的像素世界里学习 Web3、安全检查、交易回执与链上实践。",
};

export default function Home() {
  return <FarmGame />;
}
