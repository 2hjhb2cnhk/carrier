// Carrier GreenON의 화면 이름과 문서 제목을 한곳에서 관리합니다.
// 이후 기능을 추가할 때도 이 객체에 화면 정보를 더하면 일관된 제목을 사용할 수 있습니다.
const PAGE_TITLES = {
  home: "Carrier GreenON",
  mission: "GREEN MISSION | Carrier GreenON",
  wallet: "GREEN WALLET | Carrier GreenON",
  shop: "GREEN REWARD SHOP | Carrier GreenON",
  my: "MY GreenON | Carrier GreenON",
};

const pages = Array.from(document.querySelectorAll("[data-page]"));
const navigationButtons = Array.from(document.querySelectorAll("[data-page-target]"));
const directMoveButtons = Array.from(document.querySelectorAll("[data-go-page]"));
const notificationButton = document.querySelector(".notification-button");
const toast = document.querySelector("#toast");
let toastTimer;
const weatherElements = {
  temperature: document.querySelector("#weather-temperature"),
  humidity: document.querySelector("#weather-humidity"),
  condition: document.querySelector("#weather-condition"),
  location: document.querySelector("#weather-location"),
  source: document.querySelector("#weather-source"),
  refresh: document.querySelector("#weather-refresh"),
  recommendation: document.querySelector("#weather-mission-recommendation"),
};

// 실제 에어컨 API 대신 사용할 가상 기기의 초기값입니다.
// 추후 Supabase 단계에서는 이 데이터의 저장 위치만 데이터베이스로 교체합니다.
const DEFAULT_AIRCON_STATE = {
  power: true,
  mode: "cool",
  temperature: 26,
  fan: "auto",
  runtimeMinutes: 0,
  filterLife: 72,
  sensorError: false,
};

const MODE_LABELS = { cool: "냉방", dry: "제습", fan: "송풍" };
const FAN_LABELS = { auto: "자동풍", low: "약풍", medium: "중풍", high: "강풍" };
const AIRCON_STORAGE_KEY = "carrier-greenon-aircon";
const MISSION_STORAGE_KEY = "carrier-greenon-mission";
const WALLET_STORAGE_KEY = "carrier-greenon-wallet";
const ORDER_STORAGE_KEY = "carrier-greenon-orders";
const DEMO_PROFILE_STORAGE_KEY = "carrier-greenon-demo-profile";
const DEMO_SESSION_STORAGE_KEY = "carrier-greenon-demo-session";

// 실제 제휴 상품 API 대신 사용하는 GREEN REWARD 상품 목록입니다.
const REWARD_PRODUCTS = [
  { id: "food-tumbler-drink", category: "FOOD", name: "카페 텀블러 음료 쿠폰", description: "개인 텀블러와 함께 사용할 수 있는 시원한 음료 쿠폰이에요.", price: 100, icon: "🥤", color: "#e8f5ff" },
  { id: "food-salad", category: "FOOD", name: "로컬 채소 샐러드", description: "가까운 농장에서 온 제철 채소로 만든 건강한 한 끼예요.", price: 180, icon: "🥗", color: "#e8faef" },
  { id: "life-bag", category: "LIFE", name: "GreenON 리유저블 백", description: "장보기와 나들이에 가볍게 쓰는 튼튼한 다회용 가방이에요.", price: 250, icon: "🛍️", color: "#fff5dc" },
  { id: "life-bamboo", category: "LIFE", name: "대나무 칫솔 세트", description: "일상 속 플라스틱 사용을 줄여 주는 부드러운 칫솔 세트예요.", price: 320, icon: "🪥", color: "#eef9e8" },
  { id: "carrier-filter", category: "CARRIER", name: "Carrier 필터 케어 키트", description: "가상 에어컨을 깨끗하게 관리하는 GreenON 전용 케어 키트예요.", price: 600, icon: "❄️", color: "#e5f2ff" },
  { id: "carrier-clean", category: "CARRIER", name: "에어컨 클린 케어 쿠폰", description: "쾌적한 냉방을 위한 가상 Carrier 클린 케어 리워드예요.", price: 900, icon: "✨", color: "#eeeaff" },
];

/** 저장 데이터가 손상되어도 앱이 멈추지 않도록 안전하게 가상 기기 상태를 불러옵니다. */
function loadAirconState() {
  if (window.greenOnSupabase) return { ...DEFAULT_AIRCON_STATE };
  try {
    const savedState = JSON.parse(window.localStorage.getItem(AIRCON_STORAGE_KEY));
    return savedState ? { ...DEFAULT_AIRCON_STATE, ...savedState } : { ...DEFAULT_AIRCON_STATE };
  } catch (error) {
    console.warn("가상 에어컨 저장 데이터를 읽지 못해 초기 상태로 시작합니다.", error);
    return { ...DEFAULT_AIRCON_STATE };
  }
}

let airconState = loadAirconState();

/** UTC가 아닌 사용자의 현지 날짜를 YYYY-MM-DD 형태로 반환합니다. */
function getTodayKey() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** 날짜가 바뀌면 새로운 오늘의 미션을 받을 수 있도록 기본 기록을 만듭니다. */
function createDefaultMissionState() {
  return {
    date: getTodayKey(),
    status: "available",
    elapsedMinutes: 0,
    failureReason: "",
  };
}

/** 오늘 저장된 미션 기록만 불러오고, 이전 날짜 기록은 새 미션으로 교체합니다. */
function loadMissionState() {
  if (window.greenOnSupabase) return createDefaultMissionState();
  try {
    const savedMission = JSON.parse(window.localStorage.getItem(MISSION_STORAGE_KEY));
    const today = getTodayKey();
    return savedMission?.date === today ? { ...createDefaultMissionState(), ...savedMission } : createDefaultMissionState();
  } catch (error) {
    console.warn("오늘의 미션 기록을 읽지 못해 새 미션으로 시작합니다.", error);
    return createDefaultMissionState();
  }
}

let missionState = loadMissionState();

/** 포인트 지갑의 초기 구조입니다. 구매 기능이 추가되면 spend 기록도 같은 배열에 저장합니다. */
function createDefaultWalletState() {
  return { balance: 0, transactions: [] };
}

/** 저장된 포인트와 기록을 안전하게 불러옵니다. */
function loadWalletState() {
  if (window.greenOnSupabase) return createDefaultWalletState();
  try {
    const savedWallet = JSON.parse(window.localStorage.getItem(WALLET_STORAGE_KEY));
    return savedWallet ? { ...createDefaultWalletState(), ...savedWallet } : createDefaultWalletState();
  } catch (error) {
    console.warn("포인트 지갑을 읽지 못해 빈 지갑으로 시작합니다.", error);
    return createDefaultWalletState();
  }
}

let walletState = loadWalletState();
let activeTransactionFilter = "all";

