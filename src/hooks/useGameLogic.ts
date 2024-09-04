import { useState, useCallback, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { toast } from "sonner";
import { Player, Piece, PieceType, PromotedPieceType } from "@shared/shogi";
import { usePromotionDialog } from "@/components/PromotionDialog";
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
  playerSide: Player | null
) {
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
  const [lastMove, setLastMove] = useState<[number, number] | null>(null);
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
        if (piece && piece.player === playerSide) {
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

      // 相手の駒を取る場合
      if (targetPiece) {
        const capturedPieceType = getOriginalType(targetPiece.type);
        setCapturedPieces((prev) => ({
          ...prev,
          [playerSide as Player]: [
            ...prev[playerSide as Player],
            {
              type: capturedPieceType,
              player: playerSide as Player,
              promoted: false,
            },
          ],
        }));
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
            description: "その位置に動かすと詰んてしまいます。",
            position: "bottom-center",
          });
        } else {
          toast.error("無効な移動です", {
            description: "その位置に動かすと詰んでしまいます。",
            position: "bottom-center",
          });
        }
        return; // 移動を実行せずに関数を終了
      }

      setBoard(newBoard);
      setCurrentPlayer(currentPlayer === "先手" ? "後手" : "先手");
      setLastMove([toRow, toCol]);
      setSelectedCell(null);
      updateVisibleBoard();

      // サーバーに移動を通知
      if (socket && gameId) {
        socket.emit("move", {
          gameId,
          from,
          to,
          player: playerSide,
          promotion: piece.promoted,
          piece: piece.type,
        });
      }

      playMoveSound();
    },
    [
      board,
      playerSide,
      currentPlayer,
      socket,
      gameId,
      updateVisibleBoard,
      playMoveSound,
    ]
  );

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (currentPlayer !== playerSide) {
        toast.info("相手の手番です", {
          description: "自分の手番をお待ちください。",
          position: "bottom-center",
        });
        return;
      }

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
                position: "bottom-center",
              });
              setSelectedCapturedPiece(null);
              return;
            }
          }

          executeMove({ ...selectedCapturedPiece, promoted: false }, null, [
            row,
            col,
          ]);
          setCapturedPieces((prev) => ({
            ...prev,
            [playerSide as Player]: prev[playerSide as Player].filter(
              (p) => p !== selectedCapturedPiece
            ),
          }));
        } else {
          toast.info("無効な移動です", {
            description: "空いているマスにのみ持ち駒を打てます。",
            position: "bottom-center",
          });
        }
        setSelectedCapturedPiece(null);
        return;
      }

      if (selectedCell) {
        const [selectedRow, selectedCol] = selectedCell;
        const selectedPiece = board[selectedRow][selectedCol];

        if (selectedRow === row && selectedCol === col) {
          // 同じ位置が選択された場合、選択を解除
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
              toast.info("無効な移動です", {
                description: "自分の駒は取れません。",
                position: "bottom-center",
              });
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
            }
          } else {
            toast.info("無効な移動です", {
              description: "選択した駒はそこに移動できません。",
              position: "bottom-center",
            });
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
            position: "bottom-center",
          });
        }
      }
    },
    [
      board,
      currentPlayer,
      playerSide,
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
          position: "bottom-center",
        });
        return;
      }
      setSelectedCell(null);
      setSelectedCapturedPiece(piece);
    },
    [currentPlayer, playerSide]
  );

  useEffect(() => {
    if (!socket) return;

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

    // プレイヤーの視点に基づいて王手の状態を判断
    const isCurrentPlayerInCheck =
      playerSide === currentPlayer ? isOpponentInCheck : isPlayerInCheck;
    const isCurrentPlayerChecking =
      playerSide === currentPlayer ? isPlayerInCheck : isOpponentInCheck;

    // 王手の状態が変更されたときのみtoastを表示
    if (isCurrentPlayerInCheck && !prevIsPlayerInCheck.current) {
      toast.error("王手！", {
        description: "あなたの王が狙われています。守りましょう！",
        position: "bottom-center",
      });
    } else if (isCurrentPlayerChecking && !prevIsOpponentInCheck.current) {
      toast.success("王手！", {
        description: "相手の王を狙っています。",
        position: "bottom-center",
      });
    }

    // 前回の状態を更新
    prevIsPlayerInCheck.current = isPlayerInCheck;
    prevIsOpponentInCheck.current = isOpponentInCheck;

    return () => {
      socket.off("boardUpdated");
    };
  }, [socket, updateVisibleBoard, playMoveSound, playerSide]);

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
  };
}
