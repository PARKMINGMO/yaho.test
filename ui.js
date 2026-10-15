// 입력 문자열이 HTML 태그로 실행되지 않도록 특수문자를 안전한 문자로 바꿉니다.
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

// 숫자에 천 단위 쉼표를 넣고 원화 기호를 붙여 화면에 표시합니다.
function formatWon(amount) {
  return `₩${Math.round(amount).toLocaleString("ko-KR")}`;
}

// 기기의 현지 날짜를 YYYY-MM-DD 형식으로 만듭니다. 계산 함수가 이 형식을 사용합니다.
function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// 저장된 날짜 문자열을 카드에서 읽기 쉬운 YYYY.MM.DD 형식으로 바꿉니다.
function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return `${year}.${String(month).padStart(2, "0")}.${String(day).padStart(2, "0")}`;
}

// 요약 숫자, 구독 목록, 카테고리 비중을 현재 데이터로 모두 갱신합니다.
// main.js는 데이터가 추가/수정/삭제될 때마다 이 함수를 호출합니다.
function renderDashboard(subscriptions) {
  const today = getLocalDateString();
  // 오늘을 포함해 7일 이내에 결제하는 구독을 기존 계산 함수로 찾습니다.
  const dueThisWeek = getSubscriptionsDueWithinDays(subscriptions, today, 7);
  // 이번 주 결제 금액은 월 환산액이 아니라 해당 결제의 실제 금액을 더합니다.
  const dueTotal = dueThisWeek.reduce((total, item) => total + Number(item.amount), 0);

  document.getElementById("today-label").textContent = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "long", day: "numeric", weekday: "long"
  }).format(new Date());
  document.getElementById("monthly-total").textContent = formatWon(getTotalMonthlyAmount(subscriptions));
  document.getElementById("yearly-total").textContent = formatWon(getTotalYearlyAmount(subscriptions));
  document.getElementById("due-count").textContent = `${dueThisWeek.length}건`;
  document.getElementById("due-total").textContent = `결제 예정 금액 ${formatWon(dueTotal)}`;
  document.getElementById("subscription-count").textContent = subscriptions.length;

  renderSubscriptionList(subscriptions, today);
  renderCategories(subscriptions);
}

// 결제일이 가까운 순서대로 구독 카드를 만들어 목록 영역에 넣습니다.
function renderSubscriptionList(subscriptions, today) {
  const list = document.getElementById("subscription-list");
  // 원본 배열을 복사해서 정렬하므로 저장 데이터 순서는 바뀌지 않습니다.
  const sortedSubscriptions = [...subscriptions].sort((first, second) =>
    first.nextPaymentDate.localeCompare(second.nextPaymentDate)
  );

  if (sortedSubscriptions.length === 0) {
    // 목록이 비었을 때 안내 문구를 보여주고 카드 생성은 여기서 끝냅니다.
    list.innerHTML = '<div class="empty-state"><span class="empty-icon" aria-hidden="true">＋</span><p>아직 등록된 구독이 없어요.</p><span>오른쪽에서 첫 구독을 추가해 보세요.</span></div>';
    return;
  }

  list.innerHTML = sortedSubscriptions.map(subscription => {
    const daysRemaining = getDaysUntilNextPayment(today, subscription.nextPaymentDate);
    // 결제일까지 남은 날짜에 따라 지난 결제, 오늘 결제, D-day 문구를 정합니다.
    const dueLabel = daysRemaining < 0
      ? `${Math.abs(daysRemaining)}일 지남`
      : daysRemaining === 0 ? "오늘 결제" : `D-${daysRemaining}`;
    const monthlyAmount = getMonthlyAmount(subscription);
    const cycleLabel = subscription.cycle === "yearly" ? "연간" : "월간";
    const category = escapeHTML(subscription.category || "기타");
    const paymentMethod = subscription.paymentMethod ? escapeHTML(subscription.paymentMethod) : "결제 수단 미입력";

    // 사용자가 입력한 값은 escapeHTML로 보호한 뒤 카드 HTML에 넣습니다.
    // data-action과 data-id는 main.js가 수정/삭제 버튼을 구별하는 데 사용합니다.
    return `<article class="subscription-item">
      <div class="service-mark" aria-hidden="true">${escapeHTML((subscription.name || "?").trim().slice(0, 1).toUpperCase())}</div>
      <div class="service-details">
        <div class="service-title-row"><h3>${escapeHTML(subscription.name)}</h3><span class="category-tag">${category}</span></div>
        <p class="service-meta">${paymentMethod} <span aria-hidden="true">·</span> ${formatDate(subscription.nextPaymentDate)}</p>
      </div>
      <div class="service-cost"><strong>${formatWon(subscription.amount)}</strong><span>${cycleLabel} · 월 ${formatWon(monthlyAmount)}</span></div>
      <div class="service-due ${daysRemaining >= 0 && daysRemaining <= 7 ? "due-soon" : ""}">${dueLabel}</div>
      <div class="item-actions">
        <button class="icon-button" type="button" data-action="edit" data-id="${escapeHTML(subscription.id)}" aria-label="${escapeHTML(subscription.name)} 수정" title="수정">✎</button>
        <button class="icon-button delete-button" type="button" data-action="delete" data-id="${escapeHTML(subscription.id)}" aria-label="${escapeHTML(subscription.name)} 삭제" title="삭제">×</button>
      </div>
    </article>`;
  }).join("");
}

// 카테고리별 월 지출을 큰 금액부터 비율 막대로 보여줍니다.
function renderCategories(subscriptions) {
  const container = document.getElementById("category-list");
  const categoryTotals = getMonthlyAmountByCategory(subscriptions);
  const total = getTotalMonthlyAmount(subscriptions);
  const categories = Object.entries(categoryTotals).sort((first, second) => second[1] - first[1]);

  if (categories.length === 0) {
    // 구독이 없으면 빈 그래프 대신 카테고리 안내를 표시합니다.
    container.innerHTML = '<p class="category-empty">구독을 추가하면 카테고리별 지출을 볼 수 있어요.</p>';
    return;
  }

  // 카테고리별 색을 순서대로 반복해 사용합니다. 비율은 전체 월 지출을 기준으로 합니다.
  const colors = ["#df6e4d", "#4a8b77", "#d2a33f", "#637ca5", "#a26b80"];
  container.innerHTML = categories.map(([category, amount], index) => {
    const percentage = total > 0 ? Math.round(amount / total * 100) : 0;
    return `<div class="category-row">
      <div class="category-row-top"><span class="category-name"><i style="--category-color:${colors[index % colors.length]}"></i>${escapeHTML(category)}</span><span>${percentage}% <b>${formatWon(amount)}</b></span></div>
      <div class="category-track"><span style="width:${percentage}%;--category-color:${colors[index % colors.length]}"></span></div>
    </div>`;
  }).join("");
}
