const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const port = Number(process.env.PORT) || 4173;
const root = __dirname;
const rooms = new Map();
const roomAlphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const maxBodyBytes = 20_000;

const words = [
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

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
};

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function apiError(response, status, message) {
  sendJson(response, status, { error: message });
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > maxBodyBytes) {
        reject(new Error("요청 데이터가 너무 큽니다."));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error("올바르지 않은 요청입니다."));
      }
    });
    request.on("error", reject);
  });
}

function cleanName(value) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, 12);
}

function cleanCode(value) {
  return String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
}

function makeRoomCode() {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    let code = "";
    for (let index = 0; index < 5; index += 1) {
      code += roomAlphabet[crypto.randomInt(roomAlphabet.length)];
    }
    if (!rooms.has(code)) return code;
  }
  throw new Error("방 코드를 만들 수 없습니다.");
}

function makePlayer(name) {
  return {
    id: crypto.randomUUID(),
    token: crypto.randomBytes(24).toString("hex"),
    name,
    ready: false,
    vote: null,
    lastSeen: Date.now(),
    clients: new Set(),
  };
}

function findPlayer(room, playerId, token) {
  const player = room?.players.find((candidate) => candidate.id === playerId);
  const suppliedToken = String(token || "");
  if (!player || !/^[a-f0-9]{48}$/.test(suppliedToken) || !crypto.timingSafeEqual(Buffer.from(player.token), Buffer.from(suppliedToken))) {
    return null;
  }
  player.lastSeen = Date.now();
  return player;
}

function authenticate(room, body) {
  return findPlayer(room, String(body.playerId || ""), String(body.token || ""));
}

function pickWord(previous) {
  let selected;
  do {
    selected = words[crypto.randomInt(words.length)];
  } while (words.length > 1 && previous && selected.word === previous.word);
  return selected;
}

function finishVote(room) {
  const counts = new Map(room.players.map((player) => [player.id, 0]));
  room.players.forEach((player) => {
    if (player.vote && counts.has(player.vote)) counts.set(player.vote, counts.get(player.vote) + 1);
  });

  const highest = Math.max(...counts.values());
  const topIds = [...counts.entries()].filter(([, count]) => count === highest).map(([id]) => id);
  const caught = topIds.length === 1 && topIds[0] === room.liarId;
  room.result = { caught, counts };
  room.phase = "results";
  room.timerEndsAt = null;
}

function refreshRoom(room) {
  if (room.phase === "discussion" && room.timerEndsAt && Date.now() >= room.timerEndsAt) {
    room.phase = "voting";
    room.timerEndsAt = null;
    return true;
  }
  return false;
}

function publicState(room, viewer) {
  refreshRoom(room);
  const now = Date.now();
  const showResults = room.phase === "results";
  const roleAvailable = room.phase !== "lobby" && room.selectedWord;

  return {
    code: room.code,
    phase: room.phase,
    round: room.round,
    timerDuration: room.timerDuration,
    timerEndsAt: room.timerEndsAt,
    isHost: viewer.id === room.hostId,
    self: {
      id: viewer.id,
      name: viewer.name,
      ready: viewer.ready,
      voted: Boolean(viewer.vote),
    },
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      isHost: player.id === room.hostId,
      online: player.clients.size > 0 || now - player.lastSeen < 30_000,
      ready: player.ready,
      voted: Boolean(player.vote),
      votesReceived: showResults ? room.result.counts.get(player.id) || 0 : undefined,
    })),
    role: roleAvailable
      ? {
          isLiar: viewer.id === room.liarId,
          category: room.selectedWord.category,
          word: viewer.id === room.liarId ? null : room.selectedWord.word,
        }
      : null,
    result: showResults
      ? {
          caught: room.result.caught,
          liarId: room.liarId,
          liarName: room.players.find((player) => player.id === room.liarId)?.name || "",
          category: room.selectedWord.category,
          word: room.selectedWord.word,
        }
      : null,
  };
}

function sendEvent(response, state) {
  response.write(`event: state\ndata: ${JSON.stringify(state)}\n\n`);
}

