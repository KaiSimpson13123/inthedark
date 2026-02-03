const urlInput = document.getElementById("url");
const backBtn = document.getElementById("back");
const forwardBtn = document.getElementById("forward");
const reloadBtn = document.getElementById("reload");
const homeBtn = document.getElementById("home");
const navForm = document.getElementById("navForm");
const newTabBtn = document.getElementById("newTab");
const tabsList = document.getElementById("tabsList");


const modal = document.getElementById("liabilityModal");
const acceptBtn = document.getElementById("acceptBtn");
const denyBtn = document.getElementById("denyBtn");

// Optional: remember acceptance for future launches
const AGREED_KEY = "inthedark_liability_accepted_v1";

function unlockUI() {
  document.body.classList.remove("isLocked");

  // If you have an overlay element in the main UI, hide it too:
  const modal = document.getElementById("liabilityModal");
  if (modal) {
    modal.classList.remove("isOpen");
    modal.setAttribute("aria-hidden", "true");
  }
}


window.InTheDarkUI?.onLiabilityAccepted?.(() => {
  unlockUI();
});

function lockUI() {
  document.body.classList.add("isLocked");
}

window.InTheDarkUI?.onLiabilityRequired?.(() => {
  lockUI();
});


function openLiabilityModal() {
  document.body.classList.add("isLocked");
  modal.classList.add("isOpen");
  modal.setAttribute("aria-hidden", "false");
}

function closeLiabilityModal() {
  modal.classList.remove("isOpen");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("isLocked");
}

window.addEventListener("DOMContentLoaded", () => {
  const alreadyAgreed = localStorage.getItem(AGREED_KEY) === "true";
  if (!alreadyAgreed) openLiabilityModal();
});

acceptBtn?.addEventListener("click", () => {
  localStorage.setItem(AGREED_KEY, "true");
  closeLiabilityModal();
});

denyBtn?.addEventListener("click", () => {
  // Close the app via IPC
  window.InTheDark?.quit?.();
});


function normalizeUrl(input) {
  const trimmed = (input || "").trim();
  if (!trimmed) return "https://google.com";

  const looksLikeUrl = /^https?:\/\//i.test(trimmed) || /\./.test(trimmed);
  if (looksLikeUrl) return /^https?:\/\//i.test(trimmed) ? trimmed : "https://" + trimmed;

  return "https://google.com/search?q=" + encodeURIComponent(trimmed);
}

function renderTabs(tabsState) {
  const { activeId, tabs } = tabsState;

  tabsList.innerHTML = "";
  for (const t of tabs) {
    const el = document.createElement("div");
    el.className = "tab" + (t.id === activeId ? " tab--active" : "");
    el.title = t.url || "";

    const title = document.createElement("div");
    title.className = "tab__title";
    title.textContent = t.title || "New Tab";

    const close = document.createElement("button");
    close.className = "tab__close";
    close.type = "button";
    close.textContent = "×";
    close.title = "Close";

    close.addEventListener("click", async (e) => {
      e.stopPropagation();
      await window.InTheDark.closeTab(t.id);
    });

    el.addEventListener("click", async () => {
      await window.InTheDark.switchTab(t.id);
    });

    el.appendChild(title);
    el.appendChild(close);
    tabsList.appendChild(el);
  }
}

// Buttons
backBtn.addEventListener("click", () => window.InTheDark.back());
forwardBtn.addEventListener("click", () => window.InTheDark.forward());
reloadBtn.addEventListener("click", () => window.InTheDark.reload());
homeBtn.addEventListener("click", async () => window.InTheDark.go(await window.InTheDark.home()));
newTabBtn.addEventListener("click", async () => window.InTheDark.newTab("https://google.com"));

// Address submit
navForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const target = normalizeUrl(urlInput.value);
  await window.InTheDark.go(target);
});

// Sync nav state
window.InTheDark.onNavUpdate(({ url, canGoBack, canGoForward }) => {
  if (typeof url === "string") urlInput.value = url;
  backBtn.disabled = !canGoBack;
  forwardBtn.disabled = !canGoForward;
});

// Sync tabs state
window.InTheDark.onTabsUpdate((tabsState) => {
  renderTabs(tabsState);
});

// Initial load tabs list on startup
(async () => {
  const state = await window.InTheDark.listTabs();
  renderTabs(state);
})();
