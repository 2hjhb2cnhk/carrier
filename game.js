const $ = (id) => document.getElementById(id);
const screens = [...document.querySelectorAll(".screen")];

const elements = {
  homeBtn: $("home-btn"),
  connectionPill: $("connection-pill"),
  connectionText: $("connection-text"),
  hostName: $("host-name"),
  timerSelect: $("timer-select"),
  createRoomBtn: $("create-room-btn"),
  roomCodeInput: $("room-code-input"),
  joinName: $("join-name"),
  joinRoomBtn: $("join-room-btn"),
  homeError: $("home-error"),
  roomCode: $("room-code"),
  copyLinkBtn: $("copy-link-btn"),
  lobbyCount: $("lobby-count"),
  lobbyPlayerList: $("lobby-player-list"),
  hostLobbyActions: $("host-lobby-actions"),
  guestLobbyWait: $("guest-lobby-wait"),
  startGameBtn: $("start-game-btn"),
  startHint: $("start-hint"),
  roundLabel: $("round-label"),
  revealRoleBtn: $("reveal-role-btn"),
  roleCard: $("role-card"),
  roleKicker: $("role-kicker"),
  roleTitle: $("role-title"),
  roleWordLabel: $("role-word-label"),
  roleWord: $("role-word"),
  roleHint: $("role-hint"),
  readyBtn: $("ready-btn"),
  readyCount: $("ready-count"),
  readyBar: $("ready-bar"),
  timerRing: $("timer-ring"),
  timer: $("timer"),
  discussionPlayerList: $("discussion-player-list"),
  openVoteBtn: $("open-vote-btn"),
  discussionWait: $("discussion-wait"),
  voteList: $("vote-list"),
  voteWait: $("vote-wait"),
  voteWaitText: $("vote-wait-text"),
  resultIcon: $("result-icon"),
  resultKicker: $("result-kicker"),
  resultTitle: $("result-title"),
  resultContent: $("result-content"),
  voteSummary: $("vote-summary"),
  restartBtn: $("restart-btn"),
  restartWait: $("restart-wait"),
  toast: $("toast"),
};

const state = {
  roomCode: null,
  playerId: null,
  token: null,
  room: null,
  previousPhase: null,
  roleRevealed: false,
  eventSource: null,
  timerId: null,
  toastId: null,
};

function cleanRoomCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

function showScreen(id) {
  screens.forEach((screen) => screen.classList.toggle("active", screen.id === id));
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function showToast(message) {
  window.clearTimeout(state.toastId);
  elements.toast.textContent = message;
  elements.toast.classList.add("show");
  state.toastId = window.setTimeout(() => elements.toast.classList.remove("show"), 2200);
}

function setConnection(status) {
  if (!state.roomCode) {
    elements.connectionPill.classList.add("hidden");
    return;
  }
  elements.connectionPill.classList.remove("hidden");
  const reconnecting = status !== "connected";
  elements.connectionPill.classList.toggle("reconnecting", reconnecting);
  elements.connectionText.textContent = reconnecting ? "재연결 중" : "실시간 연결";
}

function setBusy(button, busy, label) {
  if (!button.dataset.label) button.dataset.label = button.innerHTML;
  button.disabled = busy;
  button.innerHTML = busy ? label : button.dataset.label;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "요청을 처리하지 못했습니다.");
  return payload;
}

function credentialsBody(extra = {}) {
  return JSON.stringify({ playerId: state.playerId, token: state.token, ...extra });
}

function saveSession(roomCode, playerId, token, name) {
  localStorage.setItem(`liar-room:${roomCode}`, JSON.stringify({ playerId, token, name }));
  localStorage.setItem("liar-last-name", name);
  state.roomCode = roomCode;
  state.playerId = playerId;
  state.token = token;
  const url = new URL(location.href);
  url.searchParams.set("room", roomCode);
  history.replaceState(null, "", url);
}

function getSavedSession(roomCode) {
  try {
    return JSON.parse(localStorage.getItem(`liar-room:${roomCode}`));
  } catch {
    return null;
  }
}

function clearCurrentSession() {
  if (state.eventSource) state.eventSource.close();
  if (state.timerId) window.clearInterval(state.timerId);
  state.eventSource = null;
  state.timerId = null;
  state.roomCode = null;
  state.playerId = null;
  state.token = null;
  state.room = null;
  state.previousPhase = null;
  state.roleRevealed = false;
  const url = new URL(location.href);
  url.searchParams.delete("room");
  history.replaceState(null, "", url.pathname);
  setConnection("offline");
  showScreen("home-screen");
}

