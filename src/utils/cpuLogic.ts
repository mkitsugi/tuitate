import {
  Board,
  Piece,
  Player,
  PieceType,
  PromotedPieceType,
} from "@shared/shogi";
import {
  isValidMove,
  getVisibleCellsForPiece,
  movePiece,
  canPromote,
  getPromotedType,
} from "@shared/boardUtils";

// 駒の価値
const pieceValues: {
  [key in Exclude<PieceType | PromotedPieceType, null>]: number;
} = {
  歩: 1,
  香: 4,
  桂: 4,
  銀: 5,
  金: 6,
  角: 8,
  飛: 10,
  王: 100,
  と: 7,
  成香: 6,
  成桂: 6,
  成銀: 6,
  馬: 12,
  龍: 14,
};

// 駒の位置評価テーブル（例: 歩兵）
const pawnPositionValues = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [2, 2, 2, 2, 2, 2, 2, 2, 2],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [-1, -1, -1, -1, -1, -1, -1, -1, -1],
  [-2, -2, -2, -2, -2, -2, -2, -2, -2],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
];

const lancePositionValues = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 3, 3, 3, 3, 3, 3, 3, 3],
  [2, 2, 2, 2, 2, 2, 2, 2, 2],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [-1, -1, -1, -1, -1, -1, -1, -1, -1],
  [-2, -2, -2, -2, -2, -2, -2, -2, -2],
  [-3, -3, -3, -3, -3, -3, -3, -3, -3],
];

const knightPositionValues = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [3, 3, 3, 3, 3, 3, 3, 3, 3],
  [2, 2, 2, 2, 2, 2, 2, 2, 2],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [-1, -1, -1, -1, -1, -1, -1, -1, -1],
  [-2, -2, -2, -2, -2, -2, -2, -2, -2],
  [-3, -3, -3, -3, -3, -3, -3, -3, -3],
];

const silverPositionValues = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 1, 3, 3, 3, 3, 3, 1, 1],
  [0, 1, 2, 2, 2, 2, 2, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [-1, -1, -1, -1, -1, -1, -1, -1, -1],
  [-2, -2, -2, -2, -2, -2, -2, -2, -2],
];

const goldPositionValues = [
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2, 2, 2, 2, 1],
  [1, 2, 3, 3, 3, 3, 3, 2, 1],
  [0, 1, 2, 2, 2, 2, 2, 1, 0],
  [0, 0, 1, 1, 1, 1, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0],
  [-1, -1, -1, -1, -1, -1, -1, -1, -1],
  [-2, -2, -2, -2, -2, -2, -2, -2, -2],
];

// 可視範囲内の駒のみを考慮した評価関数
function evaluateBoard(board: Board, player: Player, visibleCells: boolean[][]): number {
  let score = 0;
  let pieceCount = 0;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      if (visibleCells[row][col]) {
        const piece = board[row][col];
        if (piece && piece.type && piece.type in pieceValues) {
          const pieceValue = pieceValues[piece.type];

          let positionValue = 0;

          switch (piece.type) {
            case '歩':
              positionValue = pawnPositionValues[row][col];
              break;
            case '香':
              positionValue = lancePositionValues[row][col];
              break;
            case '桂':
              positionValue = knightPositionValues[row][col];
              break;
            case '銀':
              positionValue = silverPositionValues[row][col];
              break;
            case '金':
            case 'と':
            case '成香':
            case '成桂':
            case '成銀':
              positionValue = goldPositionValues[row][col];
              break;
            // 他の駒タイプに対する位置評価を追加できます
          }

          if (piece.player === player) {
            score += pieceValue + positionValue;
            pieceCount++;
          } else {
            score -= pieceValue - positionValue;
          }
        }
      }
    }
  }

  // 終盤戦略: 駒が少なくなったら王を中央に寄せる評価を追加
  if (pieceCount < 10) {
    const kingPos = findKingPosition(board, player);
    if (kingPos) {
      const [kingRow, kingCol] = kingPos;
      const centerDistance = Math.abs(4 - kingRow) + Math.abs(4 - kingCol);
      score -= centerDistance * 2;
    }
  }

  return score;
}

// 王の位置を見つける補助関数
function findKingPosition(board: Board, player: Player): [number, number] | null {
  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece && piece.type === '王' && piece.player === player) {
        return [row, col];
      }
    }
  }
  return null;
}

