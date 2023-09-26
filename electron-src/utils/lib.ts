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

export const sendUpdateRequest = (click: boolean) => {
  // get latest version number and compare with app.getVersion() and send notification to user
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
      if (app.getVersion() !== data.version) {
        const { response } = await dialog.showMessageBox({
          type: "info",
          buttons: ["Download Updates", "Cancel"],
          defaultId: 0,
          message: "New Update available",
          detail: "Click below to download latest version",
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
  if (store.get("lapse-updateDate")) {
    const savedDate = store.get("lapse-updateDate");
    const dates = new Date();
    const dateString = `${dates.getDate()}-${dates.getMonth()}-${dates.getFullYear()}`;
    if (savedDate !== dateString) {
      sendUpdateRequest(false);
    }
  } else {
    const dates = new Date();
    const dateString = `${dates.getDate()}-${dates.getMonth()}-${dates.getFullYear()}`;
    store.set("lapse-updateDate", dateString);
  }
};

export const createTempWindow = ({ windowOptions, screenName, func }: any) => {
  const screenBounds = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  ).bounds;
  let dialogWindow: BrowserWindow | null = new BrowserWindow({
    height: screenBounds.height,
    width: screenBounds.width,
    show: false, // Create the window initially hidden
    alwaysOnTop: true,
    transparent: true,
    frame: false,
    webPreferences: {
      // devTools: true,
      nodeIntegration: true,
      allowRunningInsecureContent: true,
      preload: join(__dirname, "../preload.js"),
    },
    ...windowOptions,
  });
  // Load a blank HTML page
  const url = is.development
    ? `http://localhost:8000/${screenName}`
    : format({
        pathname: join(__dirname, `../../renderer/out/${screenName}.html`),
        protocol: "file:",
        slashes: true,
      });
  dialogWindow.loadURL(url);
  is.development && dialogWindow.webContents.openDevTools({ mode: "detach" });

  // When the window is ready, show the dialog
  dialogWindow.webContents.on("did-finish-load", () => {
    // do the logic here
    func && func();
  });
  // Handle the dialog window being closed
  dialogWindow.on("closed", () => {
    dialogWindow = null;
  });
  return dialogWindow;
};

export const getGlobalShortCut = () => {
  // ! Here we need to handle global shortcuts
  return "meta+option+l";
};
