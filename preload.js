const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("InTheDark", {
  // navigation
  go: (url) => ipcRenderer.invoke("nav:go", url),
  back: () => ipcRenderer.invoke("nav:back"),
  forward: () => ipcRenderer.invoke("nav:forward"),
  reload: () => ipcRenderer.invoke("nav:reload"),
  home: () => ipcRenderer.invoke("nav:home"),

  // tabs
  newTab: (url) => ipcRenderer.invoke("tab:new", url),
  closeTab: (id) => ipcRenderer.invoke("tab:close", id),
  switchTab: (id) => ipcRenderer.invoke("tab:switch", id),
  listTabs: () => ipcRenderer.invoke("tab:list"),

  // events
  onNavUpdate: (cb) => ipcRenderer.on("nav:update", (_e, payload) => cb(payload)),
  onTabsUpdate: (cb) => ipcRenderer.on("tabs:update", (_e, payload) => cb(payload)),

  quit: () => ipcRenderer.invoke("app:quit"),
  onLiabilityAccepted: (cb) => ipcRenderer.on("ui:liability-accepted", cb),
  onLiabilityRequired: (cb) => ipcRenderer.on("ui:liability-required", cb),
});
