import type { Metadata } from "next";
import { FarmGame } from "./game/FarmGame";

export const metadata: Metadata = {
  title: "Monad 像素农场",
  description: "在一座治愈系像素农场里完成真实、可解释的 Monad 学习任务。",
};

export default function Home() {
  return <FarmGame />;
}
