import "module-alias/register";
import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import {
  initialBoard,
  canPromote,
  isInCheck,
  isValidMove,
  checkPromotion,
  getPromotedType,
  getOriginalType,
} from "@shared/boardUtils";
import { Piece, Board, CapturedPieces } from "@shared/shogi";

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ["https://tuitate.vercel.app/", "http://localhost:3000"],
    methods: ["GET", "POST"],
    credentials: true,
  },
});

type Side = "先手" | "後手";
type Player = { id: string; side: Side };

interface Game {
  players: Player[];
  board: Board;
  capturedPieces: CapturedPieces;
  availableSides: Side[];
  currentPlayer?: Side;
  先手?: string; // プレイヤーのIDを格納
  後手?: string;
}

const games: Map<string, Game> = new Map();
const gameTimeouts: Map<string, NodeJS.Timeout> = new Map();

function initializeGame(): Game {
  return {
    players: [],
    board: initialBoard(),
    capturedPieces: { 先手: [], 後手: [] },
    availableSides: ["先手", "後手"],
    currentPlayer: undefined,
    先手: undefined,
    後手: undefined,
  };
}

// ゲームの有効期限（ミリ秒）
const GAME_EXPIRATION_TIME = 10 * 60 * 1000; // 10分

function deleteGame(gameId: string): void {
  games.delete(gameId);
  gameTimeouts.delete(gameId);
  console.log(`Game ${gameId} has been deleted due to inactivity.`);
}

function resetGameTimeout(gameId: string): void {
  if (gameTimeouts.has(gameId)) {
    clearTimeout(gameTimeouts.get(gameId)!);
  }
  const timeoutId = setTimeout(() => deleteGame(gameId), GAME_EXPIRATION_TIME);
  gameTimeouts.set(gameId, timeoutId);
}

