"use client";
import React, {
  useEffect,
  useRef,
  useMemo,
  useState,
  useCallback,
} from "react";
import { Nunito } from "next/font/google";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import FigmaButton from "@/components/ui/figma/button";
import RulesContent from "@/components/RulesContent";
import Lenis from "@studio-freight/lenis";
import Board from "@/components/Board";
import { Player, Piece, VisibleCell, PieceType } from "@shared/shogi";
import {
  initialBoard,
  getVisibleCellsForPiece,
  isValidMove,
} from "@shared/boardUtils";
import { getPromotedType } from "@/utils/pieceUtils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";

const nunito = Nunito({ subsets: ["latin"] });

// 成りのチェック関数
const checkPromotion = (
  from: [number, number],
  to: [number, number],
  piece: Piece
): boolean => {
  const [fromRow] = from;
  const [toRow] = to;
  const promotionZone = piece.player === "先手" ? 2 : 6;
  return (
    (piece.player === "先手"
      ? toRow <= promotionZone
      : toRow >= promotionZone) ||
    (piece.player === "先手"
      ? fromRow <= promotionZone
      : fromRow >= promotionZone)
  );
};

export default function LandingPage() {
  const router = useRouter();
  const lenisRef = useRef<Lenis | null>(null);

  useEffect(() => {
    lenisRef.current = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      touchMultiplier: 2,
    });

    function raf(time: number) {
      lenisRef.current?.raf(time);
      requestAnimationFrame(raf);
    }

    requestAnimationFrame(raf);

    return () => {
      lenisRef.current?.destroy();
    };
  }, []);

  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth <= 480);
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 480);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const FORMSPARK_ACTION_URL = "https://submit-form.com/Ii1HP9nL";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(FORMSPARK_ACTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          message,
        }),
      });

      if (response.ok) {
        toast.success("送信成功: お問い合わせありがとうございます。");
        setName("");
        setEmail("");
        setMessage("");
      } else {
        throw new Error("送信に失敗しました");
      }
    } catch (error) {
      toast.error("送信に失敗しました。もう一度お試しください。");
    } finally {
      setIsLoading(false);
    }
  };

  const [board, setBoard] = useState<(Piece | null)[][]>(initialBoard());
  const [visibleBoard, setVisibleBoard] = useState<VisibleCell[][]>(() => {
    const newVisibleBoard: VisibleCell[][] = Array(9)
      .fill(null)
      .map(() =>
        Array(9)
          .fill(null)
          .map(() => ({ isVisible: false, piece: null }))
      );

    // 先手の駒だけを表示
    for (let row = 6; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = board[row][col];
        if (piece) {
          newVisibleBoard[row][col] = { isVisible: true, piece };
          const visibleCells = getVisibleCellsForPiece(row, col, piece, board);
          visibleCells.forEach(([r, c]) => {
            newVisibleBoard[r][c] = { isVisible: true, piece: board[r][c] };
          });
        }
      }
    }

    return newVisibleBoard;
  });

  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(
    null
  );

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (selectedCell) {
        const [selectedRow, selectedCol] = selectedCell;
        if (selectedRow === row && selectedCol === col) {
          setSelectedCell(null);
        } else {
          const movingPiece = board[selectedRow][selectedCol];
          if (
            movingPiece &&
            isValidMove(
              [selectedRow, selectedCol],
              [row, col],
              movingPiece,
              board
            )
          ) {
            const newBoard = board.map((row) => [...row]);
            const newVisibleBoard = visibleBoard.map((row) =>
              row.map((cell) => ({ ...cell }))
            );

            // 成りのチェックと処理
            const canPromote = checkPromotion(
              [selectedRow, selectedCol],
              [row, col],
              movingPiece
            );
            if (canPromote && !movingPiece.promoted) {
              // 簡易的に自動で成る実装。実際のゲームでは選択UIが必要です。
              movingPiece.type = getPromotedType(movingPiece.type as PieceType);
              movingPiece.promoted = true;
            }

            newBoard[row][col] = movingPiece;
            newBoard[selectedRow][selectedCol] = null;

            // 移動後の視界を更新
            newVisibleBoard.forEach((row) =>
              row.forEach((cell) => (cell.isVisible = false))
            );
            for (let r = 0; r < 9; r++) {
              for (let c = 0; c < 9; c++) {
                const piece = newBoard[r][c];
                if (piece && piece.player === "先手") {
                  newVisibleBoard[r][c] = { isVisible: true, piece };
                  const visibleCells = getVisibleCellsForPiece(
                    r,
                    c,
                    piece,
                    newBoard
                  );
                  visibleCells.forEach(([vr, vc]) => {
                    newVisibleBoard[vr][vc] = {
                      isVisible: true,
                      piece: newBoard[vr][vc],
                    };
                  });
                }
              }
            }

            setBoard(newBoard);
            setVisibleBoard(newVisibleBoard);
            setSelectedCell(null);
          } else {
            // 無効な移動の場合、選択をクリア
            setSelectedCell(null);
          }
        }
      } else {
        if (
          visibleBoard[row][col].piece &&
          visibleBoard[row][col].piece?.player === "先手"
        ) {
          setSelectedCell([row, col]);
        }
      }
    },
    [board, visibleBoard, selectedCell]
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center relative">
      <div className="fixed inset-0 z-0">
        <Image
          src="/bg/night.png"
          alt="Background"
          fill
          sizes="100vw"
          priority
          quality={100}
          className="object-cover -z-50"
        />
        <div className="cloud absolute inset-0 pointer-events-none"></div>
      </div>
      <section className="relative min-h-screen text-center flex flex-col justify-center items-center z-20 p-8">
        <Image
          src="/ui/title.png"
          alt="霧将棋"
          width={240}
          height={100}
          priority
          quality={100}
          // style={{ width: "100%", height: "auto", maxWidth: "300px" }}
        />
        <p className="text-xl">
          索敵しながら王を仕留めろ！
          <br />
          新感覚の将棋ゲーム「霧将棋」
        </p>

        <div className="flex justify-center items-center space-x-4 mt-8">
          <Link
            href="https://apps.apple.com/jp/app/your-app-id"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block cursor-pointer hover:scale-95"
          >
            <Image
              src="/Download_on_the_App_Store_Badge_JP_RGB_wht_100317.svg"
              alt="Download on the App Store"
              width={120}
              height={40}
            />
          </Link>
          <Link
            href="https://play.google.com/store/apps/details?id=your.app.id"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block cursor-pointer hover:scale-95"
          >
            <Image
              src="/GetItOnGooglePlay_Badge_Web_color_Japanese.png"
              alt="Get it on Google Play"
              width={135}
              height={40}
            />
          </Link>
        </div>
        <FigmaButton
          variant="button_rectangle_01_long"
          className="w-full max-w-[160px] sm:max-w-[170px] mt-8 tracking-wider hover:scale-95"
          textClassName="text-[17px] font-bold sm:text-[18px]"
          hasHoverState={false}
          onClick={() => {
            router.push("/app");
          }}
        >
          Web版で始める
        </FigmaButton>
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="w-1 h-16 bg-white opacity-50 rounded-full">
            <div className="w-full h-1/2 bg-white rounded-full animate-bounce"></div>
          </div>
        </div>
      </section>

      {/* Second section */}
      <section
        className={`relative min-h-screen flex flex-col items-center justify-center ${
          isMobile ? "p-1" : "p-4"
        }`}
      >
        <div className="max-w-md w-full relative">
          <div
            className="absolute inset-0 bg-contain bg-center bg-no-repeat"
            style={{
              backgroundImage: `url('/ui/window/scalable_window_02_01${
                isMobile ? "_sp" : ""
              }.png')`,
            }}
          />
          <div
            className="relative z-10"
            style={{
              fontSize: isMobile ? "13px" : "14px",
              padding: isMobile ? "4rem 4rem" : "4rem",
            }}
          >
            <RulesContent />
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="w-1 h-16 bg-white opacity-50 rounded-full">
            <div className="w-full h-1/2 bg-white rounded-full animate-bounce"></div>
          </div>
        </div>
      </section>

      {/* New section for interactive Board sample */}
      <section className="relative min-h-screen flex flex-col items-center justify-center p-4">
        <h2 className="text-2xl text-white font-bold mb-4">体験してみよう</h2>
        <div className="max-w-md w-full">
          <Board
            visibleBoard={visibleBoard}
            selectedCell={selectedCell}
            lastMove={null}
            playerSide="先手"
            onCellClick={handleCellClick}
            selectedCapturedPiece={null}
          />
        </div>
        <p className="mt-4 text-center">先手の駒を動かしてみてください。</p>
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="w-1 h-16 bg-white opacity-50 rounded-full">
            <div className="w-full h-1/2 bg-white rounded-full animate-bounce"></div>
          </div>
        </div>
      </section>

      {/* New Contact section using shadcn/ui */}
      <section
        className={`relative min-h-screen flex flex-col items-center justify-center w-full p-4 ${nunito.className}`}
      >
        <Card className="w-[100%] max-w-md bg-white/10 backdrop-blur-md border border-white/20 shadow-lg rounded-xl">
          <CardHeader>
            <CardTitle className="text-white">お問い合わせ</CardTitle>
            <CardDescription className="text-white/60">
              ご質問やフィードバックをお寄せください。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit}>
              <div className="grid w-full items-center gap-4 text-white">
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="name">お名前</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="山田 太郎"
                    required
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div className="flex flex-col space-y-1.5">
                  <Label htmlFor="message">メッセージ</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="ご質問やフィードバックをご記入ください"
                    required
                  />
                </div>
              </div>
              <CardFooter className="flex-row justify-end space-x-4 mt-4 p-0">
                <Button
                  type="button"
                  variant="outline"
                  className="text-black"
                  onClick={() => {
                    setName("");
                    setEmail("");
                    setMessage("");
                  }}
                >
                  キャンセル
                </Button>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? "送信中..." : "送信"}
                </Button>
              </CardFooter>
            </form>
          </CardContent>
        </Card>
      </section>

      <footer className="w-full text-center py-4 text-white text-sm z-50">
        © 2024 Palpa,Inc. All Rights Reserved.
      </footer>
    </div>
  );
}
