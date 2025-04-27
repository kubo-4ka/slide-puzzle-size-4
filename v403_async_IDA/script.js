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
let timerInterval = null;
let playing = false;
let isAiSolving = false;
let trialCount = 0;

// タイルを初期化
function createTiles() {
  tiles = [...Array(TILE_COUNT - 1).keys()].map(n => n + 1);
  tiles.push(null);
  emptyIndex = TILE_COUNT - 1;
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

// タイル位置を更新
function updateTilePositions() {
  for (let i = 0; i < tiles.length; i++) {
    const num = tiles[i];
    if (num !== null && tileElements[num]) {
      tileElements[num].style.transform = getTransform(i);
    }
  }
}

// インデックスからCSS transform値を算出
function getTransform(i) {
  const step = 255 / SIZE;
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
}

// クリア判定
function checkClear() {
  for (let i = 0; i < TILE_COUNT - 1; i++) {
    if (tiles[i] !== i + 1) return false;
  }
  console.log(`[Game] CLEAR`);
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
}

// タイルをランダムにシャッフル
function shuffle(times = shuffleTimes, onComplete = () => {}) {
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
      startTime = Date.now();
      playing = true;
      timerInterval = setInterval(() => {
        const now = ((Date.now() - startTime) / 1000).toFixed(1);
        timerLabel.textContent = now;
      }, 100);
      onComplete();
    }
  }, 300);
}

// 指定2インデックス間の移動可否判定
function moveAllowed(from, to) {
  const diff = Math.abs(from - to);
  return (diff === 1 && Math.floor(from / SIZE) === Math.floor(to / SIZE)) || diff === SIZE;
}

// スタートボタン押下時の処理
startBtn.addEventListener("click", () => {
  console.log(`[Game] START`);
  clearMessage.classList.add("hidden");
  startBtn.textContent = "Wait...";
  timerLabel.textContent = "0.0";
  startBtn.disabled = true;
  helpBtn.disabled = true;

  createTiles();

  setTimeout(() => {
    shuffle(shuffleTimes, () => {
      startBtn.textContent = "Trying...";
      helpBtn.disabled = false;
    });
  }, 300);
});

// 非同期でIDA*探索
async function solvePuzzleAsync(initialTiles) {
  const goal = [...Array(TILE_COUNT - 1).keys()].map(n => n + 1).concat(null);

  // マンハッタン距離の計算
  function manhattan(state) {
    let dist = 0;
    for (let i = 0; i < TILE_COUNT; i++) {
      const val = state[i];
      if (val === null) continue;
      const goalIndex = val - 1;
      dist += Math.abs(i % SIZE - goalIndex % SIZE) + Math.abs(Math.floor(i / SIZE) - Math.floor(goalIndex / SIZE));
    }
    return dist;
  }

  // 隣接ノードの生成
  function getNeighbors(state) {
    const neighbors = [];
    const empty = state.indexOf(null);
    const directions = [1, -1, SIZE, -SIZE];
    for (const d of directions) {
      const target = empty + d;
      if (
        target < 0 || target >= TILE_COUNT ||
        (d === 1 && Math.floor(empty / SIZE) !== Math.floor(target / SIZE)) ||
        (d === -1 && Math.floor(empty / SIZE) !== Math.floor(target / SIZE))
      ) continue;
      const newState = state.slice();
      [newState[empty], newState[target]] = [newState[target], newState[empty]];
      neighbors.push({ state: newState, move: state[target] });
    }
    return neighbors;
  }

  // IDA*メイン探索関数
  let threshold = manhattan(initialTiles);
  let solutionMoves = [];

  async function search(path, g) {
    const state = path[path.length - 1];
    const f = g + manhattan(state);
    if (f > threshold) return f;
    if (state.join() === goal.join()) return "FOUND";

    let min = Infinity;
    const neighbors = getNeighbors(state);

    for (const neighbor of neighbors) {
      if (path.some(p => p.join() === neighbor.state.join())) continue;
      await new Promise(resolve => setTimeout(resolve, 0));
      trialCount++;
      if (trialCount % 1000 === 0) {
        helpBtn.textContent = `trial ${trialCount.toLocaleString()}`;
        console.log(`[HELP AI] trialCount now: ${trialCount}`);
      }
      const t = await search([...path, neighbor.state], g + 1);
      if (t === "FOUND") {
        solutionMoves.push(neighbor.move);
        return "FOUND";
      }
      if (t < min) min = t;
    }
    return min;
  }

  // 閾値を増やしながら反復深化
  while (true) {
    const t = await search([initialTiles], 0);
    if (t === "FOUND") break;
    if (t === Infinity) return [];
    threshold = t;
  }
  return solutionMoves.reverse();
}

// AIによる自動解答実行
async function autoSolve() {
  const solution = await solvePuzzleAsync(tiles);
  helpBtn.disabled = false;
  helpBtn.textContent = `trial ${trialCount.toLocaleString()}`;
  helpBtn.disabled = true;
  console.log(`[HELP AI] trialCount: ${trialCount}`);
  console.log(`[HELP AI] trial end at: ${timerLabel.textContent}`);

  let index = 0;
  const interval = setInterval(() => {
    if (index >= solution.length) {
      clearInterval(interval);
      isAiSolving = false;
      showResult();
      return;
    }
    moveTile(solution[index]);
    index++;
  }, 300);
}

// HELPボタン押下時にAI起動
helpBtn.addEventListener("click", () => {
  console.log("[HELP AI] START");
  console.log(`[HELP AI] trial start at: ${timerLabel.textContent}`);
  if (!playing) return;
  startBtn.textContent = "give up...";
  helpBtn.textContent = "solving...";
  isAiSolving = true;
  helpBtn.disabled = true;
  autoSolve();
});
