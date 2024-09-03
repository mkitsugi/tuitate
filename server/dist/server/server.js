"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("module-alias/register");
const express_1 = __importDefault(require("express"));
const http_1 = __importDefault(require("http"));
const socket_io_1 = require("socket.io");
const cors_1 = __importDefault(require("cors"));
const boardUtils_1 = require("@shared/boardUtils");
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
const server = http_1.default.createServer(app);
const io = new socket_io_1.Server(server, {
    cors: {
        origin: ["https://tuitate.vercel.app/", "http://localhost:3000"],
        methods: ["GET", "POST"],
        credentials: true,
    },
});
const games = new Map();
const gameTimeouts = new Map();
function initializeGame() {
    return {
        players: [],
        board: (0, boardUtils_1.initialBoard)(),
        capturedPieces: { 先手: [], 後手: [] },
        availableSides: ["先手", "後手"],
        currentPlayer: undefined,
        先手: undefined,
        後手: undefined,
    };
}
// ゲームの有効期限（ミリ秒）
const GAME_EXPIRATION_TIME = 10 * 60 * 1000; // 10分
function deleteGame(gameId) {
    games.delete(gameId);
    gameTimeouts.delete(gameId);
    console.log(`Game ${gameId} has been deleted due to inactivity.`);
}
function resetGameTimeout(gameId) {
    if (gameTimeouts.has(gameId)) {
        clearTimeout(gameTimeouts.get(gameId));
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
        io.emit("newRoomCreated", {
            id: gameId,
            players: 1,
            availableSides: ["先手", "後手"],
        });
        // ゲーム作成時にタイムアウトを設定
        resetGameTimeout(gameId);
    });
    socket.on("joinRoom", ({ roomId }) => {
        console.log(`Player ${socket.id} joining room ${roomId}`);
        socket.join(roomId);
        const game = games.get(roomId);
        if (game) {
            const availableSides = ["先手", "後手"].filter((s) => !game[s]);
            socket.emit("availableSidesUpdated", availableSides);
            console.log(`Sent availableSides to ${socket.id}: ${availableSides}`);
        }
    });
    socket.on("getAvailableSides", (roomId, callback) => {
        const game = games.get(roomId);
        if (game) {
            const availableSides = ["先手", "後手"].filter((s) => !game[s]);
            callback(availableSides);
        }
        else {
            callback(["先手", "後手"]);
        }
    });
    socket.on("selectSide", ({ gameId, side }) => {
        console.log(`Player ${socket.id} selecting ${side} in game ${gameId}`);
        const game = games.get(gameId);
        if (game) {
            if (side === "先手" || side === "後手") {
                if (!game[side]) {
                    game[side] = socket.id;
                    game.players.push({ id: socket.id, side });
                    const availableSides = ["先手", "後手"].filter((s) => !game[s]);
                    console.log(`Broadcasting availableSidesUpdated to room ${gameId}: ${availableSides}`);
                    io.to(gameId).emit("availableSidesUpdated", availableSides);
                    io.to(gameId).emit("playerJoined", { side, playerId: socket.id });
                }
            }
        }
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
            }
            else if (game.players.length > 2) {
                socket.emit("gameError", "Game is full");
            }
            else {
                socket.emit("gameError", "Selected side is not available");
            }
        }
        else {
            socket.emit("gameError", "Game not found");
        }
    });
    socket.on("move", ({ gameId, from, to, player, piece, promotion, }) => {
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
            const pieceIndex = game.capturedPieces[player].findIndex((p) => p.type === piece || (0, boardUtils_1.getOriginalType)(p.type) === piece);
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
            game.board[toRow][toCol] = Object.assign(Object.assign({}, pieceToPlace), { promoted: false });
            game.capturedPieces[player].splice(pieceIndex, 1);
        }
        else {
            // 既存の駒を動かす場合の処理
            const [fromRow, fromCol] = from;
            const [toRow, toCol] = to;
            const piece = game.board[fromRow][fromCol];
            if (!piece || piece.player !== player) {
                socket.emit("gameError", "Invalid move: no piece or wrong player");
                return;
            }
            if (!(0, boardUtils_1.isValidMove)(from, to, piece, game.board)) {
                socket.emit("gameError", "Invalid move");
                return;
            }
            // 駒を取る処理
            if (game.board[toRow][toCol]) {
                const capturedPiece = {
                    type: (0, boardUtils_1.getOriginalType)(game.board[toRow][toCol].type),
                    player: player,
                    promoted: false,
                };
                if (!game.capturedPieces[player]) {
                    game.capturedPieces[player] = [];
                }
                game.capturedPieces[player].push(capturedPiece);
            }
            // 成りの処理
            if ((0, boardUtils_1.canPromote)(from, to, piece)) {
                if (promotion) {
                    piece.promoted = true;
                    piece.type = (0, boardUtils_1.getPromotedType)(piece.type);
                }
            }
            // 駒を移動
            game.board[toRow][toCol] = piece;
            game.board[fromRow][fromCol] = null;
        }
        // 手番を交代
        game.currentPlayer = game.currentPlayer === "先手" ? "後手" : "先手";
        // 移動後に王手状態をチェック
        const isPlayerInCheck = (0, boardUtils_1.isInCheck)(game.board, player);
        const isOpponentInCheck = (0, boardUtils_1.isInCheck)(game.board, player === "先手" ? "後手" : "先手");
        // 王手状態をログ出力
        console.log(`${player}が王手: ${isPlayerInCheck}`);
        console.log(`${player === "先手" ? "後手" : "先手"}が王手: ${isOpponentInCheck}`);
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
    });
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
        games.forEach((game, gameId) => {
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
                return false; // Stop iterating after finding the game
            }
        });
    });
});
function hasPawnInColumn(board, col, player) {
    for (let row = 0; row < 9; row++) {
        if (board[row][col] &&
            board[row][col].type === "歩" &&
            board[row][col].player === player) {
            return true;
        }
    }
    return false;
}
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
