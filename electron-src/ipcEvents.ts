import { app, ipcMain, powerMonitor, net, dialog } from "electron";
import { store } from "./utils/store";
import { windowManager } from "./windows/windowManager";
import { recorder } from "./utils/recorder";
import { tray } from "./utils/tray";
import log from "./utils/logger";
import { uniqueName } from "./utils/constants";

export const verifyUser = () => {
  const url = "https://getlapseapp.com/api/verify";
  const params = new URLSearchParams({
    host: uniqueName,
    email: "example@example.com",
    license: "12345",
  });
  const request = net.request({
    method: "POST",
    url: url,
    // headers: {
    //   "Content-Type": "application/x-www-form-urlencoded",
    // },
  });

  request.on("response", (response) => {
    let body = "";
    response.on("data", (chunk) => {
      body += chunk;
    });
    response.on("end", () => {
      const data = JSON.parse(body);
      log.info(data);
    });
  });

  request.write(params.toString());
  request.end();
};
const pauseRecordingNow = () => {
  if (recorder.isRecording()) {
    recorder.pauseRecording();
    tray.setPausedTrayMenu();
  }
};

const resumeRecordingNow = () => {
  if (recorder.isRecording()) {
    recorder.resumeRecording();
    tray.setRecordingTrayMenu();
  }
};

export default function init() {
  try {
    ipcMain.on("verified", (event, { id, email, code, name }) => {
      event.returnValue = "Verified";
      let user = {
        id,
        email,
        code,
        name,
        isVerified: true,
      };
      app.lapse.user = user;
      store.set("lapse-user", app.lapse.user);
      windowManager.license?.close();
      tray.initializeTray();
    });

    ipcMain.on("quit-app", () => {
      app.quit();
    });

    powerMonitor.on("lock-screen", () => {
      recorder.isRecording() && log.info("==> ipcEvents", "lock-screen");
      pauseRecordingNow;
    });
    powerMonitor.on("shutdown", () => {
      recorder.isRecording() && log.info("==> ipcEvents", "shutdown");

      pauseRecordingNow();
    });
    powerMonitor.on("suspend", () => {
      recorder.isRecording() && log.info("==> ipcEvents", "suspend");

      pauseRecordingNow();
    });
    powerMonitor.on("user-did-resign-active", () => {
      recorder.isRecording() &&
        log.info("==> ipcEvents", "user-did-resign-active");

      pauseRecordingNow();
    });

    powerMonitor.on("resume", () => {
      recorder.isRecording() && log.info("==> ipcEvents", "resume");

      resumeRecordingNow();
    });
    powerMonitor.on("unlock-screen", () => {
      recorder.isRecording() && log.info("==> ipcEvents", "unlock-screen");

      resumeRecordingNow();
    });
    powerMonitor.on("user-did-become-active", () => {
      recorder.isRecording() &&
        log.info("==> ipcEvents", "user-did-become-active");
      resumeRecordingNow();
    });
    // Handle unhandled promise rejections globally
    process.on("unhandledRejection", (reason, promise) => {
      log.error("Unhandled Promise Rejection at:", promise, "reason:", reason);
    });
    // Set up error handling for the renderer process
    process.on("uncaughtException", (error) => {
      log.error("Uncaught Exception:", error);
      dialog.showErrorBox(
        "Application Error",
        "The application encountered an error and will close."
      );
      app.quit();
    });

    recorder.isRecording() &&
      log.info("==> ipcEvents", "registered ipc events ");
  } catch (error) {
    log.info("==> ipcEvents", error);
  }
}