/** 사용자가 구매한 리워드 기록을 불러옵니다. */
function loadOrderState() {
  if (window.greenOnSupabase) return [];
  try {
    const savedOrders = JSON.parse(window.localStorage.getItem(ORDER_STORAGE_KEY));
    return Array.isArray(savedOrders) ? savedOrders : [];
  } catch (error) {
    console.warn("리워드 구매내역을 읽지 못해 빈 내역으로 시작합니다.", error);
    return [];
  }
}

let orderState = loadOrderState();
let activeRewardCategory = "ALL";
let selectedRewardId = null;
let rewardProducts = [...REWARD_PRODUCTS];
let databaseMode = false;
let databaseUserMissionId = null;
let activeMissionDefinition = null;
let airconSaveTimer;

/** Supabase 연결 전 UI 흐름 확인용 프로필과 세션을 불러옵니다. 비밀번호는 저장하지 않습니다. */
function loadDemoAuthState() {
  try {
    const profile = JSON.parse(window.localStorage.getItem(DEMO_PROFILE_STORAGE_KEY));
    const session = JSON.parse(window.localStorage.getItem(DEMO_SESSION_STORAGE_KEY));
    return { profile, isLoggedIn: Boolean(profile && session?.email === profile.email) };
  } catch (error) {
    console.warn("데모 로그인 상태를 읽지 못해 로그아웃 상태로 시작합니다.", error);
    return { profile: null, isLoggedIn: false };
  }
}

// Supabase가 설정된 환경에서는 데모 세션을 사용하지 않고 실제 Auth 세션만 신뢰합니다.
let authState = window.greenOnSupabase ? { profile: null, isLoggedIn: false } : loadDemoAuthState();
let activeAuthTab = "login";

const airconElements = {
  summaryCard: document.querySelector("#aircon-summary-card"),
  summaryTemperature: document.querySelector("#summary-temperature"),
  summaryOperation: document.querySelector("#summary-operation"),
  summaryStatus: document.querySelector("#summary-status"),
  powerButton: document.querySelector("#power-button"),
  deviceAlert: document.querySelector("#device-alert"),
  alertTitle: document.querySelector("#device-alert-title"),
  alertMessage: document.querySelector("#device-alert-message"),
  detailPower: document.querySelector("#detail-power"),
  detailMode: document.querySelector("#detail-mode"),
  detailTemperature: document.querySelector("#detail-temperature"),
  detailFan: document.querySelector("#detail-fan"),
  detailRuntime: document.querySelector("#detail-runtime"),
  detailFilter: document.querySelector("#detail-filter"),
  filterStatusItem: document.querySelector("#filter-status-item"),
  modeSelect: document.querySelector("#mode-select"),
  temperatureOutput: document.querySelector("#temperature-output"),
  temperatureDown: document.querySelector("#temperature-down"),
  temperatureUp: document.querySelector("#temperature-up"),
  addRuntimeButton: document.querySelector("#add-runtime-button"),
  fanButtons: Array.from(document.querySelectorAll("[data-fan]")),
  scenarioButtons: Array.from(document.querySelectorAll("[data-scenario]")),
};

const missionElements = {
  card: document.querySelector("#mission-detail-card"),
  stateChip: document.querySelector("#mission-state-chip"),
  elapsed: document.querySelector("#mission-elapsed"),
  progressBar: document.querySelector("#mission-progress-bar"),
  progressMessage: document.querySelector("#mission-progress-message"),
  conditionSummary: document.querySelector("#condition-summary"),
  warning: document.querySelector("#mission-warning"),
  warningMessage: document.querySelector("#mission-warning-message"),
  result: document.querySelector("#mission-result"),
  resultIcon: document.querySelector(".mission-result-icon"),
  resultTitle: document.querySelector("#mission-result-title"),
  resultMessage: document.querySelector("#mission-result-message"),
  startButton: document.querySelector("#mission-start-button"),
  timeButton: document.querySelector("#mission-time-button"),
  airconButton: document.querySelector("#mission-aircon-button"),
  conditions: {
    power: document.querySelector("#condition-power"),
    mode: document.querySelector("#condition-mode"),
    temperature: document.querySelector("#condition-temperature"),
    sensor: document.querySelector("#condition-sensor"),
  },
};

const walletElements = {
  balance: document.querySelector("#wallet-balance"),
  totalEarned: document.querySelector("#wallet-total-earned"),
  totalSpent: document.querySelector("#wallet-total-spent"),
  transactionCount: document.querySelector("#transaction-count"),
  transactionList: document.querySelector("#transaction-list"),
  empty: document.querySelector("#wallet-empty"),
  filterButtons: Array.from(document.querySelectorAll("[data-transaction-filter]")),
  homeCompletedMissions: document.querySelector("#home-completed-missions"),
  homeEarnedPoints: document.querySelector("#home-earned-points"),
};

const shopElements = {
  balance: document.querySelector("#shop-balance"),
  productCount: document.querySelector("#reward-product-count"),
  rewardGrid: document.querySelector("#reward-grid"),
  categoryButtons: Array.from(document.querySelectorAll("[data-reward-category]")),
  orderCount: document.querySelector("#order-count"),
  orderList: document.querySelector("#order-list"),
  orderEmpty: document.querySelector("#order-empty"),
  modalBackdrop: document.querySelector("#reward-modal"),
  modal: document.querySelector(".reward-modal"),
  modalClose: document.querySelector("#reward-modal-close"),
  modalVisual: document.querySelector("#reward-modal-visual"),
  modalCategory: document.querySelector("#reward-modal-category"),
  modalTitle: document.querySelector("#reward-modal-title"),
  modalDescription: document.querySelector("#reward-modal-description"),
  modalPrice: document.querySelector("#reward-modal-price"),
  modalBalance: document.querySelector("#reward-modal-balance"),
  purchaseLine: document.querySelector(".reward-purchase-line"),
  purchaseWarning: document.querySelector("#purchase-warning"),
  purchaseButton: document.querySelector("#reward-purchase-button"),
};

const myElements = {
  authCard: document.querySelector("#auth-card"),
  memberDashboard: document.querySelector("#member-dashboard"),
  loginTab: document.querySelector("#login-tab"),
  signupTab: document.querySelector("#signup-tab"),
  loginForm: document.querySelector("#login-form"),
  signupForm: document.querySelector("#signup-form"),
  loginError: document.querySelector("#login-error"),
  signupError: document.querySelector("#signup-error"),
  profileName: document.querySelector("#profile-name"),
  profileEmail: document.querySelector("#profile-email"),
  logoutButton: document.querySelector("#logout-button"),
  levelName: document.querySelector("#level-name"),
  levelEmoji: document.querySelector("#level-emoji"),
  levelMessage: document.querySelector("#level-message"),
  levelNextMessage: document.querySelector("#level-next-message"),
  levelProgressBar: document.querySelector("#level-progress-bar"),
  levelCurrentPoints: document.querySelector("#level-current-points"),
  levelTargetPoints: document.querySelector("#level-target-points"),
  reportCarbon: document.querySelector("#report-carbon"),
  reportMissions: document.querySelector("#report-missions"),
  reportEarned: document.querySelector("#report-earned"),
  reportSpent: document.querySelector("#report-spent"),
  reportOrders: document.querySelector("#report-orders"),
  authProviderLabel: document.querySelector("#auth-provider-label"),
};

