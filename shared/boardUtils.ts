import {
  Board,
  Piece,
  Player,
  VisibleCell,
  PieceType,
  PromotedPieceType,
} from "./shogi";

let pieceIdCounter = 0;

const createPiece = (
  type: PieceType | PromotedPieceType,
  player: Player,
  promoted: boolean
): Piece => ({
  id: `piece-${pieceIdCounter++}`,
  type,
  player,
  promoted,
});

export const initialBoard = (): (Piece | null)[][] => {
  const board: (Piece | null)[][] = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  // 先手の駒を配置
  board[8] = [
    createPiece("香", "先手", false),
    createPiece("桂", "先手", false),
    createPiece("銀", "先手", false),
    createPiece("金", "先手", false),
    createPiece("王", "先手", false),
    createPiece("金", "先手", false),
    createPiece("銀", "先手", false),
    createPiece("桂", "先手", false),
    createPiece("香", "先手", false),
  ];
  board[7][1] = createPiece("角", "先手", false);
  board[7][7] = createPiece("飛", "先手", false);
  for (let i = 0; i < 9; i++) {
    board[6][i] = createPiece("歩", "先手", false);
  }

  // 後手の駒を配置
  board[0] = [
    createPiece("香", "後手", false),
    createPiece("桂", "後手", false),
    createPiece("銀", "後手", false),
    createPiece("金", "後手", false),
    createPiece("王", "後手", false),
    createPiece("金", "後手", false),
    createPiece("銀", "後手", false),
    createPiece("桂", "後手", false),
    createPiece("香", "後手", false),
  ];
  board[1][7] = createPiece("角", "後手", false);
  board[1][1] = createPiece("飛", "後手", false);
  for (let i = 0; i < 9; i++) {
    board[2][i] = createPiece("歩", "後手", false);
  }

  return board;
};

export const initializeVisibleBoard = (
  board: (Piece | null)[][],
  playerSide: Player
): VisibleCell[][] => {
  const newVisibleBoard: VisibleCell[][] = Array(9)
    .fill(null)
    .map(() => Array(9).fill({ piece: null, isVisible: false }));

  if (playerSide) {
    const playerRows = playerSide === "先手" ? [6, 7, 8] : [0, 1, 2];
    playerRows.forEach((row) => {
      for (let col = 0; col < 9; col++) {
        const actualRow: number = playerSide === "後手" ? 8 - row : row;
        const actualCol: number = playerSide === "後手" ? 8 - col : col;
        const piece: Piece | null = board[actualRow][actualCol];
        if (piece && piece.player === playerSide) {
          newVisibleBoard[row][col] = {
            piece: piece,
            isVisible: true,
          };
        }
      }
    });
  }
  return newVisibleBoard;
};

export const isValidMove = (
  from: [number, number],
  to: [number, number],
  piece: Piece,
  board: (Piece | null)[][]
): boolean => {
  const [fromRow, fromCol] = from;
  const [toRow, toCol] = to;
  const rowDiff = toRow - fromRow;
  const colDiff = toCol - fromCol;
  const direction = piece.player === "先手" ? -1 : 1;

  const isDiagonalMove = Math.abs(rowDiff) === Math.abs(colDiff);
  const isStraightMove = rowDiff === 0 || colDiff === 0;

  const checkPath = (rowStep: number, colStep: number): boolean => {
    let r = fromRow + rowStep;
    let c = fromCol + colStep;
    while (r !== toRow || c !== toCol) {
      if (board[r][c] !== null) {
        return false; // Path is blocked
      }
      r += rowStep;
      c += colStep;
    }
    return true; // Path is clear
  };

  switch (piece.type) {
    case "歩":
      return colDiff === 0 && rowDiff === direction;
    case "香":
      return (
        colDiff === 0 && rowDiff * direction > 0 && checkPath(direction, 0)
      );
    case "桂":
      return Math.abs(colDiff) === 1 && rowDiff === 2 * direction;
    case "銀":
      return (
        (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 1) ||
        (rowDiff === direction && colDiff === 0)
      );
    case "金":
    case "と":
    case "成香":
    case "成桂":
    case "成銀":
      return (
        Math.abs(rowDiff) <= 1 &&
        Math.abs(colDiff) <= 1 &&
        !(rowDiff === -direction && Math.abs(colDiff) === 1)
      );
    case "王":
      return (
        Math.abs(rowDiff) <= 1 &&
        Math.abs(colDiff) <= 1 &&
        (rowDiff !== 0 || colDiff !== 0)
      );
    case "角":
      if (isDiagonalMove) {
        return checkPath(rowDiff > 0 ? 1 : -1, colDiff > 0 ? 1 : -1);
      }
      return piece.promoted && Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
    case "飛":
      if (isStraightMove) {
        return checkPath(
          rowDiff !== 0 ? (rowDiff > 0 ? 1 : -1) : 0,
          colDiff !== 0 ? (colDiff > 0 ? 1 : -1) : 0
        );
      }
      return piece.promoted && Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
    case "馬":
      if (isDiagonalMove) {
        return checkPath(rowDiff > 0 ? 1 : -1, colDiff > 0 ? 1 : -1);
      }
      return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
    case "龍":
      if (isStraightMove) {
        return checkPath(
          rowDiff !== 0 ? (rowDiff > 0 ? 1 : -1) : 0,
          colDiff !== 0 ? (colDiff > 0 ? 1 : -1) : 0
        );
      }
      return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
    default:
      return false;
  }
};

