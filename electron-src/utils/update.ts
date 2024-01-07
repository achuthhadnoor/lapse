import { app } from "electron";
import { autoUpdater } from "electron-updater";
import showNotification from "../notify";
import log from "./logger";
log.info("update: checking for updates...");
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

autoUpdater.checkForUpdates();
console.log("====================================");
console.log("update: checking for updates");
console.log("====================================");

autoUpdater.on("update-available", (info) => {
  log.info("new Update available =>>>>", info);
  const path = autoUpdater.downloadUpdate();
  app.lapse.settings.updateAvailable = true;
  showNotification(`Update available and downloaded at ${path}`);
});

autoUpdater.on("update-not-available", () => {
  log.info("update: no update available");
});
autoUpdater.on("update-downloaded", () => {
  showNotification(`Update downloaded `);
  log.info("update: Update downloaded");
});
autoUpdater.on("error", (info) => {
  log.error(`Update could not be downloaded due to ${info}`);
  showNotification(`Update could not be downloaded due to ${info}`);
});

export const DownloadUpdate = () => {
  autoUpdater.downloadUpdate();
};
