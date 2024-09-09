import { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { Player, GameState, RoomState, Room } from "@shared/shogi";
import { useSocketEvents } from "./useSocketEvents";
import {
  useRoomManagement,
  initialBoard,
  createInitialVisibleBoard,
} from "./useRoomManagement";

const WEBSOCKET_URL =
  process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3001";

export default function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [mySocketId, setMySocketId] = useState<string | null>(null);

  const [rematchRequested, setRematchRequested] = useState<boolean>(false);
  const [rematchAccepted, setRematchAccepted] = useState<boolean>(false);
  const [opponentLeft, setOpponentLeft] = useState<boolean>(false);
  const [opponentRequestedRematch, setOpponentRequestedRematch] =
    useState<boolean>(false);

  const [isCPUMode, setIsCPUMode] = useState<boolean>(false);

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
    handleGameEnded,
  } = useSocketEvents(setGameState, setRoomState);

  useEffect(() => {
    let newSocket: Socket | null = null;

    if (!isCPUMode) {
      newSocket = io(WEBSOCKET_URL, {
        withCredentials: true,
        transports: ["websocket"],
      });

      newSocket.on("connect", () => {
        setMySocketId(newSocket?.id as string);
        console.log("Connected to WebSocket server");
        findExistingRooms();
      });

      newSocket.on("connect_error", (error) => {
        console.error("WebSocket connection error:", error);
      });

      setSocket(newSocket);
    } else {
      // CPU モードの場合、既存の接続を切断
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setMySocketId(null);
      }
    }

    return () => {
      if (newSocket) {
        newSocket.disconnect();
      }
    };
  }, [isCPUMode]);

  useEffect(() => {
    if (isCPUMode) return;

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
    socket.on("matchFound", (response: { success: boolean; gameId: string; side: Player }) => {
      if (response.success) {
        setGameState((prev: GameState) => ({
          ...prev,
          gameId: response.gameId,
          playerSide: response.side,
        }));
        toast.success("マッチングしました！", {
          position: "top-right",
        });
      }
    });
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
    socket.on("gameEnded", handleGameEnded);

    socket.on("rematchRequested", () => {
      toast.info("相手が再戦をリクエストしました。", {
        position: "bottom-center",
        action: {
          label: "承諾",
          onClick: () => acceptRematch(),
        },
      });
    });

    socket.on("opponentRequestedRematch", () => {
      setOpponentRequestedRematch(true);
      toast.info("相手が再戦をリクエストしました。", {
        position: "bottom-center",
      });
    });

    socket.on("rematchAccepted", () => {
      setRematchAccepted(true);
    });

    socket.on("opponentLeft", () => {
      setOpponentLeft(true);
      setRematchRequested(false);
      setOpponentRequestedRematch(false);
    });

    return () => {
      socket.off("roomList");
      socket.off("matchFound");
      socket.off("gameCreated");
      socket.off("gameJoined");
      socket.off("availableSidesUpdated");
      socket.off("playerJoined");
      socket.off("playerLeft");
      socket.off("gameStarted");
      socket.off("gameError");
      socket.off("roomCreated");
      socket.off("gameEnded");
      socket.off("rematchRequested");
      socket.off("rematchAccepted");
      socket.off("opponentLeft");
      socket.off("opponentRequestedRematch");
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
    handleGameEnded,
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

  const clearExistingRooms = useCallback(() => {
    setRoomState((prev: RoomState) => ({ ...prev, existingRooms: [] }));
  }, [setRoomState]);

  const findExistingRooms = useCallback(() => {
    setRoomState((prev: RoomState) => ({ ...prev, isLoadingRooms: true }));
    console.log("Requesting rooms from server");
    socket?.emit("getRooms");
  }, [socket, setRoomState]);

  const findRandomMatch = useCallback(() => {
    if (socket) {
      socket.emit("findRandomMatch", (response: { success: boolean; gameId: string; side: Player; message?: string }) => {
        if (response.success && response.gameId && response.side) {
          setGameState((prev: GameState) => ({
            ...prev,
            gameId: response.gameId,
            playerSide: response.side,
          }));
          // toast.success("マッチングしました！");
        }
      });
    } else {
      toast.error("サーバーに接続されていません。");
    }
  }, [socket, setGameState]);

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

  const requestRematch = useCallback(() => {
    if (socket && gameState.gameId) {
      socket.emit("requestRematch", { gameId: gameState.gameId });
      setRematchRequested(true);
    }
  }, [socket, gameState.gameId]);

  const acceptRematch = useCallback(() => {
    if (socket && gameState.gameId) {
      socket.emit("acceptRematch", { gameId: gameState.gameId });
      setOpponentRequestedRematch(false);
    }
  }, [socket, gameState.gameId]);

  const startNewGame = useCallback(() => {
    if (socket && gameState.gameId) {
      socket.emit("startNewGame", { gameId: gameState.gameId });
      setRematchRequested(false);
      setRematchAccepted(false);
      setOpponentLeft(false);
    }
  }, [socket, gameState.gameId]);

  const returnToLobby = useCallback(() => {
    leaveRoom();
    setGameState((prev) => ({
      ...prev,
      gameEnded: false,
      winner: null,
      gameCreated: false,
      gameStarted: false,
      board: initialBoard,
      visibleBoard: createInitialVisibleBoard(),
      currentPlayer: "先手",
      capturedPieces: { 先手: [], 後手: [] },
    }));
    setRematchRequested(false);
    setRematchAccepted(false);
    setOpponentLeft(false);
  }, [leaveRoom, setGameState]);

  const startCPUGame = useCallback(() => {
    setIsCPUMode(true);
    setGameState((prev) => ({
      ...prev,
      gameId: "cpu-game",
      playerSide: "先手",
      gameCreated: true,
      gameStarted: true,
      board: initialBoard,
      currentPlayer: "先手",
    }));
  }, [setGameState]);

  return {
    socket,
    mySocketId,
    ...gameState,
    ...roomState,
    rematchRequested,
    rematchAccepted,
    opponentLeft,
    opponentRequestedRematch,
    requestRematch,
    acceptRematch,
    startNewGame,
    returnToLobby,
    joinRoom,
    selectSide,
    findRandomMatch,
    leaveRoom,
    getAvailableSides,
    updateAvailableSides,
    createGame,
    joinGame,
    findExistingRooms,
    clearExistingRooms,
    addNewRoom,
    resign,
    isCPUMode,
    startCPUGame,
  };
}
