import React from "react";
import { Piece } from "@shared/shogi";
import Image from "next/image";
import { motion } from "framer-motion";

interface CapturedPiecesProps {
  title: string;
  pieces: Piece[];
  onPieceClick: (piece: Piece, index: number) => void;
  selectedPieceIndex: number | null;
}

export default function CapturedPieces({
  title,
  pieces,
  onPieceClick,
  selectedPieceIndex,
}: CapturedPiecesProps) {
  // 駒の種類ごとにグループ化する
  const groupedPieces = pieces.reduce((acc, piece) => {
    acc[piece.type ?? ""] = (acc[piece.type ?? ""] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="bg-white/60 border border-white/50 px-3 py-2 min-h-[85px] rounded-lg flex flex-col w-full gap-2 items-start justify-start">
      <div className="text-xs text-black text-center">{title}</div>
      <div className="flex flex-wrap gap-2 justify-center">
        {Object.entries(groupedPieces).map(([pieceType, count], index) => {
          const isSelected = selectedPieceIndex === index;
          return (
            <button
              key={pieceType}
              className={`w-10 h-10 flex items-center justify-center rounded-md text-gray-800 transition-colors duration-200 select-none ${isSelected
                ? "bg-yellow-300 ring-2 ring-yellow-500"
                : "bg-none border-none"
                }`}
              onClick={() => onPieceClick({ type: pieceType } as Piece, index)}
            >
              <div
                className="w-10 h-10 relative"
                // layoutId={pieceType}
                key={pieceType}
              // transition={{ type: "spring", stiffness: 300, damping: 30 }}
              >
                <Image
                  src={`/pieces/v2/${pieceType}.png`}
                  alt={`${pieceType}`}
                  layout="fill"
                  objectFit="contain"
                />
                {count > 1 && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {count}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
