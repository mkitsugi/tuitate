"use client";
import React, { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { io, Socket } from "socket.io-client";

type PieceType = "歩" | "香" | "桂" | "銀" | "金" | "角" | "飛" | "玉" | null;
type PromotedPieceType = "と" | "成香" | "成桂" | "成銀" | "馬" | "龍";
type Player = "先手" | "後手";

interface Piece {
  type: PieceType | PromotedPieceType;
  player: Player;
  promoted: boolean;
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
    { type: "香", player: "先手", promoted: false },
    { type: "桂", player: "先手", promoted: false },
    { type: "銀", player: "先手", promoted: false },
    { type: "金", player: "先手", promoted: false },
    { type: "玉", player: "先手", promoted: false },
    { type: "金", player: "先手", promoted: false },
    { type: "銀", player: "先手", promoted: false },
    { type: "桂", player: "先手", promoted: false },
    { type: "香", player: "先手", promoted: false },
  ];
  board[7][1] = { type: "角", player: "先手", promoted: false };
  board[7][7] = { type: "飛", player: "先手", promoted: false };
  for (let i = 0; i < 9; i++) {
    board[6][i] = { type: "歩", player: "先手", promoted: false };
  }

  // 後手の駒を配置
  board[0] = [
    { type: "香", player: "後手", promoted: false },
    { type: "桂", player: "後手", promoted: false },
    { type: "銀", player: "後手", promoted: false },
    { type: "金", player: "後手", promoted: false },
    { type: "玉", player: "後手", promoted: false },
    { type: "金", player: "後手", promoted: false },
    { type: "銀", player: "後手", promoted: false },
    { type: "桂", player: "後手", promoted: false },
    { type: "香", player: "後手", promoted: false },
  ];
  board[1][7] = { type: "角", player: "後手", promoted: false };
  board[1][1] = { type: "飛", player: "後手", promoted: false };
  for (let i = 0; i < 9; i++) {
    board[2][i] = { type: "歩", player: "後手", promoted: false };
  }

  return board;
};

