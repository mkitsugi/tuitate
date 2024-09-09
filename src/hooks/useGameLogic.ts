import { v4 as uuidv4 } from "uuid";
import { useState, useCallback, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { toast } from "sonner";
import { Player, Piece, PieceType, PromotedPieceType } from "@shared/shogi";
import { usePromotionDialog } from "@/components/PromotionDialog";
import { initializeVisibleBoard } from "@shared/boardUtils";
import {
  initialBoard,
  getVisibleCellsForPiece,
  isValidMove,
  checkPromotion,
  getPromotedType,
  getOriginalType,
  isInCheck,
} from "@shared/boardUtils";

export default function useGameLogic(
  socket: Socket | null,
  gameId: string | null,
  playerSide: Player | null,
  isCPUMode: boolean
) {
  const isDev = process.env.NODE_ENV === "development";
  const [board, setBoard] = useState<(Piece | null)[][]>(initialBoard());
  const [visibleBoard, setVisibleBoard] = useState<
    { piece: Piece | null; isVisible: boolean }[][]
  >(
    Array(9)
      .fill(null)
      .map(() => Array(9).fill({ piece: null, isVisible: false }))
  );
  const [currentPlayer, setCurrentPlayer] = useState<Player>("先手");
  const [selectedCell, setSelectedCell] = useState<[number, number] | null>(
    null
  );
  // lastMoveの型を変更
  const [lastMove, setLastMove] = useState<{
    from: [number, number];
    to: [number, number];
    piece: Piece;
    capturedPiece: Piece | null;
  } | null>(null);

  const [capturedPieces, setCapturedPieces] = useState<{
    先手: Piece[];
    後手: Piece[];
  }>({ 先手: [], 後手: [] });
  const [selectedCapturedPiece, setSelectedCapturedPiece] =
    useState<Piece | null>(null);

  const [showPromotionDialog, setShowPromotionDialog] = useState(false);
  const [pendingMove, setPendingMove] = useState<{
    from: [number, number];
    to: [number, number];
    piece: Piece;
  } | null>(null);
  const { openPromotionDialog, PromotionDialog } = usePromotionDialog();

  const moveAudioRef = useRef<HTMLAudioElement | null>(null);

  const [isPlayerInCheck, setIsPlayerInCheck] = useState<boolean>(false);
  const [isOpponentInCheck, setIsOpponentInCheck] = useState<boolean>(false);
  const prevIsPlayerInCheck = useRef(false);
  const prevIsOpponentInCheck = useRef(false);

  const [isCPUTurn, setIsCPUTurn] = useState(false);

  useEffect(() => {
    moveAudioRef.current = new Audio("/move.mp3");
  }, []);

  const playMoveSound = useCallback(() => {
    if (moveAudioRef.current) {
      moveAudioRef.current.currentTime = 0; // 再生位置をリセット
      moveAudioRef.current.play().catch((error) => {
        console.error("Error playing sound:", error);
        // フォールバック: 音が再生できない場合はコンソールにメッセージを表示
        console.log("Move sound played (fallback)");
      });
    }
  }, []);

  const updateVisibleBoard = useCallback(() => {
    if (!playerSide) return;

    const newVisibleBoard = Array(9)
      .fill(null)
      .map(() => Array(9).fill({ piece: null, isVisible: false }));

    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 9; col++) {
        const piece = board[row][col];
        if (isDev && isCPUMode) {
          // Show all pieces in development mode and CPU mode
          newVisibleBoard[row][col] = { piece, isVisible: true };
        } else if (piece && piece.player === playerSide) {
          const visibleCells = getVisibleCellsForPiece(row, col, piece, board);
          visibleCells.forEach(([r, c]) => {
            newVisibleBoard[r][c] = { piece: board[r][c], isVisible: true };
          });
          newVisibleBoard[row][col] = { piece, isVisible: true };
        }
      }
    }

    setVisibleBoard(newVisibleBoard);
  }, [board, playerSide]);

  useEffect(() => {
    updateVisibleBoard();
  }, [updateVisibleBoard, currentPlayer]);

  const executeMove = useCallback(
    (piece: Piece, from: [number, number] | null, to: [number, number]) => {
      //   const [fromRow, fromCol] = from;
      const [toRow, toCol] = to;
      const newBoard = board.map((row) => [...row]);
      const targetPiece = newBoard[toRow][toCol];

      // 移動前の状態を記録
      setLastMove({
        from: from || [-1, -1], // 持ち駒を使う場合は[-1, -1]とする
        to: to,
        piece: { ...piece },
        capturedPiece: targetPiece ? { ...targetPiece } : null,
      });

      // 相手の駒を取る場合
      if (targetPiece && targetPiece.player !== piece.player) {
        const capturedPieceType = getOriginalType(targetPiece.type);
        setCapturedPieces((prev) => {
          const newCapturedPieces = { ...prev };
          newCapturedPieces[piece.player] = [
            ...newCapturedPieces[piece.player],
            {
              id: uuidv4(),
              type: capturedPieceType,
              player: piece.player,
              promoted: false,
            },
          ];
          // 相手の持ち駒から取られた駒を削除
          newCapturedPieces[targetPiece.player] = newCapturedPieces[
            targetPiece.player
          ].filter((p) => p.id !== targetPiece.id);
          return newCapturedPieces;
        });
      }

      // 駒を移動
      newBoard[toRow][toCol] = piece;
      if (from) {
        const [fromRow, fromCol] = from;
        newBoard[fromRow][fromCol] = null;
      }

      // 移動後に王手状態をチェック
      const isStillInCheck = isInCheck(newBoard, playerSide as Player);

      if (isStillInCheck) {
        if (piece.type === "王") {
          toast.error("無効な移動です", {
            description: "その位置に動かすと詰んでしまいます。",
            position: "top-right",
          });
        } else {
          toast.error("無効な移動です", {
            description: "その位置に動かすと詰んでしまいます。",
            position: "top-right",
          });
        }
        return board; // 移動を実行せずに関数を終了
      }

      // 移動後に王手状態をチェック
      const newIsPlayerInCheck = isInCheck(
        newBoard,
        playerSide === "先手" ? "後手" : "先手"
      );
      const newIsOpponentInCheck = isInCheck(newBoard, playerSide as Player);
      setIsPlayerInCheck(newIsPlayerInCheck);
      setIsOpponentInCheck(newIsOpponentInCheck);

      // 前回の状態を更新
      prevIsPlayerInCheck.current = newIsPlayerInCheck;
      prevIsOpponentInCheck.current = newIsOpponentInCheck;

      // CPU戦の場合、ローカルで状態を更新
      setBoard(newBoard);
      setCurrentPlayer(currentPlayer === "先手" ? "後手" : "先手");
      // setLastMove([toRow, toCol]);
      setSelectedCell(null);
      updateVisibleBoard();

      // サーバーに移動を通知（CPU戦でない場合のみ）
      if (!isCPUMode && socket && gameId) {
        socket.emit("move", {
          gameId,
          from,
          to,
          player: playerSide,
          promotion: piece.promoted,
          piece: piece.type,
        });
      }

      // CPUモードの場合、プレイヤーの手番が終わったらCPUの手番をセット
      if (isCPUMode && currentPlayer === playerSide) {
        setIsCPUTurn(true);
      }

      playMoveSound();

      return newBoard;
    },
    [
      board,
      playerSide,
      currentPlayer,
      isCPUMode,
      socket,
      gameId,
      updateVisibleBoard,
      playMoveSound,
    ]
  );

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (currentPlayer !== playerSide) {
        if (!isCPUMode) {
          toast.info("相手の手番です", {
            description: "自分の手番をお待ちください。",
            position: "top-right",
          });
        }
        return;
      }

      let moveExecuted = false;

      if (selectedCapturedPiece) {
        if (board[row][col] === null) {
          // 二歩チェックを追加
          if (selectedCapturedPiece.type === "歩") {
            const isNifu = board.some(
              (rowPieces, r) =>
                r !== row &&
                rowPieces[col] &&
                rowPieces[col]?.type === "歩" &&
                rowPieces[col]?.player === playerSide
            );
            if (isNifu) {
              toast.error("二歩は禁止されています", {
                description: "同じ列に2つの歩を置くことはできません。",
                position: "top-right",
              });
              setSelectedCapturedPiece(null);
              return;
            }
          }

          executeMove({ ...selectedCapturedPiece, promoted: false }, null, [
            row,
            col,
          ]);
          moveExecuted = true;
          setCapturedPieces((prev) => ({
            ...prev,
            [playerSide as Player]: prev[playerSide as Player].filter(
              (p) => p !== selectedCapturedPiece
            ),
          }));
        } else {
          toast.info("無効な移動です", {
            description: "空いているマスにのみ持ち駒を打てます。",
            position: "top-right",
          });
        }
        setSelectedCapturedPiece(null);
        return;
      }

      if (selectedCell) {
        const [selectedRow, selectedCol] = selectedCell;
        const selectedPiece = board[selectedRow][selectedCol];

        if (selectedRow === row && selectedCol === col) {
          setSelectedCell(null);
          return;
        }

        if (selectedPiece && selectedPiece.player === currentPlayer) {
          if (
            isValidMove(
              [selectedRow, selectedCol],
              [row, col],
              selectedPiece,
              board
            )
          ) {
            const targetPiece = board[row][col];

            // 自分の駒を取ろうとしている場合は移動を無効にする
            if (targetPiece && targetPiece.player === currentPlayer) {
              // toast.info("無効な移動です", {
              //   description: "自分の駒は取れません。",
              //   position: "top-right",
              // });
              setSelectedCell(null);
              return;
            }

            const canPromote = checkPromotion(
              [selectedRow, selectedCol],
              [row, col],
              selectedPiece
            );

            if (canPromote) {
              if (
                ["歩", "香", "桂", "銀"].includes(
                  selectedPiece.type as string
                ) &&
                (row === 0 || row === 8)
              ) {
                // 自動的に成る
                const promotedPiece = {
                  ...selectedPiece,
                  type: getPromotedType(selectedPiece.type as PieceType),
                  promoted: true,
                };
                executeMove(
                  promotedPiece,
                  [selectedRow, selectedCol],
                  [row, col]
                );
                moveExecuted = true;
              } else {
                // プレイヤーに選択させる
                setPendingMove({
                  from: [selectedRow, selectedCol],
                  to: [row, col],
                  piece: selectedPiece,
                });
                openPromotionDialog();
                return;
              }
            } else {
              executeMove(
                selectedPiece,
                [selectedRow, selectedCol],
                [row, col]
              );
              moveExecuted = true;
            }
          }
          setSelectedCell(null);
        }
      } else {
        const piece = board[row][col];
        if (piece && piece.player === currentPlayer) {
          setSelectedCell([row, col]);
        } else if (piece) {
          toast.error("無効な選択です", {
            description: "自分の駒を選択してください。",
            position: "top-right",
          });
        }
      }
    },
    [
      board,
      currentPlayer,
      playerSide,
      isCPUMode,
      selectedCell,
      selectedCapturedPiece,
      executeMove,
      openPromotionDialog,
    ]
  );

  const handleCapturedPieceClick = useCallback(
    (piece: Piece | null, side: Player) => {
      if (currentPlayer !== side || playerSide !== side) {
        toast.error("無効な操作です", {
          description: "自分の手番で自分の持ち駒を選択してください。",
          position: "top-right",
        });
        return;
      }
      setSelectedCell(null);
      setSelectedCapturedPiece(piece);
    },
    [currentPlayer, playerSide]
  );

  useEffect(() => {
    // CPU戦（socketがない場合）の処理を追加
    const updateCheckStatus = () => {
      const isCurrentPlayerTurn = playerSide !== currentPlayer;
      const isPlayerChecking = isCurrentPlayerTurn
        ? isOpponentInCheck
        : isPlayerInCheck;
      const isPlayerInDanger = isCurrentPlayerTurn
        ? isPlayerInCheck
        : isOpponentInCheck;

      if (isPlayerInDanger && !prevIsPlayerInCheck.current) {
        toast.error("王手されました！", {
          position: "top-right",
        });
      } else if (isPlayerChecking && !prevIsOpponentInCheck.current) {
        toast.success("王手！", {
          position: "top-right",
        });
      }

      prevIsPlayerInCheck.current = isPlayerInCheck;
      prevIsOpponentInCheck.current = isOpponentInCheck;
    };

    // CPU戦（socketがない場合）の処理
    if (!socket) {
      updateCheckStatus();
      return;
    }

    socket.on(
      "boardUpdated",
      ({
        board: newBoard,
        currentPlayer: newCurrentPlayer,
        capturedPieces: newCapturedPieces,
        isPlayerInCheck,
        isOpponentInCheck,
      }) => {
        setBoard(newBoard);
        setCurrentPlayer(newCurrentPlayer);
        setCapturedPieces(newCapturedPieces);
        setSelectedCell(null);
        setIsPlayerInCheck(isPlayerInCheck);
        setIsOpponentInCheck(isOpponentInCheck);
        updateVisibleBoard();
        playMoveSound();
      }
    );

    // ボードが更新された後にチェック状態を更新
    updateCheckStatus();

    return () => {
      socket.off("boardUpdated");
    };
  }, [
    socket,
    updateVisibleBoard,
    playMoveSound,
    playerSide,
    isPlayerInCheck,
    isOpponentInCheck,
  ]);

  const handlePromotionChoice = useCallback(
    (shouldPromote: boolean) => {
      if (pendingMove) {
        const { from, to, piece } = pendingMove;
        const promotedPiece = shouldPromote
          ? {
            ...piece,
            type: getPromotedType(piece.type as PieceType),
            promoted: true,
          }
          : piece;
        executeMove(promotedPiece, from, to);
        setPendingMove(null);
      }
    },
    [pendingMove, executeMove]
  );

  const executeCPUMove = async () => {
    try {
      const cpuPlayer = playerSide === "先手" ? "後手" : "先手";
      // 全ての駒の情報を含む完全な盤面情報
      const fullBoard = board.map((row) =>
        row.map((cell) => {
          if (!cell) return null;
          return { player: cell.player, type: cell.type };
        })
      );
      // CPU視点の可視盤面情報を生成
      const cpuVisibleBoard = Array(9)
        .fill(null)
        .map(() => Array(9).fill(null));
      for (let row = 0; row < 9; row++) {
        for (let col = 0; col < 9; col++) {
          const piece = board[row][col];
          if (piece && piece.player === cpuPlayer) {
            cpuVisibleBoard[row][col] = {
              player: piece.player,
              type: piece.type,
            };
            const visibleCells = getVisibleCellsForPiece(
              row,
              col,
              piece,
              board
            );
            visibleCells.forEach(([r, c]) => {
              if (board[r][c]) {
                cpuVisibleBoard[r][c] = {
                  player: board[r][c].player,
                  type: board[r][c].type,
                };
              }
            });
          }
        }
      }

      const requestBody = {
        fullBoard: fullBoard,
        visibleBoard: cpuVisibleBoard,
        player: cpuPlayer,
      };

      const response = await fetch("/api/getCPUMove", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const [fromRow, fromCol, toRow, toCol] = data.move;

      const cpuPiece = board[fromRow][fromCol];
      if (cpuPiece) {
        executeMove(cpuPiece, [fromRow, fromCol], [toRow, toCol]);
      }
      setIsCPUTurn(false);
    } catch (error) {
      console.error("Error getting CPU move:", error);
      toast.error("CPUの手の取得に失敗しました", {
        description: "もう一度お試しください。",
        position: "top-right",
      });
      // ユーザーの手を元に戻す
      undoLastMove();
      setIsCPUTurn(false);
    }
  };

  // 最後の手を元に戻す関数を追加
  const undoLastMove = useCallback(() => {
    if (!lastMove) return;

    setBoard((prevBoard) => {
      const newBoard = prevBoard.map((row) => [...row]);
      const { from, to, piece, capturedPiece } = lastMove;

      // 移動した駒を元の位置に戻す
      if (from[0] !== -1 && from[1] !== -1) {
        newBoard[from[0]][from[1]] = piece;
      } else {
        // 持ち駒を使った場合は、その駒を持ち駒に戻す
        setCapturedPieces((prev) => ({
          ...prev,
          [piece.player]: [...prev[piece.player], piece],
        }));
      }

      // 移動先を元の状態に戻す
      newBoard[to[0]][to[1]] = capturedPiece;

      return newBoard;
    });

    // プレイヤーを切り替え
    setCurrentPlayer(currentPlayer === "先手" ? "後手" : "先手");

    // その他の状態をリセット
    setLastMove(null);
    setSelectedCell(null);
    updateVisibleBoard();
  }, [lastMove, currentPlayer, updateVisibleBoard]);

  useEffect(() => {
    if (isCPUMode && isCPUTurn) {
      const timer = setTimeout(executeCPUMove, 1000);
      return () => clearTimeout(timer);
    }
  }, [isCPUMode, isCPUTurn, playerSide, executeMove, board]);

  const showAllPieces = useCallback(() => {
    const newVisibleBoard = board.map((row) =>
      row.map((piece) => ({ piece, isVisible: true }))
    );
    setVisibleBoard(newVisibleBoard);
  }, [board]);

  const resetGameState = useCallback(() => {
    const newBoard = initialBoard();
    setBoard(newBoard);
    setVisibleBoard(
      Array(9)
        .fill(null)
        .map(() => Array(9).fill({ piece: null, isVisible: false }))
    );
    setCurrentPlayer("先手");
    setSelectedCell(null);
    setLastMove(null);
    setCapturedPieces({ 先手: [], 後手: [] });
    setSelectedCapturedPiece(null);
  }, []);

  const resetForNewGame = useCallback(() => {
    resetGameState();
  }, [resetGameState]);

  useEffect(() => {
    if (gameId) {
      resetGameState();
    }
  }, [gameId, resetGameState]);

  return {
    board,
    visibleBoard,
    currentPlayer,
    selectedCell,
    lastMove,
    capturedPieces,
    selectedCapturedPiece,
    isPlayerInCheck,
    isOpponentInCheck,
    PromotionDialog,
    handlePromotionChoice,
    playMoveSound,
    handleCellClick,
    handleCapturedPieceClick,
    showAllPieces,
    resetGameState,
    resetForNewGame,
  };
}