// ルーム一覧を取得するエンドポイントを追加
app.get("/api/rooms", (req, res) => {
  const activeRooms = Array.from(games.entries())
    .filter(([_, game]) => game.players.length < 2)
    .map(([id, game]) => ({
      id,
      players: game.players.length,
      availableSides: game.availableSides,
    }));
  res.json(activeRooms);
});

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("createGame", () => {
    const gameId = Math.random().toString(36).substring(7);
    games.set(gameId, initializeGame());
    socket.join(gameId);
    socket.emit("gameCreated", gameId);
    io.emit("newRoomCreated", { id: gameId, players: 1 });

    // ゲーム作成時にタイムアウトを設定
    resetGameTimeout(gameId);
  });

  socket.on("joinRoom", ({ roomId }) => {
    console.log(`Player ${socket.id} joining room ${roomId}`);
    socket.join(roomId);
    const game = games.get(roomId);
    if (game) {
      const availableSides = ["先手", "後手"].filter(
        (s) => !game[s as keyof Game]
      );
      socket.emit("availableSidesUpdated", availableSides);
      console.log(`Sent availableSides to ${socket.id}: ${availableSides}`);
    }
  });

  socket.on("getAvailableSides", (roomId, callback) => {
    const game = games.get(roomId);
    if (game) {
      const availableSides = ["先手", "後手"].filter(
        (s) => !game[s as keyof Game]
      );
      callback(availableSides);
    } else {
      callback(["先手", "後手"]);
    }
  });

  socket.on(
    "selectSide",
    ({ gameId, side }: { gameId: string; side: Side }) => {
      console.log(`Player ${socket.id} selecting ${side} in game ${gameId}`);
      const game = games.get(gameId);
      if (game) {
        if (side === "先手" || side === "後手") {
          if (!game[side]) {
            game[side] = socket.id;
            game.players.push({ id: socket.id, side });
            const availableSides = ["先手", "後手"].filter(
              (s) => !game[s as keyof Game]
            );

            console.log(
              `Broadcasting availableSidesUpdated to room ${gameId}: ${availableSides}`
            );
            io.to(gameId).emit("availableSidesUpdated", availableSides);
            io.to(gameId).emit("playerJoined", { side, playerId: socket.id });
          }
        }
      }
    }
  );

  socket.on("joinGame", ({ gameId, side }: { gameId: string; side: Side }) => {
    console.log("Join game request:", gameId, side);
    console.log("Current games:", Array.from(games.keys()));
    console.log("Game exists:", games.has(gameId));
    const game = games.get(gameId);
    if (game) {
      console.log("Game found:", gameId);
      console.log("Current players:", game.players);
      console.log("Available sides:", game.availableSides);

      if (game.players.length <= 2 && game.availableSides.includes(side)) {
        game.players.push({ id: socket.id, side });
        game.availableSides = game.availableSides.filter((s) => s !== side);

        socket.join(gameId);
        console.log("Player joined game:", gameId, side);
        socket.emit("gameJoined", { gameId, side });

        // 全てのクライアントに通知を送信
        io.to(gameId).emit("playerJoined", {
          side,
          availableSides: game.availableSides,
          playerId: socket.id,
        });

        io.to(gameId).emit("sideSelected", {
          side,
          availableSides: game.availableSides,
        });

        // プレイヤーが参加したらタイムアウトをリセット
        resetGameTimeout(gameId);

        if (game.players.length === 2) {
          game.currentPlayer = "先手";
          io.to(gameId).emit("gameStarted", {
            gameId,
            board: game.board,
            currentPlayer: game.currentPlayer,
          });

          // ゲームが開始されたらタイムアウトを解除
          clearTimeout(gameTimeouts.get(gameId));
          gameTimeouts.delete(gameId);
        }
      } else if (game.players.length > 2) {
        socket.emit("gameError", "Game is full");
      } else {
        socket.emit("gameError", "Selected side is not available");
      }
    } else {
      socket.emit("gameError", "Game not found");
    }
  });

  socket.on(
    "move",
    ({
      gameId,
      from,
      to,
      player,
      piece,
      promotion,
    }: {
      gameId: string;
      from: [number, number] | null;
      to: [number, number];
      player: Side;
      piece?: string;
      promotion?: boolean;
    }) => {
      const game = games.get(gameId);
      if (!game) {
        socket.emit("gameError", "Game not found");
        return;
      }

      if (game.currentPlayer !== player) {
        socket.emit("gameError", "Not your turn");
        return;
      }

      // capturedPieces の初期化を確認
      if (!game.capturedPieces) {
        game.capturedPieces = { 先手: [], 後手: [] };
      }

      if (from === null) {
        // 持ち駒を打つ場合の処理
        const [toRow, toCol] = to;
        if (game.board[toRow][toCol]) {
          socket.emit("gameError", "Invalid move: destination is not empty");
          return;
        }

        if (!piece) {
          socket.emit("gameError", "Piece type is not specified");
          return;
        }

        // 持ち駒の検索方法を修正
        const pieceIndex = game.capturedPieces[player].findIndex(
          (p) => p.type === piece || getOriginalType(p.type) === piece
        );

        console.log("Captured pieces:", game.capturedPieces[player]);
        console.log("Piece to place:", piece);
        console.log("Piece index:", pieceIndex);

        if (pieceIndex === -1) {
          socket.emit("gameError", "No such captured piece to place");
          return;
        }

        if (piece === "歩" && hasPawnInColumn(game.board, toCol, player)) {
          socket.emit("gameError", "二歩になってしまいます。");
          return;
        }

        const pieceToPlace = game.capturedPieces[player][pieceIndex];
        game.board[toRow][toCol] = { ...pieceToPlace, promoted: false };
        game.capturedPieces[player].splice(pieceIndex, 1);
      } else {
        // 既存の駒を動かす場合の処理
        const [fromRow, fromCol] = from;
        const [toRow, toCol] = to;
        const piece = game.board[fromRow][fromCol];

        if (!piece || piece.player !== player) {
          socket.emit("gameError", "Invalid move: no piece or wrong player");
          return;
        }

        if (!isValidMove(from, to, piece, game.board)) {
          socket.emit("gameError", "Invalid move");
          return;
        }

        // 駒を取る処理
        if (game.board[toRow][toCol]) {
          const capturedPiece = {
            type: getOriginalType(game.board[toRow][toCol]!.type),
            player: player,
            promoted: false,
          };
          if (!game.capturedPieces[player]) {
            game.capturedPieces[player] = [];
          }
          game.capturedPieces[player].push(capturedPiece);
        }

        // 成りの処理
        if (canPromote(from, to, piece)) {
          if (promotion) {
            piece.promoted = true;
            piece.type = getPromotedType(piece.type);
          }
        }

        // 駒を移動
        game.board[toRow][toCol] = piece;
        game.board[fromRow][fromCol] = null;
      }

      // 手番を交代
      game.currentPlayer = game.currentPlayer === "先手" ? "後手" : "先手";

      // 移動後に王手状態をチェック
      const isPlayerInCheck = isInCheck(game.board, player);
      const isOpponentInCheck = isInCheck(
        game.board,
        player === "先手" ? "後手" : "先手"
      );

      // 王手状態をログ出力
      console.log(`${player}が王手: ${isPlayerInCheck}`);
      console.log(
        `${player === "先手" ? "後手" : "先手"}が王手: ${isOpponentInCheck}`
      );

      // 王手が解消されていない場合、移動を無効にする
      if (isPlayerInCheck) {
        socket.emit("gameError", "Invalid move: You are still in check");
        return;
      }

      // 更新された盤面を全プレイヤーに送信
      io.to(gameId).emit("boardUpdated", {
        board: game.board,
        currentPlayer: game.currentPlayer,
        capturedPieces: game.capturedPieces,
        isPlayerInCheck,
        isOpponentInCheck,
      });
    }
  );

  socket.on("getRooms", () => {
    console.log("getRooms event received");
    const activeRooms = Array.from(games.entries())
      .filter(([_, game]) => game.players.length < 2)
      .map(([id, game]) => ({
        id,
        players: game.players.length,
        availableSides: game.availableSides,
      }));
    console.log("Active rooms:", activeRooms);
    socket.emit("roomList", activeRooms);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected");
    // プレイヤーが切断された場合、そのプレイヤーが参加していたゲームを探す
    for (const [gameId, game] of games.entries()) {
      const playerIndex = game.players.findIndex((p) => p.id === socket.id);
      if (playerIndex !== -1) {
        const disconnectedPlayer = game.players[playerIndex];
        game.players.splice(playerIndex, 1);
        game.availableSides.push(disconnectedPlayer.side);
        io.to(gameId).emit("playerLeft", {
          side: disconnectedPlayer.side,
          availableSides: game.availableSides,
        });

        // プレイヤーが離脱したらタイムアウトをリセット
        resetGameTimeout(gameId);

        break;
      }
    }
  });
});

function hasPawnInColumn(board: Board, col: number, player: Side): boolean {
  for (let row = 0; row < 9; row++) {
    if (
      board[row][col] &&
      board[row][col]!.type === "歩" &&
      board[row][col]!.player === player
    ) {
      return true;
    }
  }
  return false;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
