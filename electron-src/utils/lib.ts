import { BrowserWindow, app, dialog, net, screen, shell } from "electron";
import { is } from "electron-util";
import { join } from "path";
import { format } from "url";
import AutoLaunch from "auto-launch";
import { store, updateStoreSettings } from "./store";
import { tray } from "./tray";
import { recorder } from "./recorder";

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
      !recorder.isRecording() && tray.setIdleTrayMenu();
    });
  }
};

export const sendUpdateRequest = async (click: boolean) => {
  const url = is.development
    ? "http://localhost:3000/api/updates"
    : "https://getlapseapp.com/api/updates";
  const request = net.request(url);
  console.log("==> updates", "checking for updates");
  request.on("response", (response) => {
    let body = "";
    response.on("data", (chunk) => {
      body += chunk;
    });
    response.on("end", async () => {
      const data = JSON.parse(body);
      console.log(`Version: ${data.version}`);
      if (
        Number(app.getVersion().split(".").join()) <
        Number(data.version.split(".").join())
      ) {
        const { response } = await dialog.showMessageBox({
          type: "info",
          buttons: ["Download Updates", "Cancel"],
          defaultId: 0,
          message: "New Update available",
          detail: `You are on ${app.getVersion()}. Latest version ${
            data.version
          } is available`,
          cancelId: 1,
        });
        if (response === 0) {
          console.log("====================================");
          console.log(
            "==> updates",
            `https://getlapseapp.com/download?email=${app.lapse.user.email}&&code=${app.lapse.user.code}`
          );
          console.log("====================================");
          shell.openExternal(
            `https://getlapseapp.com/download?email=${app.lapse.user.email}&&code=${app.lapse.user.code}`
          );
        }
      } else {
        if (click) {
          console.log("==> updates", "same version");
          await dialog.showMessageBox({
            type: "info",
            buttons: ["ok"],
            defaultId: 0,
            message: "Lapse runs the latest version already",
          });
        }
      }
    });
  });
  request.on("error", (err) => {
    console.log("====================================");
    console.log("==> updates", err);
    console.log("====================================");
  });
  request.end();
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

export const updateSettings = (newSettings: any) => {
  try {
    app.lapse.settings = {
      ...app.lapse.settings,
      ...newSettings,
    };
    updateStoreSettings(app.lapse.settings);
  } catch (error) {
    console.error("Error updating settings:", error);
  }
};

export const trimSavedPath = (inputString: string) => {
  if (inputString.length > 30) {
    const trimmedString = "...." + inputString.slice(-26);
    return trimmedString;
  }
  return inputString;
};

export const appIcon =
  process.platform === "darwin"
    ? join(__dirname, "../../build/appTemplate.png")
    : join(__dirname, "../../build/lapse.ico");
export const recordIcon =
  process.platform === "darwin"
    ? join(__dirname, "../../build/recordTemplate.png")
    : join(__dirname, "../../build/lapse.ico");
export const loadingIcon =
  process.platform === "darwin"
    ? join(__dirname, "../../build/loadingTemplate.png")
    : join(__dirname, "../../build/lapse.ico");
export const pauseIcon =
  process.platform === "darwin"
    ? join(__dirname, "../../build/pauseTemplate.png")
    : join(__dirname, "../../build/lapse.ico");