export const checkPromotion = (
  from: [number, number],
  to: [number, number],
  piece: Piece
): boolean => {
  const [fromRow] = from;
  const [toRow] = to;

  if (piece.promoted) {
    return false; // すでに成っている駒は成れない
  }

  // 成れない駒の種類をチェック
  if (
    ["金", "王", "と", "成香", "成桂", "成銀", "馬", "龍"].includes(
      piece.type as string
    )
  ) {
    return false;
  }

  if (piece.player === "先手") {
    // 先手の場合、相手陣地（0, 1, 2行目）に入るか、そこから出る場合に成れる
    return toRow <= 2 || (fromRow <= 2 && toRow > 2);
  } else {
    // 後手の場合、相手陣地（6, 7, 8行目）に入るか、そこから出る場合に成れる
    return toRow >= 6 || (fromRow >= 6 && toRow < 6);
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
      break;
    case "銀":
      addVisibleCell(row + direction, col - 1);
      addVisibleCell(row + direction, col);
      addVisibleCell(row + direction, col + 1);
      addVisibleCell(row - direction, col - 1);
      addVisibleCell(row - direction, col + 1);
      break;
    case "金":
    case "と":
    case "成香":
    case "成桂":
    case "成銀":
      addGoldMoves(row, col, direction, addVisibleCell);
      break;
    case "角":
      addLineOfSight(row, col, 1, 1);
      addLineOfSight(row, col, 1, -1);
      addLineOfSight(row, col, -1, 1);
      addLineOfSight(row, col, -1, -1);
      if (piece.promoted) {
        addKingMoves(row, col, addVisibleCell);
      }
      break;
    case "飛":
      addLineOfSight(row, col, 1, 0);
      addLineOfSight(row, col, -1, 0);
      addLineOfSight(row, col, 0, 1);
      addLineOfSight(row, col, 0, -1);
      if (piece.promoted) {
        addKingMoves(row, col, addVisibleCell);
      }
      break;
    case "王":
      addKingMoves(row, col, addVisibleCell);
      break;
    case "馬":
      addDiagonalMoves(row, col, addVisibleCell);
      addKingMoves(row, col, addVisibleCell);
      break;
    case "龍":
      addStraightMoves(row, col, board, addVisibleCell);
      addKingMoves(row, col, addVisibleCell);
      break;
  }

  return visibleCells;
};

const addGoldMoves = (
  row: number,
  col: number,
  direction: number,
  addVisibleCell: (r: number, c: number) => void
) => {
  addVisibleCell(row + direction, col - 1);
  addVisibleCell(row + direction, col);
  addVisibleCell(row + direction, col + 1);
  addVisibleCell(row, col - 1);
  addVisibleCell(row, col + 1);
  addVisibleCell(row - direction, col);
};

const addDiagonalMoves = (
  row: number,
  col: number,
  addVisibleCell: (r: number, c: number) => void
) => {
  for (let i = 1; i < 9; i++) {
    addVisibleCell(row + i, col + i);
    addVisibleCell(row + i, col - i);
    addVisibleCell(row - i, col + i);
    addVisibleCell(row - i, col - i);
  }
};

const addStraightMoves = (
  row: number,
  col: number,
  board: (Piece | null)[][],
  addVisibleCell: (r: number, c: number) => void
) => {
  // 上方向
  for (let i = row - 1; i >= 0; i--) {
    addVisibleCell(i, col);
    if (board[i][col] !== null) break;
  }
  // 下方向
  for (let i = row + 1; i < 9; i++) {
    addVisibleCell(i, col);
    if (board[i][col] !== null) break;
  }
  // 左方向
  for (let i = col - 1; i >= 0; i--) {
    addVisibleCell(row, i);
    if (board[row][i] !== null) break;
  }
  // 右方向
  for (let i = col + 1; i < 9; i++) {
    addVisibleCell(row, i);
    if (board[row][i] !== null) break;
  }
};

const addKingMoves = (
  row: number,
  col: number,
  addVisibleCell: (r: number, c: number) => void
) => {
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      if (r !== row || c !== col) {
        addVisibleCell(r, c);
      }
    }
  }
};

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

export function isInCheck(board: Board, player: Player): boolean {
  const kingPosition = findKing(board, player);
  if (!kingPosition) return false;

  const opponent: Player = player === "先手" ? "後手" : "先手";
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece && piece.player === opponent) {
        if (isValidMove([row, col], kingPosition, piece, board)) {
          return true;
        }
      }
    }
  }
  return false;
}

export function findKing(
  board: Board,
  player: Player
): [number, number] | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece && piece.type === "王" && piece.player === player) {
        return [row, col];
      }
    }
  }
  return null;
}

export function canPromote(
  from: [number, number],
  to: [number, number],
  piece: Piece
): boolean {
  const [fromRow] = from;
  const [toRow] = to;

  if (piece.promoted) {
    return false;
  }

  if (piece.player === "先手") {
    return toRow <= 2 || (fromRow <= 2 && toRow > 2);
  } else {
    return toRow >= 6 || (fromRow >= 6 && toRow < 6);
  }
}
