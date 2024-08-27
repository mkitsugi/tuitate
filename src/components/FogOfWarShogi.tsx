import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Board from "./Board";
import CapturedPieces from "./CapturedPieces";
import WaitingOverlay from "./WaitingOverlay";
import useSocket from "@/hooks/useSocket";
import useGameLogic from "@/hooks/useGameLogic";
import { Player, Piece } from "@/types/shogi";
import { Loader2, Copy } from "lucide-react";

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
  } = useSocket();

  const {
    board,
    visibleBoard,
    currentPlayer,
    selectedCell,
    lastMove,
    capturedPieces,
    selectedCapturedPiece,
    playMoveSound,
    handleCellClick,
    handleCapturedPieceClick,
  } = useGameLogic(socket, gameId, playerSide);

  // 選択された持ち駒のインデックスを追跡するための状態
  const [selectedPieceIndex, setSelectedPieceIndex] = useState<number | null>(
    null
  );

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
    toast({
      description: "ルームIDをクリップボードにコピーしました。",
    });
  }, [gameId]);

  return (
    <div className="flex justify-center items-center w-full h-full">
      <div className="space-y-6 px-4 w-full">
        {!gameStarted && (
          <div className="flex flex-col justify-between items-start gap-4">
            <div className="w-full space-y-4">
              <div className="flex flex-col gap-2 w-full">
                {!gameCreated && (
                  <>
                    {!inputGameId && (
                      <Button
                        onClick={() => {
                          createGame();
                          playMoveSound();
                        }}
                        className="w-full sm:w-auto mt-4"
                      >
                        新しいルームを作成
                      </Button>
                    )}

                    <div className="w-full sm:w-auto mt-2">
                      <Label htmlFor="gameId">友達のルームに参加</Label>
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
                        className="mt-4 w-full bg-sky-600 hover:bg-sky-700"
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
                        className="mt-2 w-full bg-rose-600 hover:bg-rose-700"
                      >
                        後手として参加
                      </Button>
                    )}
                    {selectedSide && !gameStarted && (
                      <div className="mt-4 text-center w-full">
                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
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
        )}

        {gameId && (
          <div className="text-sm text-gray-600 text-center flex items-center justify-center space-x-2">
            <p>作成したルームID: {gameId}</p>
            <Button
              variant="ghost"
              size="icon"
              onClick={copyGameId}
              title="ルームIDをコピー"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        )}

        {gameStarted && (
          <div className="relative">
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
        )}
        <div className="flex justify-between gap-4">
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
    </div>
  );
}
