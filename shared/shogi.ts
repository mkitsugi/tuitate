export type PieceType =
  | "歩"
  | "香"
  | "桂"
  | "銀"
  | "金"
  | "角"
  | "飛"
  | "王"
  | null;
export type PromotedPieceType = "と" | "成香" | "成桂" | "成銀" | "馬" | "龍";

export type Player = "先手" | "後手";

export interface Piece {
  id: string;
  type: PieceType | PromotedPieceType;
  player: Player;
  promoted: boolean;
}

export interface VisibleCell {
  piece: Piece | null;
  isVisible: boolean;
}

export type Board = (Piece | null)[][];
export type VisibleBoard = VisibleCell[][];

export interface CapturedPieces {
  先手: Piece[];
  後手: Piece[];
}

export interface GameState {
  board: Board;
  visibleBoard: VisibleBoard;
  currentPlayer: Player;
  capturedPieces: CapturedPieces;
}

export interface Room {
  id: string;
  players: number;
  availableSides: Player[];
}

export interface GameState {
  gameId: string | null;
  playerSide: Player | null;
  gameCreated: boolean;
  gameStarted: boolean;
  availableSides: Player[];
  selectedSide: Player | null;
  board: Board;
  visibleBoard: VisibleBoard;
  currentPlayer: Player;
  capturedPieces: CapturedPieces;
}

export interface RoomState {
  existingRooms: Room[];
  isLoadingRooms: boolean;
}
