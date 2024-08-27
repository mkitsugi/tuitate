import React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Info } from "lucide-react";

export default function RulesDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-fit bg-white/10 text-white hover:bg-black/80 hover:text-white hover:border-black/80 mt-4"
        >
          <Info className="w-4 h-4 mr-2" />
          霧将棋のルールについて
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-white/95 backdrop-blur-md">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold mb-4 text-center">
            霧将棋のルール
          </DialogTitle>
        </DialogHeader>
        <div className="mt-2 space-y-4">
          <p>
            霧将棋はお互いの情報が不完全な状態で将棋をプレイする完全オリジナルな将棋ゲームです。
          </p>
          <ol className="list-decimal pl-5 space-y-2">
            <li>基本的な動きは将棋と同様で、王を倒しましょう。</li>
            <li>
              お互いに相手の駒は霧に隠れて見ることができません。あなたの駒が進める範囲のみ、視界が開かれます。
            </li>
            <li>持ち駒は自分の駒が進める範囲に置くことができます。</li>
          </ol>
          <p>
            実際、霧将棋が生み出す緊張感と戦略性は通常の将棋とは一味違った体験です。霧の中で相手の動きを予測し、自らの戦略を練る
            —
            まるで戦場の指揮官のような臨場感を味わえるでしょう。スリリングな頭脳戦の世界に挑戦してみよう！
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
