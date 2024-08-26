"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { io, Socket } from "socket.io-client";

type PieceType = "歩" | "香" | "桂" | "銀" | "金" | "角" | "飛" | "玉" | null;
type Player = "先手" | "後手";

interface Piece {
  type: PieceType;
  player: Player;
}

interface VisibleCell {
  piece: Piece | null;
  isVisible: boolean;
}

const initialBoard = (): (Piece | null)[][] => {
  const board: (Piece | null)[][] = Array(9)
    .fill(null)
    .map(() => Array(9).fill(null));

  // 先手の駒を配置
  board[8] = [
    { type: "香", player: "先手" },
    { type: "桂", player: "先手" },
    { type: "銀", player: "先手" },
    { type: "金", player: "先手" },
    { type: "玉", player: "先手" },
    { type: "金", player: "先手" },
    { type: "銀", player: "先手" },
    { type: "桂", player: "先手" },
    { type: "香", player: "先手" },
  ];
  board[7][1] = { type: "角", player: "先手" };
  board[7][7] = { type: "飛", player: "先手" };
  for (let i = 0; i < 9; i++) {
    board[6][i] = { type: "歩", player: "先手" };
  }

  // 後手の駒を配置
  board[0] = [
    { type: "香", player: "後手" },
    { type: "桂", player: "後手" },
    { type: "銀", player: "後手" },
    { type: "金", player: "後手" },
    { type: "玉", player: "後手" },
    { type: "金", player: "後手" },
    { type: "銀", player: "後手" },
    { type: "桂", player: "後手" },
    { type: "香", player: "後手" },
  ];
  board[1][7] = { type: "角", player: "後手" };
  board[1][1] = { type: "飛", player: "後手" };
  for (let i = 0; i < 9; i++) {
    board[2][i] = { type: "歩", player: "後手" };
  }

  return board;
};

