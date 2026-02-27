// Estado principal da aplicação com persistência local.
const STORAGE_KEY = "rifaBeneficenteData";
const TOTAL_NUMBERS = 150;
const ADMIN_PASSWORD = "admin123";

const formatBRL = (value) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const defaultData = {
  campaign: {
    goal: 10000,
    drawDate: "2026-12-30T20:00:00",
    ticketPrice: 10,
  },
  tickets: [],
  supporters: [],
  receipts: [],
};

const state = {
  data: structuredClone(defaultData),
  selectedNumbers: new Set(),
};

// Seletores de elementos da interface.
const el = {
  metaValor: document.getElementById("metaValor"),
  arrecadadoValor: document.getElementById("arrecadadoValor"),
  progressBar: document.getElementById("progressBar"),
  progressText: document.getElementById("progressText"),
  countdown: document.getElementById("countdown"),
  ticketPrice: document.getElementById("ticketPrice"),
  numbersGrid: document.getElementById("numbersGrid"),
  ticketsSold: document.getElementById("ticketsSold"),
  ticketsConfirmed: document.getElementById("ticketsConfirmed"),
  paymentForm: document.getElementById("paymentForm"),
  paymentFeedback: document.getElementById("paymentFeedback"),
  liveAmount: document.getElementById("liveAmount"),
  liveTickets: document.getElementById("liveTickets"),
  receiptsList: document.getElementById("receiptsList"),
  supportersRanking: document.getElementById("supportersRanking"),
  adminPassword: document.getElementById("adminPassword"),
  adminUnlock: document.getElementById("adminUnlock"),
  adminFeedback: document.getElementById("adminFeedback"),
  adminPanel: document.getElementById("adminPanel"),
  adminDataPreview: document.getElementById("adminDataPreview"),
  resetReservations: document.getElementById("resetReservations"),
  exportData: document.getElementById("exportData"),
};

async function bootstrap() {
  await hydrateData();
  renderAll();
  bindEvents();
  startCountdown();
}

// Carrega JSON local e combina com dados do localStorage para simular backend.
async function hydrateData() {
  try {
    const [jsonData, local] = await Promise.all([
      fetch("data.json").then((res) => res.json()),
      Promise.resolve(localStorage.getItem(STORAGE_KEY)),
    ]);

    state.data = local ? JSON.parse(local) : jsonData;
  } catch {
    state.data = structuredClone(defaultData);
  }
}

function persistData() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
}

function bindEvents() {
  el.ticketPrice.addEventListener("change", (event) => {
    state.data.campaign.ticketPrice = Number(event.target.value);
    persistData();
    renderAll();
  });

  el.paymentForm.addEventListener("submit", handlePaymentSubmit);

  el.adminUnlock.addEventListener("click", () => {
    const isValid = el.adminPassword.value === ADMIN_PASSWORD;
    el.adminFeedback.className = `feedback ${isValid ? "success" : "error"}`;
    el.adminFeedback.textContent = isValid
      ? "Acesso liberado."
      : "Senha incorreta. Tente novamente.";

    if (isValid) {
      el.adminPanel.classList.remove("hidden");
      renderAdminPreview();
    }
  });

  el.resetReservations.addEventListener("click", () => {
    state.data.tickets = state.data.tickets.filter((ticket) => ticket.status === "confirmed");
    persistData();
    renderAll();
    renderAdminPreview();
  });

  el.exportData.addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state.data, null, 2)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "rifa-dados-exportados.json";
    link.click();
    URL.revokeObjectURL(link.href);
  });
}

// Renderização central da interface.
function renderAll() {
  el.ticketPrice.value = String(state.data.campaign.ticketPrice);
  renderNumbersGrid();
  renderStats();
  renderReceipts();
  renderRanking();
}

function renderNumbersGrid() {
  el.numbersGrid.innerHTML = "";

  for (let i = 1; i <= TOTAL_NUMBERS; i += 1) {
    const statusObj = state.data.tickets.find((ticket) => ticket.number === i);
    const button = document.createElement("button");
    button.className = "number-btn";
    button.textContent = i.toString().padStart(2, "0");

    if (statusObj?.status === "reserved") {
      button.classList.add("reserved");
      button.title = "Número reservado";
      button.disabled = true;
    } else if (statusObj?.status === "confirmed") {
      button.classList.add("confirmed");
      button.title = "Número confirmado";
      button.disabled = true;
    } else if (state.selectedNumbers.has(i)) {
      button.classList.add("selected");
    }

    if (!statusObj) {
      button.addEventListener("click", () => {
        if (state.selectedNumbers.has(i)) {
          state.selectedNumbers.delete(i);
        } else {
          state.selectedNumbers.add(i);
          state.data.tickets.push({ number: i, status: "reserved", reservedAt: new Date().toISOString() });
        }
        persistData();
        renderAll();
      });
    }

    el.numbersGrid.appendChild(button);
  }
}

