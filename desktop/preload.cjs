const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("teamakingDesktop", {
  runtime: "desktop"
});
