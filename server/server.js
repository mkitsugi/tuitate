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
      capturedPieces: { 先手: [], 後手: [] },
      availableSides: ["先手", "後手"],
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
      console.log("Available sides:", game.availableSides);
      if (game.players.length < 2 && game.availableSides.includes(side)) {
        game.players.push({ id: socket.id, side });
        game.availableSides = game.availableSides.filter((s) => s !== side);
        socket.join(gameId);
        console.log("Player joined game:", gameId, side);
        socket.emit("gameJoined", { gameId, side });
        io.to(gameId).emit("sideSelected", {
          side,
          availableSides: game.availableSides,
        });
        if (game.players.length === 2) {
          game.currentPlayer = "先手";
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
      } else if (game.players.length >= 2) {
        console.log("Game is full:", gameId);
        socket.emit("gameError", "Game is full");
      } else {
        console.log("Side not available:", side);
        socket.emit("gameError", "Selected side is not available");
      }
    } else {
      console.log("Game not found:", gameId);
      socket.emit("gameError", "Game not found");
    }
  });

  socket.on("move", ({ gameId, from, to, player, piece, promotion }) => {
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
        (p) => p.type === piece
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

      if (!isValidMove(game.board, from, to, piece)) {
        socket.emit("gameError", "Invalid move");
        return;
      }

      // 駒を取る処理
      if (game.board[toRow][toCol]) {
        const capturedPiece = {
          type: game.board[toRow][toCol].type,
          player: player,
          promoted: false,
        };
        if (!game.capturedPieces[player]) {
          game.capturedPieces[player] = [];
        }
        game.capturedPieces[player].push(capturedPiece);
      }

      // 成りの処理
      // if (canPromote(from, to, piece)) {
      //   const shouldPromote = Math.random() < 0.5; // クライアントからの入力を模倣
      //   if (shouldPromote) {
      //     piece.promoted = true;
      //     piece.type = getPromotedType(piece.type);
      //   }
      // }
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

    // 更新された盤面を全プレイヤーに送信
    io.to(gameId).emit("boardUpdated", {
      board: game.board,
      currentPlayer: game.currentPlayer,
      capturedPieces: game.capturedPieces,
    });
  });
});

// 補助関数
function isValidMove(board, from, to, piece) {
  // ここに駒の動きの妥当性チェックを実装
  // 簡単な例として、同じ場所への移動を禁止
  return from[0] !== to[0] || from[1] !== to[1];
}

function canPromote(from, to, piece) {
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

function hasPawnInColumn(board, col, player) {
  for (let row = 0; row < 9; row++) {
    if (
      board[row][col] &&
      board[row][col].type === "歩" &&
      board[row][col].player === player
    ) {
      return true;
    }
  }
  return false;
}

function getPromotedType(type) {
  const promotionMap = {
    歩: "と",
    香: "成香",
    桂: "成桂",
    銀: "成銀",
    角: "馬",
    飛: "龍",
  };
  return promotionMap[type] || type;
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

function initialBoard() {
  const board = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  // 先手の駒を配置
  board[8] = ["香", "桂", "銀", "金", "玉", "金", "銀", "桂", "香"].map(
    (type) => ({ type, player: "先手", promoted: false })
  );
  board[7][1] = { type: "角", player: "先手", promoted: false };
  board[7][7] = { type: "飛", player: "先手", promoted: false };
  for (let i = 0; i < 9; i++) {
    board[6][i] = { type: "歩", player: "先手", promoted: false };
  }

  // 後手の駒を配置
  board[0] = ["香", "桂", "銀", "金", "玉", "金", "銀", "桂", "香"].map(
    (type) => ({ type, player: "後手", promoted: false })
  );
  board[1][7] = { type: "角", player: "後手", promoted: false };
  board[1][1] = { type: "飛", player: "後手", promoted: false };
  for (let i = 0; i < 9; i++) {
    board[2][i] = { type: "歩", player: "後手", promoted: false };
  }

  return board;
}

function isValidMove(board, from, to, piece) {
  // ここに駒の動きの妥当性チェックを実装
  // 簡単な例として、同じ場所への移動を禁止
  return from[0] !== to[0] || from[1] !== to[1];
}

function canPromote(from, to, piece) {
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

function hasPawnInColumn(board, col, player) {
  for (let row = 0; row < 9; row++) {
    if (
      board[row][col] &&
      board[row][col].type === "歩" &&
      board[row][col].player === player
    ) {
      return true;
    }
  }
  return false;
}
