const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

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

const games = new Map();

io.on("connection", (socket) => {
  console.log("A user connected");

  socket.on("createGame", () => {
    const gameId = Math.random().toString(36).substring(7);
    games.set(gameId, {
      players: [],
      board: initialBoard(),
      currentPlayer: null, // 初期化時にnullを設定
    });
    socket.join(gameId);
    console.log("Game created:", gameId);
    console.log("Current games:", Array.from(games.keys()));
    socket.emit("gameCreated", gameId);
  });

  socket.on("joinGame", ({ gameId, side }) => {
    console.log("Join game request:", gameId, side);
    console.log("Current games:", Array.from(games.keys()));
    console.log("Game exists:", games.has(gameId));
    const game = games.get(gameId);
    if (game) {
      console.log("Game found:", gameId);
      console.log("Current players:", game.players);
      if (game.players.length < 2) {
        game.players.push({ id: socket.id, side });
        socket.join(gameId);
        console.log("Player joined game:", gameId, side);
        socket.emit("gameJoined", { gameId, side });
        if (game.players.length === 2) {
          game.currentPlayer = "先手"; // 2人目のプレイヤーが参加したときに初期の手番を設定
          console.log(
            "Game started:",
            gameId,
            "Current player:",
            game.currentPlayer
          );
          io.to(gameId).emit("gameStarted", {
            gameId,
            board: game.board,
            currentPlayer: game.currentPlayer,
          });
        }
      } else {
        console.log("Game is full:", gameId);
        socket.emit("gameError", "Game is full");
      }
    } else {
      console.log("Game not found:", gameId);
      socket.emit("gameError", "Game not found");
    }
  });

  socket.on("move", ({ gameId, from, to, player }) => {
    const game = games.get(gameId);
    if (game && game.currentPlayer === player) {
      // 移動のバリデーションと盤面の更新ロジックを実装
      const [fromRow, fromCol] = from;
      const [toRow, toCol] = to;
      const piece = game.board[fromRow][fromCol];

      if (piece && piece.player === player) {
        // 駒を移動
        game.board[toRow][toCol] = piece;
        game.board[fromRow][fromCol] = null;

        // 手番を交代
        game.currentPlayer = game.currentPlayer === "先手" ? "後手" : "先手";

        console.log("Move made:", gameId, from, to, player);
        console.log("New board state:", game.board);

        io.to(gameId).emit("boardUpdated", {
          board: game.board,
          currentPlayer: game.currentPlayer,
        });
      } else {
        socket.emit("gameError", "Invalid move");
      }
    } else {
      socket.emit("gameError", "Invalid move or not your turn");
    }
  });
});

server.listen(3001, () => {
  console.log("Server is running on port 3001");
});

function initialBoard() {
  // 9x9の空の盤面を作成
  const board = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  // 先手の駒を配置
  board[8] = ["香", "桂", "銀", "金", "玉", "金", "銀", "桂", "香"].map(
    (type) => ({ type, player: "先手" })
  );
  board[7][1] = { type: "角", player: "先手" };
  board[7][7] = { type: "飛", player: "先手" };
  for (let i = 0; i < 9; i++) {
    board[6][i] = { type: "歩", player: "先手" };
  }

  // 後手の駒を配置
  board[0] = ["香", "桂", "銀", "金", "玉", "金", "銀", "桂", "香"].map(
    (type) => ({ type, player: "後手" })
  );
  board[1][7] = { type: "角", player: "後手" };
  board[1][1] = { type: "飛", player: "後手" };
  for (let i = 0; i < 9; i++) {
    board[2][i] = { type: "歩", player: "後手" };
  }

  return board;
}
