const wordPacks = [
  { category: "음식", word: "김치찌개" },
  { category: "음식", word: "붕어빵" },
  { category: "음식", word: "떡볶이" },
  { category: "음식", word: "치킨" },
  { category: "음식", word: "햄버거" },
  { category: "음식", word: "초밥" },
  { category: "음식", word: "아이스크림" },
  { category: "동물", word: "고양이" },
  { category: "동물", word: "강아지" },
  { category: "동물", word: "기린" },
  { category: "동물", word: "펭귄" },
  { category: "동물", word: "돌고래" },
  { category: "장소", word: "학교" },
  { category: "장소", word: "놀이공원" },
  { category: "장소", word: "영화관" },
  { category: "장소", word: "편의점" },
  { category: "장소", word: "공항" },
  { category: "물건", word: "우산" },
  { category: "물건", word: "스마트폰" },
  { category: "물건", word: "에어컨" },
  { category: "물건", word: "칫솔" },
  { category: "물건", word: "자동차" },
  { category: "직업", word: "소방관" },
  { category: "직업", word: "선생님" },
  { category: "직업", word: "요리사" },
  { category: "직업", word: "가수" },
  { category: "취미", word: "축구" },
  { category: "취미", word: "캠핑" },
  { category: "취미", word: "사진 촬영" },
  { category: "취미", word: "게임" },
];

const screens = [...document.querySelectorAll(".screen")];
const $ = (id) => document.getElementById(id);

const elements = {
  stepLabel: $("step-label"),
  homeLink: $("home-link"),
  playerInputs: $("player-inputs"),
  playerCount: $("player-count"),
  addPlayerBtn: $("add-player-btn"),
  startBtn: $("start-btn"),
  setupError: $("setup-error"),
  timerSelect: $("timer-select"),
  roleOrder: $("role-order"),
  playerTurn: $("player-turn"),
  roleProgress: $("role-progress"),
  handoffCopy: $("handoff-copy"),
  showRoleBtn: $("show-role-btn"),
  roleCard: $("role-card"),
  roleKicker: $("role-kicker"),
  roleTitle: $("role-title"),
  roleWordLabel: $("role-word-label"),
  roleWord: $("role-word"),
  roleHint: $("role-hint"),
  nextPlayerBtn: $("next-player-btn"),
  timer: $("timer"),
  timerRing: $("timer-ring"),
  timerBtn: $("timer-btn"),
  voteBtn: $("vote-btn"),
  voteList: $("vote-list"),
  resultIcon: $("result-icon"),
  resultKicker: $("result-kicker"),
  resultTitle: $("result-title"),
  resultContent: $("result-content"),
  restartBtn: $("restart-btn"),
  resetBtn: $("reset-btn"),
  toast: $("toast"),
};

const screenLabels = {
  "setup-screen": "게임 설정",
  "role-screen": "역할 확인",
  "discussion-screen": "토론",
  "vote-screen": "최종 지목",
  "result-screen": "게임 결과",
};

const state = {
  players: [],
  liarIndex: -1,
  currentPlayer: 0,
  selectedPack: null,
  timerDuration: 180,
  timeLeft: 180,
  timerId: null,
  timerRunning: false,
};

let toastId;

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
  elements.stepLabel.textContent = screenLabels[id];
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  window.clearTimeout(toastId);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  toastId = window.setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function addPlayerInput(value = "") {
  if (elements.playerInputs.children.length >= 8) {
    showToast("플레이어는 최대 8명까지 참여할 수 있어요.");
    return;
  }

  const row = document.createElement("div");
  row.className = "player-row";

  const index = document.createElement("span");
  index.className = "player-index";

  const input = document.createElement("input");
  input.className = "player-input";
  input.type = "text";
  input.maxLength = 12;
  input.autocomplete = "off";
  input.value = value;
  input.setAttribute("aria-label", "플레이어 이름");

  const remove = document.createElement("button");
  remove.className = "remove-player";
  remove.type = "button";
  remove.innerHTML = "&times;";
  remove.setAttribute("aria-label", "플레이어 삭제");
  remove.addEventListener("click", () => {
    if (elements.playerInputs.children.length <= 3) {
      showToast("게임에는 최소 3명이 필요해요.");
      return;
    }
    row.remove();
    refreshPlayerRows();
  });

  input.addEventListener("input", () => {
    elements.setupError.textContent = "";
  });

  row.append(index, input, remove);
  elements.playerInputs.appendChild(row);
  refreshPlayerRows();
  if (value === "" && elements.playerInputs.children.length > 3) input.focus();
}

