const path = require("path");
const {
  app,
  BrowserWindow,
  BrowserView,
  ipcMain,
  session,
} = require("electron");

const PROXY = "http://inthedark-proxy.fly.dev:3128";
const HOME = "https://google.com";

const TOP_PAD = 14;
const CHROME_ROW1 = 78;
const TABS_H = 44;
const GAP = 10;

let mainWindow;

let tabs = [];
let activeTabId = null;

function contentTop() {
  return TOP_PAD + CHROME_ROW1 + TABS_H + GAP;
}

function setActiveViewBounds() {
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!mainWindow || !tab) return;

  const [w, h] = mainWindow.getContentSize();
  const y = contentTop();

  tab.view.setBounds({
    x: 0,
    y,
    width: w,
    height: Math.max(0, h - y),
  });

  tab.view.setAutoResize({ width: true, height: true });
}

function sendTabsUpdate() {
  if (!mainWindow) return;
  mainWindow.webContents.send("tabs:update", {
    activeId: activeTabId,
    tabs: tabs.map((t) => ({
      id: t.id,
      title: t.title,
      url: t.url,
    })),
  });
}

function sendNavUpdate() {
  if (!mainWindow) return;
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab) return;

  mainWindow.webContents.send("nav:update", {
    url: tab.view.webContents.getURL(),
    canGoBack: tab.view.webContents.canGoBack(),
    canGoForward: tab.view.webContents.canGoForward(),
  });
}

function wireTabEvents(tab) {
  const wc = tab.view.webContents;

  const updateMeta = () => {
    tab.url = wc.getURL();
    // title can be empty briefly
    tab.title = wc.getTitle() || tab.title || "New Tab";
    sendTabsUpdate();
    if (tab.id === activeTabId) sendNavUpdate();
  };

  wc.on("page-title-updated", (e) => {
    e.preventDefault();
    updateMeta();
  });
  wc.on("did-navigate", updateMeta);
  wc.on("did-navigate-in-page", updateMeta);
  wc.on("did-finish-load", updateMeta);
}

function createTab(url = HOME, makeActive = true) {
  const id =
    "tab_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const view = new BrowserView({
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
    },
  });

  const tab = { id, view, title: "New Tab", url };
  tabs.push(tab);
  wireTabEvents(tab);

  view.webContents.loadURL(url);

  if (makeActive) switchTab(id);
  else sendTabsUpdate();

  return tab;
}

function switchTab(id) {
  const next = tabs.find((t) => t.id === id);
  if (!mainWindow || !next) return;

  // detach current
  if (activeTabId) {
    const cur = tabs.find((t) => t.id === activeTabId);
    if (cur) mainWindow.removeBrowserView(cur.view);
  }

  // attach new
  activeTabId = id;
  mainWindow.setBrowserView(next.view);
  setActiveViewBounds();
  sendTabsUpdate();
  sendNavUpdate();
}

function closeTab(id) {
  const idx = tabs.findIndex((t) => t.id === id);
  if (idx === -1) return;

  const tab = tabs[idx];

  // detach if active
  if (mainWindow && activeTabId === id) {
    mainWindow.removeBrowserView(tab.view);
  }

  // destroy resources
  tab.view.webContents.destroy();
  tabs.splice(idx, 1);

  // choose next active
  if (tabs.length === 0) {
    activeTabId = null;
    createTab(HOME, true);
    return;
  }

  if (activeTabId === id) {
    const next = tabs[Math.max(0, idx - 1)] || tabs[0];
    switchTab(next.id);
  } else {
    sendTabsUpdate();
  }
}

let liabilityWin = null;
let liabilityAccepted = false;

