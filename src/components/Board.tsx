import React from "react";
import { Player, Piece, VisibleCell } from "@/types/shogi";

interface BoardProps {
  visibleBoard: VisibleCell[][];
  selectedCell: [number, number] | null;
  lastMove: [number, number] | null;
  playerSide: Player | null;
  onCellClick: (row: number, col: number) => void;
  selectedCapturedPiece: Piece | null;
}
// ... existing imports ...

export default function Board({
  visibleBoard,
  selectedCell,
  lastMove,
  playerSide,
  onCellClick,
  selectedCapturedPiece,
}: BoardProps) {
  const reversedBoard =
    playerSide === "後手"
      ? [...visibleBoard].reverse().map((row) => [...row].reverse())
      : visibleBoard;

  return (
    <div
      className="grid grid-cols-9 gap-[1px] bg-slate-50/10 backdrop-blur-sm p-4 rounded-lg shadow-lg"
      role="grid"
      aria-label="将棋盤"
    >
      {reversedBoard.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const actualRow = playerSide === "後手" ? 8 - rowIndex : rowIndex;
          const actualCol = playerSide === "後手" ? 8 - colIndex : colIndex;
          const isSelected =
            selectedCell &&
            selectedCell[0] === actualRow &&
            selectedCell[1] === actualCol;

          return (
            <button
              key={`${rowIndex}-${colIndex}`}
              className={`w-8 h-8 rounded-sm flex items-center justify-center border ${
                isSelected ? "border-yellow-500 border-2" : "border-yellow-800"
              } ${
                isSelected
                  ? "bg-green-300"
                  : lastMove &&
                    lastMove[0] === actualRow &&
                    lastMove[1] === actualCol
                  ? "bg-yellow-200"
                  : "bg-yellow-100"
              } ${
                cell.isVisible ? "bg-yellow-100" : "bg-gray-800"
              } transition-colors duration-200`}
              onClick={() => onCellClick(actualRow, actualCol)}
              aria-label={
                cell.isVisible
                  ? cell.piece
                    ? `${cell.piece.player}の${cell.piece.type}`
                    : `空のマス (${actualRow + 1}, ${actualCol + 1})`
                  : "不可視のマス"
              }
              role="gridcell"
              disabled={!cell.isVisible && !selectedCapturedPiece}
            >
              {cell.isVisible && cell.piece && (
                <span
                  className={`text-2xl font-bold ${
                    cell.piece.player !== playerSide
                      ? "transform rotate-180 text-blue-600"
                      : "text-rose-700"
                  } ${
                    isSelected
                      ? "ring-2 ring-yellow-500 bg-yellow-300 px-0.5"
                      : ""
                  }`}
                >
                  {cell.piece.type}
                </span>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
