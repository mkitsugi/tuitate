import React from "react";
import Image from "next/image";
import FigmaButton from "./ui/figma/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

export default function RulesDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <FigmaButton
          variant="button_rectangle_02"
          className="w-full max-w-[160px] sm:max-w-[180px]"
          textClassName="text-[13px] sm:text-[15px]"
        >
          ルールについて
        </FigmaButton>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-transparent border-none">
        <div
          className="absolute inset-0 bg-contain bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/ui/window/scalable_window_02_01${
              window.innerWidth <= 768 ? "_sp" : ""
            }.png')`,
          }}
        />
        <div className="relative z-10 p-6">
          <DialogHeader>
            <DialogTitle className="text-2xl mb-4 text-center">
              霧将棋のルール
            </DialogTitle>
          </DialogHeader>
          <div className="mt-2 space-y-4 tracking-wide">
            <p>
              霧将棋はお互いの情報が不完全な状態で将棋をプレイする完全オリジナルな将棋ゲームです。
            </p>
            <ol className="list-decimal pl-5 space-y-2">
              <li>基本的な駒の配置や動きは将棋と同様です。</li>
              <li>
                お互いの駒は霧に隠れて見ることができません。あなたの駒が進める範囲のみ、視界が開かれます。
              </li>
              <li>持ち駒は自分の駒が進める範囲に置くことができます。</li>
            </ol>
            <p>
              霧将棋で味わえる緊張感と戦略性は普通の将棋とはまた一味違った体験です。霧の中で相手の動きを予測し、自らの戦略を練る...まるで実際の戦場のような臨場感を体感してみてください。
            </p>
          </div>
        </div>
        <DialogClose className="absolute right-4 -top-12 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none">
          <Image
            src="/ui/button/button_close.png"
            alt="Close"
            width={24}
            height={24}
          />
          <span className="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
