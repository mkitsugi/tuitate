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
    <div className="bg-gray-100 p-4 rounded-lg flex-1">
      <h3 className="text-center font-semibold mb-2 text-gray-700">{title}</h3>
      <div className="flex flex-wrap gap-2 justify-start">
        {pieces.map((piece, index) => {
          const isSelected = selectedPieceIndex === index;
          return (
            <button
              key={index}
              className={`w-8 h-8 flex items-center justify-center rounded-md shadow text-gray-800 transition-colors duration-200 ${
                isSelected
                  ? "bg-green-300 ring-2 ring-green-500"
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
