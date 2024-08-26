import { useState, useCallback, useEffect } from "react";
import { Socket } from "socket.io-client";
import { toast } from "@/components/ui/use-toast";
import { Player, Piece, PieceType, PromotedPieceType } from "@/types/shogi";
import {
  initialBoard,
  getVisibleCellsForPiece,
  isValidMove,
  checkPromotion,
  getPromotedType,
  getOriginalType,
} from "@/utils/boardUtils";

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

  const handleCellClick = useCallback(
    (row: number, col: number) => {
      if (currentPlayer !== playerSide) {
        toast({
          title: "相手の手番です",
          description: "自分の手番をお待ちください。",
          variant: "destructive",
        });
        return;
      }

      if (selectedCapturedPiece) {
        if (board[row][col] === null) {
          const newBoard = board.map((r) => [...r]);
          newBoard[row][col] = { ...selectedCapturedPiece, promoted: false };
          setBoard(newBoard);
          setCapturedPieces((prev) => ({
            ...prev,
            [playerSide as Player]: prev[playerSide as Player].filter(
              (p) => p !== selectedCapturedPiece
            ),
          }));
          setCurrentPlayer(currentPlayer === "先手" ? "後手" : "先手");
          setLastMove([row, col]);
          updateVisibleBoard();

          if (socket && gameId) {
            socket.emit("move", {
              gameId,
              from: null,
              to: [row, col],
              player: playerSide,
              piece: selectedCapturedPiece.type,
              promotion: false,
            });
          }
        } else {
          toast({
            title: "無効な移動です",
            description: "空いているマスにのみ持ち駒を打てます。",
            variant: "destructive",
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
              toast({
                title: "無効な移動です",
                description: "自分の駒は取れません。",
                variant: "destructive",
              });
              setSelectedCell(null);
              return;
            }

            const newBoard = board.map((r) => [...r]);

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

            const canPromote = checkPromotion(
              [selectedRow, selectedCol],
              [row, col],
              selectedPiece
            );
            let promotedPiece = { ...selectedPiece };

            if (canPromote) {
              if (
                ["歩", "香", "桂", "銀"].includes(
                  selectedPiece.type as string
                ) &&
                (row === 0 || row === 8)
              ) {
                // 自動的に成る
                promotedPiece = {
                  ...selectedPiece,
                  type: getPromotedType(selectedPiece.type as PieceType),
                  promoted: true,
                };
              } else {
                // プレイヤーに選択させる
                const shouldPromote = window.confirm("駒を成りますか？");
                if (shouldPromote) {
                  promotedPiece = {
                    ...selectedPiece,
                    type: getPromotedType(selectedPiece.type as PieceType),
                    promoted: true,
                  };
                }
              }
            }

            newBoard[row][col] = promotedPiece;
            newBoard[selectedRow][selectedCol] = null;

            setBoard(newBoard);
            setCurrentPlayer(currentPlayer === "先手" ? "後手" : "先手");
            setLastMove([row, col]);
            updateVisibleBoard();

            if (socket && gameId) {
              socket.emit("move", {
                gameId,
                from: [selectedRow, selectedCol],
                to: [row, col],
                player: playerSide,
                promotion: promotedPiece.promoted,
              });
            }
          } else {
            toast({
              title: "無効な移動です",
              description: "選択した駒はそこに移動できません。",
              variant: "destructive",
            });
          }
        }
        setSelectedCell(null);
      } else {
        const piece = board[row][col];
        if (piece && piece.player === currentPlayer) {
          setSelectedCell([row, col]);
        } else if (piece) {
          toast({
            title: "無効な選択です",
            description: "自分の駒を選択してください。",
            variant: "destructive",
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
      socket,
      gameId,
      updateVisibleBoard,
    ]
  );

  const handleCapturedPieceClick = useCallback(
    (piece: Piece | null, side: Player) => {
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
    },
    [currentPlayer, playerSide]
  );

  useEffect(() => {
    if (!socket) return;

    socket.on(
      "boardUpdated",
      ({ board: newBoard, currentPlayer: newCurrentPlayer }) => {
        setBoard(newBoard);
        setCurrentPlayer(newCurrentPlayer);
        setSelectedCell(null);
        updateVisibleBoard();
      }
    );

    return () => {
      socket.off("boardUpdated");
    };
  }, [socket, updateVisibleBoard]);

  return {
    board,
    visibleBoard,
    currentPlayer,
    selectedCell,
    lastMove,
    capturedPieces,
    selectedCapturedPiece,
    handleCellClick,
    handleCapturedPieceClick,
  };
}
