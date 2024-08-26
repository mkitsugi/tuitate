import { Piece, PieceType, PromotedPieceType } from "@/types/shogi";

export const getPromotedType = (
  type: PieceType | PromotedPieceType
): PromotedPieceType => {
  switch (type) {
    case "歩":
      return "と";
    case "香":
      return "成香";
    case "桂":
      return "成桂";
    case "銀":
      return "成銀";
    case "角":
      return "馬";
    case "飛":
      return "龍";
    default:
      return type as PromotedPieceType;
  }
};

export const getOriginalType = (
  type: PieceType | PromotedPieceType
): PieceType => {
  switch (type) {
    case "と":
      return "歩";
    case "成香":
      return "香";
    case "成桂":
      return "桂";
    case "成銀":
      return "銀";
    case "馬":
      return "角";
    case "龍":
      return "飛";
    default:
      return type as PieceType;
  }
};

export const getVisibleCellsForPiece = (
  row: number,
  col: number,
  piece: Piece,
  board: (Piece | null)[][]
): [number, number][] => {
  const visibleCells: [number, number][] = [];
  const addVisibleCell = (r: number, c: number) => {
    if (r >= 0 && r < 9 && c >= 0 && c < 9) {
      visibleCells.push([r, c]);
    }
  };

  const direction = piece.player === "先手" ? -1 : 1;

  const addLineOfSight = (
    startRow: number,
    startCol: number,
    rowStep: number,
    colStep: number
  ) => {
    let r = startRow + rowStep;
    let c = startCol + colStep;
    while (r >= 0 && r < 9 && c >= 0 && c < 9) {
      addVisibleCell(r, c);
      if (board[r][c] !== null) break; // 駒があれば、そこで視線が遮られる
      r += rowStep;
      c += colStep;
    }
  };

  const addGoldMoves = () => {
    addVisibleCell(row + direction, col - 1);
    addVisibleCell(row + direction, col);
    addVisibleCell(row + direction, col + 1);
    addVisibleCell(row, col - 1);
    addVisibleCell(row, col + 1);
    addVisibleCell(row - direction, col);
  };

  const addKingMoves = () => {
    for (let r = row - 1; r <= row + 1; r++) {
      for (let c = col - 1; c <= col + 1; c++) {
        if (r !== row || c !== col) {
          addVisibleCell(r, c);
        }
      }
    }
  };

  switch (piece.type) {
    case "歩":
      addVisibleCell(row + direction, col);
      break;
    case "香":
      addLineOfSight(row, col, direction, 0);
      break;
    case "桂":
      addVisibleCell(row + 2 * direction, col - 1);
      addVisibleCell(row + 2 * direction, col + 1);
      if (piece.promoted) {
        addGoldMoves();
      }
      break;
    case "銀":
      addVisibleCell(row + direction, col - 1);
      addVisibleCell(row + direction, col);
      addVisibleCell(row + direction, col + 1);
      addVisibleCell(row - direction, col - 1);
      addVisibleCell(row - direction, col + 1);
      if (piece.promoted) {
        addGoldMoves();
      }
      break;
    case "金":
    case "と":
    case "成香":
    case "成桂":
    case "成銀":
      addGoldMoves();
      break;
    case "角":
      addLineOfSight(row, col, 1, 1);
      addLineOfSight(row, col, 1, -1);
      addLineOfSight(row, col, -1, 1);
      addLineOfSight(row, col, -1, -1);
      if (piece.promoted) {
        addKingMoves();
      }
      break;
    case "飛":
      addLineOfSight(row, col, 0, 1);
      addLineOfSight(row, col, 0, -1);
      addLineOfSight(row, col, 1, 0);
      addLineOfSight(row, col, -1, 0);
      if (piece.promoted) {
        addKingMoves();
      }
      break;
    case "玉":
      addKingMoves();
      break;
    case "馬":
      addLineOfSight(row, col, 1, 1);
      addLineOfSight(row, col, 1, -1);
      addLineOfSight(row, col, -1, 1);
      addLineOfSight(row, col, -1, -1);
      addKingMoves();
      break;
    case "龍":
      addLineOfSight(row, col, 0, 1);
      addLineOfSight(row, col, 0, -1);
      addLineOfSight(row, col, 1, 0);
      addLineOfSight(row, col, -1, 0);
      addKingMoves();
      break;
  }

  return visibleCells;
};
