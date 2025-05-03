// スライドパズル用の各種DOM要素を取得
const board = document.getElementById("board");
const startBtn = document.getElementById("startBtn");
const helpBtn = document.getElementById("helpBtn");
const timerLabel = document.getElementById("timer");
const clearMessage = document.getElementById("clearMessage");

// パズルサイズとタイル数を定義
const SIZE = 4;
const shuffleTimes = 40;
const TILE_COUNT = SIZE * SIZE;

// パズル状態管理用変数
let tiles = [];
let emptyIndex = TILE_COUNT - 1;
let tileElements = {};
let startTime = null;
let endTime = null;
let timerInterval = null;
let playing = false;
let isAiSolving = false;
let trialCount = 0;
let goalState = [];
let trialNodesLimitCount = 1000000;
let solvingInterval = null;
let solvingSolution = [];
let solvingIndex = 0;

// タイルを初期化
function createTiles() {
  tiles = [...Array(TILE_COUNT - 1).keys()].map(n => n + 1);
  tiles.push(null);
  emptyIndex = TILE_COUNT - 1;
  goalState = [...tiles];
  initRender();
}

// タイルをボードに描画
function initRender() {
  board.innerHTML = "";
  tileElements = {};

  tiles.forEach((num, i) => {
    if (num !== null) {
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.textContent = num;
      tile.dataset.value = num;
      tile.style.transform = getTransform(i);
      tile.addEventListener("click", () => {
        if (!isAiSolving) moveTile(num);
      });
      board.appendChild(tile);
      tileElements[num] = tile;
    }
  });
}

// tiles[] 配列の現在の状態に基づいて、画面上のタイルの表示位置を更新する
// 実際にタイルのDOM要素（tileElements）に対して transform を適用する
function updateTilePositions() {
  for (let i = 0; i < tiles.length; i++) {
    const num = tiles[i];
    if (num !== null && tileElements[num]) {
      // タイル番号numに対応するDOM要素を、現在のインデックスiの位置へ移動
      tileElements[num].style.transform = getTransform(i);
    }
  }
}

// タイルがボード上の何行何列に位置するかを計算し、CSS transform 値を返す関数
// i: タイルが tiles[] 配列上で存在するインデックス（0〜15）
// 返り値: transform: translate(x, y) の形式（文字列）
function getTransform(i) {
  const step = 255 / SIZE; // 1マス分のpxサイズ（255px ÷ 4マス = 63.75px）
  // 横方向（列番号 × step）、縦方向（行番号 × step）
  // 行列座標：(row, col) = (Math.floor(i / SIZE), i % SIZE)
  return `translate(${(i % SIZE) * step}px, ${Math.floor(i / SIZE) * step}px)`;
}

// 指定タイルを移動
function moveTile(num) {
  if (!playing) return;
  const index = tiles.indexOf(num);
  const diff = Math.abs(index - emptyIndex);
  const valid =
    (diff === 1 && Math.floor(index / SIZE) === Math.floor(emptyIndex / SIZE)) ||
    diff === SIZE;

  if (valid) {
    console.log(`[Move] ${num} (${index}) → empty (${emptyIndex})`);
    [tiles[index], tiles[emptyIndex]] = [tiles[emptyIndex], tiles[index]];
    emptyIndex = index;
    updateTilePositions();
    if (checkClear()) showResult();
  }
  if (!valid) {
    console.log(`[Move] moveTile NG ${num} (${index}) cannot→ empty (${emptyIndex})`);
  }
}

// クリア判定
function checkClear() {
  for (let i = 0; i < TILE_COUNT - 1; i++) {
    if (tiles[i] !== i + 1) return false;
  }
  console.log(`[Game] CLEAR! TIME : ${timerLabel.textContent} s`);
  return true;
}

// ゲームクリア後の処理
function showResult() {
  clearInterval(timerInterval);
  playing = false;
  clearMessage.classList.remove("hidden");
  startBtn.textContent = "Try again?";
  helpBtn.textContent = "HELP AI !!";
  startBtn.disabled = false;
  helpBtn.disabled = true;
  badBtn.disabled = false;
}

function startTimer() {
  clearInterval(timerInterval);
  startTime = Date.now();
  playing = true;
  timerInterval = setInterval(() => {
    const now = ((Date.now() - startTime) / 1000).toFixed(1);
    timerLabel.textContent = now;
  }, 100);
}

