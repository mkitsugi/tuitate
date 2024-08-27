import React, { useState, useCallback, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
// import { toast } from "@/components/ui/use-toast";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Board from "./Board";
import CapturedPieces from "./CapturedPieces";
import WaitingOverlay from "./WaitingOverlay";
import useSocket from "@/hooks/useSocket";
import useGameLogic from "@/hooks/useGameLogic";
import { Player, Piece } from "@/types/shogi";
import { Loader2, Copy } from "lucide-react";
import RulesDialog from "./Rules";

export default function ImprovedFogOfWarShogi() {
  const [inputGameId, setInputGameId] = useState<string>("");
  const [selectedSide, setSelectedSide] = useState<Player | null>(null);
  const {
    socket,
    gameId,
    playerSide,
    gameCreated,
    gameStarted,
    availableSides,
    createGame,
    joinGame,
    existingRooms,
    isLoadingRooms,
    findExistingRooms,
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
  } = useGameLogic(socket, gameId, playerSide);

  // 選択された持ち駒のインデックスを追跡するための状態
  const [selectedPieceIndex, setSelectedPieceIndex] = useState<number | null>(
    null
  );

  // 初回マウント時にルーム一覧を取得
  useEffect(() => {
    findExistingRooms();
  }, [findExistingRooms]);

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

  return (
    <div className="flex justify-center items-center w-full h-full z-10">
      <div className="space-y-6 px-4 w-full">
        {!gameStarted && (
          <Card className="mx-auto bg-white/10 backdrop-blur-md border border-white/20 shadow-lg w-full max-w-[450px] py-8 overflow-hidden">
            <CardContent className="p-2">
              <div className="flex flex-col justify-between items-start gap-4">
                <h1 className="text-3xl w-full font-black mt-4 mb-4 text-center text-white">
                  霧将棋
                </h1>

                <div className="w-full space-y-4">
                  <div className="flex flex-col gap-2 w-full px-4">
                    {!gameCreated && (
                      <>
                        {!inputGameId && (
                          <>
                            <div className="flex flex-row items-center w-full space-x-2">
                              <Button
                                onClick={() => {
                                  createGame();
                                  playMoveSound();
                                }}
                                className="w-full sm:w-auto bg-black/80 backdrop-blur-sm border border-white/50 text-white hover:bg-black transition-colors"
                                // className="w-full sm:w-auto mt-4"
                              >
                                新しいルームを作成
                              </Button>

                              <Button
                                onClick={() => {
                                  findExistingRooms();
                                  playMoveSound();
                                }}
                                className="w-full sm:w-auto bg-gray-600/80 backdrop-blur-sm border border-white/50 text-white hover:bg-gray-700 transition-colors"
                              >
                                既存のルームを探す
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

              <div className="flex justify-start items-center pt-2 px-4">
                <RulesDialog />
                {gameId && (
                  <div className="flex w-full mt-4 items-center text-sm text-white text-center justify-center space-x-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={copyGameId}
                      title="ルームIDをコピー"
                      className="w-fit px-4 rounded-full bg-black/80 backdrop-blur-sm hover:none"
                    >
                      <div className="flex items-center justify-center space-x-2">
                        <p>ルームID : {gameId}</p>
                        <Copy className="h-4 w-4" />
                      </div>
                    </Button>
                  </div>
                )}
              </div>

              {isLoadingRooms && (
                <p className="px-4 pt-4 text-white text-sm">
                  ルームを検索中...
                </p>
              )}
              {existingRooms.length > 0 && (
                <div className="mt-4 px-4">
                  <h3 className="text-sm text-white mb-2">利用可能なルーム:</h3>
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
            </CardContent>
          </Card>
        )}

        {gameStarted && (
          <>
            <div className="flex flex-col justify-center items-center space-y-4">
              <div className="relative max-w-[450px]">
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

              <div className="flex justify-between gap-4 max-w-[400px] px-6 w-full">
                {playerSide === "先手" && gameStarted && (
                  <CapturedPieces
                    title="あなた（先手）の持ち駒"
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
                    title="あなた（後手）の持ち駒"
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
            </div>
            <PromotionDialog onPromote={handlePromotionChoice} />
          </>
        )}
      </div>
    </div>
  );
}
