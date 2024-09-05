import React, { useMemo } from "react";
import Image from "next/image";
import { Player, Piece, VisibleCell } from "@shared/shogi";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface BoardProps {
  visibleBoard: VisibleCell[][];
  selectedCell: [number, number] | null;
  lastMove: {
    from: [number, number];
    to: [number, number];
    piece: Piece;
    capturedPiece: Piece | null;
  } | null;
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
      className="w-full grid grid-cols-9 bg-slate-50/10 backdrop-blur-sm rounded-md shadow-lg select-none overflow-hidden"
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
              className={cn(
                "w-11 h-11 rounded-[4px] flex items-center justify-center border transition-colors duration-200",
                {
                  "bg-yellow-200":
                    lastMove &&
                    lastMove.from[0] === actualRow &&
                    lastMove.from[1] === actualCol,
                  "bg-yellow-100":
                    !isSelected &&
                    (!lastMove ||
                      lastMove.from[0] !== actualRow ||
                      lastMove.from[1] !== actualCol),
                },
                cell.isVisible
                  ? "bg-white border-slate-300"
                  : "bg-white/10 border-white/10"
              )}
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
                <motion.div
                  className={cn(
                    "w-10 h-10 relative",
                    isSelected && "ring-4 ring-yellow-400 bg-yellow-300"
                  )}
                  layoutId={cell.piece.id}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                >
                  <Image
                    src={`/pieces/${cell.piece.type}.png`}
                    className={cn({
                      "transform rotate-180": cell.piece.player !== playerSide,
                    })}
                    alt={`${cell.piece.player}の${cell.piece.type}`}
                    layout="fill"
                    objectFit="contain"
                    draggable="false"
                  />
                </motion.div>
              )}
            </button>
          );
        })
      )}
    </div>
  );
}
