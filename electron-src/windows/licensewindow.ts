import { BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { format } from "url";
import { hostname, platform } from "os";
import { windowManager } from "./windowManager";
import { is } from "electron-util";

let window: BrowserWindow | null = null,
  isOpen = false;

const createBrowserWindow = () => {
  close();
  window = new BrowserWindow({
    height: 570,
    width: 400,
    fullscreen: false,
    resizable: false,
    frame: false,
    transparent: platform() === "darwin" ? true : false,
    vibrancy: "sidebar",
    titleBarStyle: "customButtonsOnHover",
    trafficLightPosition: { x: 16, y: 16 },
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: true,
      preload: join(__dirname, "../preload.js"),
    },
  });

  const url = is.development
    ? "http://localhost:8000/"
    : format({
        pathname: join(__dirname, "../../renderer/out/index.html"),
        protocol: "file:",
        slashes: true,
      });

  window.loadURL(url);
  is.development && window.webContents.openDevTools({ mode: "detach" });
  isOpen = true;
};

const close = () => {
  window?.close();
};

const windowOpenCheck = () => isOpen;

ipcMain.handle("get-hostname", (_e, _args) => {
  console.log("====================================");
  console.log(hostname());
  console.log("====================================");
  return hostname();
});

export default windowManager.setLicenseWindow({
  open: createBrowserWindow,
  close,
  isOpen: windowOpenCheck,
});
