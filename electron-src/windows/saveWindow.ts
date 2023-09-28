import { app, BrowserWindow, dialog, screen } from "electron";
import { join } from "path";
import { format } from "url";
import { windowManager } from "./windowManager";
import { is } from "electron-util";
import { recorder } from "../utils/recorder";

let window: BrowserWindow | null = null;
let isOpen = false;

const createBrowserWindow = () => {
  close();
  const screenBounds = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  ).bounds;

  window = new BrowserWindow({
    height: screenBounds.height,
    width: screenBounds.width,
    show: false,
    alwaysOnTop: true,
    transparent: true,
    frame: false,
    hiddenInMissionControl: true,
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: true,
      preload: join(__dirname, "../preload.js"),
    },
  });

  const url = is.development
    ? "http://localhost:8000/empty"
    : format({
        pathname: join(__dirname, "../../renderer/out/empty.html"),
        protocol: "file:",
        slashes: true,
      });

  window.loadURL(url);
  is.development && window.webContents.openDevTools({ mode: "detach" });

  // When the window is ready, show the dialog
  window.webContents.on("did-finish-load", async () => {
    if (window) {
      const result = await dialog.showSaveDialog(window, {
        title: "Save File",
        defaultPath: `${app.lapse.settings.savePath}/lapse-${Date.now()}.${
          app.lapse.settings.format
        }`,
      });
      window.focus();

      if (!window.isDestroyed()) {
        // Check if the window is destroyed before accessing it
        if (!result.canceled) {
          const path: any = result.filePath;
          recorder.prepareVideo(path);
        } else {
          recorder.initVariables();
        }
        close();
      }
    }
  });

  isOpen = true;
};

const close = () => {
  if (window && !window.isDestroyed()) {
    // Check if the window is destroyed before attempting to close it
    window.close();
    window = null;
  }
};

const windowOpenCheck = () => isOpen;

export default windowManager.setSaveWindow({
  open: createBrowserWindow,
  close,
  isOpen: windowOpenCheck,
});
