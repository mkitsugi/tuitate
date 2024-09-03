import { useCallback } from "react";
import { toast } from "sonner";
import { Player, Room, GameState, RoomState } from "@shared/shogi";

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
        position: "bottom-center",
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
        position: "bottom-center",
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
      toast.info(`${side}のプレイヤーが退出しました。`);
    },
    []
  );

  const handleGameStarted = useCallback(
    ({ gameId, currentPlayer }: { gameId: string; currentPlayer: Player }) => {
      setGameState((prev) => ({
        ...prev,
        gameStarted: true,
        availableSides: [],
      }));
      toast("ゲームが開始されました", {
        description: `現在の手番: ${currentPlayer}`,
        position: "bottom-center",
      });
    },
    [setGameState]
  );

  const handleGameError = useCallback((message: string) => {
    toast("エラー", {
      description: message,
      style: { background: "#dc2626", color: "#fff" },
      position: "bottom-center",
    });
  }, []);

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
  };
}