function refreshPlayerRows() {
  const rows = [...elements.playerInputs.children];
  rows.forEach((row, index) => {
    row.querySelector(".player-index").textContent = String(index + 1).padStart(2, "0");
    row.querySelector(".player-input").placeholder = `플레이어 ${index + 1}`;
  });
  elements.playerCount.textContent = `${rows.length} / 8`;
  elements.addPlayerBtn.disabled = rows.length >= 8;
}

function collectPlayers() {
  const names = [...document.querySelectorAll(".player-input")].map((input, index) =>
    input.value.trim() || `플레이어 ${index + 1}`,
  );

  const normalized = names.map((name) => name.toLocaleLowerCase("ko-KR"));
  if (new Set(normalized).size !== names.length) {
    elements.setupError.textContent = "구분할 수 있도록 플레이어 이름을 서로 다르게 입력해 주세요.";
    return null;
  }
  return names;
}

function pickRound() {
  state.liarIndex = Math.floor(Math.random() * state.players.length);
  let nextPack;
  do {
    nextPack = wordPacks[Math.floor(Math.random() * wordPacks.length)];
  } while (wordPacks.length > 1 && nextPack === state.selectedPack);
  state.selectedPack = nextPack;
  state.currentPlayer = 0;
  state.timerDuration = Number(elements.timerSelect.value);
  state.timeLeft = state.timerDuration;
  stopTimer();
  updateTimer();
}

function startGame() {
  const players = collectPlayers();
  if (!players || players.length < 3) return;

  state.players = players;
  pickRound();
  showScreen("role-screen");
  preparePlayer();
}

function preparePlayer() {
  const number = state.currentPlayer + 1;
  elements.roleOrder.textContent = `PLAYER ${String(number).padStart(2, "0")} / ${String(state.players.length).padStart(2, "0")}`;
  elements.playerTurn.textContent = `${state.players[state.currentPlayer]} 님의 차례`;
  elements.roleProgress.style.width = `${(number / state.players.length) * 100}%`;
  elements.handoffCopy.classList.remove("hidden");
  elements.showRoleBtn.classList.remove("hidden");
  elements.roleCard.classList.add("hidden");
  elements.roleCard.classList.remove("liar");
  elements.nextPlayerBtn.innerHTML = number === state.players.length
    ? "토론 시작 <span aria-hidden=\"true\">→</span>"
    : "확인 완료 <span aria-hidden=\"true\">→</span>";
}

function revealRole() {
  const isLiar = state.currentPlayer === state.liarIndex;
  elements.showRoleBtn.classList.add("hidden");
  elements.handoffCopy.classList.add("hidden");
  elements.roleCard.classList.remove("hidden");
  elements.roleCard.classList.toggle("liar", isLiar);

  if (isLiar) {
    elements.roleKicker.textContent = "YOU ARE THE LIAR";
    elements.roleTitle.textContent = "당신은 라이어입니다";
    elements.roleWordLabel.textContent = "제시어의 카테고리";
    elements.roleWord.textContent = state.selectedPack.category;
    elements.roleHint.textContent = "다른 사람의 설명을 잘 듣고 제시어를 아는 척하세요. 정체를 들키면 패배합니다.";
  } else {
    elements.roleKicker.textContent = "YOU ARE A CITIZEN";
    elements.roleTitle.textContent = "당신은 시민입니다";
    elements.roleWordLabel.textContent = `${state.selectedPack.category} · 제시어`;
    elements.roleWord.textContent = state.selectedPack.word;
    elements.roleHint.textContent = "제시어를 직접 말하지 않으면서 라이어가 알아채기 어렵게 설명하세요.";
  }
}