export default function ImprovedFogOfWarShogi() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [gameId, setGameId] = useState<string | null>(null);
  const [inputGameId, setInputGameId] = useState<string>("");

  const [playerSide, setPlayerSide] = useState<Player | null>(null);
  const [gameCreated, setGameCreated] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [debugInfo, setDebugInfo] = useState<string>("");

  const [selectedCapturedPiece, setSelectedCapturedPiece] =
    useState<Piece | null>(null);

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
          if (piece.promoted) {
            addGoldMoves(row, col, direction, addVisibleCell);
          }
          break;
        case "銀":
          addVisibleCell(row + direction, col - 1);
          addVisibleCell(row + direction, col);
          addVisibleCell(row + direction, col + 1);
          addVisibleCell(row - direction, col - 1);
          addVisibleCell(row - direction, col + 1);
          if (piece.promoted) {
            addGoldMoves(row, col, direction, addVisibleCell);
          }
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
          addLineOfSight(row, col, 0, 1);
          addLineOfSight(row, col, 0, -1);
          addLineOfSight(row, col, 1, 0);
          addLineOfSight(row, col, -1, 0);
          if (piece.promoted) {
            addKingMoves(row, col, addVisibleCell);
          }
          break;
        case "玉":
          addKingMoves(row, col, addVisibleCell);
          break;
        case "馬":
          addLineOfSight(row, col, 1, 1);
          addLineOfSight(row, col, 1, -1);
          addLineOfSight(row, col, -1, 1);
          addLineOfSight(row, col, -1, -1);
          addKingMoves(row, col, addVisibleCell);
          break;
        case "龍":
          addLineOfSight(row, col, 0, 1);
          addLineOfSight(row, col, 0, -1);
          addLineOfSight(row, col, 1, 0);
          addLineOfSight(row, col, -1, 0);
          addKingMoves(row, col, addVisibleCell);
          break;
      }

      return visibleCells;
    },
    [board]
  );

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
    addVisibleCell: (r: number, c: number) => void
  ) => {
    for (let i = 0; i < 9; i++) {
      if (i !== row) addVisibleCell(i, col);
      if (i !== col) addVisibleCell(row, i);
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

  const updateVisibleBoard = useCallback(() => {
    if (!playerSide || !gameStarted) return;

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
          newVisibleBoard[row][col] = {
            piece: {
              ...piece,
              player:
                piece.player === playerSide
                  ? playerSide
                  : piece.player === "先手"
                  ? "後手"
                  : "先手",
            },
            isVisible: true,
          };
        }
      }
    }

    setVisibleBoard(newVisibleBoard);
  }, [board, playerSide, getVisibleCellsForPiece, gameStarted]);

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
        case "と":
        case "成香":
        case "成桂":
        case "成銀":
          return isValidGoldMove(rowDiff, colDiff, direction);
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
          if (isDiagonalMove) {
            const rowStep = rowDiff > 0 ? 1 : -1;
            const colStep = colDiff > 0 ? 1 : -1;
            return checkPath(rowStep, colStep);
          }
          if (
            piece.promoted &&
            Math.abs(rowDiff) <= 1 &&
            Math.abs(colDiff) <= 1
          ) {
            return true; // Promoted bishop can move one square in any direction
          }
          return false;
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
        case "馬":
          if (isDiagonalMove) {
            const rowStep = rowDiff > 0 ? 1 : -1;
            const colStep = colDiff > 0 ? 1 : -1;
            return checkPath(rowStep, colStep);
          }
          return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
        case "龍":
          return (
            (rowDiff === 0 && colDiff !== 0) ||
            (rowDiff !== 0 && colDiff === 0) ||
            (Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1)
          );
        default:
          return false;
      }
    },
    [board]
  );

  const isValidGoldMove = (
    rowDiff: number,
    colDiff: number,
    direction: number
  ): boolean => {
    return (
      Math.abs(rowDiff) <= 1 &&
      Math.abs(colDiff) <= 1 &&
      !(rowDiff === -direction && Math.abs(colDiff) === 1)
    );
  };

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

  const initializeVisibleBoard = useCallback(() => {
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
    setVisibleBoard(newVisibleBoard);
  }, [board, playerSide]);

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
      setGameStarted(true);
      setCurrentPlayer(currentPlayer);
      initializeVisibleBoard();
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
  }, [socket, initializeVisibleBoard]);

  useEffect(() => {
    console.log("visibleBoard updated:", visibleBoard);
  }, [visibleBoard]);

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

  // 駒の成りを確認する関数
  const checkPromotion = (
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
      ["金", "玉", "と", "成香", "成桂", "成銀", "馬", "龍"].includes(
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

  // 成った駒の種類を返す関数
  const getPromotedType = (
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

  const getOriginalType = (type: PieceType | PromotedPieceType): PieceType => {
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

        // 持ち駒を打つ場合の処理
        if (selectedCapturedPiece) {
          if (board[actualRow][actualCol] === null) {
            // 持ち駒を打つ処理
            const newBoard = board.map((r) => [...r]);
            newBoard[actualRow][actualCol] = {
              ...selectedCapturedPiece,
              promoted: false,
            };
            setBoard(newBoard);
            setCapturedPieces((prev) => ({
              ...prev,
              [playerSide]: prev[playerSide].filter(
                (p) => p !== selectedCapturedPiece
              ),
            }));
            setCurrentPlayer(currentPlayer === "先手" ? "後手" : "先手");
            setLastMove([row, col]);
            updateVisibleBoard();

            // WebSocket経由で移動を送信
            if (socket && gameId) {
              socket.emit("move", {
                gameId,
                from: null,
                to: [actualRow, actualCol],
                player: playerSide,
              });
            }
            setSelectedCapturedPiece(null);
            return;
          } else {
            toast({
              title: "無効な移動です",
              description: "空のマスにのみ持ち駒を打つことができます。",
              variant: "destructive",
            });
            setSelectedCapturedPiece(null);
            return;
          }
        }

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
                const capturedPieceType = getOriginalType(targetPiece.type);
                setCapturedPieces((prev) => ({
                  ...prev,
                  [playerSide]: [
                    ...prev[playerSide],
                    {
                      type: capturedPieceType,
                      player: playerSide,
                      promoted: false,
                    },
                  ],
                }));
              }

              // 駒の成りを確認
              const canPromote = checkPromotion(
                [actualSelectedRow, actualSelectedCol],
                [actualRow, actualCol],
                selectedPiece
              );

              let promotedPiece = { ...selectedPiece };

              if (canPromote) {
                const shouldPromote = window.confirm("駒を成りますか？");
                if (shouldPromote) {
                  promotedPiece = {
                    ...selectedPiece,
                    type: getPromotedType(selectedPiece.type),
                    promoted: true,
                  };
                }
              }

              // 駒を移動
              newBoard[actualRow][actualCol] = promotedPiece;
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
                  promotion: promotedPiece.promoted,
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
      selectedCapturedPiece,
      isValidMove,
      checkPromotion,
      getPromotedType,
      updateVisibleBoard,
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

  // 持ち駒をクリックしたときの処理を追加
  const handleCapturedPieceClick = (piece: Piece, side: Player) => {
    if (currentPlayer !== side || playerSide !== side) {
      toast({
        title: "無効な操作です",
        description: "自分の手番で自分の持ち駒を選択してください。",
        variant: "destructive",
      });
      return;
    }
    setSelectedCell(null);
    setSelectedCapturedPiece(piece);
  };

  return (
    <div className="min-h-screen bg-gray-100 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-4xl mx-auto bg-white shadow-xl">
        <CardContent className="p-2 pb-4">
          <h1 className="text-3xl font-bold mb-6 text-center text-gray-800">
            霧の将棋
          </h1>
          <div className="space-y-6">
            {!gameStarted && (
              <div className="flex flex-col justify-between items-start gap-4">
                <div className="w-full sm:w-auto space-y-4">
                  {!gameCreated && (
                    <Button onClick={createGame} className="w-full sm:w-auto">
                      新しいゲームを作成
                    </Button>
                  )}
                  <div className="flex flex-col sm:flex-row sm:items-end gap-2">
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
              </div>
            )}

            {gameId && (
              <div className="text-sm text-gray-600">
                <p>現在のゲームID: {gameId}</p>
                {playerSide && (
                  <p>あなたの手番: {playerSide === "先手" ? "先手" : "後手"}</p>
                )}
              </div>
            )}

            <div className="flex justify-between gap-4">
              <CapturedPieces
                title="先手の持ち駒"
                pieces={capturedPieces["先手"]}
                onPieceClick={(piece) =>
                  handleCapturedPieceClick(piece, "先手")
                }
              />
              <CapturedPieces
                title="後手の持ち駒"
                pieces={capturedPieces["後手"]}
                onPieceClick={(piece) =>
                  handleCapturedPieceClick(piece, "後手")
                }
              />
            </div>
            {gameStarted && (
              <div className="relative">
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
                {currentPlayer !== playerSide && <WaitingOverlay />}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function WaitingOverlay() {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <p className="text-lg font-semibold">相手のアクションを待っています</p>
      </div>
    </div>
  );
}

// CapturedPieces コンポーネントを更新
function CapturedPieces({
  title,
  pieces,
  onPieceClick,
}: {
  title: string;
  pieces: Piece[];
  onPieceClick: (piece: Piece) => void;
}) {
  return (
    <div className="bg-gray-100 p-4 rounded-lg flex-1">
      <h3 className="text-center font-semibold mb-2 text-gray-700">{title}</h3>
      <div className="grid grid-cols-3 gap-2">
        {pieces.map((piece, index) => (
          <button
            key={index}
            className="w-8 h-8 flex items-center justify-center bg-white rounded shadow text-gray-800 hover:bg-gray-200"
            onClick={() => onPieceClick(piece)}
          >
            {piece.type}
          </button>
        ))}
      </div>
    </div>
  );
}
