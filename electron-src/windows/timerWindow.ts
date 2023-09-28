import { BrowserWindow, ipcMain, screen } from "electron";
import { join } from "path";
import { format } from "url";
import { windowManager } from "./windowManager";
import { is } from "electron-util";
import { recorder } from "../utils/recorder";

let window: BrowserWindow | null = null;
let isOpen = false;

const createBrowserWindow = (srcId: any) => {
  close();
  // Create a temporary browser window to show the timer and close it once done
  const screenBounds = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  ).bounds;

  window = new BrowserWindow({
    height: screenBounds.height,
    width: screenBounds.width,
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

  // Load a blank HTML page
  const url = is.development
    ? "http://localhost:8000/timer"
    : format({
        pathname: join(__dirname, "../../renderer/out/timer.html"),
        protocol: "file:",
        slashes: true,
      });

  window.loadURL(url);

  window.webContents.on("did-finish-load", () => {
    ipcMain.once("done-timer", () => {
      close();
      recorder.createScreenshotInterval(srcId);
    });
  });

  window.setIgnoreMouseEvents(true);
  isOpen = true;
};

const close = () => {
  if (window) {
    window.close();
    window = null; // Set window to null after closing
  }
};

const windowOpenCheck = () => isOpen;

export default windowManager.setScreensWindow({
  open: createBrowserWindow,
  close,
  isOpen: windowOpenCheck,
});
