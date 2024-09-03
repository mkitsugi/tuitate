import { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { Player, GameState, RoomState, Room } from "@shared/shogi";
import { useSocketEvents } from "./useSocketEvents";
import { useRoomManagement } from "./useRoomManagement";

const WEBSOCKET_URL =
  process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3001";

export default function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [mySocketId, setMySocketId] = useState<string | null>(null);

  const {
    gameState,
    setGameState,
    roomState,
    setRoomState,
    addNewRoom,
    updateAvailableSides,
  } = useRoomManagement();

  const {
    handleRoomList,
    handleGameCreated,
    handleGameJoined,
    handleAvailableSidesUpdated,
    handleRoomCreated,
    handlePlayerJoined,
    handlePlayerLeft,
    handleGameStarted,
    handleGameError,
  } = useSocketEvents(setGameState, setRoomState);

  useEffect(() => {
    const newSocket = io(WEBSOCKET_URL, {
      withCredentials: true,
      transports: ["websocket"],
    });
    setSocket(newSocket);

    newSocket.on("connect", () => {
      setMySocketId(newSocket.id as string);
      console.log("Connected to WebSocket server");
      findExistingRooms();
    });

    newSocket.on("connect_error", (error) => {
      console.error("WebSocket connection error:", error);
      toast.error("接続エラー", {
        description: "サーバーに接続できません。",
        position: "bottom-center",
      });
    });

    return () => {
      newSocket.disconnect();
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    socket.on("roomList", handleRoomList);
    socket.on("gameCreated", handleGameCreated);
    socket.on("newRoomCreated", (newRoom: Room) => {
      addNewRoom(newRoom);
    });
    socket.on("gameJoined", handleGameJoined);
    socket.on("availableSidesUpdated", handleAvailableSidesUpdated);
    socket.on("playerJoined", handlePlayerJoined);
    socket.on("playerLeft", handlePlayerLeft);
    socket.on("roomCreated", handleRoomCreated);
    socket.on("gameStarted", handleGameStarted);
    socket.on("gameError", handleGameError);

    return () => {
      socket.off("roomList");
      socket.off("gameCreated");
      socket.off("gameJoined");
      socket.off("availableSidesUpdated");
      socket.off("playerJoined");
      socket.off("playerLeft");
      socket.off("gameStarted");
      socket.off("gameError");
      socket.off("roomCreated");
    };
  }, [
    socket,
    handleRoomList,
    handleGameCreated,
    handleGameJoined,
    handleAvailableSidesUpdated,
    handlePlayerJoined,
    handlePlayerLeft,
    handleGameStarted,
    handleGameError,
  ]);

  const getAvailableSides = useCallback(
    async (roomId: string): Promise<Player[]> => {
      return new Promise((resolve) => {
        socket?.emit("getAvailableSides", roomId, (sides: Player[]) => {
          updateAvailableSides(sides);
          resolve(sides);
        });
      });
    },
    [socket, updateAvailableSides]
  );

  const resign = useCallback(() => {
    if (socket && gameState.gameId) {
      socket.emit("resign", { gameId: gameState.gameId });
    }
  }, [socket, gameState.gameId]);

  const findExistingRooms = useCallback(() => {
    setRoomState((prev: RoomState) => ({ ...prev, isLoadingRooms: true }));
    console.log("Requesting rooms from server");
    socket?.emit("getRooms");
  }, [socket, setRoomState]);

  const createGame = useCallback(() => {
    if (socket) {
      socket.emit("createGame", (response: { gameId: string }) => {
        if (response.gameId) {
          socket.emit("roomCreated", { id: response.gameId, players: 1 });
        }
      });
    } else {
      toast.error("エラー", {
        description: "サーバーに接続されていません。",
        position: "bottom-center",
      });
    }
  }, [socket]);

  const joinGame = useCallback(
    (side: Player, roomId: string) => {
      socket?.emit(
        "joinGame",
        { gameId: roomId, side },
        (response: { success: boolean; message?: string }) => {
          if (response.success) {
            setGameState((prev: GameState) => ({
              ...prev,
              gameId: roomId,
              playerSide: side,
            }));
          } else {
            toast.error(response.message || "ゲームに参加できませんでした。");
          }
        }
      );
    },
    [socket, setGameState]
  );

  const joinRoom = useCallback(
    (roomId: string) => {
      console.log(`Joining room ${roomId}`);
      socket?.emit("joinRoom", { roomId });
    },
    [socket]
  );

  const selectSide = useCallback(
    (side: Player, roomId: string) => {
      console.log(`Selecting side ${side} in room ${roomId}`);
      socket?.emit(
        "selectSide",
        { gameId: roomId, side },
        (response: { success: boolean; message?: string }) => {
          if (response.success) {
            setGameState((prev: GameState) => ({
              ...prev,
              gameId: roomId,
              playerSide: side,
            }));
            console.log(`Joined game ${roomId} as ${side}`);
          } else {
            toast.error(response.message || "ゲームに参加できませんでした。");
          }
        }
      );
    },
    [socket, setGameState]
  );

  const leaveRoom = useCallback(() => {
    if (gameState.gameId && gameState.playerSide) {
      console.log(
        `Leaving room ${gameState.gameId} as ${gameState.playerSide}`
      );
      socket?.emit("leaveRoom", {
        roomId: gameState.gameId,
        side: gameState.playerSide,
      });
      setGameState((prev: GameState) => ({
        ...prev,
        gameId: null,
        playerSide: null,
        selectedSide: null,
        availableSides: ["先手", "後手"],
      }));
    }
  }, [socket, gameState, setGameState]);

  return {
    socket,
    mySocketId,
    ...gameState,
    ...roomState,
    joinRoom,
    selectSide,
    leaveRoom,
    getAvailableSides,
    updateAvailableSides,
    createGame,
    joinGame,
    findExistingRooms,
    addNewRoom,
    resign,
  };
}