function renderStats() {
  const confirmedTickets = state.data.tickets.filter((ticket) => ticket.status === "confirmed");
  const soldCount = state.data.tickets.length;
  const confirmedCount = confirmedTickets.length;
  const amount = confirmedCount * state.data.campaign.ticketPrice;

  const progress = Math.min((amount / state.data.campaign.goal) * 100, 100);

  el.metaValor.textContent = formatBRL(state.data.campaign.goal);
  el.arrecadadoValor.textContent = formatBRL(amount);
  el.progressBar.style.width = `${progress}%`;
  el.progressText.textContent = `${progress.toFixed(1)}% da meta concluída`;
  el.ticketsSold.textContent = String(soldCount);
  el.ticketsConfirmed.textContent = String(confirmedCount);
  el.liveAmount.textContent = formatBRL(amount);
  el.liveTickets.textContent = String(soldCount);
}

function renderReceipts() {
  el.receiptsList.innerHTML = "";

  if (state.data.receipts.length === 0) {
    el.receiptsList.innerHTML = "<p class='muted'>Nenhum comprovante enviado ainda.</p>";
    return;
  }

  state.data.receipts
    .slice()
    .reverse()
    .forEach((receipt) => {
      const item = document.createElement("article");
      item.className = "receipt-item";
      item.innerHTML = `
        <strong>${receipt.name}</strong>
        <p class="muted">${formatBRL(receipt.amount)} • ${new Date(receipt.date).toLocaleDateString("pt-BR")}</p>
        <img src="${receipt.image}" alt="Comprovante de ${receipt.name}" />
      `;
      el.receiptsList.appendChild(item);
    });
}

function renderRanking() {
  el.supportersRanking.innerHTML = "";

  if (state.data.supporters.length === 0) {
    el.supportersRanking.innerHTML = "<li class='muted'>Seja o primeiro apoiador confirmado!</li>";
    return;
  }

  const ranking = [...state.data.supporters].sort((a, b) => b.total - a.total).slice(0, 5);

  ranking.forEach((supporter) => {
    const li = document.createElement("li");
    li.innerHTML = `${supporter.name} <strong>(${formatBRL(supporter.total)})</strong>`;
    el.supportersRanking.appendChild(li);
  });
}

function renderAdminPreview() {
  el.adminDataPreview.textContent = JSON.stringify(state.data, null, 2);
}

async function handlePaymentSubmit(event) {
  event.preventDefault();

  const name = document.getElementById("supporterName").value.trim();
  const amount = Number(document.getElementById("supporterAmount").value);
  const fileInput = document.getElementById("receiptUpload");
  const file = fileInput.files?.[0];

  if (!name || !amount || !file) {
    setFeedback("Preencha todos os campos e selecione o comprovante.", true);
    return;
  }

  const reserved = state.data.tickets.filter((ticket) => ticket.status === "reserved");
  if (reserved.length === 0) {
    setFeedback("Selecione ao menos um número para reservar antes de confirmar.", true);
    return;
  }

  const base64 = await fileToBase64(file);

  // Confirma os números reservados (simulação de validação de pagamento).
  state.data.tickets = state.data.tickets.map((ticket) =>
    ticket.status === "reserved" ? { ...ticket, status: "confirmed", confirmedAt: new Date().toISOString() } : ticket
  );

  state.data.receipts.push({
    name,
    amount,
    image: base64,
    date: new Date().toISOString(),
  });

  const existingSupporter = state.data.supporters.find((supporter) => supporter.name.toLowerCase() === name.toLowerCase());
  if (existingSupporter) {
    existingSupporter.total += amount;
  } else {
    state.data.supporters.push({ name, total: amount });
  }

  state.selectedNumbers.clear();
  persistData();
  renderAll();
  renderAdminPreview();
  el.paymentForm.reset();
  setFeedback("Pagamento registrado com sucesso! Números confirmados.", false);
}

function setFeedback(message, isError) {
  el.paymentFeedback.className = `feedback ${isError ? "error" : "success"}`;
  el.paymentFeedback.textContent = message;
}

function startCountdown() {
  const drawTime = new Date(state.data.campaign.drawDate).getTime();

  const tick = () => {
    const now = Date.now();
    const diff = drawTime - now;

    if (diff <= 0) {
      el.countdown.textContent = "Sorteio encerrado";
      return;
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((diff / (1000 * 60)) % 60);

    el.countdown.textContent = `${days}d ${hours}h ${minutes}m`;
  };

  tick();
  setInterval(tick, 1000 * 30);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

bootstrap();
