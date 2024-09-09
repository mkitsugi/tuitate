import { useCallback } from "react";
import { toast } from "sonner";
import { Player, Room, GameState, RoomState, Board } from "@shared/shogi";

export function useSocketEvents(
  setGameState: React.Dispatch<React.SetStateAction<GameState>>,
  setRoomState: React.Dispatch<React.SetStateAction<RoomState>>
) {
  const handleRoomList = useCallback(
    (rooms: Room[]) => {
      console.log("Received room list:", rooms);
      setRoomState((prev) => ({
        ...prev,
        existingRooms: rooms,
        isLoadingRooms: false,
      }));
    },
    [setRoomState]
  );

  const handleGameCreated = useCallback(
    (id: string) => {
      setGameState((prev) => ({
        ...prev,
        gameId: id.trim(),
        gameCreated: true,
      }));
      toast("ゲームが作成されました", {
        description: `ゲームID: ${id.trim()}`,
        position: "top-right",
      });
    },
    [setGameState]
  );

  const handleGameJoined = useCallback(
    ({ gameId, side }: { gameId: string; side: Player }) => {
      setGameState((prev) => ({
        ...prev,
        gameId,
        playerSide: side,
        availableSides: prev.availableSides.filter((s) => s !== side),
      }));
      toast("ゲームに参加しました", {
        description: `ゲームID: ${gameId}, 手番: ${side}`,
        position: "top-right",
      });
    },
    [setGameState]
  );

  const handleRoomCreated = useCallback(
    (newRoom: Room) => {
      setRoomState((prev) => ({
        ...prev,
        existingRooms: [...prev.existingRooms, newRoom],
      }));
    },
    [setRoomState]
  );

  const handleAvailableSidesUpdated = useCallback(
    (updatedSides: Player[]) => {
      console.log("Received availableSidesUpdated:", updatedSides);
      setGameState((prev) => ({ ...prev, availableSides: updatedSides }));
    },
    [setGameState]
  );

  const handlePlayerJoined = useCallback(
    ({ side, playerId }: { side: Player; playerId: string }) => {
      console.log(`Player ${playerId} joined as ${side}`);
    },
    []
  );

  const handlePlayerLeft = useCallback(
    ({ side, playerId }: { side: Player; playerId: string }) => {
      console.log(`Player ${playerId} left as ${side}`);
      setGameState((prev) => ({
        ...prev,
        gameEnded: true,
        winner: prev.playerSide,
      }));
    },
    []
  );

  const handleGameStarted = useCallback(
    ({ gameId, board, currentPlayer, playerSides }: {
      gameId: string;
      board: Board;
      currentPlayer: Player;
      playerSides: { [key: string]: Player }
    }) => {
      setGameState((prev) => ({
        ...prev,
        gameId,
        board,
        playerSides,
        currentPlayer,
        gameStarted: true,
        gameEnded: false,
        winner: null,
        availableSides: [],
      }));
    },
    [setGameState]
  );

  const handleGameError = useCallback((message: string) => {
    toast("エラー", {
      description: message,
      style: { background: "#dc2626", color: "#fff" },
      position: "top-right",
    });
  }, []);

  const handleGameEnded = useCallback(
    ({ winner, reason }: { winner: Player | null; reason: string }) => {
      console.log("Game ended:", { winner, reason });
      setGameState((prev) => ({
        ...prev,
        gameEnded: true,
        winner: winner,
      }));
    },
    [setGameState]
  );

  return {
    handleRoomList,
    handleGameCreated,
    handleGameJoined,
    handleAvailableSidesUpdated,
    handleRoomCreated,
    handlePlayerJoined,
    handlePlayerLeft,
    handleGameStarted,
    handleGameError,
    handleGameEnded,
  };
}
