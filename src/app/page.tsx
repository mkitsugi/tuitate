"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";

type PieceType = "歩" | "香" | "桂" | "銀" | "金" | "角" | "飛" | "玉" | null;
type Player = "先手" | "後手";

interface Piece {
  type: PieceType;
  player: Player;
}

interface VisibleCell {
  piece: Piece | null;
  isVisible: boolean;
}

const initialBoard = (): (Piece | null)[][] => {
  const board: (Piece | null)[][] = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  // 先手の駒を配置
  board[8] = [
    { type: "香", player: "先手" },
    { type: "桂", player: "先手" },
    { type: "銀", player: "先手" },
    { type: "金", player: "先手" },
    { type: "玉", player: "先手" },
    { type: "金", player: "先手" },
    { type: "銀", player: "先手" },
    { type: "桂", player: "先手" },
    { type: "香", player: "先手" },
  ];
  board[7][1] = { type: "角", player: "先手" };
  board[7][7] = { type: "飛", player: "先手" };
  for (let i = 0; i < 9; i++) {
    board[6][i] = { type: "歩", player: "先手" };
  }

  // 後手の駒を配置
  board[0] = [
    { type: "香", player: "後手" },
    { type: "桂", player: "後手" },
    { type: "銀", player: "後手" },
    { type: "金", player: "後手" },
    { type: "玉", player: "後手" },
    { type: "金", player: "後手" },
    { type: "銀", player: "後手" },
    { type: "桂", player: "後手" },
    { type: "香", player: "後手" },
  ];
  board[1][7] = { type: "角", player: "後手" };
  board[1][1] = { type: "飛", player: "後手" };
  for (let i = 0; i < 9; i++) {
    board[2][i] = { type: "歩", player: "後手" };
  }

  return board;
};