/** Supabase 사용자와 profiles 행을 화면에서 사용하는 단순 프로필 구조로 바꿉니다. */
function createAuthProfile(user, databaseProfile = null) {
  return {
    id: user.id,
    name: databaseProfile?.display_name || user.user_metadata?.display_name || user.email?.split("@")[0] || "그린 히어로",
    email: user.email || "",
    createdAt: user.created_at,
  };
}

/** Supabase 오류 문구를 회원 화면에 표시하기 쉬운 한글 안내로 바꿉니다. */
function getAuthErrorMessage(error, action) {
  if (error?.message?.includes("Invalid login credentials")) return "이메일 또는 비밀번호를 확인해 주세요.";
  if (error?.message?.includes("already registered")) return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (error?.message?.includes("rate limit")) return "요청이 너무 많아요. 잠시 후 다시 시도해 주세요.";
  return `${action} 중 문제가 생겼어요. 잠시 후 다시 시도해 주세요.`;
}

/** 앱 시작 시 기존 Supabase 세션을 복원하고 인증 변화를 계속 반영합니다. */
async function initializeSupabaseAuth() {
  if (!window.greenOnSupabase) {
    myElements.authProviderLabel.textContent = "Supabase 연결 전 데모 인증";
    return;
  }

  myElements.authProviderLabel.textContent = "Supabase Auth 보안 연결";

  async function applySession(session) {
    if (!session?.user) {
      authState = { profile: null, isLoggedIn: false };
      resetUserData();
      renderMyPage();
      return;
    }

    try {
      await hydrateSupabaseAppData(session.user);
    } catch (error) {
      console.error("Supabase 사용자 데이터를 불러오지 못했습니다.", error);
      authState = { profile: createAuthProfile(session.user), isLoggedIn: true };
      renderMyPage();
      showToast("사용자 데이터를 불러오지 못했어요. 잠시 후 새로고침해 주세요.");
    }
  }

  try {
    await applySession(await window.greenOnSupabase.getSession());
    window.greenOnSupabase.client.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => applySession(session), 0);
    });
  } catch (error) {
    console.warn("Supabase 세션을 복원하지 못했습니다.", error);
    authState = { profile: null, isLoggedIn: false };
    renderMyPage();
  }
}

/** Supabase 행을 기존 화면 상태 형태로 변환하고 모든 화면을 한 번에 갱신합니다. */
async function hydrateSupabaseAppData(user) {
  const data = await window.greenOnSupabase.loadAppData(getTodayKey());
  const mission = data.missions[0] || null;

  databaseMode = true;
  activeMissionDefinition = mission;
  databaseUserMissionId = data.userMission?.id || null;
  authState = { profile: createAuthProfile(user, data.profile), isLoggedIn: true };
  airconState = {
    power: data.aircon.power,
    mode: data.aircon.mode,
    temperature: data.aircon.set_temperature,
    fan: data.aircon.fan,
    runtimeMinutes: data.aircon.runtime_minutes,
    filterLife: data.aircon.filter_life,
    sensorError: data.aircon.sensor_error,
  };
  missionState = data.userMission
    ? {
        date: data.userMission.mission_date,
        status: data.userMission.status,
        elapsedMinutes: data.userMission.elapsed_minutes,
        failureReason: data.userMission.failure_reason || "",
      }
    : createDefaultMissionState();
  walletState = {
    balance: data.profile.green_points,
    transactions: data.transactions.map((transaction) => ({
      id: transaction.id,
      type: transaction.transaction_type,
      source: transaction.source,
      sourceId: transaction.source_id,
      amount: transaction.amount,
      description: transaction.description,
      createdAt: transaction.created_at,
    })),
  };
  rewardProducts = data.rewards.map((reward) => ({
    id: reward.id,
    code: reward.code,
    category: reward.category,
    name: reward.name,
    description: reward.description,
    price: reward.price,
    icon: reward.emoji,
    color: reward.color,
    stock: reward.stock,
  }));
  orderState = data.orders.map((order) => ({
    id: order.id,
    productId: order.reward_id,
    productName: order.product_name,
    productIcon: order.product_emoji,
    price: order.points_spent,
    createdAt: order.created_at,
  }));

  // Supabase 전환 뒤에는 이전 임시 데이터가 다른 사용자에게 섞이지 않도록 제거합니다.
  [AIRCON_STORAGE_KEY, MISSION_STORAGE_KEY, WALLET_STORAGE_KEY, ORDER_STORAGE_KEY, DEMO_PROFILE_STORAGE_KEY, DEMO_SESSION_STORAGE_KEY]
    .forEach((key) => window.localStorage.removeItem(key));

  renderAirconState();
  renderWallet();
  renderShop();
  renderOrders();
  renderMyPage();
}

/** 로그아웃 시 이전 사용자의 데이터가 화면에 남지 않도록 초기 화면 상태로 되돌립니다. */
function resetUserData() {
  databaseMode = false;
  databaseUserMissionId = null;
  activeMissionDefinition = null;
  airconState = { ...DEFAULT_AIRCON_STATE };
  missionState = createDefaultMissionState();
  walletState = createDefaultWalletState();
  orderState = [];
  rewardProducts = [...REWARD_PRODUCTS];
  renderAirconState();
  renderWallet();
  renderShop();
  renderOrders();
}

