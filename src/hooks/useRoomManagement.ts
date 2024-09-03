import { useState, useCallback } from "react";
import {
  Player,
  Room,
  Board,
  VisibleBoard,
  GameState,
  RoomState,
} from "@shared/shogi";

const initialBoard: Board = Array(9)
  .fill(null)
  .map(() => Array(9).fill(null));
const createInitialVisibleBoard = (): VisibleBoard => {
  return Array(9)
    .fill(null)
    .map(() =>
      Array(9)
        .fill(null)
        .map(() => ({
          piece: null,
          isVisible: false,
        }))
    );
};

export function useRoomManagement() {
  const [gameState, setGameState] = useState<GameState>({
    gameId: null,
    playerSide: null,
    gameCreated: false,
    gameStarted: false,
    availableSides: ["先手", "後手"],
    selectedSide: null,
    board: initialBoard,
    visibleBoard: createInitialVisibleBoard(),
    currentPlayer: "先手",
    capturedPieces: { 先手: [], 後手: [] },
  });

  const [roomState, setRoomState] = useState<RoomState>({
    existingRooms: [],
    isLoadingRooms: false,
  });

  const addNewRoom = useCallback((newRoom: Room) => {
    setRoomState((prev) => ({
      ...prev,
      existingRooms: [...prev.existingRooms, newRoom],
    }));
  }, []);

  const updateAvailableSides = useCallback((updatedSides: Player[]) => {
    setGameState((prev) => ({ ...prev, availableSides: updatedSides }));
  }, []);

  return {
    gameState,
    setGameState,
    roomState,
    setRoomState,
    addNewRoom,
    updateAvailableSides,
  };
}
