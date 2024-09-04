import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Board from "./Board";
import CapturedPieces from "./CapturedPieces";
import WaitingOverlay from "./WaitingOverlay";
import useSocket from "@/hooks/useSocket";
import useGameLogic from "@/hooks/useGameLogic";
import { useResignDialog } from "./ResignDialog";
import { Player, Piece } from "@shared/shogi";
import { Loader2, Copy } from "lucide-react";
import RulesDialog from "./Rules";
import { VisibleCell } from "@shared/shogi";
import { formatTime } from "@/lib/utils";

export default function ImprovedFogOfWarShogi() {
  const [inputGameId, setInputGameId] = useState<string>("");
  const { openResignDialog, ResignDialog } = useResignDialog();
  const [selectedSide, setSelectedSide] = useState<Player | null>(null);

  const {
    socket,
    gameId,
    playerSide,
    gameCreated,
    gameStarted,
    gameEnded,
    winner,
    availableSides,
    createGame,
    joinGame,
    existingRooms,
    isLoadingRooms,
    findExistingRooms,
    clearExistingRooms,
    resign,
    leaveRoom,
    returnToLobby,
    rematchRequested,
    rematchAccepted,
    opponentRequestedRematch,
    opponentLeft,
    requestRematch,
    acceptRematch,
    startNewGame,
  } = useSocket();

  const {
    board,
    visibleBoard,
    currentPlayer,
    selectedCell,
    lastMove,
    capturedPieces,
    selectedCapturedPiece,
    PromotionDialog,
    handlePromotionChoice,
    playMoveSound,
    handleCellClick,
    handleCapturedPieceClick,
    resetGameState,
    resetForNewGame,
  } = useGameLogic(socket, gameId, playerSide);

  // 選択された持ち駒のインデックスを追跡するための状態
  const [selectedPieceIndex, setSelectedPieceIndex] = useState<number | null>(
    null
  );

  // 初回マウント時にルーム一覧を取得
  useEffect(() => {
    findExistingRooms();
    const interval = setInterval(() => {
      if (!gameStarted) {
        findExistingRooms();
      }
    }, 10000); // 10秒ごとに更新

    return () => clearInterval(interval);
  }, [findExistingRooms, gameStarted]);

  useEffect(() => {
    if (rematchAccepted) {
      resetForNewGame();
      startNewGame();
    }
  }, [rematchAccepted, resetForNewGame, startNewGame]);

  const handleReturnToLobby = () => {
    returnToLobby();
    setInputGameId("");
    setSelectedSide(null);
    clearExistingRooms();
    findExistingRooms();
    resetGameState();
  };

  useEffect(() => {
    if (opponentLeft) {
      toast.info("相手がルームを抜けました。ロビーに戻ります。");
      handleReturnToLobby();
    }
  }, [opponentLeft, handleReturnToLobby]);

  const handleCapturedPieceClickWrapper = (
    piece: Piece,
    index: number,
    player: Player
  ) => {
    if (selectedPieceIndex === index) {
      // 既に選択されている駒を再度クリックした場合、選択を解除
      setSelectedPieceIndex(null);
      handleCapturedPieceClick(null, player);
    } else {
      // 新しい駒を選択した場合
      setSelectedPieceIndex(index);
      handleCapturedPieceClick(piece, player);
    }
  };

  const handleJoinGame = (side: Player) => {
    setSelectedSide(side);
    joinGame(side, gameId || inputGameId);
  };

  const copyGameId = useCallback(() => {
    navigator.clipboard.writeText(gameId || "");
    toast.success("ルームIDをクリップボードにコピーしました。", {
      position: "bottom-center",
    });
  }, [gameId]);

  const handleResign = () => {
    resign();
    toast.info("投了しました。", {
      position: "bottom-center",
    });
  };

  // board を VisibleCell[][] に変換する関数
  const convertBoardToVisible = (
    board: (Piece | null)[][]
  ): VisibleCell[][] => {
    return board.map((row) =>
      row.map((cell) => ({ piece: cell, isVisible: true } as VisibleCell))
    );
  };

  const [sente時間, setSente時間] = useState(0); // 10分 = 600秒
  const [gote時間, setGote時間] = useState(0);

  // タイマー更新のための useEffect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameStarted && !gameEnded) {
      interval = setInterval(() => {
        if (currentPlayer === "先手") {
          setSente時間((prev) => Math.max(0, prev + 1));
        } else {
          setGote時間((prev) => Math.max(0, prev + 1));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameEnded, currentPlayer]);

  return (
    <div className="flex justify-center items-center w-full h-full z-10">
      <div className="space-y-6 w-full">
        {!gameStarted && (
          <Card className="mx-auto bg-white/10 backdrop-blur-md border border-white/20 shadow-lg w-full max-w-[450px] py-8 overflow-hidden">
            <CardContent className="p-2">
              <div className="flex flex-col justify-between items-start gap-4">
                <h1 className="text-3xl w-full font-black mt-4 mb-4 text-center text-white">
                  霧将棋
                </h1>

                <div className="w-full space-y-4">
                  <div className="flex flex-col gap-2 w-full px-2">
                    {!gameCreated && (
                      <>
                        {!inputGameId && (
                          <>
                            <div className="flex flex-row items-start w-full space-x-2">
                              <Button
                                onClick={() => {
                                  createGame();
                                  setSelectedSide(null);
                                  playMoveSound();
                                }}
                                className="w-full sm:w-auto bg-black/80 backdrop-blur-sm border border-white/50 text-white hover:bg-black transition-colors"
                                // className="w-full sm:w-auto mt-4"
                              >
                                新しいルームを作成
                              </Button>
                            </div>
                          </>
                        )}

                        <div className="w-full sm:w-auto mt-2">
                          <Label htmlFor="gameId" className="text-white">
                            友達のルームに参加
                          </Label>
                          <Input
                            id="gameId"
                            placeholder="ルームIDを入力"
                            value={inputGameId}
                            onChange={(e) => setInputGameId(e.target.value)}
                            className="mt-1"
                          />
                        </div>
                      </>
                    )}
                    {(gameCreated || inputGameId) && (
                      <>
                        {availableSides.includes("先手") && !selectedSide && (
                          <Button
                            onClick={() => {
                              handleJoinGame("先手" as Player);
                              playMoveSound();
                            }}
                            className="mt-4 w-full bg-sky-600/80 backdrop-blur-sm border-2 border-sky-400/20 text-white hover:bg-sky-700/80 transition-colors"
                            // className="mt-4 w-full bg-sky-600 hover:bg-sky-700"
                          >
                            先手として参加
                          </Button>
                        )}
                        {availableSides.includes("後手") && !selectedSide && (
                          <Button
                            onClick={() => {
                              handleJoinGame("後手" as Player);
                              playMoveSound();
                            }}
                            className="mt-2 w-full bg-rose-600/80 backdrop-blur-sm border-2 border-rose-400/20 text-white hover:bg-rose-700/80 transition-colors"
                            // className="mt-2 w-full bg-rose-600 hover:bg-rose-700"
                          >
                            後手として参加
                          </Button>
                        )}
                        {selectedSide && !gameStarted && (
                          <div className="mt-4 text-center w-full text-white">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-white" />
                            <p>
                              {selectedSide === "先手" ? "先手" : "後手"}
                              として参加しました
                            </p>
                            <p>相手のプレイヤーを待っています...</p>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="w-full flex flex-col md:flex-row justify-start md:justify-start pt-2 px-2">
                <RulesDialog />
                {gameId && (
                  <div className="flex w-full mt-4 items-center text-sm text-white text-center justify-start md:justify-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={copyGameId}
                      title="ルームIDをコピー"
                      className="w-fit px-4 rounded-full bg-black/80 backdrop-blur-sm hover:none"
                    >
                      <div className="flex space-x-2 w-full">
                        <p>ルームID : {gameId}</p>
                        <Copy className="h-4 w-4" />
                      </div>
                    </Button>
                  </div>
                )}
              </div>

              {!gameId && (
                <>
                  {isLoadingRooms && (
                    <p className="px-4 pt-4 text-white text-sm">
                      ルームを検索中...
                    </p>
                  )}
                  {existingRooms.length > 0 && (
                    <div className="mt-4 px-4">
                      <h3 className="text-sm text-white mb-2">
                        利用可能なルーム:
                      </h3>
                      <div className="grid grid-cols-2 gap-2 overflow-y-auto max-h-[200px]">
                        {existingRooms.map((room) => (
                          <Button
                            key={room.id}
                            onClick={() => setInputGameId(room.id)}
                            className="w-full text-left bg-white/90 backdrop-blur-md text-black hover:bg-white/70 transition-colors text-sm"
                          >
                            {room.id} ({room.players}/2)
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}
                  {existingRooms.length === 0 && !isLoadingRooms && (
                    <p className="mt-4 px-4 text-white text-sm">
                      利用可能なルームがありません。
                    </p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {gameStarted && !gameEnded && (
          <>
            <div className="flex flex-col justify-center items-center space-y-4 w-full">
              <div className="w-full max-w-[480px] flex flex-col items-end justify-center px-2 sm:px-8">
                <div className="text-white text-sm pr-1 pb-1">
                  {formatTime(playerSide === "先手" ? gote時間 : sente時間)}
                </div>
                <div
                  className={cn(
                    "px-2 py-0.5 rounded-full w-fit text-sm bg-sky-600/80 backdrop-blur-sm border-2 border-sky-400/20 text-white",
                    playerSide === "先手" ? "bg-rose-600/80" : "bg-sky-600/80"
                  )}
                >
                  {playerSide === "先手" ? "後手" : "先手"}
                </div>
              </div>
              <div className="relative max-w-[480px]">
                <Board
                  visibleBoard={visibleBoard}
                  selectedCell={selectedCell}
                  lastMove={lastMove}
                  playerSide={playerSide}
                  onCellClick={handleCellClick}
                  selectedCapturedPiece={selectedCapturedPiece}
                />
                {currentPlayer !== playerSide && <WaitingOverlay />}
              </div>
              <div className="w-full max-w-[480px] flex flex-col justify-start px-2 sm:px-8 space-y-2">
                <div className="w-full max-w-[480px] flex justify-between items-center">
                  <div
                    className={cn(
                      "px-2 py-0.5 rounded-full text-sm bg-sky-600/80 backdrop-blur-sm border-2 border-sky-400/20 text-white",
                      playerSide === "先手" ? "bg-sky-600/80" : "bg-rose-600/80"
                    )}
                  >
                    {playerSide}
                  </div>
                  {currentPlayer === playerSide && (
                    <div className="text-white font-semibold">
                      あなたの番です
                    </div>
                  )}
                  <div className="w-[50px]"></div>
                </div>

                <div className="text-white text-sm pl-1">
                  {formatTime(playerSide === "先手" ? sente時間 : gote時間)}
                </div>
              </div>

              <div className="flex justify-between gap-4 max-w-[420px] w-full px-2">
                {playerSide === "先手" && gameStarted && (
                  <CapturedPieces
                    title="あなたの持ち駒"
                    pieces={capturedPieces["先手"]}
                    onPieceClick={(piece, index) =>
                      handleCapturedPieceClickWrapper(piece, index, "先手")
                    }
                    selectedPieceIndex={
                      playerSide === "先手" ? selectedPieceIndex : null
                    }
                  />
                )}
                {playerSide === "後手" && gameStarted && (
                  <CapturedPieces
                    title="あなたの持ち駒"
                    pieces={capturedPieces["後手"]}
                    onPieceClick={(piece, index) =>
                      handleCapturedPieceClickWrapper(piece, index, "後手")
                    }
                    selectedPieceIndex={
                      playerSide === "後手" ? selectedPieceIndex : null
                    }
                  />
                )}
              </div>
              <Button
                onClick={openResignDialog}
                className="mt-4 bg-red-600 hover:bg-red-700 text-white"
              >
                投了
              </Button>
            </div>
            <PromotionDialog onPromote={handlePromotionChoice} />
            <ResignDialog onResign={handleResign} />
          </>
        )}

        {gameEnded && (
          <div className="flex flex-col items-center space-y-4">
            <h2 className="text-2xl font-bold text-white">ゲーム終了</h2>
            {winner && (
              <p className="text-xl text-white">
                {winner === playerSide
                  ? "あなたの勝利です！"
                  : "相手の勝利です。"}
              </p>
            )}
            <div className="relative max-w-[450px]">
              <Board
                visibleBoard={convertBoardToVisible(board)} // 全ての駒を表示
                selectedCell={null}
                lastMove={null}
                playerSide={playerSide}
                selectedCapturedPiece={null}
                onCellClick={() => {}} // クリックを無効化
              />
            </div>
            <div className="flex space-x-4">
              <Button
                onClick={handleReturnToLobby}
                disabled={rematchRequested}
                className="bg-gray-600 hover:bg-gray-700 text-white"
              >
                ルームを抜ける
              </Button>
              {!rematchRequested && !opponentRequestedRematch && (
                <Button
                  onClick={requestRematch}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  再戦をリクエスト
                </Button>
              )}
              {opponentRequestedRematch && (
                <Button
                  onClick={acceptRematch}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  再戦を受け入れる
                </Button>
              )}
            </div>
            {rematchRequested && (
              <p className="text-white">相手の応答を待っています...</p>
            )}
            {opponentRequestedRematch && (
              <p className="text-white">相手が再戦をリクエストしています</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
