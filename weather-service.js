// Carrier GreenON 날씨 서비스
// 현재는 교육용 샘플을 사용하며, 나중에 서버 프록시 URL만 설정하면 실제 응답으로 교체할 수 있습니다.
(function initializeWeatherService() {
  const SAMPLE_WEATHER = {
    location: "서울",
    temperature: 29,
    humidity: 62,
    condition: "sunny",
    source: "sample",
    observedAt: new Date().toISOString(),
  };

  /** 온도와 습도를 친근한 한글 상태 문구로 바꿉니다. */
  function getConditionLabel(weather) {
    if (weather.temperature >= 32) return "무척 더워요";
    if (weather.humidity >= 75) return "덥고 습해요";
    if (weather.temperature >= 28) return "맑고 더워요";
    return "선선하고 쾌적해요";
  }

  /** 서버 프록시 응답이 화면에 사용하기 안전한 숫자 범위인지 확인합니다. */
  function normalizeWeather(payload) {
    const temperature = Number(payload.temperature);
    const humidity = Number(payload.humidity);
    if (!Number.isFinite(temperature) || !Number.isFinite(humidity) || humidity < 0 || humidity > 100) {
      throw new Error("INVALID_WEATHER_RESPONSE");
    }

    return {
      location: String(payload.location || "현재 위치"),
      temperature: Math.round(temperature),
      humidity: Math.round(humidity),
      condition: String(payload.condition || "unknown"),
      source: "api",
      observedAt: payload.observedAt || new Date().toISOString(),
    };
  }

  /** 설정된 서버 프록시가 없거나 실패하면 앱이 멈추지 않도록 샘플 날씨를 반환합니다. */
  async function getCurrentWeather() {
    const apiUrl = window.GREENON_CONFIG?.weatherApiUrl;
    if (!apiUrl) return { ...SAMPLE_WEATHER, conditionLabel: getConditionLabel(SAMPLE_WEATHER) };

    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(apiUrl, { headers: { Accept: "application/json" }, signal: controller.signal });
      if (!response.ok) throw new Error(`WEATHER_API_${response.status}`);
      const weather = normalizeWeather(await response.json());
      return { ...weather, conditionLabel: getConditionLabel(weather) };
    } catch (error) {
      console.warn("날씨 API를 불러오지 못해 샘플 데이터를 사용합니다.", error);
      return { ...SAMPLE_WEATHER, source: "fallback", conditionLabel: getConditionLabel(SAMPLE_WEATHER) };
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  window.greenOnWeather = { getCurrentWeather };
})();
