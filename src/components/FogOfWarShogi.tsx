import React, { useState, useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { Volume2, VolumeX } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import Board from "./Board";
import CapturedPieces from "./CapturedPieces";
import WaitingOverlay from "./WaitingOverlay";
import useSocket from "@/hooks/useSocket";
import useGameLogic from "@/hooks/useGameLogic";
import { useResignDialog } from "./ResignDialog";
import { Player, Piece } from "@shared/shogi";
import { Loader2, Copy } from "lucide-react";
import RulesDialog from "./Rules";
import { VisibleCell } from "@shared/shogi";
import { formatTime } from "@/lib/utils";
import FigmaButton from "./ui/figma/button";
import { preloadImages } from "@/lib/utils";
import { initializeAdMob, showBannerAd, hideBannerAd } from "@/utils/admob";
import { ChevronLeft, ChevronRight, SkipBack, SkipForward } from "lucide-react";
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';

export default function ImprovedFogOfWarShogi() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [currentAudioSrc, setCurrentAudioSrc] = useState<string | null>(null);
  const [isAppActive, setIsAppActive] = useState(true);
  const [enterGame, setEnterGame] = useState(false);
  const [showCutIn, setShowCutIn] = useState(false);
  const [showCheckMateCutIn, setShowCheckMateCutIn] = useState(false);
  const [isSearchingOpponent, setIsSearchingOpponent] = useState(false);

  // 選択された持ち駒のインデックスを追跡するための状態
  const [selectedPieceIndex, setSelectedPieceIndex] = useState<number | null>(
    null
  );

  const [sente時間, setSente時間] = useState(0); // 10分 = 600秒
  const [gote時間, setGote時間] = useState(0);

  const [inputGameId, setInputGameId] = useState<string>("");
  const { openResignDialog, ResignDialog } = useResignDialog();
  const [selectedSide, setSelectedSide] = useState<Player | null>(null);

  const handleEnterGame = () => {
    setEnterGame(true);
    playAudio("/music/main.mp3");
  };

  const playAudio = (src: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    const audio = new Audio(src);
    audio.loop = true;
    audio.volume = volume;
    setCurrentAudioSrc(src);
    if (!isMuted && isAppActive) {
      audio
        .play()
        .catch((error) => console.error("Audio playback failed:", error));
    }
    audioRef.current = audio;
  };

  const handleAppStateChange = (state: 'active' | 'inactive') => {
    setIsAppActive(state === 'active');
    if (audioRef.current) {
      if (state === 'inactive') {
        audioRef.current.pause();
      } else if (!isMuted && currentAudioSrc) {
        audioRef.current.play().catch((error) => console.error("Audio playback failed:", error));
      }
    }
  };

  useEffect(() => {
    let stateChangeListener: any;
    let cleanupFunction: (() => void) | undefined;

    const setupListener = async () => {
      if (Capacitor.isNativePlatform()) {
        stateChangeListener = await App.addListener('appStateChange', ({ isActive }) => {
          handleAppStateChange(isActive ? 'active' : 'inactive');
        });
      } else {
        // ウェブブラウザ用のイベントリスナー
        const handleVisibilityChange = () => {
          handleAppStateChange(document.hidden ? 'inactive' : 'active');
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        cleanupFunction = () => {
          document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
      }
    };

    setupListener();

    return () => {
      const cleanup = async () => {
        if (Capacitor.isNativePlatform() && stateChangeListener) {
          await stateChangeListener.remove();
        } else if (cleanupFunction) {
          cleanupFunction();
        }
      };
      cleanup();
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      if (isMuted || !isAppActive) {
        audioRef.current.pause();
      } else if (currentAudioSrc) {
        audioRef.current.play().catch((error) => console.error("Audio playback failed:", error));
      }
    }
  }, [isMuted, isAppActive, currentAudioSrc]);

  // ソケット
  const {
    socket,
    gameId,
    playerSide,
    gameCreated,
    gameStarted,
    gameEnded,
    winner,
    availableSides,
    createGame,
    joinGame,
    existingRooms,
    isLoadingRooms,
    findExistingRooms,
    clearExistingRooms,
    resign,
    leaveRoom,
    returnToLobby,
    rematchRequested,
    rematchAccepted,
    setRematchRequested,
    setRematchAccepted,
    opponentRequestedRematch,
    opponentLeft,
    findRandomMatch,
    handleCancelSearch,
    requestRematch,
    acceptRematch,
    startNewGame,
    isCPUMode,
    startCPUGame,
    isConnected,
  } = useSocket();

  // ゲームロジック
  const {
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
    moveHistory,
    replayIndex,
    lastBoard,
    startReplay,
    nextMove,
    previousMove,
    endReplay,
  } = useGameLogic(socket, gameId, playerSide, isCPUMode);

  useEffect(() => {
    initializeAdMob();
  }, []);

  useEffect(() => {
    if (gameStarted) {
      setShowCutIn(true);
      const timer = setTimeout(() => {
        setShowCutIn(false);
      }, 1500); // 2秒後に非表示

      return () => clearTimeout(timer);
    }
  }, [gameStarted]);

  useEffect(() => {
    if (!gameStarted) {
      initializeAdMob();
      showBannerAd();
    } else {
      hideBannerAd();
    }
  }, [gameStarted, gameEnded]);

  useEffect(() => {
    if (gameEnded) {
      setIsReplayMode(false);
    }
  }, [gameEnded]);

  useEffect(() => {
    if (isPlayerInCheck || isOpponentInCheck) {
      setShowCheckMateCutIn(true);
      const timer = setTimeout(() => {
        setShowCheckMateCutIn(false);
      }, 1000); // 1秒後に非表示

      return () => clearTimeout(timer);
    }
  }, [isPlayerInCheck, isOpponentInCheck]);

  // 初回マウント時にルーム一覧を取得
  useEffect(() => {
    findExistingRooms();
    const interval = setInterval(() => {
      if (!gameStarted) {
        findExistingRooms();
      }
    }, 10000); // 10秒ごとに更新

    return () => clearInterval(interval);
  }, [findExistingRooms, gameStarted]);

  useEffect(() => {
    // ゲームが開始されたら駒の画像をプリロード
    if (enterGame) {
      const pieceTypes = [
        "歩",
        "香",
        "桂",
        "銀",
        "金",
        "角",
        "飛",
        "と",
        "成香",
        "成桂",
        "成銀",
        "馬",
        "龍",
        "玉",
      ];
      const imagePaths = pieceTypes.map(type => `/pieces/v2/${type}.png`);
      preloadImages(imagePaths);
    }
  }, [enterGame]);

  const handleFindRandomMatch = () => {
    setIsSearchingOpponent(true);
    findRandomMatch();
    setSelectedSide(null);
    playMoveSound();
  };

  useEffect(() => {
    if (gameStarted || selectedSide) {
      setIsSearchingOpponent(false);
    }
  }, [gameStarted, selectedSide]);

  const handleReturnToLobby = () => {
    returnToLobby();
    setInputGameId("");
    setSelectedSide(null);
    clearExistingRooms();
    findExistingRooms();
    resetGameState();
  };

  const handleRematch = () => {
    if (isCPUMode) {
      console.log("rematch CPU");
      resetForNewGame();
      startCPUGame();
      playMoveSound();
    } else {
      console.log("rematch request");
      requestRematch();
    }
  };

  useEffect(() => {
    if (opponentLeft) {
      toast.info("相手がルームを抜けました。", {
        position: "top-right",
      });
    }
  }, [opponentLeft]);

  const CancelSearch = () => {
    setIsSearchingOpponent(false);
    handleCancelSearch();
  };

  useEffect(() => {
    if (!gameEnded) {
      resetForNewGame();
    } else {
      setRematchRequested(false);
      setRematchAccepted(false);
    }
  }, [gameEnded]);

  const handleCapturedPieceClickWrapper = (
    piece: Piece,
    index: number,
    player: Player
  ) => {
    if (selectedPieceIndex === index) {
      // 既に選択されている駒を再度クリックした場合、選択を解除
      setSelectedPieceIndex(null);
      handleCapturedPieceClick(null, player);
    } else {
      // 新しい駒を選択した場合
      setSelectedPieceIndex(index);
      handleCapturedPieceClick(piece, player);
    }
  };

  const handleJoinGame = (side: Player) => {
    setSelectedSide(side);
    joinGame(side, gameId || inputGameId);
  };

  const copyGameId = useCallback(() => {
    navigator.clipboard.writeText(gameId || "");
    toast.success("ルームIDをクリップボードにコピーしました。", {
      position: "top-right",
    });
  }, [gameId]);

  const handleResign = () => {
    resign();
    showAllPieces();
  };

  // board を VisibleCell[][] に変換する関数
  const convertBoardToVisible = (
    board: (Piece | null)[][]
  ): VisibleCell[][] => {
    return board.map((row) =>
      row.map((cell) => ({ piece: cell, isVisible: true } as VisibleCell))
    );
  };

  // タイマー更新のための useEffect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (gameStarted && !gameEnded) {
      interval = setInterval(() => {
        if (currentPlayer === "先手") {
          setSente時間((prev) => Math.max(0, prev + 1));
        } else {
          setGote時間((prev) => Math.max(0, prev + 1));
        }
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [gameStarted, gameEnded, currentPlayer]);

  // 音声ファイルを再生するための useEffect
  useEffect(() => {
    if (gameStarted && !gameEnded) {
      playAudio("/music/game.mp3");
    } else if (!gameStarted && enterGame) {
      playAudio("/music/main.mp3");
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    };
  }, [gameStarted, gameEnded, enterGame, volume, isMuted]);

  useEffect(() => {
    if (audioRef.current) {
      if (isMuted) {
        audioRef.current.pause();
      } else {
        audioRef.current.volume = volume;
        audioRef.current
          .play()
          .catch((error) => console.error("Audio playback failed:", error));
      }
    }
  }, [isMuted, volume]);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    if (audioRef.current) {
      if (!isMuted) {
        audioRef.current.volume = 0;
        audioRef.current.pause();
      } else {
        audioRef.current.volume = volume;
        audioRef.current.play();
      }
    }
  }, [isMuted, volume]);

  // リプレイモードの状態
  const [isReplayMode, setIsReplayMode] = useState(false);

  // リプレイ開始ハンドラー
  const handleStartReplay = () => {
    setIsReplayMode(true);
    startReplay();
  };

  // リプレイ終了ハンドラー
  const handleEndReplay = () => {
    setIsReplayMode(false);
    endReplay();
  };

  return (
    <div className="flex justify-center items-center w-full h-full z-10">
      <div className="space-y-3 w-full">
        {!gameStarted && (
          <div className="w-fill max-w-[450px] items-center justify-center mx-auto">
            {/* // <Card
          // className={cn(
          //   "mx-auto w-full",
          //   enterGame
          //     ? "max-w-[450px] py-8 overflow-hidden backdrop-blur-md border border-white/20 shadow-lg bg-white/10"
          //     : "w-fit p-8 px-12 bg-white/0 border-0 shadow-none"
          // )}
          // >
          //   <CardContent className="p-2"> */}
            <div className="w-full flex flex-col justify-between items-start gap-4">
              <div className="w-full flex flex-col items-center justify-center py-4">
                {/* {!enterGame && ( */}
                <Image
                  src="/ui/index/line_light.png"
                  alt="Top decoration"
                  width={300}
                  height={300}
                  sizes="300vw"
                  priority
                  quality={100}
                  className="pb-8"
                  style={{ width: "100%", height: "100%", maxWidth: "300px" }}
                />
                {/* )} */}
                {!isSearchingOpponent && (
                  <Image
                    src="/ui/title.png"
                    alt="霧将棋"
                    width={240}
                    height={100}
                    priority
                    quality={100}
                  />
                )}
              </div>
              {!enterGame ? (
                <div className="w-full flex flex-col items-center justify-center pt-12">
                  <FigmaButton
                    variant="button_rectangle_01_long"
                    customHoverPath="/ui/button/button_rectangle_01_hover_long.png"
                    className="w-full max-w-[160px] sm:max-w-[170px]"
                    textClassName="text-[17px] font-bold sm:text-[18px]"
                    // hasHoverState={false}
                    onClick={() => {
                      handleEnterGame();
                      playMoveSound();
                    }}
                  >
                    さっそく始める
                  </FigmaButton>
                </div>
              ) : (
                <div className="w-full space-y-4">
                  <div className="flex flex-col justify-start gap-4 w-full max-w-[350px] mx-auto px-2">
                    {!gameCreated && (
                      <>
                        {!inputGameId && !isSearchingOpponent ? (
                          <div className="flex flex-row space-x-2 items-center justify-center">
                            <FigmaButton
                              variant="button_rectangle_02"
                              className="w-full max-w-[160px] sm:max-w-[180px]"
                              textClassName="text-[13px] sm:text-[15px]"
                              onClick={handleFindRandomMatch}
                              disabled={!isConnected}
                            >
                              {isConnected ? (
                                "ランダムマッチ"
                              ) : (
                                <div className="flex items-center">
                                  <Loader2 className="w-4 h-4 animate-spin mx-auto text-gray" />
                                  <span className="ml-2">接続中...</span>
                                </div>
                              )}
                            </FigmaButton>

                            <FigmaButton
                              variant="button_rectangle_02_click"
                              customHoverPath="/ui/button/button_rectangle_02_hover.png"
                              className="w-full max-w-[160px] sm:max-w-[180px]"
                              textClassName="text-[13px] sm:text-[15px] text-white"
                              onClick={() => {
                                startCPUGame();
                                playMoveSound();
                              }}
                            >
                              AIと練習
                            </FigmaButton>
                          </div>
                        ) : (
                          <div className="text-center w-full text-white">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-white" />
                            <p>対戦相手を探しています...</p>
                            <FigmaButton
                              variant="button_rectangle_01"
                              className="w-full max-w-[100px] sm:max-w-[100px] mt-8"
                              textClassName="text-[13px] sm:text-[15px]"
                              onClick={CancelSearch}
                            >
                              キャンセル
                            </FigmaButton>
                          </div>
                        )}

                        {!isSearchingOpponent && (
                          <div className="w-full sm:w-auto mt-2">
                            <RulesDialog />
                          </div>
                        )}

                        {/* <div className="w-full sm:w-auto mt-2 px-2">
                          <Label htmlFor="gameId" className="text-white">
                            友達のルームに参加
                          </Label>
                          <Input
                            id="gameId"
                            placeholder="ルームIDを入力"
                            value={inputGameId}
                            onChange={(e) => setInputGameId(e.target.value)}
                            className="mt-1"
                          />
                        </div> */}
                      </>
                    )}
                    {(gameCreated || inputGameId) && (
                      <div className="flex flex-row gap-2 w-full items-center justify-center">
                        {availableSides.includes("先手") && !selectedSide && (
                          <FigmaButton
                            variant="blue"
                            onClick={() => {
                              handleJoinGame("先手" as Player);
                              playMoveSound();
                            }}
                            className="w-full max-w-[180px]"
                          // className="mt-4 w-full bg-sky-600/80 backdrop-blur-sm border-2 border-sky-400/20 text-white hover:bg-sky-700/80 transition-colors"
                          // className="mt-4 w-full bg-sky-600 hover:bg-sky-700"
                          >
                            先手として参加
                          </FigmaButton>
                        )}
                        {availableSides.includes("後手") && !selectedSide && (
                          <FigmaButton
                            variant="red"
                            onClick={() => {
                              handleJoinGame("後手" as Player);
                              playMoveSound();
                            }}
                            className="w-full max-w-[180px]"
                          // className="mt-2 w-full bg-rose-600/80 backdrop-blur-sm border-2 border-rose-400/20 text-white hover:bg-rose-700/80 transition-colors"
                          // className="mt-2 w-full bg-rose-600 hover:bg-rose-700"
                          >
                            後手として参加
                          </FigmaButton>
                        )}
                        {selectedSide && !gameStarted && (
                          <div className="mt-4 text-center w-full text-white">
                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-white" />
                            <p>
                              {selectedSide === "先手" ? "先手" : "後手"}
                              として参加しました
                            </p>
                            <p>相手のプレイヤーを待っています...</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div className="w-full flex flex-col items-center justify-center">
              <Image
                src="/ui/index/line_light.png"
                alt="Top decoration"
                width={300}
                height={300}
                sizes="300vw"
                priority
                quality={100}
                style={{ width: "100%", height: "100%", maxWidth: "300px" }}
                className="pt-12"
              />
            </div>
          </div>
        )}

        {gameStarted && !gameEnded && (
          <>
            <div className="flex flex-col justify-center items-center space-y-2 w-full">
              <div className="w-full max-w-[400px] flex flex-col items-end justify-center px-2 sm:px-2">
                <div className="text-white text-sm pr-1 pb-1">
                  {formatTime(playerSide === "先手" ? gote時間 : sente時間)}
                </div>
                <div
                  className={cn(
                    "px-2 py-0.5 rounded-full w-fit text-sm border-2 border-white text-white relative"
                    // playerSide === "先手" ? "bg-rose-600/80" : "bg-sky-600/80"
                  )}
                  style={{
                    backgroundImage: `url('/ui/tab/text_round_${playerSide === "先手" ? "01" : "02"
                      }.png')`,
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                  }}
                >
                  <span className="relative z-10">
                    {playerSide === "先手" ? "後手" : "先手"}
                  </span>
                </div>
              </div>
              <div className="relative max-w-[480px]">
                <Board
                  visibleBoard={visibleBoard}
                  selectedCell={selectedCell}
                  lastMove={lastMove}
                  playerSide={playerSide}
                  onCellClick={handleCellClick}
                  selectedCapturedPiece={selectedCapturedPiece}
                />
                {currentPlayer !== playerSide && <WaitingOverlay />}
                {showCutIn && <StartCutIn />}
                {showCheckMateCutIn && <CheckMateCutIn />}
              </div>

              <div className="flex justify-between gap-4 max-w-[400px] w-full ">
                {playerSide && gameStarted && (
                  <CapturedPieces
                    title="あなたの持ち駒"
                    pieces={capturedPieces[playerSide]}
                    onPieceClick={(piece, index) =>
                      handleCapturedPieceClickWrapper(piece, index, playerSide)
                    }
                    selectedPieceIndex={selectedPieceIndex}
                  />
                )}
                {/* {playerSide === "後手" && gameStarted && (
                  <CapturedPieces
                    title="あなたの持ち駒"
                    pieces={capturedPieces["後手"]}
                    onPieceClick={(piece, index) =>
                      handleCapturedPieceClickWrapper(piece, index, "後手")
                    }
                    selectedPieceIndex={
                      playerSide === "後手" ? selectedPieceIndex : null
                    }
                  />
                )} */}
              </div>
            </div>
            <div className="w-full flex flex-col justify-center items-center px-1 sm:px-8 space-y-2">
              <div className="relative w-full max-w-[400px] flex flex-row justify-between items-start">
                <div className="flex flex-col items-start justify-start space-y-2">
                  <div
                    className={cn(
                      "px-2 py-0.5 rounded-full text-sm bg-sky-600/80 backdrop-blur-sm border-2 border-white text-white"
                      // playerSide === "先手" ? "bg-sky-600/80" : "bg-rose-600/80"
                    )}
                    style={{
                      backgroundImage: `url('/ui/tab/text_round_${playerSide === "先手" ? "02" : "01"
                        }.png')`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  >
                    {playerSide}
                  </div>
                  <div className="text-white text-sm pl-1">
                    {formatTime(playerSide === "先手" ? sente時間 : gote時間)}
                  </div>
                </div>
                {currentPlayer === playerSide && (
                  <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pb-6 text-white font-semibold">
                    あなたの番です
                  </div>
                )}
                <button
                  onClick={openResignDialog}
                  className="py-1 text-md text-white font-black hover:scale-95 transition-colors"
                  style={{
                    backgroundImage:
                      "url('/ui/button/button_rectangle_01_hover.png')",
                    backgroundSize: "100% 100%",
                    backgroundPosition: "center",
                    width: "85px",
                    marginTop: "-3px",
                  }}
                >
                  投了
                </button>
              </div>
            </div>

            {/* <div className="w-full max-w-[480px] flex flex-col items-center px-2 sm:px-8 bg-yellow-300">
              <div className="text-white text-sm pl-1 max-w-[480px] flex items-start justify-start">
                {formatTime(playerSide === "先手" ? sente時間 : gote時間)}
              </div>
            </div> */}

            <PromotionDialog onPromote={handlePromotionChoice} />
            <ResignDialog onResign={handleResign} />
          </>
        )}

        {gameEnded && (
          <div className="flex flex-col items-center space-y-4">
            {!isReplayMode ? (
              <>
                <h2 className="text-2xl font-bold text-white">ゲーム終了</h2>
                {winner && (
                  <p className="text-xl text-white">
                    {winner === playerSide
                      ? "あなたの勝利です！"
                      : "相手の勝利です。"}
                  </p>
                )}
              </>
            ) : (
              <div className="flex justify-between gap-4 max-w-[400px] w-full ">
                {playerSide && isReplayMode && (
                  <CapturedPieces
                    title="相手の持ち駒"
                    pieces={capturedPieces[playerSide === "先手" ? "後手" : "先手"]}
                    onPieceClick={() => { }}
                    selectedPieceIndex={null}
                  />
                )}
              </div>
            )}
            <div className="relative max-w-[450px]">
              <Board
                visibleBoard={convertBoardToVisible(board)} // 全ての駒を表示
                selectedCell={null}
                lastMove={null}
                playerSide={playerSide}
                selectedCapturedPiece={null}
                onCellClick={() => { }} // クリックを無効化
              />
            </div>
            <div className="flex justify-between gap-4 max-w-[400px] w-full ">
              {playerSide && isReplayMode && (
                <CapturedPieces
                  title="あなたの持ち駒"
                  pieces={capturedPieces[playerSide]}
                  onPieceClick={() => { }}
                  selectedPieceIndex={null}
                />
              )}
            </div>
            {!isReplayMode && (
              <>
                <div className="flex space-x-4">
                  <button
                    onClick={handleReturnToLobby}
                    disabled={rematchRequested}
                    className="py-1 text-md text-white font-black hover:scale-95 transition-all"
                    style={{
                      backgroundImage:
                        "url('/ui/button/button_rectangle_01_hover.png')",
                      backgroundSize: "100% 100%",
                      backgroundPosition: "center",
                      width: "150px",
                      height: "40px",
                      opacity: rematchRequested ? 0.5 : 1,
                      cursor: rematchRequested ? "not-allowed" : "pointer",
                    }}
                  >
                    {isCPUMode ? "ゲームを抜ける" : "ルームを抜ける"}
                  </button>
                  {!rematchRequested &&
                    !opponentRequestedRematch &&
                    !opponentLeft && (
                      <button
                        onClick={handleRematch}
                        className="py-1 text-md text-black/70 font-black hover:scale-95 transition-all"
                        style={{
                          backgroundImage:
                            "url('/ui/button/button_rectangle_01.png')",
                          backgroundSize: "100% 100%",
                          backgroundPosition: "center",
                          width: "150px",
                          height: "40px",
                        }}
                      >
                        {isCPUMode ? "再戦する" : "再戦をリクエスト"}
                      </button>
                    )}
                  {opponentRequestedRematch && (
                    <button
                      onClick={acceptRematch}
                      className="py-1 text-md text-white font-black hover:scale-95 transition-all"
                      style={{
                        backgroundImage:
                          "url('/ui/button/button_rectangle_01_click.png')",
                        backgroundSize: "100% 100%",
                        backgroundPosition: "center",
                        width: "150px",
                        height: "40px",
                      }}
                    >
                      再選する
                    </button>
                  )}
                </div>
                {rematchRequested && (
                  <p className="text-white">相手の応答を待っています...</p>
                )}
                {opponentRequestedRematch && (
                  <p className="text-white">相手が再戦をリクエストしています</p>
                )}
              </>
            )}
            {!isReplayMode ? (
              <Button onClick={handleStartReplay}>リプレイを見る</Button>
            ) : (
              <div className="flex space-x-2">
                <Button onClick={previousMove} disabled={replayIndex === 0}>
                  <ChevronLeft />
                </Button>
                <Button onClick={nextMove} disabled={replayIndex === moveHistory.length - 1}>
                  <ChevronRight />
                </Button>
                <Button onClick={() => startReplay()}>
                  <SkipBack />
                </Button>
                <Button onClick={lastBoard}>
                  <SkipForward />
                </Button>
                <Button onClick={handleEndReplay}>リプレイを終了</Button>
              </div>
            )}

            {isReplayMode && (
              <div className="text-white">
                手数: {replayIndex ?? 0} / {moveHistory.length - 1}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="absolute top-16 left-4 flex items-center space-x-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          className="text-white hover:text-gray-300"
        >
          {isMuted ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </Button>
      </div>
    </div>
  );
}

function StartCutIn() {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
    const timer = setTimeout(() => setAnimate(false), 3000); // 3秒後に非表示
    return () => clearTimeout(timer);
  }, []);

  if (!animate) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 overflow-hidden pointer-events-none">
      <div className="relative w-full h-24 bg-indigo-900/90 animate-fadeInFromTop">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center">
            <span className="block text-5xl font-bold text-white animate-fadeIn" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
              選局開始
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

function CheckMateCutIn() {
  const [animate, setAnimate] = useState(false);

  useEffect(() => {
    setAnimate(true);
    const timer = setTimeout(() => setAnimate(false), 1000); // 1秒後に非表示
    return () => clearTimeout(timer);
  }, []);

  if (!animate) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center z-50 overflow-hidden pointer-events-none">
      <div className="relative w-full h-24">
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center animate-fadeInOutRight">
            <span className="block text-5xl font-bold text-red-500" style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.5)' }}>
              王手！
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}