// タイルをランダムにシャッフル
function shuffle(times = shuffleTimes, onComplete = () => { }) {
  console.log(`[Shuffle] START (${times} times)`);
  let count = 0;
  let previousEmptyIndex = -1;

  const interval = setInterval(() => {
    const moves = [1, -1, SIZE, -SIZE];
    const possible = moves
      .map(d => emptyIndex + d)
      .filter(i =>
        i >= 0 &&
        i < TILE_COUNT &&
        i !== previousEmptyIndex &&
        moveAllowed(emptyIndex, i)
      );

    const rand = possible[Math.floor(Math.random() * possible.length)];
    const movedTile = tiles[rand];
    console.log(`[Shuffle ${count + 1}] move ${movedTile} (${rand}) → empty (${emptyIndex})`);

    [tiles[emptyIndex], tiles[rand]] = [tiles[rand], tiles[emptyIndex]];
    previousEmptyIndex = emptyIndex;
    emptyIndex = rand;
    updateTilePositions();

    count++;
    if (count >= times) {
      clearInterval(interval);
      console.log(`[Shuffle] DONE`);
      startTimer();
      onComplete();
    }
  }, 300);
}

// 指定from, toインデックス間の移動可否判定
function moveAllowed(from, to) {
  const diff = Math.abs(from - to);
  return (diff === 1 && Math.floor(from / SIZE) === Math.floor(to / SIZE)) || diff === SIZE;
}

// スタートボタン押下時の処理
startBtn.addEventListener("click", () => {
  console.log(`[Game] START NOMAL`);
  clearMessage.classList.add("hidden");
  startBtn.textContent = "Wait...";
  helpBtn.textContent = "HELP AI !!";
  timerLabel.textContent = "0.0";
  startBtn.disabled = true;
  helpBtn.disabled = true;
  badBtn.disabled = true;
  trialCount = 0;

  createTiles();

  setTimeout(() => {
    shuffle(shuffleTimes, () => {
      startBtn.textContent = "Trying...";
      helpBtn.disabled = false;
      playing = true;
    });
  }, 300);
});

// 指定した状態 state に対して、合法的に動かせる次の状態（隣接状態）を列挙
// 主に双方向探索のスタート側で使用される
function getNeighbors(state) {
  const neighbors = [];
  const empty = state.indexOf(null); // 空白マスのインデックスを取得

  const directions = [
    { delta: 1, dir: "right" },
    { delta: -1, dir: "left" },
    { delta: SIZE, dir: "down" },
    { delta: -SIZE, dir: "up" }
  ];

  for (const { delta, dir } of directions) {
    const target = empty + delta;

    // 範囲外 or 行をまたぐ横移動（左端↔右端）を除外
    if (
      target < 0 || target >= TILE_COUNT ||
      (delta === 1 && Math.floor(empty / SIZE) !== Math.floor(target / SIZE)) ||
      (delta === -1 && Math.floor(empty / SIZE) !== Math.floor(target / SIZE))
    ) continue;

    // 状態をコピーして空白と対象の値をスワップ
    const newState = state.slice();
    [newState[empty], newState[target]] = [newState[target], newState[empty]];

    // 新しい状態、動かした値、方向を格納
    neighbors.push({ state: newState, move: state[target], direction: dir });
  }

  return neighbors;
}