// 可視範囲を計算する関数
function calculateVisibleCells(board: Board, player: Player): boolean[][] {
  const visibleCells: boolean[][] = Array(9).fill(null).map(() => Array(9).fill(false));

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece && piece.player === player) {
        const visibleForPiece = getVisibleCellsForPiece(row, col, piece, board);
        visibleForPiece.forEach(([vRow, vCol]) => {
          visibleCells[vRow][vCol] = true;
        });
      }
    }
  }

  return visibleCells;
}

// ミニマックスアルゴリズム（アルファベータ枝刈り付き）
function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  player: Player,
  visibleCells: boolean[][]
): [number, [number, number, number, number] | null] {
  if (depth === 0) {
    return [evaluateBoard(board, player, visibleCells), null];
  }

  const moves = getAllPossibleMoves(
    board,
    maximizingPlayer ? player : player === "先手" ? "後手" : "先手",
    visibleCells
  );
  let bestMove: [number, number, number, number] | null = null;

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const [fromRow, fromCol, toRow, toCol] = move;
      const newBoard = movePiece(board, fromRow, fromCol, toRow, toCol, visibleCells);
      const [evaluation] = minimax(
        newBoard,
        depth - 1,
        alpha,
        beta,
        false,
        player,
        visibleCells
      );
      if (evaluation > maxEval) {
        maxEval = evaluation;
        bestMove = move;
      }
      alpha = Math.max(alpha, evaluation);
      if (beta <= alpha) break;
    }
    return [maxEval, bestMove];
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      const [fromRow, fromCol, toRow, toCol] = move;
      const newBoard = movePiece(board, fromRow, fromCol, toRow, toCol, visibleCells);
      const [evaluation] = minimax(
        newBoard,
        depth - 1,
        alpha,
        beta,
        true,
        player,
        visibleCells
      );
      if (evaluation < minEval) {
        minEval = evaluation;
        bestMove = move;
      }
      beta = Math.min(beta, evaluation);
      if (beta <= alpha) break;
    }
    return [minEval, bestMove];
  }
}

// すべての可能な手を取得
function getAllPossibleMoves(
  board: Board,
  player: Player,
  visibleCells: boolean[][]
): [number, number, number, number][] {
  const moves: [number, number, number, number][] = [];

  for (let fromRow = 0; fromRow < 9; fromRow++) {
    for (let fromCol = 0; fromCol < 9; fromCol++) {
      const piece = board[fromRow][fromCol];
      if (piece && piece.player === player) {
        const possibleMoves = getVisibleCellsForPiece(fromRow, fromCol, piece, board);
        for (const [toRow, toCol] of possibleMoves) {
          if (visibleCells[toRow][toCol] && isValidMove([fromRow, fromCol], [toRow, toCol], piece, board)) {
            moves.push([fromRow, fromCol, toRow, toCol]);
          }
        }
      }
    }
  }

  return moves;
}

// 動的な探索深さを決定する関数
function getDynamicDepth(board: Board): number {
  const pieceCount = board.flat().filter(piece => piece !== null).length;
  if (pieceCount > 25) return 2;
  if (pieceCount > 15) return 3;
  return 4;
}

// CPUの手を決定する関数（更新）
export function getCPUMove(
  board: Board,
  player: Player
): [number, number, number, number] {
  const depth = getDynamicDepth(board);
  const visibleCells = calculateVisibleCells(board, player);

  let bestMove: [number, number, number, number] | null = null;
  let attempts = 0;
  const maxAttempts = 10; // 最大試行回数を設定

  while (!bestMove && attempts < maxAttempts) {
    const [_, move] = minimax(
      board,
      depth,
      -Infinity,
      Infinity,
      true,
      player,
      visibleCells
    );

    if (move) {
      const [fromRow, fromCol, toRow, toCol] = move;
      const piece = board[fromRow][fromCol];

      if (piece && isValidMove([fromRow, fromCol], [toRow, toCol], piece, board) && visibleCells[toRow][toCol]) {
        bestMove = move;
      }
    }

    attempts++;
  }

  if (!bestMove) {
    // フォールバック：ランダムな合法手を選択
    const allMoves = getAllPossibleMoves(board, player, visibleCells);
    return allMoves[Math.floor(Math.random() * allMoves.length)];
  }

  return bestMove;
}
