// Supabase 호출을 앱 화면 코드와 분리한 작은 데이터 서비스입니다.
// PHASE 8에서는 localStorage 호출을 이 서비스의 데이터 함수로 완전히 교체합니다.
(function initializeGreenOnSupabase() {
  const config = window.GREENON_CONFIG;
  const createClient = window.supabase?.createClient;

  if (!config?.supabaseUrl || !config?.supabasePublishableKey || !createClient) {
    console.warn("Supabase 설정 또는 라이브러리를 찾지 못해 데모 모드로 실행합니다.");
    window.greenOnSupabase = null;
    return;
  }

  const client = createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  /** 브라우저 주소일 때만 이메일 확인 후 돌아올 URL을 전달합니다. */
  function getEmailRedirectUrl() {
    if (!window.location.protocol.startsWith("http")) return undefined;
    return `${window.location.origin}${window.location.pathname}#my`;
  }

  /** 현재 로그인 세션을 확인합니다. */
  async function getSession() {
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  }

  /** 이메일 회원가입을 요청하고 표시 이름은 안전한 프로필 생성용 metadata로만 전달합니다. */
  async function signUp({ name, email, password }) {
    const emailRedirectTo = getEmailRedirectUrl();
    const options = { data: { display_name: name } };
    if (emailRedirectTo) options.emailRedirectTo = emailRedirectTo;

    const { data, error } = await client.auth.signUp({ email, password, options });
    if (error) throw error;
    return data;
  }

  /** 이메일과 비밀번호로 로그인합니다. 비밀번호는 앱에서 별도로 저장하지 않습니다. */
  async function signIn({ email, password }) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  /** 현재 기기의 Supabase 세션을 종료합니다. */
  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) throw error;
  }

  /** RLS가 적용된 현재 사용자 프로필을 읽습니다. */
  async function getProfile() {
    const { data, error } = await client.from("profiles").select("id, display_name, green_points, green_level").single();
    if (error) throw error;
    return data;
  }

  /** 로그인한 사용자의 GreenON 화면 데이터 전체를 RLS 범위 안에서 불러옵니다. */
  async function loadAppData(today) {
    const [profileResult, missionsResult, userMissionResult, transactionsResult, rewardsResult, ordersResult, airconResult] =
      await Promise.all([
        client.from("profiles").select("id, display_name, green_points, green_level").single(),
        client.from("missions").select("id, code, title, description, target_minutes, reward_points, required_mode, required_temperature").eq("is_active", true).order("id").limit(1),
        client.from("user_missions").select("id, mission_id, mission_date, status, elapsed_minutes, failure_reason, started_at, completed_at").eq("mission_date", today).maybeSingle(),
        client.from("point_transactions").select("id, transaction_type, amount, balance_after, source, source_id, description, created_at").order("created_at", { ascending: false }),
        client.from("rewards").select("id, code, category, name, description, price, emoji, color, stock").eq("is_active", true).order("id"),
        client.from("reward_orders").select("id, reward_id, product_name, product_emoji, points_spent, status, created_at").order("created_at", { ascending: false }),
        client.from("aircon_status").select("user_id, power, mode, set_temperature, fan, runtime_minutes, filter_life, sensor_error, updated_at").single(),
      ]);

    const results = [profileResult, missionsResult, userMissionResult, transactionsResult, rewardsResult, ordersResult, airconResult];
    const failedResult = results.find((result) => result.error);
    if (failedResult) throw failedResult.error;

    return {
      profile: profileResult.data,
      missions: missionsResult.data,
      userMission: userMissionResult.data,
      transactions: transactionsResult.data,
      rewards: rewardsResult.data,
      orders: ordersResult.data,
      aircon: airconResult.data,
    };
  }

  /** 현재 사용자의 가상 에어컨 상태만 갱신합니다. user_id는 세션에서 가져옵니다. */
  async function updateAirconStatus(state) {
    const session = await getSession();
    if (!session?.user) throw new Error("AUTHENTICATION_REQUIRED");

    const { data, error } = await client
      .from("aircon_status")
      .update({
        power: state.power,
        mode: state.mode,
        set_temperature: state.temperature,
        fan: state.fan,
        runtime_minutes: state.runtimeMinutes,
        filter_life: state.filterLife,
        sensor_error: state.sensorError,
      })
      .eq("user_id", session.user.id)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  /** 인증 사용자 전용 RPC로 오늘의 미션을 시작합니다. */
  async function startMission(missionId, missionDate) {
    const { data, error } = await client.rpc("start_green_mission", {
      p_mission_id: missionId,
      p_mission_date: missionDate,
    });
    if (error) throw error;
    return data;
  }

  /** 30분 시뮬레이션과 미션 성공·실패·포인트 지급을 원자적으로 처리합니다. */
  async function advanceMission(userMissionId) {
    const { data, error } = await client.rpc("advance_green_mission", {
      p_user_mission_id: userMissionId,
      p_minutes: 30,
    });
    if (error) throw error;
    return data;
  }

  /** 포인트 확인, 차감, 거래 기록, 주문 생성을 데이터베이스 한 트랜잭션에서 처리합니다. */
  async function purchaseReward(rewardId) {
    const { data, error } = await client.rpc("purchase_reward", { p_reward_id: rewardId });
    if (error) throw error;
    return data;
  }

  window.greenOnSupabase = {
    client,
    getSession,
    signUp,
    signIn,
    signOut,
    getProfile,
    loadAppData,
    updateAirconStatus,
    startMission,
    advanceMission,
    purchaseReward,
  };
})();
