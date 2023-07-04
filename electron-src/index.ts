import { app, BrowserWindow, shell } from "electron";
import { enforceMacOSAppLocation, is } from "electron-util";
import prepareNext from "electron-next";

import "./windows/load";
import "./utils/recorder";
import ipcEvents from "./ipcEvents";

import { ensureScreenCapturePermissions } from "./utils/permission";

import { checkForUpdates, initializeTray } from "./utils/tray";
import { getRecordingState, RECORDING, stopRecording } from "./utils/recorder";
import { windowManager } from "./windows/windowManager";
import { checkIfAppIsOpen } from "./utils/lib";
import { getAppData } from "./utils/store";

ipcEvents();
checkIfAppIsOpen();
/*
 * load all global variables to app.lapse so it is easy to use in other files
 */
getAppData();

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