function nextPlayer() {
  state.currentPlayer += 1;
  if (state.currentPlayer >= state.players.length) {
    showScreen("discussion-screen");
    updateTimer();
    return;
  }
  preparePlayer();
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function updateTimer() {
  elements.timer.textContent = formatTime(state.timeLeft);
  elements.timerRing.style.setProperty("--progress", state.timeLeft / state.timerDuration);
  elements.timerBtn.textContent = state.timerRunning ? "타이머 잠시 멈춤" : state.timeLeft < state.timerDuration ? "타이머 계속하기" : "타이머 시작";
}

function toggleTimer() {
  if (state.timerRunning) {
    stopTimer();
    updateTimer();
    return;
  }

  if (state.timeLeft <= 0) state.timeLeft = state.timerDuration;
  state.timerRunning = true;
  updateTimer();
  state.timerId = window.setInterval(() => {
    state.timeLeft -= 1;
    updateTimer();
    if (state.timeLeft <= 0) {
      stopTimer();
      updateTimer();
      showToast("토론 시간이 끝났습니다. 라이어를 지목해 주세요!");
      window.setTimeout(openVote, 900);
    }
  }, 1000);
}

function stopTimer() {
  if (state.timerId) window.clearInterval(state.timerId);
  state.timerId = null;
  state.timerRunning = false;
}

function openVote() {
  stopTimer();
  elements.voteList.replaceChildren();

  state.players.forEach((player, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "vote-player";
    button.dataset.number = String(index + 1).padStart(2, "0");
    button.textContent = player;
    button.addEventListener("click", () => selectVote(index));
    elements.voteList.appendChild(button);
  });

  showScreen("vote-screen");
}

function createResultRow(label, value, className = "") {
  const row = document.createElement("div");
  row.className = "result-row";
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  const valueNode = document.createElement("strong");
  valueNode.className = className;
  valueNode.textContent = value;
  row.append(labelNode, valueNode);
  return row;
}

function selectVote(index) {
  const citizensWin = index === state.liarIndex;
  elements.resultIcon.classList.toggle("lose", !citizensWin);
  elements.resultIcon.textContent = citizensWin ? "✓" : "!";
  elements.resultKicker.textContent = citizensWin ? "LIAR FOUND" : "LIAR ESCAPED";
  elements.resultTitle.innerHTML = citizensWin ? "시민 팀의<br /><em>승리!</em>" : "라이어의<br /><em>승리!</em>";
  elements.resultContent.replaceChildren(
    createResultRow("지목한 사람", state.players[index]),
    createResultRow("진짜 라이어", state.players[state.liarIndex]),
    createResultRow("제시어", state.selectedPack.word, "answer"),
  );
  showScreen("result-screen");
}

function replay() {
  pickRound();
  showScreen("role-screen");
  preparePlayer();
}

function resetToSetup() {
  stopTimer();
  showScreen("setup-screen");
}

elements.addPlayerBtn.addEventListener("click", () => addPlayerInput());
elements.startBtn.addEventListener("click", startGame);
elements.showRoleBtn.addEventListener("click", revealRole);
elements.nextPlayerBtn.addEventListener("click", nextPlayer);
elements.timerBtn.addEventListener("click", toggleTimer);
elements.voteBtn.addEventListener("click", openVote);
elements.restartBtn.addEventListener("click", replay);
elements.resetBtn.addEventListener("click", resetToSetup);
elements.homeLink.addEventListener("click", (event) => {
  event.preventDefault();
  resetToSetup();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && state.timerRunning) {
    stopTimer();
    updateTimer();
    showToast("화면을 벗어나 타이머가 잠시 멈췄어요.");
  }
});

["플레이어 1", "플레이어 2", "플레이어 3"].forEach((name) => addPlayerInput(name));
updateTimer();
