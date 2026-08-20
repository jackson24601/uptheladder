const RUNG_COUNT = 10;
const WIND_MS = 3 * 60 * 1000;

const TEAMS = [
  { shirt: "#e53935", hair: "#4e342e", skin: "#f4c7a1", label: "Red" },
  { shirt: "#1e88e5", hair: "#212121", skin: "#e0ac7a", label: "Blue" },
  { shirt: "#fdd835", hair: "#6d4c41", skin: "#f3d1b0", label: "Yellow" },
  { shirt: "#43a047", hair: "#3e2723", skin: "#c68642", label: "Green" },
  { shirt: "#8e24aa", hair: "#5d4037", skin: "#f1c27d", label: "Purple" },
  { shirt: "#fb8c00", hair: "#263238", skin: "#ffdbac", label: "Orange" },
];

const setupScreen = document.getElementById("setup-screen");
const gameScreen = document.getElementById("game-screen");
const nameFields = document.getElementById("name-fields");
const forest = document.getElementById("forest");
const windCountdown = document.getElementById("wind-countdown");
const windBanner = document.getElementById("wind-banner");
const leafLayer = document.getElementById("leaf-layer");
const winOverlay = document.getElementById("win-overlay");
const winTitle = document.getElementById("win-title");
const winCopy = document.getElementById("win-copy");
const muteBtn = document.getElementById("mute-btn");

const state = {
  teamCount: 2,
  teams: [],
  winnerIndex: null,
  nextWindAt: 0,
  windTimerId: null,
  muted: false,
  audio: null,
};

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[ch]));
}

function personSvg(team, mini = false) {
  const w = mini ? 42 : 58;
  const h = mini ? 54 : 86;
  return `
    <svg viewBox="0 0 60 90" width="${w}" height="${h}" aria-hidden="true">
      <ellipse cx="30" cy="86" rx="16" ry="4" fill="rgba(0,0,0,0.18)" />
      <rect x="18" y="58" width="10" height="24" rx="4" fill="#1565c0" />
      <rect x="32" y="58" width="10" height="24" rx="4" fill="#1565c0" />
      <rect x="16" y="70" width="12" height="7" rx="3" fill="#37474f" />
      <rect x="32" y="70" width="12" height="7" rx="3" fill="#37474f" />
      <rect x="14" y="30" width="32" height="30" rx="8" fill="${team.shirt}" />
      <rect x="4" y="32" width="14" height="9" rx="4" fill="${team.shirt}" />
      <rect x="42" y="32" width="14" height="9" rx="4" fill="${team.shirt}" />
      <circle cx="11" cy="41" r="4.2" fill="${team.skin}" />
      <circle cx="49" cy="41" r="4.2" fill="${team.skin}" />
      <circle cx="30" cy="18" r="13" fill="${team.skin}" />
      <ellipse cx="30" cy="12" rx="13" ry="8" fill="${team.hair}" />
      <circle cx="25" cy="18" r="1.6" fill="#3e2723" />
      <circle cx="35" cy="18" r="1.6" fill="#3e2723" />
      <path d="M25 24 Q30 28 35 24" fill="none" stroke="#6d4c41" stroke-width="1.6" stroke-linecap="round" />
    </svg>
  `;
}

function renderNameFields() {
  nameFields.innerHTML = "";
  for (let i = 0; i < state.teamCount; i += 1) {
    const team = TEAMS[i];
    const row = document.createElement("label");
    row.className = "name-row";
    row.innerHTML = `
      <span class="mini-person">${personSvg(team, true)}</span>
      <input type="text" maxlength="18" value="Team ${team.label}" data-index="${i}" aria-label="Name for team ${team.label}" />
    `;
    nameFields.appendChild(row);
  }
}

function selectedNames() {
  return [...nameFields.querySelectorAll("input")].map((input, index) => {
    const value = input.value.trim();
    return value || `Team ${TEAMS[index].label}`;
  });
}

function ensureAudio() {
  if (!state.audio) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) state.audio = new AudioCtx();
  }
  if (state.audio && state.audio.state === "suspended") {
    state.audio.resume();
  }
}

function tone(freq, duration, type = "sine", gainValue = 0.05) {
  if (state.muted || !state.audio) return;
  const osc = state.audio.createOscillator();
  const gain = state.audio.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = gainValue;
  gain.gain.exponentialRampToValueAtTime(0.001, state.audio.currentTime + duration);
  osc.connect(gain).connect(state.audio.destination);
  osc.start();
  osc.stop(state.audio.currentTime + duration);
}

function playClimb() {
  tone(420, 0.12, "triangle", 0.04);
  setTimeout(() => tone(620, 0.14, "triangle", 0.045), 80);
}

function playFall() {
  tone(320, 0.28, "sawtooth", 0.03);
  setTimeout(() => tone(180, 0.32, "sawtooth", 0.025), 120);
}