/** 분 단위 사용시간을 읽기 쉬운 한글 시간으로 바꿉니다. */
function formatRuntime(minutes) {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours}시간 ${remainingMinutes}분` : `${hours}시간`;
}

/** 현재 기기 상태를 Supabase 또는 오프라인 데모 저장소에 저장합니다. */
function saveAirconState() {
  if (databaseMode) {
    window.clearTimeout(airconSaveTimer);
    airconSaveTimer = window.setTimeout(async () => {
      try {
        await window.greenOnSupabase.updateAirconStatus(airconState);
      } catch (error) {
        console.error("가상 에어컨 상태 저장에 실패했습니다.", error);
        showToast("에어컨 상태를 저장하지 못했어요.");
      }
    }, 250);
    return;
  }
  if (window.greenOnSupabase) return;
  window.localStorage.setItem(AIRCON_STORAGE_KEY, JSON.stringify(airconState));
}

/** 오늘의 미션 진행 기록을 브라우저에 저장합니다. */
function saveMissionState() {
  if (window.greenOnSupabase) return;
  window.localStorage.setItem(MISSION_STORAGE_KEY, JSON.stringify(missionState));
}

/** 포인트 지갑 변경 내용을 브라우저에 저장합니다. */
function saveWalletState() {
  if (window.greenOnSupabase) return;
  window.localStorage.setItem(WALLET_STORAGE_KEY, JSON.stringify(walletState));
}

/** 리워드 구매내역을 브라우저에 저장합니다. */
function saveOrderState() {
  if (window.greenOnSupabase) return;
  window.localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(orderState));
}

/** 날짜와 시간을 포인트 내역에 표시하기 좋은 형태로 바꿉니다. */
function formatTransactionDate(dateString) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

/** 현재 필터에 맞춰 지갑 잔액, 합계, 포인트 기록을 화면에 표시합니다. */
function renderWallet() {
  const totalEarned = walletState.transactions
    .filter((transaction) => transaction.type === "earn")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalSpent = walletState.transactions
    .filter((transaction) => transaction.type === "spend")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const filteredTransactions = walletState.transactions.filter(
    (transaction) => activeTransactionFilter === "all" || transaction.type === activeTransactionFilter,
  );

  walletElements.balance.textContent = walletState.balance.toLocaleString("ko-KR");
  walletElements.totalEarned.textContent = `+${totalEarned.toLocaleString("ko-KR")} P`;
  walletElements.totalSpent.textContent = `-${totalSpent.toLocaleString("ko-KR")} P`;
  walletElements.transactionCount.textContent = `${filteredTransactions.length}건`;
  walletElements.homeCompletedMissions.textContent = walletState.transactions.filter(
    (transaction) => transaction.source === "mission",
  ).length;
  walletElements.homeEarnedPoints.textContent = `${totalEarned.toLocaleString("ko-KR")} P`;
  shopElements.balance.textContent = walletState.balance.toLocaleString("ko-KR");
  walletElements.empty.hidden = filteredTransactions.length > 0;
  walletElements.transactionList.hidden = filteredTransactions.length === 0;

  walletElements.transactionList.innerHTML = filteredTransactions
    .map(
      (transaction) => `
        <article class="transaction-item" data-type="${transaction.type}">
          <span class="transaction-icon" aria-hidden="true">${transaction.type === "earn" ? "＋" : "−"}</span>
          <div class="transaction-copy">
            <strong>${transaction.description}</strong>
            <span>${formatTransactionDate(transaction.createdAt)}</span>
          </div>
          <strong class="transaction-amount">${transaction.type === "earn" ? "+" : "−"}${transaction.amount.toLocaleString("ko-KR")} P</strong>
        </article>
      `,
    )
    .join("");

  walletElements.filterButtons.forEach((button) => {
    button.classList.toggle("transaction-filter--active", button.dataset.transactionFilter === activeTransactionFilter);
  });

  saveWalletState();
  renderMyPage();
}

/** 선택한 카테고리의 리워드 상품 카드를 표시합니다. */
function renderShop() {
  const visibleProducts = rewardProducts.filter(
    (product) => activeRewardCategory === "ALL" || product.category === activeRewardCategory,
  );

  shopElements.productCount.textContent = `${visibleProducts.length}개`;
  shopElements.rewardGrid.innerHTML = visibleProducts
    .map(
      (product) => `
        <article class="reward-card">
          <div class="reward-visual" style="--reward-background: ${product.color}" aria-hidden="true">${product.icon}</div>
          <div class="reward-card-copy">
            <span class="reward-category">${product.category}</span>
            <h3>${product.name}</h3>
            <p>${product.description}</p>
            <div class="reward-card-bottom">
              <strong>${product.price.toLocaleString("ko-KR")} P</strong>
              <button class="reward-detail-button" type="button" data-reward-id="${product.id}">상세보기</button>
            </div>
          </div>
        </article>
      `,
    )
    .join("");

  shopElements.categoryButtons.forEach((button) => {
    button.classList.toggle("category-filter--active", button.dataset.rewardCategory === activeRewardCategory);
  });

  shopElements.rewardGrid.querySelectorAll("[data-reward-id]").forEach((button) => {
    button.addEventListener("click", () => openRewardModal(button.dataset.rewardId));
  });
}

/** 구매한 리워드 상품을 최신 순서로 표시합니다. */
function renderOrders() {
  shopElements.orderCount.textContent = `${orderState.length}건`;
  shopElements.orderEmpty.hidden = orderState.length > 0;
  shopElements.orderList.hidden = orderState.length === 0;
  shopElements.orderList.innerHTML = orderState
    .map(
      (order) => `
        <article class="order-item">
          <span class="order-item-visual" aria-hidden="true">${order.productIcon}</span>
          <div class="order-item-copy">
            <strong>${order.productName}</strong>
            <span>${formatTransactionDate(order.createdAt)} · 구매 완료</span>
          </div>
          <strong class="order-item-price">−${order.price.toLocaleString("ko-KR")} P</strong>
        </article>
      `,
    )
    .join("");
  saveOrderState();
  renderMyPage();
}

/** 누적 적립 포인트를 기준으로 현재 GREEN LEVEL과 다음 목표를 계산합니다. */
function getGreenLevel(totalEarned) {
  if (totalEarned >= 700) {
    return { name: "그린 트리", emoji: "🌳", message: "든든한 초록 습관이 자랐어요!", start: 700, target: 1200 };
  }
  if (totalEarned >= 300) {
    return { name: "초록잎", emoji: "🌿", message: "꾸준한 실천이 잎을 틔웠어요!", start: 300, target: 700 };
  }
  return { name: "새싹", emoji: "🌱", message: "첫 초록 습관을 시작했어요!", start: 0, target: 300 };
}

/** 회원 상태, GREEN LEVEL, 실제 활동 집계를 MY 화면에 반영합니다. */
function renderMyPage() {
  myElements.authCard.hidden = authState.isLoggedIn;
  myElements.memberDashboard.hidden = !authState.isLoggedIn;

  myElements.loginTab.classList.toggle("auth-tab--active", activeAuthTab === "login");
  myElements.signupTab.classList.toggle("auth-tab--active", activeAuthTab === "signup");
  myElements.loginTab.setAttribute("aria-selected", String(activeAuthTab === "login"));
  myElements.signupTab.setAttribute("aria-selected", String(activeAuthTab === "signup"));
  myElements.loginForm.hidden = activeAuthTab !== "login";
  myElements.signupForm.hidden = activeAuthTab !== "signup";

  if (!authState.isLoggedIn) return;

  const totalEarned = walletState.transactions
    .filter((transaction) => transaction.type === "earn")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalSpent = walletState.transactions
    .filter((transaction) => transaction.type === "spend")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const completedMissions = walletState.transactions.filter((transaction) => transaction.source === "mission").length;
  const level = getGreenLevel(totalEarned);
  const levelProgress = Math.min(100, ((totalEarned - level.start) / (level.target - level.start)) * 100);

  myElements.profileName.textContent = authState.profile.name;
  myElements.profileEmail.textContent = authState.profile.email;
  myElements.levelName.textContent = level.name;
  myElements.levelEmoji.textContent = level.emoji;
  myElements.levelMessage.textContent = level.message;
  myElements.levelNextMessage.textContent = `다음 레벨까지 ${Math.max(0, level.target - totalEarned).toLocaleString("ko-KR")} P 남았어요.`;
  myElements.levelProgressBar.style.width = `${levelProgress}%`;
  myElements.levelCurrentPoints.textContent = `${totalEarned.toLocaleString("ko-KR")} P`;
  myElements.levelTargetPoints.textContent = `${level.target.toLocaleString("ko-KR")} P`;
  myElements.reportCarbon.textContent = (completedMissions * 0.4).toFixed(1);
  myElements.reportMissions.textContent = `${completedMissions}회`;
  myElements.reportEarned.textContent = `${totalEarned.toLocaleString("ko-KR")} P`;
  myElements.reportSpent.textContent = `${totalSpent.toLocaleString("ko-KR")} P`;
  myElements.reportOrders.textContent = `${orderState.length}개`;
}

/** 로그인과 회원가입 탭을 바꾸고 이전 오류 안내를 지웁니다. */
function setAuthTab(tabName) {
  activeAuthTab = tabName;
  myElements.loginError.hidden = true;
  myElements.signupError.hidden = true;
  renderMyPage();
}

/** 상품 상세 모달을 열고 현재 포인트로 구매 가능한지도 함께 표시합니다. */
function openRewardModal(productId) {
  const product = rewardProducts.find((item) => String(item.id) === String(productId));
  if (!product) return;

  selectedRewardId = product.id;
  shopElements.modalVisual.textContent = product.icon;
  shopElements.modalVisual.style.background = product.color;
  shopElements.modalCategory.textContent = product.category;
  shopElements.modalTitle.textContent = product.name;
  shopElements.modalDescription.textContent = product.description;
  shopElements.modalPrice.textContent = product.price.toLocaleString("ko-KR");
  shopElements.modalBalance.textContent = walletState.balance.toLocaleString("ko-KR");
  shopElements.purchaseWarning.hidden = true;
  shopElements.purchaseLine.classList.remove("is-danger");
  shopElements.modalBackdrop.hidden = false;
  document.body.style.overflow = "hidden";
  shopElements.modalClose.focus();
}

/** 상품 상세 모달을 닫고 선택 상태를 초기화합니다. */
function closeRewardModal() {
  shopElements.modalBackdrop.hidden = true;
  document.body.style.overflow = "";
  selectedRewardId = null;
}

/**
 * 포인트 확인, 차감, 사용 기록, 구매내역 생성을 한 번에 처리합니다.
 * 포인트가 부족하면 데이터를 바꾸지 않고 관련 안내 영역만 Red UI로 전환합니다.
 */
async function purchaseSelectedReward() {
  const product = rewardProducts.find((item) => String(item.id) === String(selectedRewardId));
  if (!product) return;

  if (window.greenOnSupabase && !authState.isLoggedIn) {
    closeRewardModal();
    showPage("my");
    showToast("리워드를 구매하려면 먼저 로그인해 주세요.");
    return;
  }

  if (walletState.balance < product.price) {
    shopElements.purchaseWarning.hidden = false;
    shopElements.purchaseLine.classList.add("is-danger");
    showToast("포인트가 부족해 상품을 구매할 수 없어요.");
    return;
  }

  if (databaseMode) {
    try {
      await window.greenOnSupabase.purchaseReward(product.id);
      const session = await window.greenOnSupabase.getSession();
      await hydrateSupabaseAppData(session.user);
      closeRewardModal();
      showToast(`${product.name} 구매가 완료됐어요!`);
    } catch (error) {
      if (error?.message?.includes("INSUFFICIENT_POINTS")) {
        shopElements.purchaseWarning.hidden = false;
        shopElements.purchaseLine.classList.add("is-danger");
      }
      console.error("리워드 구매에 실패했습니다.", error);
      showToast("상품을 구매하지 못했어요. 다시 시도해 주세요.");
    }
    return;
  }

  const purchaseId = `reward-${Date.now()}`;
  const createdAt = new Date().toISOString();
  walletState.balance -= product.price;
  walletState.transactions.unshift({
    id: purchaseId,
    type: "spend",
    source: "reward",
    amount: product.price,
    description: product.name,
    createdAt,
  });
  orderState.unshift({
    id: purchaseId,
    productId: product.id,
    productName: product.name,
    productIcon: product.icon,
    price: product.price,
    createdAt,
  });

  renderWallet();
  renderOrders();
  closeRewardModal();
  showToast(`${product.name} 구매가 완료됐어요!`);
}

/**
 * 같은 날짜의 미션 보상을 두 번 지급하지 않도록 고유 id를 먼저 확인합니다.
 * 새로고침하거나 성공 화면을 다시 열어도 포인트는 한 번만 쌓입니다.
 */
function awardMissionReward() {
  // Supabase 모드에서는 advance_green_mission RPC가 보상을 한 번만 지급합니다.
  if (databaseMode) return false;
  const transactionId = `mission-${missionState.date}`;
  const alreadyRewarded = walletState.transactions.some((transaction) => transaction.id === transactionId);
  if (alreadyRewarded) return false;

  walletState.balance += 150;
  walletState.transactions.unshift({
    id: transactionId,
    type: "earn",
    source: "mission",
    amount: 150,
    description: "적정 온도 26℃ 지키기 성공",
    createdAt: new Date().toISOString(),
  });
  renderWallet();
  return true;
}

/** 현재 가상 에어컨이 오늘의 미션 조건을 지키고 있는지 항목별로 확인합니다. */
function getMissionConditions() {
  return {
    power: airconState.power,
    mode: airconState.mode === "cool",
    temperature: airconState.temperature === 26,
    sensor: !airconState.sensorError,
  };
}

/** 미션 조건 중 충족하지 못한 항목을 사용자가 이해하기 쉬운 문장으로 만듭니다. */
function getMissionWarningMessage(conditions) {
  const messages = [];
  if (!conditions.power) messages.push("에어컨 전원을 켜 주세요");
  if (!conditions.mode) messages.push("운전 모드를 냉방으로 바꿔 주세요");
  if (!conditions.temperature) messages.push("설정온도를 26℃로 맞춰 주세요");
  if (!conditions.sensor) messages.push("온도 센서 오류를 해결해 주세요");
  return messages.join(" · ");
}

/** 에어컨 상태가 바뀔 때마다 조건, 진행률, 성공·실패 화면을 다시 그립니다. */
function renderMissionState() {
  const conditions = getMissionConditions();
  const conditionEntries = Object.entries(conditions);
  const metCount = conditionEntries.filter(([, isMet]) => isMet).length;
  const allConditionsMet = metCount === conditionEntries.length;
  const progress = Math.min(100, Math.round((missionState.elapsedMinutes / 60) * 100));

  conditionEntries.forEach(([name, isMet]) => {
    const item = missionElements.conditions[name];
    item.classList.toggle("is-danger", !isMet);
    item.querySelector(".condition-check").textContent = isMet ? "✓" : "!";
    item.querySelector("strong").textContent = isMet ? "충족" : "미충족";
  });

  missionElements.conditionSummary.textContent = `${metCount}/4개 조건 충족`;
  missionElements.elapsed.textContent = missionState.elapsedMinutes;
  missionElements.progressBar.style.width = `${progress}%`;
  missionElements.warning.hidden = allConditionsMet || missionState.status === "success";
  missionElements.warningMessage.textContent = getMissionWarningMessage(conditions) || "모든 조건을 충족했어요.";
  missionElements.result.hidden = !["success", "failed"].includes(missionState.status);
  missionElements.result.classList.toggle("is-danger", missionState.status === "failed");
  missionElements.startButton.hidden = missionState.status === "active" || missionState.status === "success";
  missionElements.timeButton.hidden = missionState.status !== "active";

  if (missionState.status === "available") {
    missionElements.stateChip.textContent = "참여 가능";
    missionElements.stateChip.className = "mission-state-chip";
    missionElements.startButton.textContent = "미션 참여하기";
    missionElements.progressMessage.textContent = "미션에 참여하면 진행 시간이 기록돼요.";
  }

  if (missionState.status === "active") {
    missionElements.stateChip.textContent = "도전 중";
    missionElements.stateChip.className = "mission-state-chip";
    missionElements.progressMessage.textContent = allConditionsMet
      ? "좋아요! 이 상태로 시간을 진행해 보세요."
      : "조건 위반 상태에서 시간을 진행하면 미션이 실패해요.";
  }

  if (missionState.status === "failed") {
    missionElements.stateChip.textContent = "미션 실패";
    missionElements.stateChip.className = "mission-state-chip is-danger";
    missionElements.startButton.textContent = "다시 도전하기";
    missionElements.progressMessage.textContent = "조건을 다시 맞춘 뒤 재도전할 수 있어요.";
    missionElements.resultIcon.textContent = "!";
    missionElements.resultTitle.textContent = "아쉽지만 미션에 실패했어요";
    missionElements.resultMessage.textContent = missionState.failureReason;
  }

  if (missionState.status === "success") {
    awardMissionReward();
    missionElements.stateChip.textContent = "미션 성공";
    missionElements.stateChip.className = "mission-state-chip is-success";
    missionElements.progressMessage.textContent = "60분 동안 친환경 냉방 조건을 모두 지켰어요!";
    missionElements.resultIcon.textContent = "✓";
    missionElements.resultTitle.textContent = "오늘의 미션 성공!";
    missionElements.resultMessage.textContent = "150 GREEN POINT가 지갑에 지급됐어요.";
  }

  saveMissionState();
}

/**
 * 가상 기기 상태를 홈 요약 카드와 상세 패널에 동시에 반영합니다.
 * 필터 수명이 10% 이하이거나 센서 오류가 있으면 위험 상태로 판단해 Red UI를 사용합니다.
 */
function renderAirconState() {
  const needsFilterCheck = airconState.filterLife <= 10;
  const isAbnormal = needsFilterCheck || airconState.sensorError;
  const isRunning = airconState.power && !airconState.sensorError;
  const visibleTemperature = airconState.sensorError ? "--" : airconState.temperature;
  const statusLabel = airconState.sensorError ? "센서 오류" : needsFilterCheck ? "필터 점검" : "정상";

  airconElements.summaryTemperature.textContent = visibleTemperature;
  airconElements.summaryOperation.textContent = airconState.sensorError
    ? "온도 센서 연결을 확인해 주세요"
    : airconState.power
      ? `${MODE_LABELS[airconState.mode]} · ${FAN_LABELS[airconState.fan]} 운전 중`
      : "전원이 꺼져 있어요";
  airconElements.summaryStatus.querySelector("span").textContent = statusLabel;
  airconElements.summaryCard.classList.toggle("is-danger", isAbnormal);

  airconElements.powerButton.setAttribute("aria-pressed", String(airconState.power));
  airconElements.powerButton.querySelector("span").textContent = airconState.power ? "POWER ON" : "POWER OFF";
  airconElements.detailPower.textContent = airconState.power ? "ON" : "OFF";
  airconElements.detailMode.textContent = MODE_LABELS[airconState.mode];
  airconElements.detailTemperature.textContent = `${visibleTemperature}℃`;
  airconElements.detailFan.textContent = FAN_LABELS[airconState.fan];
  airconElements.detailRuntime.textContent = formatRuntime(airconState.runtimeMinutes);
  airconElements.detailFilter.textContent = `${airconState.filterLife}%`;
  airconElements.filterStatusItem.classList.toggle("is-danger", needsFilterCheck);

  if (airconState.sensorError) {
    airconElements.alertTitle.textContent = "온도 센서 오류가 감지됐어요";
    airconElements.alertMessage.textContent = "정확한 상태를 확인할 수 없어요. 센서 연결을 점검해 주세요.";
  } else if (needsFilterCheck) {
    airconElements.alertTitle.textContent = "필터 점검이 필요해요";
    airconElements.alertMessage.textContent = "필터 수명이 10% 이하예요. 깨끗한 공기를 위해 교체해 주세요.";
  } else if (!airconState.power) {
    airconElements.alertTitle.textContent = "에어컨 전원이 꺼져 있어요";
    airconElements.alertMessage.textContent = "운전을 시작하려면 POWER 버튼을 눌러 주세요.";
  } else {
    airconElements.alertTitle.textContent = "모든 상태가 정상이에요";
    airconElements.alertMessage.textContent = "Carrier GreenON이 쾌적한 냉방 상태를 확인했어요.";
  }

  airconElements.deviceAlert.classList.toggle("is-danger", isAbnormal);
  airconElements.modeSelect.value = airconState.mode;
  airconElements.temperatureOutput.textContent = `${airconState.temperature}℃`;
  airconElements.modeSelect.disabled = !isRunning;
  airconElements.temperatureDown.disabled = !isRunning;
  airconElements.temperatureUp.disabled = !isRunning;
  airconElements.addRuntimeButton.disabled = !isRunning;

  airconElements.fanButtons.forEach((button) => {
    button.disabled = !isRunning;
    button.classList.toggle("segment--active", button.dataset.fan === airconState.fan);
  });

  const currentScenario = airconState.sensorError ? "sensor" : needsFilterCheck ? "filter" : "normal";
  airconElements.scenarioButtons.forEach((button) => {
    button.classList.toggle("scenario-button--active", button.dataset.scenario === currentScenario);
  });

  saveAirconState();
  renderMissionState();
}

airconElements.powerButton.addEventListener("click", () => {
  airconState.power = !airconState.power;
  renderAirconState();
  showToast(airconState.power ? "가상 에어컨을 켰어요." : "가상 에어컨을 껐어요.");
});

airconElements.modeSelect.addEventListener("change", (event) => {
  airconState.mode = event.target.value;
  renderAirconState();
});

airconElements.temperatureDown.addEventListener("click", () => {
  airconState.temperature = Math.max(18, airconState.temperature - 1);
  renderAirconState();
});

airconElements.temperatureUp.addEventListener("click", () => {
  airconState.temperature = Math.min(30, airconState.temperature + 1);
  renderAirconState();
});

airconElements.fanButtons.forEach((button) => {
  button.addEventListener("click", () => {
    airconState.fan = button.dataset.fan;
    renderAirconState();
  });
});

/**
 * 가상 시간을 진행하면서 활성 미션이 있으면 조건도 함께 판정합니다.
 * 조건을 위반한 상태로 시간을 진행하면 실패하고, 60분을 채우면 성공합니다.
 */
async function advanceSimulation(minutes) {
  const conditions = getMissionConditions();
  const allConditionsMet = Object.values(conditions).every(Boolean);

  if (databaseMode) {
    if (missionState.status === "active") {
      try {
        window.clearTimeout(airconSaveTimer);
        await window.greenOnSupabase.updateAirconStatus(airconState);
        await window.greenOnSupabase.advanceMission(databaseUserMissionId);
        const session = await window.greenOnSupabase.getSession();
        await hydrateSupabaseAppData(session.user);
        showToast(missionState.status === "success" ? "오늘의 GREEN MISSION 성공!" : `가상 시간이 ${minutes}분 늘었어요.`);
      } catch (error) {
        console.error("미션 시간 진행에 실패했습니다.", error);
        showToast("미션 시간을 진행하지 못했어요. 다시 시도해 주세요.");
      }
      return;
    }

    if (!airconState.power || airconState.sensorError) {
      showToast("에어컨이 정상 운전 중일 때만 시간을 진행할 수 있어요.");
      return;
    }

    airconState.runtimeMinutes += minutes;
    airconState.filterLife = Math.max(0, airconState.filterLife - 1);
    renderAirconState();
    showToast(`가상 시간이 ${minutes}분 늘었어요.`);
    return;
  }

  if (missionState.status === "active" && !allConditionsMet) {
    missionState.status = "failed";
    missionState.failureReason = getMissionWarningMessage(conditions);
    renderMissionState();
    showToast("미션 조건 위반으로 도전에 실패했어요.");
    return;
  }

  if (!airconState.power || airconState.sensorError) {
    showToast("에어컨이 정상 운전 중일 때만 시간을 진행할 수 있어요.");
    return;
  }

  airconState.runtimeMinutes += minutes;
  airconState.filterLife = Math.max(0, airconState.filterLife - 1);

  if (missionState.status === "active") {
    missionState.elapsedMinutes = Math.min(60, missionState.elapsedMinutes + minutes);
    if (missionState.elapsedMinutes >= 60) missionState.status = "success";
  }

  renderAirconState();
  showToast(missionState.status === "success" ? "오늘의 GREEN MISSION 성공!" : `가상 시간이 ${minutes}분 늘었어요.`);
}

airconElements.addRuntimeButton.addEventListener("click", () => advanceSimulation(30));

// 버튼 한 번으로 정상, 필터 점검, 센서 오류 상태를 재현합니다.
airconElements.scenarioButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const scenario = button.dataset.scenario;
    airconState.sensorError = scenario === "sensor";
    airconState.filterLife = scenario === "filter" ? 8 : 72;
    renderAirconState();

    if (scenario === "normal") showToast("에어컨을 정상 상태로 되돌렸어요.");
    if (scenario === "filter") showToast("필터 점검 상태를 시뮬레이션했어요.");
    if (scenario === "sensor") showToast("센서 오류 상태를 시뮬레이션했어요.");
  });
});

missionElements.startButton.addEventListener("click", async () => {
  if (window.greenOnSupabase && !authState.isLoggedIn) {
    showPage("my");
    showToast("미션에 참여하려면 먼저 로그인해 주세요.");
    return;
  }

  const conditions = getMissionConditions();
  const allConditionsMet = Object.values(conditions).every(Boolean);

  if (!allConditionsMet) {
    renderMissionState();
    showToast("미션 조건을 먼저 맞춰 주세요.");
    return;
  }

  if (databaseMode) {
    try {
      window.clearTimeout(airconSaveTimer);
      await window.greenOnSupabase.updateAirconStatus(airconState);
      const userMission = await window.greenOnSupabase.startMission(activeMissionDefinition.id, getTodayKey());
      databaseUserMissionId = userMission.id;
      missionState = {
        date: userMission.mission_date,
        status: userMission.status,
        elapsedMinutes: userMission.elapsed_minutes,
        failureReason: userMission.failure_reason || "",
      };
      renderMissionState();
      showToast("GREEN MISSION을 시작했어요!");
    } catch (error) {
      console.error("미션 시작에 실패했습니다.", error);
      showToast("미션을 시작하지 못했어요. 다시 시도해 주세요.");
    }
    return;
  }

  missionState.status = "active";
  missionState.elapsedMinutes = 0;
  missionState.failureReason = "";
  renderMissionState();
  showToast("GREEN MISSION을 시작했어요!");
});

missionElements.timeButton.addEventListener("click", () => advanceSimulation(30));

missionElements.airconButton.addEventListener("click", () => {
  showPage("home");
  window.setTimeout(() => {
    document.querySelector("#aircon-simulator").scrollIntoView({ behavior: "smooth", block: "start" });
  }, 120);
});

walletElements.filterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeTransactionFilter = button.dataset.transactionFilter;
    renderWallet();
  });
});

shopElements.categoryButtons.forEach((button) => {
  button.addEventListener("click", () => {
    activeRewardCategory = button.dataset.rewardCategory;
    renderShop();
  });
});

shopElements.modalClose.addEventListener("click", closeRewardModal);
shopElements.modalBackdrop.addEventListener("click", (event) => {
  if (event.target === shopElements.modalBackdrop) closeRewardModal();
});
shopElements.purchaseButton.addEventListener("click", purchaseSelectedReward);

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !shopElements.modalBackdrop.hidden) closeRewardModal();
});

myElements.loginTab.addEventListener("click", () => setAuthTab("login"));
myElements.signupTab.addEventListener("click", () => setAuthTab("signup"));

myElements.signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const name = String(formData.get("name")).trim();
  const email = String(formData.get("email")).trim().toLowerCase();
  const password = String(formData.get("password"));

  if (window.greenOnSupabase) {
    try {
      const data = await window.greenOnSupabase.signUp({ name, email, password });
      event.currentTarget.reset();
      myElements.signupError.hidden = true;

      if (data.session?.user) {
        await hydrateSupabaseAppData(data.session.user);
        showToast("Carrier GreenON 회원가입이 완료됐어요!");
      } else {
        setAuthTab("login");
        showToast("확인 이메일을 보냈어요. 인증 후 로그인해 주세요.");
      }
    } catch (error) {
      myElements.signupError.textContent = getAuthErrorMessage(error, "회원가입");
      myElements.signupError.hidden = false;
    }
    return;
  }

  const profile = {
    id: `demo-${Date.now()}`,
    name,
    email,
    createdAt: new Date().toISOString(),
  };

  // 데모 단계에서는 비밀번호를 저장하지 않고, 실제 검증은 Supabase Auth 단계에서 처리합니다.
  window.localStorage.setItem(DEMO_PROFILE_STORAGE_KEY, JSON.stringify(profile));
  window.localStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify({ email: profile.email }));
  authState = { profile, isLoggedIn: true };
  event.currentTarget.reset();
  renderMyPage();
  showToast("Carrier GreenON 회원가입이 완료됐어요!");
});

myElements.loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(event.currentTarget);
  const email = String(formData.get("email")).trim().toLowerCase();
  const password = String(formData.get("password"));

  if (window.greenOnSupabase) {
    try {
      const data = await window.greenOnSupabase.signIn({ email, password });
      await hydrateSupabaseAppData(data.user);
      event.currentTarget.reset();
      myElements.loginError.hidden = true;
      showToast("다시 만나서 반가워요!");
    } catch (error) {
      myElements.loginError.textContent = getAuthErrorMessage(error, "로그인");
      myElements.loginError.hidden = false;
    }
    return;
  }

  if (!authState.profile || authState.profile.email !== email) {
    myElements.loginError.textContent = "가입된 데모 이메일을 확인해 주세요.";
    myElements.loginError.hidden = false;
    return;
  }

  window.localStorage.setItem(DEMO_SESSION_STORAGE_KEY, JSON.stringify({ email }));
  authState.isLoggedIn = true;
  event.currentTarget.reset();
  myElements.loginError.hidden = true;
  renderMyPage();
  showToast("다시 만나서 반가워요!");
});

myElements.logoutButton.addEventListener("click", async () => {
  if (window.greenOnSupabase) {
    try {
      await window.greenOnSupabase.signOut();
      authState = { profile: null, isLoggedIn: false };
      activeAuthTab = "login";
      resetUserData();
      renderMyPage();
      showToast("안전하게 로그아웃했어요.");
    } catch (error) {
      showToast("로그아웃 중 문제가 생겼어요. 다시 시도해 주세요.");
    }
    return;
  }

  window.localStorage.removeItem(DEMO_SESSION_STORAGE_KEY);
  authState.isLoggedIn = false;
  activeAuthTab = "login";
  renderMyPage();
  showToast("안전하게 로그아웃했어요.");
});

/**
 * 짧은 안내 메시지를 화면 아래에 보여줍니다.
 * 알림 기능이 완성되기 전에도 버튼이 반응한다는 점을 사용자가 알 수 있습니다.
 */
function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add("toast--visible");

  toastTimer = window.setTimeout(() => {
    toast.classList.remove("toast--visible");
  }, 2200);
}

/**
 * 선택한 화면만 표시하고 하단 내비게이션의 활성 상태를 함께 갱신합니다.
 * 아직 구현 전인 메뉴도 빈 화면으로 연결해 전체 앱 구조를 미리 확인할 수 있습니다.
 */
function showPage(pageName, options = {}) {
  const safePageName = PAGE_TITLES[pageName] ? pageName : "home";

  pages.forEach((page) => {
    const isCurrentPage = page.dataset.page === safePageName;
    page.hidden = !isCurrentPage;
    page.classList.toggle("page--active", isCurrentPage);
  });

  navigationButtons.forEach((button) => {
    const isActive = button.dataset.pageTarget === safePageName;
    button.classList.toggle("nav-item--active", isActive);

    if (isActive) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  document.title = PAGE_TITLES[safePageName];

  // 브라우저 뒤로 가기가 자연스럽게 동작하도록 주소의 해시도 함께 바꿉니다.
  if (options.updateHash !== false) {
    window.history.pushState({ page: safePageName }, "", `#${safePageName}`);
  }

  // 화면이 바뀌면 첫 내용부터 읽을 수 있도록 스크롤을 위로 이동합니다.
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/** 현재 시각에 어울리는 인사말과 날짜를 홈에 표시합니다. */
function updateWelcomeMessage() {
  const now = new Date();
  const hour = now.getHours();
  const greeting = hour < 11 ? "좋은 아침이에요" : hour < 18 ? "반가워요" : "편안한 저녁이에요";
  const dateLabel = new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(now);

  document.querySelector("#greeting").textContent = greeting;
  document.querySelector("#today-label").textContent = `${dateLabel} · 오늘도 시원하고 착하게!`;
}

