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

// 改善された評価関数
function evaluateBoard(board: Board, player: Player): number {
  let score = 0;
  let pieceCount = 0;

  for (let row = 0; row < 9; row++) {
    for (let col = 0; col < 9; col++) {
      const piece = board[row][col];
      if (piece && piece.type && piece.type in pieceValues) {
        const pieceValue = pieceValues[piece.type];
        const positionValue = piece.type === '歩' ? pawnPositionValues[row][col] : 0;

        if (piece.player === player) {
          score += pieceValue + positionValue;
          pieceCount++;
        } else {
          score -= pieceValue - positionValue;
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

// ミニマックスアルゴリズム（アルファベータ枝刈り付き）
function minimax(
  board: Board,
  depth: number,
  alpha: number,
  beta: number,
  maximizingPlayer: boolean,
  player: Player
): [number, [number, number, number, number] | null] {
  if (depth === 0) {
    return [evaluateBoard(board, player), null];
  }

  const moves = getAllPossibleMoves(
    board,
    maximizingPlayer ? player : player === "先手" ? "後手" : "先手"
  );
  let bestMove: [number, number, number, number] | null = null;

  if (maximizingPlayer) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const [fromRow, fromCol, toRow, toCol] = move;
      const newBoard = movePiece(board, fromRow, fromCol, toRow, toCol);
      const [evaluation] = minimax(
        newBoard,
        depth - 1,
        alpha,
        beta,
        false,
        player
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
      const newBoard = movePiece(board, fromRow, fromCol, toRow, toCol);
      const [evaluation] = minimax(
        newBoard,
        depth - 1,
        alpha,
        beta,
        true,
        player
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
  player: Player
): [number, number, number, number][] {
  const moves: [number, number, number, number][] = [];

  for (let fromRow = 0; fromRow < 9; fromRow++) {
    for (let fromCol = 0; fromCol < 9; fromCol++) {
      const piece = board[fromRow][fromCol];
      if (piece && piece.player === player) {
        const visibleCells = getVisibleCellsForPiece(
          fromRow,
          fromCol,
          piece,
          board
        );
        for (const [toRow, toCol] of visibleCells) {
          if (isValidMove([fromRow, fromCol], [toRow, toCol], piece, board)) {
            moves.push([fromRow, fromCol, toRow, toCol]);

            // 成りの手も追加
            if (canPromote([fromRow, fromCol], [toRow, toCol], piece)) {
              moves.push([fromRow, fromCol, toRow, toCol]);
            }
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
  const [_, bestMove] = minimax(
    board,
    depth,
    -Infinity,
    Infinity,
    true,
    player
  );

  if (bestMove) {
    const [fromRow, fromCol, toRow, toCol] = bestMove;
    const piece = board[fromRow][fromCol];

    if (piece) {
      // 成りが可能な場合、確率的に成るかどうかを決定
      if (canPromote([fromRow, fromCol], [toRow, toCol], piece)) {
        if (Math.random() < 0.8) {
          // 80%の確率で成る
          const promotedType = getPromotedType(piece.type as PieceType);
          if (promotedType) {
            piece.type = promotedType;
            piece.promoted = true;
          }
        }
      }
    }

    return bestMove;
  }

  // フォールバック：ランダムな合法手を選択
  const allMoves = getAllPossibleMoves(board, player);
  return allMoves[Math.floor(Math.random() * allMoves.length)];
}
