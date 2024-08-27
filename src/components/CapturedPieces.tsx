import React from "react";
import { Piece } from "@/types/shogi";

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
  return (
    <div className="bg-white/60 border border-white/50 px-3 py-2 rounded-lg flex flex-col w-full gap-2 items-start justify-center">
      <div className="text-xs text-black text-center font-semibold">
        {title}
      </div>
      <div className="flex flex-wrap gap-2 justify-center">
        {pieces.map((piece, index) => {
          const isSelected = selectedPieceIndex === index;
          return (
            <button
              key={index}
              className={`w-8 h-8 flex items-center justify-center rounded-md shadow text-gray-800 transition-colors duration-200 ${
                isSelected
                  ? "bg-yellow-300 ring-2 ring-yellow-500"
                  : "bg-white hover:bg-gray-200"
              }`}
              onClick={() => onPieceClick(piece, index)}
            >
              {piece.type}
            </button>
          );
        })}
      </div>
    </div>
  );
}
