import { BrowserWindow } from "electron";
import { join } from "path";
import { format } from "url";
import { platform } from "os";
import { windowManager } from "./windowManager";
import { is } from "electron-util";

let window: BrowserWindow | null = null,
  isOpen = false;

const createBrowserWindow = () => {
  close();
  window = new BrowserWindow({
    width: 300,
    height: 350,
    fullscreen: false,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    transparent: platform() === "darwin" ? true : false,
    vibrancy: "sidebar",
    webPreferences: {
      // devTools: true,
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

export default windowManager.setMainWindow({
  open: createBrowserWindow,
  close,
  isOpen: windowOpenCheck,
});
