// 이 파일은 가상 리모컨의 안내 문구와 색상만 동기화합니다.
// 에어컨 상태, 미션 판정, 포인트 지급은 기존 app.js 로직을 그대로 사용합니다.
(function initializeEcoRemotePresentation() {
  const remote = document.querySelector("#eco-remote");
  const display = document.querySelector("#remote-display");
  const temperatureOutput = document.querySelector("#temperature-output");
  const modeSelect = document.querySelector("#mode-select");
  const powerButton = document.querySelector("#power-button");
  const operationLabel = document.querySelector("#remote-operation-label");
  const modeLabel = document.querySelector("#remote-mode-label");
  const ecoMessage = document.querySelector("#remote-eco-message");
  const speech = document.querySelector("#remote-speech");
  const detailMode = document.querySelector("#detail-mode");

  if (!remote || !display || !temperatureOutput || !modeSelect || !powerButton) return;

  const modeLabels = {
    cool: "냉방 · ECO",
    dry: "제습 · 쾌적",
    fan: "송풍 · 산뜻",
  };

  /** 기존 시뮬레이션이 렌더링한 값만 읽어 리모컨 안내 UI에 반영합니다. */
  function syncRemotePresentation() {
    const temperature = Number.parseInt(temperatureOutput.textContent, 10);
    const isPowered = powerButton.getAttribute("aria-pressed") === "true";
    const isEcoTemperature = isPowered && modeSelect.value === "cool" && temperature === 26;

    remote.classList.toggle("is-powered-off", !isPowered);
    display.classList.toggle("is-eco-temperature", isEcoTemperature);
    operationLabel.textContent = isPowered ? "절전 운전 중" : "운전 대기 중";
    modeLabel.textContent = isPowered ? modeLabels[modeSelect.value] || "ECO AIR" : "전원 OFF";
    ecoMessage.hidden = !isEcoTemperature;

    if (!isPowered) {
      speech.innerHTML = "<strong>전원을 켜볼까요?</strong><span>준비되면 절전 미션을 시작해요.</span>";
    } else if (temperature < 26) {
      speech.innerHTML = "<strong>조금만 높여볼까요?</strong><span>26℃면 더 알뜰하게 시원해요.</span>";
    } else if (isEcoTemperature) {
      speech.innerHTML = "<strong>완벽해요! 🌱</strong><span>지구가 좋아하고 있어요!</span>";
    } else if (modeSelect.value === "cool") {
      speech.innerHTML = "<strong>26℃로 맞춰볼까요?</strong><span>오늘의 절전 미션에 도전해요.</span>";
    } else {
      speech.innerHTML = "<strong>산뜻한 바람이에요! 🍃</strong><span>필요한 만큼만 시원하게 사용해요.</span>";
    }
  }

  modeSelect.addEventListener("change", syncRemotePresentation);

  // 기존 app.js가 화면 값을 바꿀 때만 감지하며 기기나 미션 상태는 수정하지 않습니다.
  new MutationObserver(syncRemotePresentation).observe(temperatureOutput, { childList: true, characterData: true, subtree: true });
  new MutationObserver(syncRemotePresentation).observe(powerButton, { attributes: true, attributeFilter: ["aria-pressed"] });
  if (detailMode) new MutationObserver(syncRemotePresentation).observe(detailMode, { childList: true, characterData: true, subtree: true });

  syncRemotePresentation();
})();