function broadcast(room) {
  for (const player of room.players) {
    const state = publicState(room, player);
    for (const response of [...player.clients]) {
      try {
        sendEvent(response, state);
      } catch {
        player.clients.delete(response);
      }
    }
  }
}

function createRoom(response, body, request) {
  const name = cleanName(body.name);
  if (!name) return apiError(response, 400, "이름을 입력해 주세요.");

  const timerDuration = [60, 120, 180, 300].includes(Number(body.timerDuration)) ? Number(body.timerDuration) : 180;
  const host = makePlayer(name);
  const code = makeRoomCode();
  const room = {
    code,
    hostId: host.id,
    players: [host],
    phase: "lobby",
    round: 1,
    timerDuration,
    timerEndsAt: null,
    liarId: null,
    selectedWord: null,
    result: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  rooms.set(code, room);

  const protocol = request.headers["x-forwarded-proto"] || "http";
  const hostName = request.headers["x-forwarded-host"] || request.headers.host;
  sendJson(response, 201, {
    roomCode: code,
    playerId: host.id,
    token: host.token,
    shareUrl: `${protocol}://${hostName}/?room=${code}`,
  });
}

function joinRoom(response, room, body) {
  if (room.phase !== "lobby") return apiError(response, 409, "이미 게임이 시작된 방입니다.");
  if (room.players.length >= 8) return apiError(response, 409, "방이 가득 찼습니다.");

  const name = cleanName(body.name);
  if (!name) return apiError(response, 400, "이름을 입력해 주세요.");
  if (room.players.some((player) => player.name.toLocaleLowerCase("ko-KR") === name.toLocaleLowerCase("ko-KR"))) {
    return apiError(response, 409, "이미 사용 중인 이름입니다.");
  }

  const player = makePlayer(name);
  room.players.push(player);
  room.updatedAt = Date.now();
  sendJson(response, 201, { roomCode: room.code, playerId: player.id, token: player.token });
  broadcast(room);
}

function startRound(response, room, player) {
  if (player.id !== room.hostId) return apiError(response, 403, "방장만 게임을 시작할 수 있습니다.");
  if (room.phase !== "lobby") return apiError(response, 409, "지금은 게임을 시작할 수 없습니다.");
  if (room.players.length < 3) return apiError(response, 409, "최소 3명이 필요합니다.");

  room.liarId = room.players[crypto.randomInt(room.players.length)].id;
  room.selectedWord = pickWord(room.selectedWord);
  room.players.forEach((participant) => {
    participant.ready = false;
    participant.vote = null;
  });
  room.result = null;
  room.timerEndsAt = null;
  room.phase = "role";
  room.updatedAt = Date.now();
  sendJson(response, 200, { ok: true });
  broadcast(room);
}

function markReady(response, room, player) {
  if (room.phase !== "role") return apiError(response, 409, "역할 확인 단계가 아닙니다.");
  player.ready = true;
  if (room.players.every((participant) => participant.ready)) {
    room.phase = "discussion";
    room.timerEndsAt = Date.now() + room.timerDuration * 1000;
  }
  room.updatedAt = Date.now();
  sendJson(response, 200, { ok: true });
  broadcast(room);
}

function openVoting(response, room, player) {
  if (player.id !== room.hostId) return apiError(response, 403, "방장만 투표를 시작할 수 있습니다.");
  if (room.phase !== "discussion") return apiError(response, 409, "토론 단계가 아닙니다.");
  room.phase = "voting";
  room.timerEndsAt = null;
  room.updatedAt = Date.now();
  sendJson(response, 200, { ok: true });
  broadcast(room);
}

function castVote(response, room, player, targetId) {
  refreshRoom(room);
  if (room.phase !== "voting") return apiError(response, 409, "투표 단계가 아닙니다.");
  if (targetId === player.id) return apiError(response, 400, "자신에게는 투표할 수 없습니다.");
  if (!room.players.some((candidate) => candidate.id === targetId)) return apiError(response, 400, "플레이어를 찾을 수 없습니다.");

  player.vote = targetId;
  if (room.players.every((participant) => participant.vote)) finishVote(room);
  room.updatedAt = Date.now();
  sendJson(response, 200, { ok: true });
  broadcast(room);
}

function restartRoom(response, room, player) {
  if (player.id !== room.hostId) return apiError(response, 403, "방장만 새 게임을 준비할 수 있습니다.");
  if (room.phase !== "results") return apiError(response, 409, "아직 게임이 끝나지 않았습니다.");
  room.phase = "lobby";
  room.round += 1;
  room.liarId = null;
  room.result = null;
  room.timerEndsAt = null;
  room.players.forEach((participant) => {
    participant.ready = false;
    participant.vote = null;
  });
  room.updatedAt = Date.now();
  sendJson(response, 200, { ok: true });
  broadcast(room);
}

function openEvents(request, response, room, url) {
  const player = findPlayer(room, url.searchParams.get("playerId"), url.searchParams.get("token"));
  if (!player) return apiError(response, 401, "참가 정보를 확인할 수 없습니다.");

  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  response.write("retry: 2000\n\n");
  player.clients.add(response);
  player.lastSeen = Date.now();
  sendEvent(response, publicState(room, player));
  broadcast(room);

  const heartbeat = setInterval(() => {
    player.lastSeen = Date.now();
    response.write(": heartbeat\n\n");
  }, 15_000);

  request.on("close", () => {
    clearInterval(heartbeat);
    player.clients.delete(response);
    player.lastSeen = Date.now();
    setTimeout(() => broadcast(room), 2_000).unref();
  });
}

async function handleApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/health") {
    return sendJson(response, 200, { ok: true, rooms: rooms.size });
  }

  if (request.method === "POST" && url.pathname === "/api/rooms") {
    try {
      return createRoom(response, await readJson(request), request);
    } catch (error) {
      return apiError(response, 400, error.message);
    }
  }

  const match = url.pathname.match(/^\/api\/rooms\/([A-Z0-9]{5})(?:\/(join|events|start|ready|vote|restart))?$/);
  if (!match) return apiError(response, 404, "API를 찾을 수 없습니다.");

  const room = rooms.get(match[1]);
  if (!room) return apiError(response, 404, "방을 찾을 수 없습니다.");
  const action = match[2];

  if (request.method === "GET" && action === "events") return openEvents(request, response, room, url);
  if (request.method === "GET" && !action) {
    const player = findPlayer(room, url.searchParams.get("playerId"), url.searchParams.get("token"));
    if (!player) return apiError(response, 401, "참가 정보를 확인할 수 없습니다.");
    return sendJson(response, 200, publicState(room, player));
  }
  if (request.method !== "POST") return apiError(response, 405, "허용되지 않은 요청입니다.");

  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    return apiError(response, 400, error.message);
  }

  if (action === "join") return joinRoom(response, room, body);
  const player = authenticate(room, body);
  if (!player) return apiError(response, 401, "참가 정보를 확인할 수 없습니다.");

  if (action === "start") return startRound(response, room, player);
  if (action === "ready") return markReady(response, room, player);
  if (action === "vote") return castVote(response, room, player, String(body.targetId || ""));
  if (action === "restart") return restartRoom(response, room, player);
  if (!action && body.action === "open-voting") return openVoting(response, room, player);
  return apiError(response, 404, "동작을 찾을 수 없습니다.");
}

function serveFile(response, url) {
  const requestedPath = url.pathname === "/" ? "index.html" : decodeURIComponent(url.pathname.slice(1));
  const filePath = path.resolve(root, requestedPath);
  if (!filePath.startsWith(`${root}${path.sep}`) && filePath !== path.join(root, "index.html")) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": path.extname(filePath) === ".html" ? "no-cache" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "same-origin",
    });
    response.end(data);
  });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(request, response, url);
    return;
  }
  serveFile(response, url);
});

setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms) {
    if (now - room.updatedAt > 4 * 60 * 60 * 1000) {
      for (const player of room.players) {
        for (const response of player.clients) response.end();
      }
      rooms.delete(code);
      continue;
    }
    if (room.phase === "discussion") {
      refreshRoom(room);
      broadcast(room);
    }
  }
}, 1000).unref();

server.listen(port, "0.0.0.0", () => {
  console.log(`Liar Game Online: http://0.0.0.0:${port}`);
});
