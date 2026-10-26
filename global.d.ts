// global.d.ts
import { Socket } from "socket.io-client";

declare global {
  // 1. window オブジェクトの中に生えている自作モジュールを定義
  interface Window {
    boardManager: any;
    SQ_MODULES: any;
    hasConfirmedThisTurn: boolean;
    isLandedThisTurn: boolean;
    turnStartPosition: number | null;
    serverCurrentPhase: string;
  }

  // 2. ファイルをまたいで直接参照されているグローバル変数を定義
  var socket: Socket;
  var io: any;
  var roomCode: string;
  var rooms: any;
  var currentRoomCode: string;
  var players: any[];
  var activePlayerIndex: number;
  var pcCurrentRotation: number;
  var isPCEventMode: boolean;
  var MAP_SQUARES: any[];
  var JOBS: any[];
  var loadAndApplySquareComponent: (squareId: number, callback: () => void) => void;
  var applySquareEffects: (player: any, square: any) => void;
  var executeSyncedRoulette: (resultNum: number) => void;
  var triggerDelayedDisplay: (resultNum: number, targetSquare: any) => void;
  var switchScreen: (targetId: string) => void;
  var renderPlayerWaitingList: () => void;
  var updateCurrentPlayerDisplay: () => void;
  var renderLocationPlayersList: () => void;
  var handleForceStopSquare: (player: any, square: any) => void;
  var appendSocketListeners: () => void;
}
