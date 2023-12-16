import { BrowserWindow, app, dialog, net, screen, shell } from "electron";
import { is } from "electron-util";
import { join } from "path";
import { format } from "url";
import AutoLaunch from "auto-launch";
import { store } from "./store";

export const autoLauncher = new AutoLaunch({
  name: "Lapse",
  path: "/Applications/Lapse.app",
});

export const checkIfAppIsOpen = () => {
  const gotTheLock = app.requestSingleInstanceLock();

  if (!gotTheLock) {
    app.quit();
  } else {
    app.on("second-instance", () => {
      app.focus();
    });
  }
};

export const sendUpdateRequest = async (click: boolean) => {
  const apiUrl = is.development
    ? "http://localhost:3000/api/updates"
    : "https://getlapseapp.com/api/updates";

  try {
    const response = await new Promise<string>((resolve, reject) => {
      const request = net.request(apiUrl);
      request.on("response", (res) => {
        let data = "";
        res.on("data", (chunk) => {
          data += chunk;
        });
        res.on("end", () => {
          resolve(data);
        });
      });
      request.on("error", (error) => {
        reject(error);
      });
      request.end();
    });

    const data = JSON.parse(response);

    if (app.getVersion() !== data.version) {
      const { response } = await dialog.showMessageBox({
        type: "info",
        buttons: ["Download Updates", "Cancel"],
        defaultId: 0,
        message: "New Update available",
        detail: "Click below to download the latest version",
        cancelId: 1,
      });

      if (response === 0) {
        const downloadUrl = `https://getlapseapp.com/download?email=${app.lapse.user.email}&&code=${app.lapse.user.code}`;
        shell.openExternal(downloadUrl);
      }
    } else if (click) {
      await dialog.showMessageBox({
        type: "info",
        buttons: ["OK"],
        defaultId: 0,
        message: "Lapse runs the latest version already",
      });
    }
  } catch (error) {
    console.error("Error during update check:", error);
  }
};

export const checkUpdates = () => {
  const savedDate = store.get("lapse-updateDate");
  const currentDate = new Date().toLocaleDateString();

  if (savedDate !== currentDate) {
    sendUpdateRequest(false);
    store.set("lapse-updateDate", currentDate);
  }
};

export const createTempWindow = ({ windowOptions, screenName, func }: any) => {
  const screenBounds = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  ).bounds;
  let dialogWindow: BrowserWindow | null = new BrowserWindow({
    height: screenBounds.height,
    width: screenBounds.width,
    show: false,
    alwaysOnTop: true,
    transparent: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: true,
      preload: join(__dirname, "../preload.js"),
    },
    ...windowOptions,
  });

  const url = is.development
    ? `http://localhost:8000/${screenName}`
    : format({
        pathname: join(__dirname, `../../renderer/out/${screenName}.html`),
        protocol: "file:",
        slashes: true,
      });

  dialogWindow.loadURL(url);
  is.development && dialogWindow.webContents.openDevTools({ mode: "detach" });

  dialogWindow.webContents.on("did-finish-load", () => {
    func && func();
  });

  dialogWindow.on("closed", () => {
    dialogWindow = null;
  });

  return dialogWindow;
};

export const getGlobalShortCut = () => {
  return "meta+option+l";
};
