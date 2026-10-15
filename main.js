// localStorage 안에서 이 앱의 구독 목록을 찾을 때 사용할 이름입니다.
const STORAGE_KEY = "subscription-tracker-data";
// HTML 요소를 시작할 때 한 번 찾아 두면 이후 이벤트 처리에서 재사용할 수 있습니다.
const subscriptionForm = document.getElementById("subscription-form");
const formMessage = document.getElementById("form-message");
const submitButton = document.getElementById("submit-button");
const cancelEditButton = document.getElementById("cancel-edit");
let subscriptions = loadSubscriptions();
// null은 새 구독 입력 상태, 문자열 id는 해당 구독을 수정하는 상태를 뜻합니다.
let editingId = null;

// 브라우저 저장소에서 JSON 문자열을 읽고 자바스크립트 배열로 되돌립니다.
function loadSubscriptions() {
  try {
    const savedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    // 배열이 아니거나 핵심 필드가 없는 데이터는 계산/표시 과정에서 제외합니다.
    if (!Array.isArray(savedData)) return [];
    return savedData.filter(item => item && typeof item.name === "string" &&
      Number.isFinite(Number(item.amount)) && item.nextPaymentDate && item.cycle);
  } catch (error) {
    console.warn("저장된 구독 데이터를 읽지 못했습니다.", error);
    return [];
  }
}

// 현재 구독 배열을 저장하고 화면도 다시 그려 데이터와 화면을 일치시킵니다.
function saveAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(subscriptions));
  renderDashboard(subscriptions);
}

// 폼 값을 비우고 수정 모드에서 새 구독 입력 모드로 돌아갑니다.
function resetForm() {
  subscriptionForm.reset();
  editingId = null;
  submitButton.innerHTML = '<span aria-hidden="true">＋</span> 구독 추가';
  cancelEditButton.hidden = true;
  formMessage.textContent = "";
}

// 제출 이벤트에서 새 항목 추가와 기존 항목 수정을 모두 처리합니다.
subscriptionForm.addEventListener("submit", event => {
  // 브라우저의 기본 폼 제출은 페이지를 새로고침하므로 직접 처리합니다.
  event.preventDefault();
  const formData = new FormData(subscriptionForm);
  const amount = Number(formData.get("amount"));
  const nextPaymentDate = formData.get("nextPaymentDate");

  // 입력 요소의 제약과 별개로 금액이 양의 정수인지 한 번 더 확인합니다.
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    formMessage.textContent = "금액은 1원 이상의 정수로 입력해 주세요.";
    return;
  }
  if (!nextPaymentDate) {
    formMessage.textContent = "다음 결제일을 선택해 주세요.";
    return;
  }

  // 폼 필드 값을 계산 함수가 사용하는 구독 객체 형태로 모읍니다.
  const updatedSubscription = {
    id: editingId || (crypto.randomUUID ? crypto.randomUUID() : `sub_${Date.now()}`),
    name: String(formData.get("name")).trim(),
    amount,
    cycle: formData.get("cycle"),
    nextPaymentDate,
    category: String(formData.get("category")).trim() || "기타",
    paymentMethod: String(formData.get("paymentMethod")).trim()
  };

  // 수정이면 기존 id의 항목만 바꾸고, 새 입력이면 목록에 새 항목을 추가합니다.
  if (editingId) {
    subscriptions = subscriptions.map(item => item.id === editingId ? updatedSubscription : item);
  } else {
    subscriptions.push(updatedSubscription);
  }

  saveAndRender();
  resetForm();
});

// 목록 컨테이너 하나에서 카드 안의 모든 수정/삭제 클릭을 처리합니다.
// 이벤트 위임을 사용하면 목록을 다시 그린 뒤에도 별도 등록 없이 버튼이 동작합니다.
document.getElementById("subscription-list").addEventListener("click", event => {
  // 클릭한 아이콘이 아니라 그 아이콘을 감싼 작업 버튼을 찾습니다.
  const button = event.target.closest("button[data-action]");
  if (!button) return;

  const subscription = subscriptions.find(item => item.id === button.dataset.id);
  if (!subscription) return;

  if (button.dataset.action === "delete") {
    // 선택한 항목을 제거하고, 그 항목을 편집 중이었다면 폼도 초기화합니다.
    subscriptions = subscriptions.filter(item => item.id !== subscription.id);
    if (editingId === subscription.id) resetForm();
    saveAndRender();
    return;
  }

  if (button.dataset.action === "edit") {
    // 객체의 각 값을 같은 name을 가진 입력 칸에 채워 수정할 수 있게 합니다.
    editingId = subscription.id;
    for (const [field, value] of Object.entries(subscription)) {
      const input = subscriptionForm.elements.namedItem(field);
      if (input) input.value = value;
    }
    submitButton.textContent = "수정 저장";
    cancelEditButton.hidden = false;
    formMessage.textContent = "구독 정보를 수정하고 저장해 주세요.";
    document.getElementById("form-title").scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("name").focus({ preventScroll: true });
  }
});

// 수정 취소는 저장하지 않고 입력 폼을 초기 상태로 되돌립니다.
cancelEditButton.addEventListener("click", resetForm);

// 페이지가 처음 열리면 저장값으로 화면을 그립니다.
// 저장소 접근이 막힌 경우에도 화면은 표시하고 입력 영역에 안내를 남깁니다.
try {
  saveAndRender();
} catch (error) {
  console.error("구독 데이터를 저장하거나 화면을 표시하지 못했습니다.", error);
  renderDashboard(subscriptions);
  formMessage.textContent = "브라우저 저장소를 사용할 수 없습니다.";
}