export default function ImprovedFogOfWarShogi() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [inputGameId, setInputGameId] = useState<string>("");

  const [playerSide, setPlayerSide] = useState<Player | null>(null);
  const [gameCreated, setGameCreated] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");

  const [board, setBoard] = useState<(Piece | null)[][]>(initialBoard());
  const [visibleBoard, setVisibleBoard] = useState<VisibleCell[][]>(
    Array(9)
      .fill(null)
      .map(() => Array(9).fill({ piece: null, isVisible: false }))
  );
  const [currentPlayer, setCurrentPlayer] = useState<Player>("先手");
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(
    null
  );
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
  const [capturedPieces, setCapturedPieces] = useState<{
    先手: Piece[];
    後手: Piece[];
  }>({ 先手: [], 後手: [] });

  const getVisibleCellsForPiece = useCallback(
    (row: number, col: number, piece: Piece): [number, number][] => {
      const visibleCells: [number, number][] = [];
      const addVisibleCell = (r: number, c: number) => {
        if (r >= 0 && r < 9 && c >= 0 && c < 9) {
          visibleCells.push([r, c]);
        }
      };

      const direction = piece.player === "先手" ? -1 : 1;

      switch (piece.type) {
        case "歩":
          addVisibleCell(row + direction, col);
          break;
        case "香":
          for (let r = row + direction; r >= 0 && r < 9; r += direction) {
            addVisibleCell(r, col);
            if (board[r][col]) break;
          }
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
        case "玉":
          addVisibleCell(row + direction, col - 1);
          addVisibleCell(row + direction, col);
          addVisibleCell(row + direction, col + 1);
          addVisibleCell(row, col - 1);
          addVisibleCell(row, col + 1);
          addVisibleCell(row - direction, col);
          break;
        case "角":
          for (const [dr, dc] of [
            [-1, -1],
            [-1, 1],
            [1, -1],
            [1, 1],
          ]) {
            let r = row + dr,
              c = col + dc;
            while (r >= 0 && r < 9 && c >= 0 && c < 9) {
              addVisibleCell(r, c);
              if (board[r][c]) break;
              r += dr;
              c += dc;
            }
          }
          break;
        case "飛":
          for (const [dr, dc] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ]) {
            let r = row + dr,
              c = col + dc;
            while (r >= 0 && r < 9 && c >= 0 && c < 9) {
              addVisibleCell(r, c);
              if (board[r][c]) break;
              r += dr;
              c += dc;
            }
          }
          break;
      }

      return visibleCells;
    },
    [board]
  );

  const updateVisibleBoard = useCallback(() => {
    if (!playerSide) return;

    const newVisibleBoard: VisibleCell[][] = Array(9)
      .fill(null)
      .map(() => Array(9).fill({ piece: null, isVisible: false }));

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const actualRow: number = playerSide === "後手" ? 8 - row : row;
        const actualCol: number = playerSide === "後手" ? 8 - col : col;
        const piece: Piece | null = board[actualRow][actualCol];
        if (piece && piece.player === playerSide) {
          const visibleCells = getVisibleCellsForPiece(
            actualRow,
            actualCol,
            piece
          );
          visibleCells.forEach(([r, c]) => {
            const visibleRow = playerSide === "後手" ? 8 - r : r;
            const visibleCol = playerSide === "後手" ? 8 - c : c;
            newVisibleBoard[visibleRow][visibleCol] = {
              piece: board[r][c],
              isVisible: true,
            };
          });
          // 自分の駒の位置も可視にする
          newVisibleBoard[row][col] = { piece, isVisible: true };
        }
      }
    }

    setVisibleBoard(newVisibleBoard);
  }, [board, playerSide, getVisibleCellsForPiece]);

  useEffect(() => {
    updateVisibleBoard();
  }, [updateVisibleBoard, currentPlayer]);

  const isValidMove = useCallback(
    (from: [number, number], to: [number, number], piece: Piece): boolean => {
      const [fromRow, fromCol] = from;
      const [toRow, toCol] = to;
      const rowDiff = toRow - fromRow;
      const colDiff = toCol - fromCol;
      const direction = piece.player === "先手" ? -1 : 1;

      switch (piece.type) {
        case "歩":
          return colDiff === 0 && rowDiff === direction;
        case "香":
          return (
            colDiff === 0 &&
            rowDiff * direction > 0 &&
            !board
              .slice(Math.min(fromRow, toRow) + 1, Math.max(fromRow, toRow))
              .some((row) => row[fromCol] !== null)
          );
        case "桂":
          return Math.abs(colDiff) === 1 && rowDiff === 2 * direction;
        case "銀":
          return (
            (Math.abs(rowDiff) === 1 && Math.abs(colDiff) === 1) ||
            (rowDiff === direction && colDiff === 0)
          );
        case "金":
        case "玉":
          return (
            Math.abs(rowDiff) <= 1 &&
            Math.abs(colDiff) <= 1 &&
            !(
              Math.abs(rowDiff) === 1 &&
              Math.abs(colDiff) === 1 &&
              rowDiff === -direction
            )
          );
        case "角":
          return (
            Math.abs(rowDiff) === Math.abs(colDiff) &&
            !board
              .slice(Math.min(fromRow, toRow) + 1, Math.max(fromRow, toRow))
              .some(
                (row, index) =>
                  row[fromCol + (index + 1) * Math.sign(colDiff)] !== null
              )
          );
        case "飛":
          return (
            (rowDiff === 0 || colDiff === 0) &&
            !board
              .slice(Math.min(fromRow, toRow) + 1, Math.max(fromRow, toRow))
              .some((row) => row[fromCol] !== null) &&
            !board[fromRow]
              .slice(Math.min(fromCol, toCol) + 1, Math.max(fromCol, toCol))
              .some((cell) => cell !== null)
          );
        default:
          return false;
      }
    },
    [board]
  );

  useEffect(() => {
    const WEBSOCKET_URL =
      process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3001";
    console.log("Connecting to WebSocket server:", WEBSOCKET_URL);

    const newSocket = io(WEBSOCKET_URL, {
      withCredentials: true,
      transports: ["websocket"],
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      console.log("Connected to WebSocket server");
    });

    newSocket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      toast({
        title: "接続エラー",
        description: "サーバーに接続できません。",
        variant: "destructive",
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("connect", () => {
      console.log("Connected to WebSocket server");
      setDebugInfo((prev) => prev + "\nConnected to WebSocket server");
    });

    socket.on("gameCreated", (id: string) => {
      console.log("Game created with ID:", id);
      // ゲームID設定時にトリムして余分な空白を削除
      setGameId(id.trim());
      setGameCreated(true);
      setDebugInfo((prev) => prev + `\nGame created with ID: ${id.trim()}`);
      toast({
        title: "ゲームが作成されました",
        description: `ゲームID: ${id.trim()}`,
      });
    });

    socket.on("gameJoined", ({ gameId, side }) => {
      console.log("Joined game:", gameId, "as", side);
      setGameId(gameId);
      setPlayerSide(side);
      setDebugInfo((prev) => prev + `\nJoined game: ${gameId} as ${side}`);
      toast({
        title: "ゲームに参加しました",
        description: `ゲームID: ${gameId}, 手番: ${side}`,
      });
    });

    socket.on("gameStarted", ({ gameId, board, currentPlayer }) => {
      console.log("Game started:", gameId, "Current player:", currentPlayer);
      setBoard(board);
      setCurrentPlayer(currentPlayer);
      setDebugInfo(
        (prev) =>
          prev + `\nGame started: ${gameId}, Current player: ${currentPlayer}`
      );
      toast({
        title: "ゲームが開始されました",
        description: `現在の手番: ${currentPlayer}`,
      });
    });

    socket.on("boardUpdated", ({ board, currentPlayer }) => {
      console.log("Board updated:", board);
      console.log("Current player:", currentPlayer);
      setBoard(board);
      setCurrentPlayer(currentPlayer);
      setSelectedCell(null); // 選択状態をリセット
      setDebugInfo(
        (prev) => prev + `\nBoard updated, current player: ${currentPlayer}`
      );
    });

    socket.on("gameError", (message: string) => {
      console.error("Game error:", message);
      setDebugInfo((prev) => prev + `\nGame error: ${message}`);
      toast({
        title: "エラー",
        description: message,
        variant: "destructive",
      });
    });

    return () => {
      socket.off("connect");
      socket.off("gameCreated");
      socket.off("gameJoined");
      socket.off("gameStarted");
      socket.off("boardUpdated");
      socket.off("gameError");
    };
  }, [socket]);

  const createGame = useCallback(() => {
    if (socket) {
      console.log("Requesting to create a new game");
      setDebugInfo((prev) => prev + "\nRequesting to create a new game");
      socket.emit("createGame");
    } else {
      console.error("Socket is not initialized");
      setDebugInfo((prev) => prev + "\nError: Socket is not initialized");
      toast({
        title: "エラー",
        description: "サーバーに接続されていません。",
        variant: "destructive",
      });
    }
  }, [socket]);

  const joinGame = useCallback(
    (side: Player) => {
      const idToJoin = gameId || inputGameId;
      if (socket && idToJoin) {
        console.log("Joining game:", idToJoin, "as", side);
        setDebugInfo((prev) => prev + `\nJoining game: ${idToJoin} as ${side}`);
        socket.emit("joinGame", { gameId: idToJoin.trim(), side });
      } else {
        console.error("Socket is not initialized or gameId is missing");
        setDebugInfo(
          (prev) =>
            prev + "\nError: Socket is not initialized or gameId is missing"
        );
        toast({
          title: "エラー",
          description: "ゲームに参加できません。",
          variant: "destructive",
        });
      }
    },
    [socket, gameId, inputGameId]
  );

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      try {
        if (currentPlayer !== playerSide) {
          toast({
            title: "相手の手番です",
            description: "自分の手番をお待ちください。",
            variant: "destructive",
          });
          return;
        }

        const actualRow = playerSide === "後手" ? 8 - row : row;
        const actualCol = playerSide === "後手" ? 8 - col : col;

        if (selectedCell) {
          const [selectedRow, selectedCol] = selectedCell;
          const actualSelectedRow =
            playerSide === "後手" ? 8 - selectedRow : selectedRow;
          const actualSelectedCol =
            playerSide === "後手" ? 8 - selectedCol : selectedCol;
          const selectedPiece = board[actualSelectedRow][actualSelectedCol];

          if (selectedPiece && selectedPiece.player === currentPlayer) {
            if (
              isValidMove(
                [actualSelectedRow, actualSelectedCol],
                [actualRow, actualCol],
                selectedPiece
              )
            ) {
              // 新しい盤面を作成
              const newBoard = board.map((r) => [...r]);
              const targetPiece = newBoard[actualRow][actualCol];

              // 駒を取る処理
              if (targetPiece) {
                setCapturedPieces((prev) => ({
                  ...prev,
                  [currentPlayer]: [
                    ...prev[currentPlayer],
                    { ...targetPiece, player: currentPlayer },
                  ],
                }));
              }

              // 駒を移動
              newBoard[actualRow][actualCol] = selectedPiece;
              newBoard[actualSelectedRow][actualSelectedCol] = null;

              // ローカルの状態を更新
              setBoard(newBoard);
              setCurrentPlayer(currentPlayer === "先手" ? "後手" : "先手");
              setLastMove([row, col]);
              updateVisibleBoard();

              // WebSocket経由で移動を送信
              if (socket && gameId) {
                socket.emit("move", {
                  gameId,
                  from: [actualSelectedRow, actualSelectedCol],
                  to: [actualRow, actualCol],
                  player: playerSide,
                });
              }
            } else {
              // 無効な移動の場合
              toast({
                title: "無効な移動です",
                description: "選択した駒はそこに移動できません。",
                variant: "destructive",
              });
            }
          }
          // 選択状態をリセット
          setSelectedCell(null);
        } else {
          // 新しい駒を選択
          const piece = board[actualRow][actualCol];
          if (piece && piece.player === currentPlayer) {
            setSelectedCell([row, col]);
          } else if (piece) {
            // 相手の駒を選択した場合
            toast({
              title: "無効な選択です",
              description: "自分の駒を選択してください。",
              variant: "destructive",
            });
          }
        }
      } catch (error) {
        console.error("Error in handleCellClick:", error);
        toast({
          title: "エラーが発生しました",
          description: "駒の移動中にエラーが発生しました。",
          variant: "destructive",
        });
      }
    },
    [
      board,
      currentPlayer,
      playerSide,
      selectedCell,
      isValidMove,
      socket,
      gameId,
      setCapturedPieces,
    ]
  );

  const resetGame = useCallback(() => {
    setBoard(initialBoard());
    setCurrentPlayer("先手");
    setSelectedCell(null);
    setLastMove(null);
    setCapturedPieces({ 先手: [], 後手: [] });
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-4xl mx-auto bg-white shadow-xl">
        <CardContent className="p-2 pb-4">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
            霧の将棋
          </h1>
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div className="w-full sm:w-auto space-y-4">
                {!gameCreated && (
                  <Button onClick={createGame} className="w-full sm:w-auto">
                    新しいゲームを作成
                  </Button>
                )}
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="w-full sm:w-auto">
                    <Label htmlFor="gameId">ゲームID</Label>
                    <Input
                      id="gameId"
                      placeholder="ゲームIDを入力"
                      value={inputGameId}
                      onChange={(e) => setInputGameId(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <Button
                    onClick={() => joinGame("先手")}
                    className="mt-6 sm:mt-0"
                  >
                    先手として参加
                  </Button>
                  <Button
                    onClick={() => joinGame("後手")}
                    className="mt-2 sm:mt-0"
                  >
                    後手として参加
                  </Button>
                </div>
              </div>
              {gameId && (
                <div className="text-sm text-gray-600">
                  <p>現在のゲームID: {gameId}</p>
                  {playerSide && <p>あなたの手番: {playerSide}</p>}
                </div>
              )}
            </div>
            <div className="flex justify-between gap-4">
              <CapturedPieces
                title="先手の持ち駒"
                pieces={capturedPieces["先手"]}
              />
              <CapturedPieces
                title="後手の持ち駒"
                pieces={capturedPieces["後手"]}
              />
            </div>
            <div
              className="grid grid-cols-9 gap-[1px] bg-yellow-100 p-4 rounded-lg"
              role="grid"
              aria-label="将棋盤"
            >
              {visibleBoard.map((row, rowIndex) =>
                row.map((cell, colIndex) => (
                  <button
                    key={`${rowIndex}-${colIndex}`}
                    className={`w-8 h-8 flex items-center justify-center border border-yellow-800 ${
                      selectedCell &&
                      selectedCell[0] === rowIndex &&
                      selectedCell[1] === colIndex
                        ? "bg-blue-200"
                        : lastMove &&
                          lastMove[0] === rowIndex &&
                          lastMove[1] === colIndex
                        ? "bg-yellow-200"
                        : "bg-yellow-100"
                    } ${
                      cell.isVisible ? "hover:bg-yellow-50" : "bg-gray-800"
                    } transition-colors duration-200`}
                    onClick={() => handleCellClick(rowIndex, colIndex)}
                    aria-label={
                      cell.isVisible
                        ? cell.piece
                          ? `${cell.piece.player}の${cell.piece.type}`
                          : `空のマス (${rowIndex + 1}, ${colIndex + 1})`
                        : "不可視のマス"
                    }
                    role="gridcell"
                    disabled={!cell.isVisible}
                  >
                    {cell.isVisible && cell.piece && (
                      <span
                        className={`text-2xl font-bold ${
                          cell.piece.player !== playerSide
                            ? "transform rotate-180 text-blue-600"
                            : "text-red-600"
                        }`}
                      >
                        {cell.piece.type}
                      </span>
                    )}
                  </button>
                ))
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function CapturedPieces({ title, pieces }: { title: string; pieces: Piece[] }) {
  return (
    <div className="bg-gray-100 p-4 rounded-lg flex-1">
      <h3 className="text-center font-semibold mb-2 text-gray-700">{title}</h3>
      <div className="grid grid-cols-3 gap-2">
        {pieces.map((piece, index) => (
          <div
            key={index}
            className="w-8 h-8 flex items-center justify-center bg-white rounded shadow text-gray-800"
          >
            {piece.type}
          </div>
        ))}
      </div>
    </div>
  );
}
