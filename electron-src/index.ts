import { app, BrowserWindow, shell } from "electron";
import AutoLaunch from "auto-launch";
import Store from "electron-store";
import { enforceMacOSAppLocation, is } from "electron-util";
import prepareNext from "electron-next";

import "./windows/load";
import "./utils/recorder";
import ipcEvents from "./ipcEvents";

import { ensureScreenCapturePermissions } from "./utils/permission";

import { checkForUpdates, initializeTray } from "./utils/tray";
import { getRecordingState, RECORDING, stopRecording } from "./utils/recorder";
import { windowManager } from "./windows/windowManager";

ipcEvents();

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    app.focus();
  });
}

export const store = new Store();

export const autoLauncher = new AutoLaunch({
  name: "Lapse",
  path: "/Applications/Lapse.app",
});

/*
 * load all global variables to app.lapse so it is easy to use in other files
 */
app.lapse = {
  timerText: "00:00:00",
  user: {
    id: "",
    email: "",
    code: "",
    name: "",
    isVerified: false,
  },
  settings: {
    showTimer: true,
    intervals: 2, // 2,3,4,5
    countdown: true,
    imageType: "png",
    imagesDir: "~/var/temp/lapse/",
    framerate: 30, //12 24,30,60,
    format: "mp4",
    quality: "auto", //256 12 18 24 30 36 42 48
    key: null,
    autolaunch: true,
    savePath: `${app.getPath("documents")}/lapse`,
    height: "1080",
    width: "1920",
  },
};
// ? only un comment to clear the data including licence
// store.set("lapse-settings", app.lapse.settings);
// store.set("lapse-user", app.lapse.user);

if (store.get("lapse-user")) {
  app.lapse.user = store.get("lapse-user");
} else {
  store.set("lapse-user", app.lapse.user);
}
if (store.get("lapse-settings")) {
  app.lapse.settings = store.get("lapse-settings");
} else {
  store.set("lapse-settings", app.lapse.settings);
}

const checkUpdates = () => {
  if (store.get("lapse-updateDate")) {
    const savedDate = store.get("lapse-updateDate");
    const dates = new Date();
    const dateString = `${dates.getDate()}-${dates.getMonth()}-${dates.getFullYear()}`;
    if (savedDate !== dateString) {
      checkForUpdates(false);
    }
  } else {
    const dates = new Date();
    const dateString = `${dates.getDate()}-${dates.getMonth()}-${dates.getFullYear()}`;
    store.set("lapse-updateDate", dateString);
  }
};

app.whenReady().then(async () => {
  app.commandLine.appendSwitch("disable-features", "CrossOriginOpenerPolicy");
  app.setAboutPanelOptions({ copyright: "Copyright © lapse" });

  if (!app.isDefaultProtocolClient("lapse")) {
    app.setAsDefaultProtocolClient("lapse");
  }
  !is.development && enforceMacOSAppLocation();
  await prepareNext("./renderer");
  !is.development && checkUpdates();

  if (
    !app.getLoginItemSettings().wasOpenedAtLogin &&
    ensureScreenCapturePermissions() &&
    app.lapse.user.isVerified
  ) {
    if (app.dock) app.dock.hide();
    shell.beep();
    initializeTray();
  } else {
    windowManager.main?.open();
  }

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
    }
  });

  app.on("before-quit", async () => {
    if (getRecordingState() === RECORDING) {
      await stopRecording();
    }
  });
});
