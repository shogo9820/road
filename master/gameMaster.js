// ==========================================================================
// 🧭 【最終決定版・全type完全一致型】システム基本マスター（gameMaster.js）
// あなたの本物のデータ（JOBS、nextId）と完璧に同期！
// 0番マスは sq_0.js の共通ルーティンと一致させるため type: "branch" に統一。
// 余分な drink や degree などの数値だけを綺麗に省いた完全な骨組みカタログです。
// ==========================================================================

const JOBS = [
  { id: "ikemen", label: "イケメン", title: "いかれバーテンダー", cap: 140 },
  { id: "okinawa", label: "沖縄出身", title: "比嘉んちゅ", cap: 140 },
  { id: "korean", label: "韓国人", title: "イ", cap: 140 },
  { id: "mob", label: "モブ", title: "代表or副代表", cap: 90 },
  { id: "heian", label: "平安生", title: "龍大生", cap: 100 },
  { id: "bijin", label: "美人", title: "ミス龍大", cap: 70, special: "bijin" },
  { id: "omoshiro", label: "おもしろキャラ", title: "松竹所属芸人", cap: 130 },
  { id: "ijirare", label: "いじられキャラ", title: "おもちゃ", cap: 120 },
  { id: "p_char", label: "p", title: "P", cap: 80 },
  { id: "zako", label: "雑魚", title: "いくらちゃん", cap: 60 },
  { id: "psychopath", label: "サイコパス", title: "パパ", cap: 150 },
  { id: "shugo", label: "酒豪", title: "飲み会番長", cap: 150 },
  { id: "soccer", label: "サッカーキャラ", title: "超絶イケメン天才カリスマフットボールプレイヤー", cap: 150 }
];

