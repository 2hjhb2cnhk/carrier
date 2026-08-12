// 화면 위의 장식만 담당하며 미션, 포인트, 로그인 데이터에는 접근하지 않습니다.
(function initializeSnowMotion() {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const finePointer = window.matchMedia("(pointer: fine)");

  // 움직임 최소화 설정을 사용하는 분에게는 눈 효과를 만들지 않습니다.
  if (reducedMotion.matches) return;

  const snowLayer = document.createElement("div");
  snowLayer.className = "snowfall-layer";
  snowLayer.setAttribute("aria-hidden", "true");
  document.body.append(snowLayer);

  const snowShapes = ["❄", "✦", "•"];
  const maximumSnowflakes = finePointer.matches ? 52 : 24;
  let lastPointerSnowTime = 0;

  /** 지정한 위치에서 아래로 흩날리는 눈송이 하나를 만듭니다. */
  function createSnowflake(options = {}) {
    if (snowLayer.childElementCount >= maximumSnowflakes || document.hidden) return;

    const fromPointer = options.fromPointer === true;
    const snowflake = document.createElement("span");
    const size = fromPointer ? 9 + Math.random() * 10 : 8 + Math.random() * 13;
    const startX = fromPointer ? options.x + (Math.random() - 0.5) * 28 : Math.random() * window.innerWidth;
    const startY = fromPointer ? options.y + (Math.random() - 0.5) * 18 : -28;
    const duration = fromPointer ? 1800 + Math.random() * 1500 : 4800 + Math.random() * 3500;
    const drift = (Math.random() - 0.5) * (fromPointer ? 110 : 180);
    const fallDistance = fromPointer ? 180 + Math.random() * 280 : window.innerHeight + 70;

    snowflake.className = `snowflake${fromPointer ? " snowflake--pointer" : ""}`;
    snowflake.textContent = snowShapes[Math.floor(Math.random() * snowShapes.length)];
    snowflake.style.setProperty("--snow-x", `${startX}px`);
    snowflake.style.setProperty("--snow-y", `${startY}px`);
    snowflake.style.setProperty("--snow-size", `${size}px`);
    snowflake.style.setProperty("--snow-duration", `${duration}ms`);
    snowflake.style.setProperty("--snow-drift", `${drift}px`);
    snowflake.style.setProperty("--snow-fall", `${fallDistance}px`);
    snowflake.style.setProperty("--snow-spin", `${180 + Math.random() * 420}deg`);

    snowflake.addEventListener("animationend", () => snowflake.remove(), { once: true });
    snowLayer.append(snowflake);
  }

  /** 마우스를 움직일 때 과하지 않은 간격으로 눈송이를 남깁니다. */
  function handlePointerMove(event) {
    if (!finePointer.matches || event.pointerType === "touch") return;

    const currentTime = performance.now();
    if (currentTime - lastPointerSnowTime < 70) return;
    lastPointerSnowTime = currentTime;

    createSnowflake({ fromPointer: true, x: event.clientX, y: event.clientY });
    if (Math.random() > 0.55) {
      createSnowflake({ fromPointer: true, x: event.clientX, y: event.clientY });
    }
  }

  // 배경에는 적은 양의 눈이 내리고, 마우스 주변에는 조금 더 선명한 눈이 생깁니다.
  const ambientSnowTimer = window.setInterval(() => createSnowflake(), finePointer.matches ? 430 : 760);
  window.addEventListener("pointermove", handlePointerMove, { passive: true });
  window.addEventListener(
    "beforeunload",
    () => {
      window.clearInterval(ambientSnowTimer);
      window.removeEventListener("pointermove", handlePointerMove);
    },
    { once: true },
  );
})();