/** 외부 온도와 습도에 따라 오늘 미션이 왜 적합한지 설명합니다. */
function getWeatherMissionRecommendation(weather) {
  if (weather.temperature >= 32) return "폭염 날씨예요. 26℃ 적정 온도로 과도한 냉방을 줄여요.";
  if (weather.humidity >= 70) return "습도가 높은 날이에요. 26℃와 자동풍으로 쾌적함을 유지해요.";
  if (weather.temperature >= 28) return "더운 날씨예요. 오늘은 26℃ 지키기 미션을 추천해요.";
  return "비교적 선선한 날이에요. 필요할 때만 냉방해 에너지를 아껴요.";
}

/** 날씨 서비스 결과를 홈 카드와 조건별 미션 추천에 반영합니다. */
async function refreshWeather() {
  if (!window.greenOnWeather) return;
  weatherElements.refresh.classList.add("is-loading");
  weatherElements.refresh.disabled = true;

  try {
    const weather = await window.greenOnWeather.getCurrentWeather();
    weatherElements.temperature.textContent = weather.temperature;
    weatherElements.humidity.textContent = weather.humidity;
    weatherElements.condition.textContent = weather.conditionLabel;
    weatherElements.location.textContent = weather.location;
    weatherElements.source.textContent = weather.source === "api" ? "실시간 날씨" : weather.source === "fallback" ? "연결 오류 · 샘플 날씨" : "샘플 날씨";
    weatherElements.source.classList.toggle("is-danger", weather.source === "fallback");
    weatherElements.recommendation.textContent = getWeatherMissionRecommendation(weather);
  } finally {
    weatherElements.refresh.classList.remove("is-loading");
    weatherElements.refresh.disabled = false;
  }
}

navigationButtons.forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.pageTarget));
});

directMoveButtons.forEach((button) => {
  button.addEventListener("click", () => showPage(button.dataset.goPage));
});

notificationButton.addEventListener("click", () => {
  showToast("새 알림 기능은 다음 단계에서 만나요!");
});

weatherElements.refresh.addEventListener("click", () => {
  refreshWeather();
  showToast("현재 날씨를 다시 확인했어요.");
});

// 브라우저의 뒤로/앞으로 가기를 눌렀을 때 주소에 맞는 화면을 다시 보여줍니다.
window.addEventListener("popstate", () => {
  const pageFromHash = window.location.hash.replace("#", "");
  showPage(pageFromHash, { updateHash: false });
});

// 처음 접속했을 때 해시 주소가 있으면 해당 화면을, 없으면 홈을 엽니다.
updateWelcomeMessage();
const initialPage = window.location.hash.replace("#", "") || "home";
showPage(initialPage, { updateHash: false });
renderAirconState();
renderWallet();
renderShop();
renderOrders();
renderMyPage();
initializeSupabaseAuth();
refreshWeather();
