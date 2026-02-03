const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("Liability", {
  accept: () => ipcRenderer.send("liability:accept"),
  deny: () => ipcRenderer.send("liability:deny"),
});