function showLiabilityWindow() {
  if (liabilityAccepted) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("ui:liability-required");
  }

  // IMPORTANT: detach BrowserView while modal is up (prevents weird click routing)
  detachActiveView?.();

  liabilityWin = new BrowserWindow({
    parent: mainWindow,
    modal: true,
    show: false,
    width: 820,
    height: 520,
    resizable: false,
    minimizable: false,
    maximizable: false,
    frame: false,
    backgroundColor: "#0b0f14",
    webPreferences: {
      preload: path.join(__dirname, "ui", "liability.preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      devTools: true, // turn ON temporarily until verified
    },
  });

  liabilityWin.setMenuBarVisibility(false);

  liabilityWin.loadFile(path.join(__dirname, "ui", "liability.html"));

  liabilityWin.once("ready-to-show", () => liabilityWin.show());

  liabilityWin.on("closed", () => {
    liabilityWin = null;
    if (!liabilityAccepted) app.quit();
  });
}


function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    title: "InTheDark",
    backgroundColor: "#0b0f14",
    icon: path.join(__dirname, "images/icon.ico"),
    show: false, // ✅ important so we control timing
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      devTools: false,
    },
  });

  mainWindow.removeMenu();
  mainWindow.loadFile(path.join(__dirname, "ui", "index.html"));

  mainWindow.on("resize", () => setActiveViewBounds());
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    mainWindow.focus();

    // ✅ show liability FIRST, then create tabs only after accept
    showLiabilityWindow();
  });

  // ❌ remove this from here:
  // createTab(HOME, true);
}

function getActiveTab() {
  return tabs.find((t) => t.id === activeTabId);
}

function detachActiveView() {
  const tab = getActiveTab();
  if (!mainWindow || !tab) return;
  // removeBrowserView is safe even if already removed
  try {
    mainWindow.removeBrowserView(tab.view);
  } catch {}
}

function attachActiveView() {
  const tab = getActiveTab();
  if (!mainWindow || !tab) return;
  mainWindow.setBrowserView(tab.view);
  setActiveViewBounds();
}

app.commandLine.appendSwitch("proxy-server", PROXY);

app.whenReady().then(async () => {
  try {
    await session.defaultSession.setProxy({ proxyRules: PROXY });
  } catch {}

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    if (mainWindow && !liabilityAccepted) showLiabilityWindow();
  });
});

// nav IPC
ipcMain.handle("nav:go", async (_evt, url) => {
  const tab = tabs.find((t) => t.id === activeTabId);
  if (!tab) return false;
  await tab.view.webContents.loadURL(url);
  return true;
});
ipcMain.handle("nav:back", async () => {
  const tab = tabs.find((t) => t.id === activeTabId);
  if (tab?.view.webContents.canGoBack()) tab.view.webContents.goBack();
});
ipcMain.handle("nav:forward", async () => {
  const tab = tabs.find((t) => t.id === activeTabId);
  if (tab?.view.webContents.canGoForward()) tab.view.webContents.goForward();
});
ipcMain.handle("nav:reload", async () => {
  const tab = tabs.find((t) => t.id === activeTabId);
  tab?.view.webContents.reload();
});
ipcMain.handle("nav:home", async () => HOME);

// tabs IPC
ipcMain.handle("tab:new", async (_evt, url) => {
  createTab(url || HOME, true);
  return true;
});
ipcMain.handle("tab:close", async (_evt, id) => {
  closeTab(id);
  return true;
});
ipcMain.handle("tab:switch", async (_evt, id) => {
  switchTab(id);
  return true;
});
ipcMain.handle("tab:list", async () => {
  return {
    activeId: activeTabId,
    tabs: tabs.map((t) => ({ id: t.id, title: t.title, url: t.url })),
  };
});
ipcMain.handle("app:quit", async () => {
  app.quit();
  return true;
});

ipcMain.on("liability:accept", () => {
  liabilityAccepted = true;

  // ✅ tell main UI to remove blur/lock
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("ui:liability-accepted");
  }

  if (liabilityWin) {
    liabilityWin.close();
    liabilityWin = null;
  }

  if (!activeTabId) createTab(HOME, true);
  attachActiveView?.();
  mainWindow?.focus();
});


ipcMain.on("liability:deny", () => {
  console.log("🛑 liability:deny received");
  app.quit();
});