function playWind() {
  if (state.muted || !state.audio) return;
  const duration = 1.2;
  const bufferSize = state.audio.sampleRate * duration;
  const buffer = state.audio.createBuffer(1, bufferSize, state.audio.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) data[i] = Math.random() * 2 - 1;
  const noise = state.audio.createBufferSource();
  noise.buffer = buffer;
  const filter = state.audio.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 700;
  const gain = state.audio.createGain();
  gain.gain.value = 0.045;
  gain.gain.exponentialRampToValueAtTime(0.001, state.audio.currentTime + duration);
  noise.connect(filter).connect(gain).connect(state.audio.destination);
  noise.start();
}

function playWin() {
  [523, 659, 784, 1046].forEach((freq, i) => {
    setTimeout(() => tone(freq, 0.28, "triangle", 0.05), i * 140);
  });
}

function formatTime(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function stopWind() {
  if (state.windTimerId) {
    cancelAnimationFrame(state.windTimerId);
    state.windTimerId = null;
  }
}

function tickWind() {
  if (state.winnerIndex !== null) return;
  const remaining = state.nextWindAt - Date.now();
  windCountdown.textContent = formatTime(remaining);
  if (remaining <= 0) {
    blowWind();
    state.nextWindAt = Date.now() + WIND_MS;
  }
  state.windTimerId = requestAnimationFrame(tickWind);
}

function spawnLeaves() {
  leafLayer.innerHTML = "";
  for (let i = 0; i < 22; i += 1) {
    const leaf = document.createElement("span");
    leaf.className = `leaf ${["", "gold", "dark"][i % 3]}`.trim();
    leaf.style.top = `${8 + Math.random() * 40}%`;
    leaf.style.left = `${-10 - Math.random() * 20}px`;
    leaf.style.animationDuration = `${1.4 + Math.random() * 1.4}s`;
    leaf.style.animationDelay = `${Math.random() * 0.4}s`;
    leafLayer.appendChild(leaf);
  }
  setTimeout(() => {
    leafLayer.innerHTML = "";
  }, 2800);
}

function showBanner(message) {
  windBanner.hidden = false;
  windBanner.classList.add("show");
  windBanner.textContent = message;
  setTimeout(() => {
    windBanner.hidden = true;
    windBanner.classList.remove("show");
  }, 2800);
}

function updateTeamView(index) {
  const team = state.teams[index];
  const column = forest.querySelector(`[data-team="${index}"]`);
  if (!column) return;
  const climber = column.querySelector(".climber");
  const scoreLine = column.querySelector(".score-line");
  climber.style.setProperty("--score", team.score);
  scoreLine.textContent = `${team.score} / ${RUNG_COUNT}`;
  column.querySelectorAll(".rung").forEach((rung) => {
    const value = Number(rung.dataset.rung);
    rung.classList.toggle("reached", value <= team.score);
  });
}

function setButtonsEnabled(enabled) {
  forest.querySelectorAll("button").forEach((button) => {
    button.disabled = !enabled;
  });
}

function celebrate(index) {
  const team = state.teams[index];
  state.winnerIndex = index;
  stopWind();
  setButtonsEnabled(false);
  playWin();
  winTitle.textContent = `${team.name} wins!`;
  winCopy.textContent = `They climbed all ${RUNG_COUNT} rungs and reached the top of the tree.`;
  winOverlay.hidden = false;
  winOverlay.classList.remove("hidden");
  const colors = TEAMS.map((item) => item.shirt);
  for (let i = 0; i < 48; i += 1) {
    const piece = document.createElement("span");
    piece.className = "confetti";
    piece.style.left = `${Math.random() * 100}vw`;
    piece.style.background = colors[i % colors.length];
    piece.style.animationDuration = `${1.6 + Math.random() * 1.6}s`;
    piece.style.animationDelay = `${Math.random() * 0.5}s`;
    document.body.appendChild(piece);
    setTimeout(() => piece.remove(), 3600);
  }
}

function climb(index) {
  if (state.winnerIndex !== null) return;
  const team = state.teams[index];
  if (team.score >= RUNG_COUNT) return;
  team.score += 1;
  playClimb();
  updateTeamView(index);
  if (team.score >= RUNG_COUNT) celebrate(index);
}

function sendToBottom(index) {
  if (state.winnerIndex !== null) return;
  const team = state.teams[index];
  if (team.score === 0) return;
  team.score = 0;
  playFall();
  const climber = forest.querySelector(`[data-team="${index}"] .climber`);
  climber.classList.add("falling");
  updateTeamView(index);
  setTimeout(() => climber.classList.remove("falling"), 900);
}

function blowWind() {
  if (state.winnerIndex !== null || !state.teams.length) return;
  playWind();
  spawnLeaves();
  forest.querySelectorAll(".tree").forEach((tree) => {
    tree.classList.add("wind-shake");
    setTimeout(() => tree.classList.remove("wind-shake"), 1200);
  });

  const index = Math.floor(Math.random() * state.teams.length);
  const team = state.teams[index];
  const tree = forest.querySelector(`[data-team="${index}"] .tree`);
  tree.classList.add("hit");
  setTimeout(() => tree.classList.remove("hit"), 1200);

  if (team.score === 0) {
    showBanner(`A gust of wind blows — ${team.name} is already on the ground.`);
    return;
  }

  team.score -= 1;
  const climber = forest.querySelector(`[data-team="${index}"] .climber`);
  climber.classList.add("knocked");
  updateTeamView(index);
  showBanner(`A gust of wind knocks ${team.name} down one rung!`);
  setTimeout(() => climber.classList.remove("knocked"), 600);
}

function renderForest() {
  forest.innerHTML = "";
  forest.style.setProperty("--n", String(state.teams.length));
  state.teams.forEach((team, index) => {
    const column = document.createElement("section");
    column.className = "team-column";
    column.dataset.team = String(index);
    const rungs = Array.from({ length: RUNG_COUNT }, (_, rungIndex) => {
      const value = RUNG_COUNT - rungIndex;
      const bottom = (value / RUNG_COUNT) * 100;
      return `<div class="rung" data-rung="${value}" style="bottom:${bottom}%"></div>`;
    }).join("");
    column.innerHTML = `
      <div class="tree">
        <div class="crown">
          <span class="leaf-blob a"></span>
          <span class="leaf-blob b"></span>
          <span class="leaf-blob c"></span>
          <span class="goal" aria-hidden="true">🍎</span>
        </div>
        <div class="trunk-wrap">
          ${rungs}
          <div class="climber" style="--score: 0">${personSvg(team)}</div>
        </div>
        <div class="mound"></div>
      </div>
      <div class="controls">
        <p class="team-name">${escapeHtml(team.name)}</p>
        <p class="score-line">0 / ${RUNG_COUNT}</p>
        <div class="btn-row">
          <button type="button" class="minus-btn" data-action="minus" data-index="${index}" aria-label="Send ${escapeHtml(team.name)} back to the ground">−</button>
          <button type="button" class="plus-btn" data-action="plus" data-index="${index}" aria-label="Move ${escapeHtml(team.name)} up one rung">+</button>
        </div>
      </div>
    `;
    forest.appendChild(column);
  });
}

function startGame() {
  ensureAudio();
  const names = selectedNames();
  state.teams = names.map((name, index) => ({
    ...TEAMS[index],
    name,
    score: 0,
  }));
  state.winnerIndex = null;
  setupScreen.hidden = true;
  setupScreen.classList.add("hidden");
  gameScreen.hidden = false;
  gameScreen.classList.remove("hidden");
  winOverlay.hidden = true;
  winOverlay.classList.add("hidden");
  renderForest();
  stopWind();
  state.nextWindAt = Date.now() + WIND_MS;
  tickWind();
}

function returnToSetup() {
  stopWind();
  state.winnerIndex = null;
  state.teams = [];
  gameScreen.hidden = true;
  gameScreen.classList.add("hidden");
  winOverlay.hidden = true;
  winOverlay.classList.add("hidden");
  setupScreen.hidden = false;
  setupScreen.classList.remove("hidden");
  leafLayer.innerHTML = "";
}

document.querySelector(".count-row").addEventListener("click", (event) => {
  const button = event.target.closest(".count-btn");
  if (!button) return;
  state.teamCount = Number(button.dataset.count);
  document.querySelectorAll(".count-btn").forEach((item) => {
    item.classList.toggle("selected", item === button);
  });
  renderNameFields();
});

document.getElementById("start-btn").addEventListener("click", startGame);
document.getElementById("new-game-btn").addEventListener("click", returnToSetup);
document.getElementById("play-again-btn").addEventListener("click", returnToSetup);

forest.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  if (!button) return;
  const index = Number(button.dataset.index);
  if (button.dataset.action === "plus") climb(index);
  if (button.dataset.action === "minus") sendToBottom(index);
});

muteBtn.addEventListener("click", () => {
  state.muted = !state.muted;
  muteBtn.textContent = state.muted ? "Sound off" : "Sound on";
  muteBtn.setAttribute("aria-pressed", String(!state.muted));
  if (!state.muted) ensureAudio();
});

document.getElementById("fullscreen-btn").addEventListener("click", async () => {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen().catch(() => {});
  } else {
    await document.exitFullscreen().catch(() => {});
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "w" || event.key === "W") {
    if (gameScreen.hidden || state.winnerIndex !== null) return;
    if (event.target.matches("input, textarea")) return;
    state.nextWindAt = Date.now() + WIND_MS;
    blowWind();
  }
});

renderNameFields();