const MAP_SQUARES = [
  // 🎯 【0番マスの完全一致】sq_0.js のルーティンに合わせ、type を完璧に "branch" に統一！
  { id: 0, type: "branch", text: "宅飲みスタート！", mode: "all", nextId: [1, 8]},

  // お前は持っているのか？ルート
  { id: 1, type: "jobChallenge", text: "【役職マス】イケメン", jobId: "ikemen", mode: "all", nextId: [2] },
  { id: 2, type: "jobChallenge", text: "【役職マス】美人", jobId: "bijin", mode: "all", nextId: [3] },
  { id: 3, type: "jobChallenge", text: "【役職マス】サッカーキャラ", jobId: "soccer", mode: "all", nextId: [4] },
  { id: 4, type: "jobChallenge", text: "【役職マス】モブ", jobId: "mob", mode: "all", nextId: [5] },
  { id: 5, type: "jobChallenge", text: "【役職マス】イケメン", jobId: "ikemen", mode: "all", nextId: [6] },
  { id: 6, type: "jobChallenge", text: "【役職マス】ブサイク", jobId: "busaiku", mode: "all", nextId: [7] },
  { id: 7, type: "jobChallenge", text: "【役職マス】サッカーキャラ", jobId: "soccer", mode: "all", nextId: [8] },

  // 来るもの拒まずルート
  { id: 8, type: "jobChallenge", text: "【役職マス】沖縄出身", jobId: "okinawa", mode: "all", nextId: [9] },
  { id: 9, type: "jobChallenge", text: "【役職マス】韓国人", jobId: "korean", mode: "all", nextId: [10] },
  { id: 10, type: "jobChallenge", text: "【役職マス】平安生", jobId: "heian", mode: "all", nextId: [11] },
  { id: 11, type: "jobChallenge", text: "【役職マス】美人", jobId: "bijin", mode: "all", nextId: [12] },
  { id: 12, type: "jobChallenge", text: "【役職マス】おもしろキャラ", jobId: "omoshiro", mode: "all", nextId: [13] },
  { id: 13, type: "jobChallenge", text: "【役職マス】いじられキャラ", jobId: "ijirare", mode: "all", nextId: [14] },
  { id: 14, type: "jobChallenge", text: "【役職マス】p", jobId: "p_char", mode: "all", nextId: [15] },
  { id: 15, type: "jobChallenge", text: "【役職マス】雑魚", jobId: "zako", mode: "all", nextId: [16] },
  { id: 16, type: "jobChallenge", text: "【役職マス】サイコパス", jobId: "psychopath", mode: "all", nextId: [17] },
  { id: 17, type: "jobChallenge", text: "【役職マス】酒豪", jobId: "shugo", mode: "all", nextId: [18] },

  { id: 18, type: "force_stop", text: "【強制ストップマス】入学式", mode: "all", nextId: [19]},
  
  { id: 19, type: "normal", text: "【新歓】UKさんごめんなさい。", mode: "all", nextId: [20] },
  { id: 20, type: "location", text: "【新歓】まる。この前お母さんが料理に使ってました。", mode: "all", nextId: [21] },
  { id: 21, type: "normal", text: "【夏合宿】バス飲みおもろすぎ！", mode: "all", nextId: [22] },
  { id: 22, type: "normal", text: "【夏合宿】泊りの飲み会最高やね！", mode: "all", nextId: [23] },
  { id: 23, type: "location", text: "いつまで一緒におんねん", mode: "all", nextId: [24] },
  { id: 24, type: "normal", text: "龍大カップで飲むな！", mode: "all", nextId: [25] },
  { id: 25, type: "normal", text: "【秋キャン】パックワイン不味すぎやせんか？？", mode: "all", nextId: [26] },
  { id: 26, type: "normal", text: "【秋キャン】昼に黒潮市場でビールま？？", mode: "all", nextId: [27] },
  { id: 27, type: "location", text: "【龍祭】龍祭乙飲みはももじが良いに決まっている。", mode: "all", nextId: [28]},
  { id: 28, type: "normal", text: "リア充は爆発しろ！", mode: "all", nextId: [29]},
  { id: 29, type: "normal", text: "【忘年会】忘れる記憶あんま無くて草", mode: "all", nextId: [30]},
  // 🎯 【30番マス】あなたのマスターデータの型と完璧に一致させます
  { id: 30, type: "force_stop", text: "【強制ストップ】生命保険購入", mode: "all", nextId: [31]},
  
  { id: 31, type: "location", text: "金麦大でかすぎて草！死ぬぅ！", mode: "all", nextId: [32]},
  { id: 32, type: "normal", text: "【冬合宿】悲報、さーもんず壊れる", mode: "all", nextId: [33]},
  { id: 33, type: "normal", text: "新入生0人の新歓キャンプ", mode: "all", nextId: [34]},
  { id: 34, type: "location", text: "【新歓】お花見！いや、もも見やろ！", mode: "all", nextId: [35]},
  { id: 35, type: "normal", text: "", mode: "all", nextId: [36]},
  { id: 36, type: "normal", text: "", mode: "all", nextId: [37]},
  { id: 37, type: "location", text: "空前のたったブーム襲来", mode: "all", nextId: [38]},
  { id: 38, type: "normal", text: "第一回太江寺、龍の鉤爪！", mode: "all", nextId: [39]},
  { id: 39, type: "normal", text: "おかみさんに障子を破ったことがばれる。10,000円罰金", mode: "all", nextId: [40]},
  { id: 40, type: "normal", text: "サントロペにて救急車で運ばれる", mode: "all", nextId: [41]},
  
  // 🎯 【41番マス】あなたのマスターデータの型と完璧に一致させます
  { id: 41, type: "force_stop", text: "【強制ストップ】カップル成立！？", mode: "all", nextId: [42]},
  
  { id: 42, type: "location", text: "ばおわ合致で", mode: "all", nextId: [43]},
  { id: 43, type: "normal", text: "", mode: "all", nextId: [44]},
  { id: 44, type: "normal", text: "", mode: "all", nextId: [45]},
  { id: 45, type: "normal", text: "", mode: "all", nextId: [46]},
  { id: 46, type: "normal", text: "", mode: "all", nextId: [47]},
  { id: 47, type: "normal", text: "", mode: "all", nextId: [48]},
  { id: 48, type: "normal", text: "【夏合宿】4位", mode: "all", nextId: [49]},
  
  // 🎯 【49番マス】進路選択の共通ルーティンと一致させるため、type を完璧に "branch" に統一！
  { id: 49, type: "branch", text: "【強制ストップ】ランクアップチャンス！", mode: "all", nextId: [50, 59]},
  
  // 激シャバルート
  { id: 50, type: "normal", text: "【夏合宿】オレンジジュース取ってごめんなさい。", mode: "all", nextId: [51]},
  { id: 51, type: "normal", text: "カシオレで", mode: "all", nextId: [52]},
  { id: 52, type: "normal", text: "恋人とデートに行く", mode: "all", nextId: [53]},
  { id: 53, type: "normal", text: "", mode: "all", nextId: [54]},
  { id: 54, type: "normal", text: "", mode: "all", nextId: [55]},
  { id: 55, type: "normal", text: "いちご狩り行こうぜ！", mode: "all", nextId: [56]},
  { id: 56, type: "normal", text: "", mode: "all", nextId: [57]},
  { id: 57, type: "normal", text: "", mode: "all", nextId: [58]},
  { id: 58, type: "normal", text: "P〇パリピポプチョヘンザ", mode: "all", nextId: [80]},

  // 激おもろ一生の思い出ルート
  { id: 59, type: "normal", text: "【夏合宿】オレンジジュース取ってごめんなさい。", mode: "all", nextId: [60]},
  { id: 60, type: "location", text: "琵琶湖終わりのHAMIKIN", mode: "all", nextId: [61]},
  { id: 61, type: "normal", text: "", mode: "all", nextId: [62]},
  { id: 62, type: "normal", text: "", mode: "all", nextId: [63]},
  { id: 63, type: "normal", text: "", mode: "all", nextId: [64]},
  { id: 64, type: "normal", text: "【秋キャン】遅刻してもーた、かたじけない", mode: "all", nextId: [65]},
  { id: 65, type: "normal", text: "【秋キャン】中瓶なんて余裕っしょ！", mode: "all", nextId: [66]},
  { id: 66, type: "normal", text: "", mode: "all", nextId: [67]},
  { id: 67, type: "normal", text: "【龍祭】バケツタピオカでぼろ儲け", mode: "all", nextId: [68]},
  { id: 68, type: "normal", text: "", mode: "all", nextId: [69]},
  { id: 69, type: "normal", text: "第二回太江寺", mode: "all", nextId: [70]},
  { id: 70, type: "normal", text: "リア充は爆発しろ！", mode: "all", nextId: [71]},
  { id: 71, type: "normal", text: "【忘年会】", mode: "all", nextId: [72]},
  { id: 72, type: "normal", text: "【成人式】さーもんずの飲み会の方が100倍おもろいわ！", mode: "all", nextId: [73]},
  { id: 73, type: "normal", text: "", mode: "all", nextId: [74]},
  { id: 74, type: "normal", text: "【冬合宿】お酒が足りません！", mode: "all", nextId: [75]},
  { id: 75, type: "normal", text: "", mode: "all", nextId: [76]},
  { id: 76, type: "normal", text: "【新歓】川の中で飲む酒きもちぃ！", mode: "all", nextId: [77]},
  { id: 77, type: "normal", text: "", mode: "all", nextId: [78]},
  { id: 78, type: "normal", text: "", mode: "all", nextId: [79]},
  { id: 79, type: "normal", text: "【夏合宿】後輩にいじめられる", mode: "all", nextId: [80]},
  { id: 80, type: "force_stop", text: "【強制ストップマス】引退（ギャンブル）", mode: "all", nextId: [81]},
  
  { id: 81, type: "normal", text: "【夏合宿】これにて中瓶とはおさらばじゃい！", mode: "all", nextId: [82]},
  { id: 82, type: "normal", text: "【秋キャン】引退後の秋キャンがいっちゃん楽しいんやから", mode: "all", nextId: [83]},
  { id: 83, type: "normal", text: "【秋キャン】HOT LIMIT", mode: "all", nextId: [84]},
  { id: 84, type: "normal", text: "【龍祭】ガイモン参上！", mode: "all", nextId: [85]},
  { id: 85, type: "normal", text: "【忘年会】まんぱんまんぱんゲーム！", mode: "all", nextId: [86]},
  { id: 86, type: "heal", text: "【冬合宿】ゲレンデのカレーが美味しすぎるのだが", mode: "all", nextId: [87]},
  { id: 87, type: "location", text: "【追いコン】みんな今までありがとう！全員で乾杯！", mode: "all", nextId: [88]},
  { id: 88, type: "normal", text: "単位が足りない！？そんなの関係ねぇ！", mode: "all", nextId: [89]},
  
  { id: 89, type: "force_stop", text: "【卒業!?留年!?】ドキドキ！運命のルーレット！", mode: "all", nextId: [90, 99]},
  
  // 留年ルート
  { id: 90, type: "repeat", text: "【留年】", mode: "all", nextId: [91]},
  { id: 91, type: "repeat", text: "【留年】", mode: "all", nextId: [92]},
  { id: 92, type: "repeat", text: "【留年】", mode: "all", nextId: [93]},
  { id: 93, type: "repeat", text: "【留年】", mode: "all", nextId: [94]},
  { id: 94, type: "repeat", text: "【留年】", mode: "all", nextId: [95]},
  { id: 95, type: "repeat", text: "【留年】", mode: "all", nextId: [96]},
  { id: 96, type: "repeat", text: "【留年】", mode: "all", nextId: [97]},
  { id: 97, type: "repeat", text: "【留年】", mode: "all", nextId: [98]},
  { id: 98, type: "repeat", text: "【留年】", mode: "all", nextId: [99]},
  
  // ゴール
  { id: 99, type: "goal", text: "【ゴール】", isGoal: true, mode: "all", nextId: [] }
];

function createPlayer(id, name) {
  return {
    id: id || "p_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
    name: name || "プレイヤー",
    jobId: "mob",
    job: "モブ",
    baseCap: 80,
    bonusCap: 0,
    currentHp: 80,
    drinkCount: 0,
    happiness: 100,
    position: 0,
    location: "スタート前",
    insurance: 0,   
    isLover: false,
    skipTurn: false,
    hasJob: false,
    lovers: []
  };
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { JOBS, MAP_SQUARES, createPlayer };
} else {
  window.JOBS = JOBS;
  window.MAP_SQUARES = MAP_SQUARES;
  window.createPlayer = createPlayer;
}