async function createRoom() {
  const name = elements.hostName.value.trim();
  elements.homeError.textContent = "";
  if (!name) {
    elements.homeError.textContent = "이름을 입력해 주세요.";
    elements.hostName.focus();
    return;
  }

  setBusy(elements.createRoomBtn, true, "방 만드는 중…");
  try {
    const data = await requestJson("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ name, timerDuration: Number(elements.timerSelect.value) }),
    });
    saveSession(data.roomCode, data.playerId, data.token, name);
    connectEvents();
  } catch (error) {
    elements.homeError.textContent = error.message;
  } finally {
    setBusy(elements.createRoomBtn, false);
  }
}

async function joinRoom() {
  const roomCode = cleanRoomCode(elements.roomCodeInput.value);
  const name = elements.joinName.value.trim();
  elements.homeError.textContent = "";
  if (roomCode.length !== 5) {
    elements.homeError.textContent = "5자리 초대 코드를 입력해 주세요.";
    elements.roomCodeInput.focus();
    return;
  }
  if (!name) {
    elements.homeError.textContent = "이름을 입력해 주세요.";
    elements.joinName.focus();
    return;
  }

  setBusy(elements.joinRoomBtn, true, "입장하는 중…");
  try {
    const data = await requestJson(`/api/rooms/${roomCode}/join`, {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    saveSession(data.roomCode, data.playerId, data.token, name);
    connectEvents();
  } catch (error) {
    elements.homeError.textContent = error.message;
  } finally {
    setBusy(elements.joinRoomBtn, false);
  }
}

async function restoreSession(roomCode, saved) {
  state.roomCode = roomCode;
  state.playerId = saved.playerId;
  state.token = saved.token;
  setConnection("reconnecting");
  try {
    const url = `/api/rooms/${roomCode}?playerId=${encodeURIComponent(saved.playerId)}&token=${encodeURIComponent(saved.token)}`;
    const room = await requestJson(url, { method: "GET", headers: {} });
    renderRoom(room);
    connectEvents();
  } catch {
    localStorage.removeItem(`liar-room:${roomCode}`);
    state.roomCode = null;
    state.playerId = null;
    state.token = null;
    elements.roomCodeInput.value = roomCode;
    elements.homeError.textContent = "이 방에 다시 입장하려면 이름을 입력해 주세요.";
    setConnection("offline");
    showScreen("home-screen");
  }
}

function connectEvents() {
  if (state.eventSource) state.eventSource.close();
  setConnection("reconnecting");
  const url = `/api/rooms/${state.roomCode}/events?playerId=${encodeURIComponent(state.playerId)}&token=${encodeURIComponent(state.token)}`;
  const source = new EventSource(url);
  state.eventSource = source;
  source.onopen = () => setConnection("connected");
  source.addEventListener("state", (event) => {
    setConnection("connected");
    renderRoom(JSON.parse(event.data));
  });
  source.onerror = () => setConnection("reconnecting");
}

function makePlayerItem(player) {
  const item = document.createElement("div");
  item.className = "player-item";

  const avatar = document.createElement("span");
  avatar.className = "player-avatar";
  avatar.textContent = player.name.slice(0, 1).toUpperCase();

  const name = document.createElement("span");
  name.className = "player-name";
  name.textContent = player.id === state.playerId ? `${player.name} (나)` : player.name;

  item.append(avatar, name);
  if (player.isHost) {
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = "방장";
    item.appendChild(badge);
  }
  const status = document.createElement("span");
  status.className = `online-dot${player.online ? "" : " offline"}`;
  status.title = player.online ? "접속 중" : "연결 끊김";
  item.appendChild(status);
  return item;
}

function renderLobby(room) {
  elements.roomCode.textContent = room.code;
  elements.lobbyCount.textContent = `${room.players.length} / 8`;
  elements.lobbyPlayerList.replaceChildren(...room.players.map(makePlayerItem));
  elements.hostLobbyActions.classList.toggle("hidden", !room.isHost);
  elements.guestLobbyWait.classList.toggle("hidden", room.isHost);
  elements.startGameBtn.disabled = room.players.length < 3;
  elements.startHint.textContent = room.players.length < 3
    ? `최소 3명이 필요해요. ${3 - room.players.length}명 더 기다려 주세요.`
    : `${room.players.length}명이 준비됐어요. 게임을 시작할 수 있습니다.`;
}

function renderRole(room) {
  const readyPlayers = room.players.filter((player) => player.ready).length;
  elements.roundLabel.textContent = `ROUND ${String(room.round).padStart(2, "0")} · SECRET ROLE`;
  elements.readyCount.textContent = `${readyPlayers} / ${room.players.length}`;
  elements.readyBar.style.width = `${(readyPlayers / room.players.length) * 100}%`;

  if (room.self.ready) state.roleRevealed = true;
  elements.revealRoleBtn.classList.toggle("hidden", state.roleRevealed);
  elements.roleCard.classList.toggle("hidden", !state.roleRevealed);
  if (!state.roleRevealed || !room.role) return;

  elements.roleCard.classList.toggle("liar", room.role.isLiar);
  if (room.role.isLiar) {
    elements.roleKicker.textContent = "YOU ARE THE LIAR";
    elements.roleTitle.textContent = "당신은 라이어입니다";
    elements.roleWordLabel.textContent = "제시어의 카테고리";
    elements.roleWord.textContent = room.role.category;
    elements.roleHint.textContent = "다른 사람의 설명을 듣고 제시어를 아는 척하세요. 정체를 들키면 패배합니다.";
  } else {
    elements.roleKicker.textContent = "YOU ARE A CITIZEN";
    elements.roleTitle.textContent = "당신은 시민입니다";
    elements.roleWordLabel.textContent = `${room.role.category} · 제시어`;
    elements.roleWord.textContent = room.role.word;
    elements.roleHint.textContent = "제시어를 직접 말하지 않으면서 라이어가 알아채기 어렵게 설명하세요.";
  }
  elements.readyBtn.disabled = room.self.ready;
  elements.readyBtn.textContent = room.self.ready ? "다른 플레이어 기다리는 중…" : "확인 완료";
}

function formatTime(totalSeconds) {
  const seconds = Math.max(0, Math.ceil(totalSeconds));
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function updateTimer() {
  if (!state.room || state.room.phase !== "discussion") return;
  const remaining = Math.max(0, (state.room.timerEndsAt - Date.now()) / 1000);
  elements.timer.textContent = formatTime(remaining);
  elements.timerRing.style.setProperty("--progress", remaining / state.room.timerDuration);
}

function renderDiscussion(room) {
  elements.discussionPlayerList.replaceChildren(...room.players.map((player) => {
    const chip = document.createElement("span");
    chip.className = "mini-player";
    chip.textContent = player.id === state.playerId ? `${player.name} · 나` : player.name;
    return chip;
  }));
  elements.openVoteBtn.classList.toggle("hidden", !room.isHost);
  elements.discussionWait.classList.toggle("hidden", room.isHost);
  updateTimer();
  if (!state.timerId) state.timerId = window.setInterval(updateTimer, 250);
}

function renderVoting(room) {
  const votedCount = room.players.filter((player) => player.voted).length;
  const buttons = room.players
    .filter((player) => player.id !== state.playerId)
    .map((player, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "vote-player";
      button.dataset.number = String(index + 1).padStart(2, "0");
      button.textContent = player.name;
      button.disabled = room.self.voted;
      button.addEventListener("click", () => submitVote(player.id, button));
      return button;
    });
  elements.voteList.replaceChildren(...buttons);
  elements.voteWait.classList.toggle("hidden", !room.self.voted);
  elements.voteWaitText.textContent = `투표 완료 · ${votedCount} / ${room.players.length}명 참여`;
}

function resultRow(label, value, answer = false) {
  const row = document.createElement("div");
  row.className = "result-row";
  const labelNode = document.createElement("span");
  labelNode.textContent = label;
  const valueNode = document.createElement("strong");
  valueNode.className = answer ? "answer" : "";
  valueNode.textContent = value;
  row.append(labelNode, valueNode);
  return row;
}

function renderResults(room) {
  const citizensWin = room.result.caught;
  elements.resultIcon.classList.toggle("lose", !citizensWin);
  elements.resultIcon.textContent = citizensWin ? "✓" : "!";
  elements.resultKicker.textContent = citizensWin ? "LIAR FOUND" : "LIAR ESCAPED";
  elements.resultTitle.innerHTML = citizensWin ? "시민 팀의<br /><em>승리!</em>" : "라이어의<br /><em>승리!</em>";
  elements.resultContent.replaceChildren(
    resultRow("진짜 라이어", room.result.liarName),
    resultRow("카테고리", room.result.category),
    resultRow("제시어", room.result.word, true),
  );

  const highestVotes = Math.max(1, ...room.players.map((player) => player.votesReceived || 0));
  const summary = [...room.players]
    .sort((a, b) => (b.votesReceived || 0) - (a.votesReceived || 0))
    .map((player) => {
      const row = document.createElement("div");
      row.className = "vote-summary-row";
      const name = document.createElement("span");
      name.className = "vote-summary-name";
      name.textContent = player.id === room.result.liarId ? `${player.name} · 라이어` : player.name;
      const count = document.createElement("span");
      count.className = "vote-summary-count";
      count.textContent = `${player.votesReceived || 0}표`;
      const meter = document.createElement("div");
      meter.className = "vote-meter";
      const fill = document.createElement("span");
      fill.style.width = `${((player.votesReceived || 0) / highestVotes) * 100}%`;
      meter.appendChild(fill);
      row.append(name, count, meter);
      return row;
    });
  elements.voteSummary.replaceChildren(...summary);
  elements.restartBtn.classList.toggle("hidden", !room.isHost);
  elements.restartWait.classList.toggle("hidden", room.isHost);
}

function renderRoom(room) {
  const phaseChanged = state.previousPhase !== room.phase;
  if (phaseChanged && room.phase === "role") state.roleRevealed = false;
  if (phaseChanged && room.phase !== "discussion" && state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }

  state.room = room;
  state.previousPhase = room.phase;
  const screenByPhase = {
    lobby: "lobby-screen",
    role: "role-screen",
    discussion: "discussion-screen",
    voting: "vote-screen",
    results: "result-screen",
  };
  showScreen(screenByPhase[room.phase] || "home-screen");

  if (room.phase === "lobby") renderLobby(room);
  if (room.phase === "role") renderRole(room);
  if (room.phase === "discussion") renderDiscussion(room);
  if (room.phase === "voting") renderVoting(room);
  if (room.phase === "results") renderResults(room);
}

async function roomAction(path, extra = {}) {
  return requestJson(`/api/rooms/${state.roomCode}${path}`, {
    method: "POST",
    body: credentialsBody(extra),
  });
}

async function startGame() {
  setBusy(elements.startGameBtn, true, "역할 나누는 중…");
  try {
    await roomAction("/start");
  } catch (error) {
    showToast(error.message);
    setBusy(elements.startGameBtn, false);
  }
}

async function markReady() {
  setBusy(elements.readyBtn, true, "확인 처리 중…");
  try {
    await roomAction("/ready");
  } catch (error) {
    showToast(error.message);
    setBusy(elements.readyBtn, false);
  }
}

async function openVoting() {
  setBusy(elements.openVoteBtn, true, "투표 여는 중…");
  try {
    await roomAction("", { action: "open-voting" });
  } catch (error) {
    showToast(error.message);
    setBusy(elements.openVoteBtn, false);
  }
}

async function submitVote(targetId, button) {
  const buttons = [...elements.voteList.querySelectorAll("button")];
  buttons.forEach((candidate) => { candidate.disabled = true; });
  button.textContent = "선택 완료";
  try {
    await roomAction("/vote", { targetId });
  } catch (error) {
    showToast(error.message);
    buttons.forEach((candidate) => { candidate.disabled = false; });
  }
}

async function restartGame() {
  setBusy(elements.restartBtn, true, "새 게임 준비 중…");
  try {
    await roomAction("/restart");
  } catch (error) {
    showToast(error.message);
    setBusy(elements.restartBtn, false);
  }
}

async function copyInviteLink() {
  const link = `${location.origin}/?room=${state.roomCode}`;
  try {
    await navigator.clipboard.writeText(link);
    showToast("초대 링크를 복사했습니다.");
  } catch {
    const input = document.createElement("textarea");
    input.value = link;
    document.body.appendChild(input);
    input.select();
    document.execCommand("copy");
    input.remove();
    showToast("초대 링크를 복사했습니다.");
  }
}

elements.createRoomBtn.addEventListener("click", createRoom);
elements.joinRoomBtn.addEventListener("click", joinRoom);
elements.copyLinkBtn.addEventListener("click", copyInviteLink);
elements.startGameBtn.addEventListener("click", startGame);
elements.revealRoleBtn.addEventListener("click", () => {
  state.roleRevealed = true;
  renderRole(state.room);
});
elements.readyBtn.addEventListener("click", markReady);
elements.openVoteBtn.addEventListener("click", openVoting);
elements.restartBtn.addEventListener("click", restartGame);
elements.homeBtn.addEventListener("click", () => {
  if (state.roomCode) {
    showToast("현재 방은 이 탭을 닫으면 나갈 수 있어요.");
    return;
  }
  clearCurrentSession();
});

elements.roomCodeInput.addEventListener("input", () => {
  elements.roomCodeInput.value = cleanRoomCode(elements.roomCodeInput.value);
  elements.homeError.textContent = "";
});
[elements.hostName, elements.joinName].forEach((input) => {
  input.addEventListener("input", () => { elements.homeError.textContent = ""; });
  input.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (input === elements.hostName) createRoom();
    else joinRoom();
  });
});

window.addEventListener("beforeunload", () => state.eventSource?.close());

const lastName = localStorage.getItem("liar-last-name") || "";
elements.hostName.value = lastName;
elements.joinName.value = lastName;
const initialCode = cleanRoomCode(new URL(location.href).searchParams.get("room"));
if (initialCode) {
  elements.roomCodeInput.value = initialCode;
  const saved = getSavedSession(initialCode);
  if (saved?.playerId && saved?.token) restoreSession(initialCode, saved);
  else showScreen("home-screen");
}