// getNeighbors() と逆向きの状態遷移を列挙する（ゴール側探索用）
// 空白に対して「元に戻すように」周囲のタイルを動かすことを模倣
function getReverseNeighbors(state) {
  const neighbors = [];
  const empty = state.indexOf(null); // 空白マスのインデックスを取得

  const directions = [
    { delta: 1, dir: "left" },   // 右隣のタイルを左へ戻す（空白が右にある）
    { delta: -1, dir: "right" }, // 左隣のタイルを右へ戻す
    { delta: SIZE, dir: "up" },  // 下隣のタイルを上へ戻す
    { delta: -SIZE, dir: "down" } // 上隣のタイルを下へ戻す
  ];

  for (const { delta, dir } of directions) {
    const target = empty + delta;

    // 範囲外 or 横方向で行が違う場合は除外（無効な移動）
    if (
      target < 0 || target >= TILE_COUNT ||
      (delta === 1 && Math.floor(empty / SIZE) !== Math.floor(target / SIZE)) ||
      (delta === -1 && Math.floor(empty / SIZE) !== Math.floor(target / SIZE))
    ) continue;

    // 状態をコピーしてスワップ（空白を元の場所へ戻す）
    const newState = state.slice();
    [newState[empty], newState[target]] = [newState[target], newState[empty]];

    // 空白と入れ替えた元のタイル番号で記録
    neighbors.push({ state: newState, move: state[empty], direction: dir });
  }

  return neighbors;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
// 双方向幅優先探索でパズルを解く関数
// startTiles: 現在のタイル状態
// goalTiles: 目標とする正解状態
// スタート側・ゴール側から同時に探索を行い、途中で出会ったら解を構築
async function solvePuzzleBidirectional(startTiles, goalTiles) {
  // 初期状態をそれぞれオブジェクトにして格納
  const startState = { state: startTiles.slice(), prev: null };
  const goalState = { state: goalTiles.slice(), prev: null };

  let startFrontier = [startState]; // スタート側の探索キュー
  let goalFrontier = [goalState];   // ゴール側の探索キュー

  const startVisited = new Map();   // スタート側の訪問済み状態
  const goalVisited = new Map();    // ゴール側の訪問済み状態

  const stateToString = state => state.join(","); // 配列をキーとして使うための文字列化

  // 初期状態を訪問済みに追加
  startVisited.set(stateToString(startState.state), startState);
  goalVisited.set(stateToString(goalState.state), goalState);

  let trialNodes = 0;
  const BATCH_SIZE = 1000; // 指定回数ごとに非同期小休止を入れる

  // 双方向探索ループ
  while (startFrontier.length > 0 && goalFrontier.length > 0) {

    // === スタート側の探索 ===
    const newStartFrontier = [];
    for (const node of startFrontier) {
      const neighbors = getNeighbors(node.state); // 隣接状態を列挙

      for (const neighbor of neighbors) {
        const neighborStr = stateToString(neighbor.state);
        if (!startVisited.has(neighborStr)) {
          startVisited.set(neighborStr, {
            state: neighbor.state,
            prev: trialNodes < trialNodesLimitCount ? node : null
          });
          const newNode = {
            state: neighbor.state,
            prev: trialNodes < trialNodesLimitCount ? node : null
          };
          startVisited.set(neighborStr, newNode);
          newStartFrontier.push(newNode);

          // ゴール側と出会った場合（探索成功）
          if (goalVisited.has(neighborStr)) {
            // 双方向から出会ったら、解を組み立てる
            console.log(`[HELP AI] start side trialNodes now: ${trialNodes}`);
            helpBtn.textContent = `trialNodes ${trialNodes.toLocaleString()}`;
            return buildSolutionPath({ state: neighbor.state, prev: node }, goalFrontier.find(g => stateToString(g.state) === neighborStr));
          }
        }
      }

      // 試行回数カウントと小休止
      trialNodes++;
      if (trialNodes % 100000 === 0) {
        helpBtn.textContent = `trialNodes ${trialNodes.toLocaleString()}`;
        console.log(`[HELP AI] start side trialNodes now: ${trialNodes}`);
      }
      if (trialNodes >= trialNodesLimitCount) {
        console.log("[HELP AI] Trial node limit exceeded (start side)");
        console.log(`[HELP AI] startVisited.size: ${startVisited.size}`);
        console.log(`[HELP AI] goalVisited.size : ${goalVisited.size}`);
        // メッセージ表示
        const helpMessage = document.getElementById("helpMessage");
        if (helpMessage) helpMessage.textContent = "Too far. Taking a step closer to goal...";

        // 上限を超えた場合、一番ゴールに近い状態へ移動し再試行
        await moveCloserState(startVisited);
        startVisited.clear();
        goalVisited.clear();
        startFrontier = null;
        goalFrontier = null;
  
        // 少し待ってから再度探索再開
        await sleep(300);

        // 再帰ではなくイベントループで再実行
        setTimeout(() => {
          autoSolve();
        }, 1000);
        return;
      }

      if (trialNodes % BATCH_SIZE === 0) {
        await sleep(0); // 小休止
      }
    }
    startFrontier = newStartFrontier;

    // === ゴール側の探索 ===（スタート側と同様）
    const newGoalFrontier = [];
    for (const node of goalFrontier) {
      const neighbors = getNeighbors(node.state);

      for (const neighbor of neighbors) {
        const neighborStr = stateToString(neighbor.state);
        if (!goalVisited.has(neighborStr)) {
          goalVisited.set(neighborStr, {
            state: neighbor.state,
            prev: trialNodes < trialNodesLimitCount ? node : null
          });
          const newNode = {
            state: neighbor.state,
            prev: trialNodes < trialNodesLimitCount ? node : null
          };
          goalVisited.set(neighborStr, newNode);
          newGoalFrontier.push(newNode);

          if (startVisited.has(neighborStr)) {
            // 双方向から出会ったら、解を組み立てる
            console.log(`[HELP AI] start side trialNodes now: ${trialNodes}`);
            helpBtn.textContent = `trialNodes ${trialNodes.toLocaleString()}`;
            return buildSolutionPath(startFrontier.find(s => stateToString(s.state) === neighborStr), { state: neighbor.state, prev: node });
          }
        }
      }

      trialNodes++;
      if (trialNodes % 100000 === 0) {
        helpBtn.textContent = `trialNodes ${trialNodes.toLocaleString()}`;
        console.log(`[HELP AI] goal side trialNodes now : ${trialNodes}`);
      }
      if (trialNodes >= trialNodesLimitCount) {
        console.log("[HELP AI] Trial node limit exceeded (goal side)");
        console.log(`[HELP AI] startVisited.size: ${startVisited.size}`);
        console.log(`[HELP AI] goalVisited.size : ${goalVisited.size}`);
        // メッセージ表示
        const helpMessage = document.getElementById("helpMessage");
        if (helpMessage) helpMessage.textContent = "Too far. Taking a step closer to goal...";

        // 最もゴールに近い状態に移動
        await moveCloserState(startVisited);
        startVisited.clear();
        goalVisited.clear();
        startFrontier = null;
        goalFrontier = null;

        // 少し待ってから再度探索再開
        await sleep(300);

        // 再帰ではなくイベントループで再実行
        setTimeout(() => {
          autoSolve();
        }, 1000);
        return;
      }

      if (trialNodes % BATCH_SIZE === 0) {
        await sleep(0); // 小休止
      }
    }
    goalFrontier = newGoalFrontier;
  }

  return null; // 双方向から接続できなかった場合（失敗）
}

// 双方向探索で出会ったノードから、解（ステップの列）を構築する関数
// startMeetNode: スタート側で出会ったノード
// goalMeetNode: ゴール側で出会ったノード
function buildSolutionPath(startMeetNode, goalMeetNode) {
  const path = [];

  // スタート側から meeting point までの経路を逆順でたどり、前に追加
  let node = startMeetNode;
  while (node) {
    path.unshift(node.state); // 経路の先頭に追加（順番が逆なので）
    node = node.prev;
  }

  // ゴール側は meeting point の「次のノード」からたどる（meeting点は既に含まれている）
  node = goalMeetNode.prev;
  while (node) {
    path.push(node.state); // 経路の後ろに追加（順方向）
    node = node.prev;
  }

  console.log(`[HELP AI] Solution found! ${path.length - 1} steps`);

  // UI更新（ボタン表示変更）
  helpBtn.disabled = false;
  helpBtn.textContent = "Solution found!";
  helpBtn.disabled = true;

  // メモリ節約のため、途中ノードのprevリンクを破棄
  for (let i = 0; i < path.length; i++) {
    if (path[i].prev) path[i].prev = null;
  }

  // 各状態をオブジェクト化して返す（後続処理でstateプロパティを使うため）
  return path.map(state => ({ state }));
}

// 現在のパズル状態における「マンハッタン距離（移動コスト）」の合計を返す関数
// 目的：パズルがどれだけ正解状態から離れているかを数値化するために使用
function calculateManhattanDistance(state) {
  const size = Math.sqrt(state.length); // パズル1辺のサイズ（例：4x4 → 4）
  let distance = 0;

  for (let i = 0; i < state.length; i++) {
    const value = state[i];

    if (value === null) continue; // 空白マスは評価対象外

    const targetIndex = value - 1; // 正解状態における位置（1-based → 0-based）

    // 現在位置の行・列
    const currentRow = Math.floor(i / size);
    const currentCol = i % size;

    // 正解位置の行・列
    const targetRow = Math.floor(targetIndex / size);
    const targetCol = targetIndex % size;

    // 行差＋列差 → 「そのタイルが必要とする移動ステップ数」
    distance += Math.abs(currentRow - targetRow) + Math.abs(currentCol - targetCol);
  }

  return distance; // 全タイル分の距離を合計して返す
}

// 試行制限で探索を中断した際、ゴールに最も近い状態まで自動で進める関数
// visitedMap: 探索済み状態（スタート側）のMapから最も近い状態を選ぶ
async function moveCloserState(visitedMap) {
  let minDistance = Infinity;
  let bestNode = null;

  // 各ノードに対してマンハッタン距離（目標との距離）を計算し、最小のものを選ぶ
  for (const node of visitedMap.values()) {
    const distance = calculateManhattanDistance(node.state);
    if (distance < minDistance) {
      minDistance = distance;
      bestNode = node;
    }
  }

  if (!bestNode) {
    console.warn("[HELP AI] No best node found");
    return;
  }

  // 選ばれたbestNodeまでのパスをprev参照を使って復元（逆順でたどって前に追加）
  const path = [];
  let node = bestNode;
  while (node && node.prev) {
    path.unshift(node);  // 経路の先頭に追加
    node = node.prev;
  }

  console.log(`[HELP AI] Moving ${path.length} steps closer`);

  // ステップごとに順に手動で移動する（描画＋sleepを挟む）
  for (const step of path) {
    const prevState = step.prev.state;
    const currState = step.state;

    const prevEmpty = prevState.indexOf(null);
    const currEmpty = currState.indexOf(null);

    // 空白の位置の差異から、どのタイルが移動されたかを特定
    const movedTile = prevState[currEmpty];

    const diff = Math.abs(prevEmpty - currEmpty);
    const validMove =
      (diff === 1 && Math.floor(prevEmpty / SIZE) === Math.floor(currEmpty / SIZE)) ||
      (diff === SIZE); // 横移動／縦移動の検証

    if (validMove) {
      moveTile(movedTile); // 実際にタイルを動かす
      await sleep(200);    // 少し待って次へ進む
    } else {
      console.warn(`[HELP AI] Skipped invalid move during closer move`);
    }
  }

  // 最後にヘルプメッセージを初期化
  node.prev = null;
  if (helpMessage) helpMessage.textContent = "HELP AI might take a few minutes";
}

// HELPボタンから呼び出され、AIによる自動解答を開始する関数
// solvePuzzleBidirectional() を呼び出し、得られた解を順に再生していく
async function autoSolve() {
  // すでに動作中なら処理を無視（二重起動防止）
  if (solvingInterval !== null) return;

  console.log(`[HELP AI] trial start at: ${timerLabel.textContent} s`);

  helpBtn.disabled = true;
  helpBtn.textContent = "solving..."; // ボタン表示を変更

  // 双方向探索で解（状態の列）を取得
  const solutionPath = await solvePuzzleBidirectional(tiles, goalState);

  if (!solutionPath) {
    // 解が見つからなかった場合（途中でタイムアウト等）
    isAiSolving = false;
    playing = true;
    helpBtn.disabled = true;
    return;
  }

  // 解が見つかった場合：状態列を保存し、順に再生していく
  solvingSolution = solutionPath;
  solvingIndex = 1; // 最初の状態（0番目）は今と同じなのでスキップ

  // 一定間隔で1手ずつタイルを動かす
  solvingInterval = setInterval(() => {
    if (solvingIndex >= solvingSolution.length) {
      // 解がすべて再生し終わったら終了
      clearInterval(solvingInterval);
      solvingInterval = null;
      badBtn.disabled = false;
      isAiSolving = false;
      return;
    }

    const currentNode = solvingSolution[solvingIndex - 1];
    const nextNode = solvingSolution[solvingIndex];

    const currentState = currentNode.state;
    const nextState = nextNode.state;

    let movedTile = null;

    // 空白マスの位置の違いから、どのタイルが動いたかを判定
    const emptyIndexCurrent = currentState.indexOf(null);
    const emptyIndexNext = nextState.indexOf(null);

    if (emptyIndexCurrent !== emptyIndexNext) {
      movedTile = nextState[emptyIndexCurrent];
    }

    if (movedTile !== null) {
      moveTile(movedTile); // タイルを実際に動かす
    }

    solvingIndex++; // 次の手へ
  }, 300); // 0.3秒ごとに1手ずつ再生
}

// HELPボタン押下時にAI起動
helpBtn.addEventListener("click", () => {
  console.log("[HELP AI] START");

  if (!playing) return;
  startBtn.textContent = "give up...";
  helpBtn.textContent = "solving...";
  isAiSolving = true;
  helpBtn.disabled = true;
  badBtn.disabled = true;
  autoSolve();
});

// BADボタン押下時の処理
badBtn.addEventListener("click", () => {
  console.log("[Game] START HARD");
  clearMessage.classList.add("hidden");
  startBtn.textContent = "Trying...";
  helpBtn.textContent = "HELP AI !!";
  timerLabel.textContent = "0.0";
  startBtn.disabled = true;
  badBtn.disabled = true;
  helpBtn.disabled = true;
  trialCount = 0;
  createTiles();
  // tilesを直接セット
  tiles = [
    9, 10, 11, 15,
    12, 13, 14, null,
    5, 6, 7, 8,
    1, 2, 4, 3
  ];
  emptyIndex = tiles.indexOf(null);
  updateTilePositions(); // 画面更新
  playing = true;
  helpBtn.disabled = false; // HELP AIを有効化
  startTimer();
  console.log("[Game] HRAD set DONE");
});