export default function ImprovedFogOfWarShogi() {
  const [board, setBoard] = useState<(Piece | null)[][]>(initialBoard());
  const [visibleBoard, setVisibleBoard] = useState<VisibleCell[][]>(
    Array(9)
      .fill(null)
      .map(() => Array(9).fill({ piece: null, isVisible: false }))
  );
  const [currentPlayer, setCurrentPlayer] = useState<Player>("先手");
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(
    null
  );
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const [capturedPieces, setCapturedPieces] = useState<{
    先手: Piece[];
    後手: Piece[];
  }>({ 先手: [], 後手: [] });

  const getVisibleCellsForPiece = useCallback(
    (row: number, col: number, piece: Piece): [number, number][] => {
      const visibleCells: [number, number][] = [];
      // const directions: [number, number][] = [];
      const addVisibleCell = (r: number, c: number) => {
        if (r >= 0 && r < 9 && c >= 0 && c < 9) {
          visibleCells.push([r, c]);
          return board[r][c] === null;
        }
        return false;
      };

      const checkDirection = (
        dRow: number,
        dCol: number,
        maxSteps: number = 8
      ) => {
        let steps = 0;
        let newRow = row + dRow;
        let newCol = col + dCol;
        while (steps < maxSteps && addVisibleCell(newRow, newCol)) {
          newRow += dRow;
          newCol += dCol;
          steps++;
        }
      };

      switch (piece.type) {
        case "歩":
          addVisibleCell(row + (piece.player === "先手" ? -1 : 1), col);
          break;
        case "香":
          checkDirection(piece.player === "先手" ? -1 : 1, 0);
          break;
        case "桂":
          addVisibleCell(row + (piece.player === "先手" ? -2 : 2), col - 1);
          addVisibleCell(row + (piece.player === "先手" ? -2 : 2), col + 1);
          break;
        case "銀":
          [
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
            [piece.player === "先手" ? -1 : 1, 0],
          ].forEach(([dRow, dCol]) => addVisibleCell(row + dRow, col + dCol));
          break;
        case "金":
        case "玉":
          [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
            [-1, -1],
            [-1, 1],
          ].forEach(([dRow, dCol]) => addVisibleCell(row + dRow, col + dCol));
          if (piece.type === "金") {
            addVisibleCell(row + (piece.player === "先手" ? 1 : -1), col);
          }
          break;
        case "角":
          [
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ].forEach(([dRow, dCol]) => checkDirection(dRow, dCol));
          break;
        case "飛":
          [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ].forEach(([dRow, dCol]) => checkDirection(dRow, dCol));
          break;
      }

      return visibleCells;
    },
    [board]
  );

  const updateVisibleBoard = useCallback(() => {
    try {
      const newVisibleBoard: VisibleCell[][] = Array(9)
        .fill(null)
        .map(() =>
          Array(9)
            .fill(null)
            .map(() => ({ piece: null, isVisible: false }))
        );

      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          const piece = board[row][col];
          if (piece && piece.player === currentPlayer) {
            newVisibleBoard[row][col] = { piece, isVisible: true };
            const visibleCells = getVisibleCellsForPiece(row, col, piece);
            visibleCells.forEach(([r, c]) => {
              newVisibleBoard[r][c] = {
                piece: board[r][c],
                isVisible: true,
              };
            });
          }
        }
      }

      setVisibleBoard(newVisibleBoard);
    } catch (error) {
      console.error("Error in updateVisibleBoard:", error);
      toast({
        title: "エラーが発生しました",
        description: "盤面の更新中にエラーが発生しました。",
        variant: "destructive",
      });
    }
  }, [board, currentPlayer, getVisibleCellsForPiece]);

  useEffect(() => {
    updateVisibleBoard();
  }, [updateVisibleBoard, currentPlayer]);

  const isValidMove = useCallback(
    (from: [number, number], to: [number, number], piece: Piece): boolean => {
      const [fromRow, fromCol] = from;
      const [toRow, toCol] = to;
      const rowDiff = toRow - fromRow;
      const colDiff = toCol - fromCol;

      const targetPiece = board[toRow][toCol];
      if (targetPiece && targetPiece.player === piece.player) {
        return false; // 自分の駒がある場所には移動できない
      }

      const visibleCells = getVisibleCellsForPiece(fromRow, fromCol, piece);
      if (!visibleCells.some(([r, c]) => r === toRow && c === toCol)) {
        return false; // 移動先が見えない場所の場合は移動できない
      }

      // 角と飛車の移動経路をチェックする関数
      const checkPath = (rowStep: number, colStep: number): boolean => {
        let currentRow = fromRow + rowStep;
        let currentCol = fromCol + colStep;
        while (currentRow !== toRow || currentCol !== toCol) {
          if (board[currentRow][currentCol] !== null) {
            return false; // 経路上に駒があれば移動できない
          }
          currentRow += rowStep;
          currentCol += colStep;
        }
        return true;
      };

      switch (piece.type) {
        case "歩":
          return (
            colDiff === 0 &&
            (piece.player === "先手" ? rowDiff === -1 : rowDiff === 1)
          );
        case "香":
          return (
            colDiff === 0 &&
            (piece.player === "先手" ? rowDiff < 0 : rowDiff > 0) &&
            checkPath(Math.sign(rowDiff), 0)
          );
        case "桂":
          return (
            Math.abs(colDiff) === 1 &&
            (piece.player === "先手" ? rowDiff === -2 : rowDiff === 2)
          );
        case "銀":
          return (
            (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 1) ||
            (colDiff === 0 &&
              (piece.player === "先手" ? rowDiff === -1 : rowDiff === 1))
          );
        case "金":
          return (
            Math.abs(rowDiff) <= 1 &&
            Math.abs(colDiff) <= 1 &&
            !(Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 1)
          );
        case "角":
          return (
            Math.abs(rowDiff) === Math.abs(colDiff) &&
            checkPath(Math.sign(rowDiff), Math.sign(colDiff))
          );
        case "飛":
          return (
            ((rowDiff === 0 && colDiff !== 0) ||
              (rowDiff !== 0 && colDiff === 0)) &&
            checkPath(Math.sign(rowDiff), Math.sign(colDiff))
          );
        case "玉":
          return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
        default:
          return false;
      }
    },
    [board, getVisibleCellsForPiece]
  );

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      try {
        if (selectedCell) {
          const [selectedRow, selectedCol] = selectedCell;
          const selectedPiece = board[selectedRow][selectedCol];
          if (selectedPiece && selectedPiece.player === currentPlayer) {
            if (isValidMove(selectedCell, [row, col], selectedPiece)) {
              const newBoard = board.map((row) => [...row]);
              const targetPiece = newBoard[row][col];
              if (targetPiece) {
                // 相手の駒を取る
                setCapturedPieces((prev) => ({
                  ...prev,
                  [currentPlayer]: [
                    ...prev[currentPlayer],
                    { ...targetPiece, player: currentPlayer },
                  ],
                }));
              }
              newBoard[row][col] = selectedPiece;
              newBoard[selectedRow][selectedCol] = null;
              setBoard(newBoard);
              setCurrentPlayer(currentPlayer === "先手" ? "後手" : "先手");
              setLastMove([row, col]);
            }
          }
          setSelectedCell(null);
        } else {
          const piece = board[row][col];
          if (piece && piece.player === currentPlayer) {
            setSelectedCell([row, col]);
          }
        }
      } catch (error) {
        console.error("Error in handleCellClick:", error);
        toast({
          title: "エラーが発生しました",
          description: "駒の移動中にエラーが発生しました。",
          variant: "destructive",
        });
      }
    },
    [board, currentPlayer, selectedCell, isValidMove]
  );

  const resetGame = useCallback(() => {
    setBoard(initialBoard());
    setCurrentPlayer("先手");
    setSelectedCell(null);
    setLastMove(null);
    setCapturedPieces({ 先手: [], 後手: [] });
  }, []);

  return (
    <Card className="w-full max-w-4xl mx-auto bg-bgprimary">
      <CardContent className="p-6">
        <h1 className="text-3xl font-bold mb-6 text-center text-textprimary">
          霧の将棋
        </h1>
        <div className="flex justify-between items-start mb-6">
          <div
            className={`text-2xl font-semibold p-2 rounded ${
              currentPlayer === "先手"
                ? "bg-red-100 text-red-800"
                : "bg-blue-100 text-blue-800"
            }`}
          >
            現在の手番: {currentPlayer}
          </div>
          <Button onClick={resetGame}>ゲームをリセット</Button>
        </div>
        <div className="flex justify-between mb-4">
          <div className="grid grid-cols-3 gap-2 bg-bgaccent p-4 rounded-lg">
            <div className="text-center font-semibold mb-2 col-span-3">
              先手の持ち駒
            </div>
            {capturedPieces["先手"].map((piece, index) => (
              <div
                key={index}
                className="w-8 h-8 flex items-center justify-center bg-bgprimary rounded text-red-600"
              >
                {piece.type}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2 bg-bgaccent p-4 rounded-lg">
            <div className="text-center font-semibold mb-2 col-span-3">
              後手の持ち駒
            </div>
            {capturedPieces["後手"].map((piece, index) => (
              <div
                key={index}
                className="w-8 h-8 flex items-center justify-center bg-bgprimary rounded text-blue-600"
              >
                {piece.type}
              </div>
            ))}
          </div>
        </div>
        <div
          className="grid grid-cols-9 gap-1 mb-4 bg-bgaccent p-4 rounded-lg"
          role="grid"
          aria-label="将棋盤"
        >
          {visibleBoard.map((row, rowIndex) =>
            row.map((cell, colIndex) => (
              <button
                key={`${rowIndex}-${colIndex}`}
                className={`w-12 h-12 flex items-center justify-center border-2 ${
                  selectedCell &&
                  selectedCell[0] === rowIndex &&
                  selectedCell[1] === colIndex
                    ? "border-textaccent"
                    : lastMove &&
                      lastMove[0] === rowIndex &&
                      lastMove[1] === colIndex
                    ? "border-yellow-400"
                    : "border-borderprimary"
                } ${
                  cell.isVisible
                    ? "bg-bgprimary hover:bg-bgaccent/80"
                    : "bg-gray-800"
                }`}
                onClick={() => handleCellClick(rowIndex, colIndex)}
                aria-label={
                  cell.isVisible
                    ? cell.piece
                      ? `${cell.piece.player}の${cell.piece.type}`
                      : `空のマス (${rowIndex + 1}, ${colIndex + 1})`
                    : "不可視のマス"
                }
                role="gridcell"
                disabled={!cell.isVisible}
              >
                {cell.isVisible && cell.piece && (
                  <span
                    className={`text-lg font-semibold ${
                      cell.piece.player === "後手"
                        ? "transform rotate-180 text-blue-600"
                        : "text-red-600"
                    }`}
                  >
                    {cell.piece.type}
                  </span>
                )}
              </button>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
