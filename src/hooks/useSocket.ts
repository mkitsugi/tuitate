import { useState, useEffect, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { Player } from "@/types/shogi";

const WEBSOCKET_URL =
  process.env.NEXT_PUBLIC_WEBSOCKET_URL || "http://localhost:3001";

export default function useSocket() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [mySocketId, setMySocketId] = useState<string | null>(null);

  const [gameId, setGameId] = useState<string | null>(null);
  const [playerSide, setPlayerSide] = useState<Player | null>(null);
  const [gameCreated, setGameCreated] = useState(false);
  const [gameStarted, setGameStarted] = useState(false);
  const [availableSides, setAvailableSides] = useState<Player[]>([
    "先手",
    "後手",
  ]);

  const [existingRooms, setExistingRooms] = useState<
    Array<{ id: string; players: number; availableSides: Player[] }>
  >([]);
  const [isLoadingRooms, setIsLoadingRooms] = useState(false);

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

    socket.on("roomList", (rooms) => {
      console.log("Received room list:", rooms);
      setExistingRooms(rooms);
      setIsLoadingRooms(false);
    });

    socket.on("gameCreated", (id: string) => {
      setGameId(id.trim());
      setGameCreated(true);
      toast("ゲームが作成されました", {
        description: `ゲームID: ${id.trim()}`,
        position: "bottom-center",
      });
    });

    socket.on(
      "gameJoined",
      ({ gameId, side }: { gameId: string; side: Player }) => {
        setGameId(gameId);
        setPlayerSide(side);
        setAvailableSides(availableSides.filter((s) => s !== side));
        toast("ゲームに参加しました", {
          description: `ゲームID: ${gameId}, 手番: ${side}`,
          position: "bottom-center",
        });
      }
    );

    socket.on("playerJoined", ({ side, availableSides, playerId }) => {
      setAvailableSides(availableSides);
      if (playerId !== mySocketId) {
        toast.info(`他のプレイヤーが${side}として参加しました`, {
          position: "bottom-center",
        });
      }
    });

    socket.on(
      "gameStarted",
      ({
        gameId,
        currentPlayer,
      }: {
        gameId: string;
        currentPlayer: Player;
      }) => {
        setGameStarted(true);
        toast("ゲームが開始されました", {
          description: `現在の手番: ${currentPlayer}`,
          position: "bottom-center",
        });
        setAvailableSides([]);
      }
    );

    socket.on("gameError", (message: string) => {
      toast("エラー", {
        description: message,
        style: { background: "#dc2626", color: "#fff" },
        position: "bottom-center",
      });
    });

    return () => {
      socket.off("gameCreated");
      socket.off("gameJoined");
      socket.off("gameStarted");
      socket.off("gameError");
      socket.off("playerJoined");
      socket.off("roomList");
    };
  }, [socket, availableSides]);

  const findExistingRooms = useCallback(() => {
    setIsLoadingRooms(true);
    console.log("Requesting rooms from server");
    socket?.emit("getRooms");
  }, [socket]);

  const createGame = useCallback(() => {
    if (socket) {
      socket.emit("createGame");
    } else {
      toast.error("エラー", {
        description: "サーバーに接続されていません。",
        position: "bottom-center",
      });
    }
  }, [socket]);

  const joinGame = useCallback(
    (side: Player, gameId: string) => {
      if (socket && gameId) {
        socket.emit("joinGame", { gameId: gameId, side });
        setAvailableSides((prev) => prev.filter((s) => s !== side));
        setPlayerSide(side);
      } else {
        toast("エラー", {
          description: "ゲームに参加できません。",
          style: { background: "#dc2626", color: "#fff" },
          position: "bottom-center",
        });
      }
    },
    [socket]
  );

  return {
    socket,
    gameId,
    playerSide,
    gameCreated,
    gameStarted,
    availableSides,
    createGame,
    joinGame,
    existingRooms,
    isLoadingRooms,
    findExistingRooms,
  };
}
