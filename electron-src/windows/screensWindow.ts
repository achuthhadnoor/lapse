import { BrowserWindow, ipcMain } from "electron";
import { join } from "path";
import { format } from "url";
import { platform } from "os";
import { windowManager } from "./windowManager";
import { is } from "electron-util";
// const { activateWindow } = require("mac-windows");

let window: BrowserWindow | null = null;
let isOpen = false;
let selectedSourceId: string = "0";
let closeWindowMessage = false;

const createBrowserWindow = () => {
  close();
  window = new BrowserWindow({
    height: 600,
    width: 500,
    fullscreen: false,
    resizable: false,
    frame: false,
    alwaysOnTop: true,
    transparent: platform() === "darwin" ? true : false,
    vibrancy: "sidebar",
    skipTaskbar: true,
    // hiddenInMissionControl: true,
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: true,
      preload: join(__dirname, "../preload.js"),
    },
  });
  window.setSkipTaskbar(false);

  const url = is.development
    ? "http://localhost:8000/screens"
    : format({
        pathname: join(__dirname, "../../renderer/out/screens.html"),
        protocol: "file:",
        slashes: true,
      });

  window.loadURL(url);
  is.development && window.webContents.openDevTools({ mode: "detach" });

  const selectScreen = (_e: any, args: any) => {
    // Check if the window still exists before interacting with it
    if (!window || window.isDestroyed()) {
      return;
    }

    // activateWindow(args.ownerName);
    selectedSourceId = args.id;

    // Close the window once the source is selected
    close();
  };

  const closeScreen = (_e: any, _args: any) => {
    // Check if the window still exists before interacting with it
    if (!window || window.isDestroyed()) {
      return;
    }
    close();
    closeWindowMessage = true;
  };

  window?.webContents.on("did-finish-load", () => {
    ipcMain.once("selected-screen", selectScreen);
    ipcMain.once("close-screen", closeScreen);
  });

  window?.on("closed", () => {
    // Remove event listeners when the window is closed
    ipcMain.removeListener("selected-screen", selectScreen);
    ipcMain.removeListener("close-screen", closeScreen);

    if (closeWindowMessage) {
      closeWindowMessage = false;
    } else {
      // Return selectedSourceId only if the window was not closed by the closeScreen function
      return selectedSourceId;
    }
  });

  isOpen = true;
};

const close = () => {
  if (window && !window.isDestroyed()) {
    // Check if the window is destroyed before attempting to close it
    window.close();
  }
};

const windowOpenCheck = () => isOpen;

export default windowManager.setScreensWindow({
  open: createBrowserWindow,
  close,
  isOpen: windowOpenCheck,
});
