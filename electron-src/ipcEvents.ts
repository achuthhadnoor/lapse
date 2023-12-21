import { app, ipcMain, powerMonitor, net } from "electron";
import { store } from "./utils/store";
import { windowManager } from "./windows/windowManager";
import { recorder } from "./utils/recorder";
import { tray } from "./utils/tray";
import log from "./utils/logger";

export const verifyUser = () => {
  const url = "https://getlapseapp.com/api/verify";
  const params = new URLSearchParams({
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
      log.info("==> ipcEvents", "lock-screen");
      pauseRecordingNow;
    });
    powerMonitor.on("shutdown", () => {
      log.info("==> ipcEvents", "shutdown");

      pauseRecordingNow();
    });
    powerMonitor.on("suspend", () => {
      log.info("==> ipcEvents", "suspend");

      pauseRecordingNow();
    });
    powerMonitor.on("user-did-resign-active", () => {
      log.info("==> ipcEvents", "user-did-resign-active");

      pauseRecordingNow();
    });

    powerMonitor.on("resume", () => {
      log.info("==> ipcEvents", "resume");

      resumeRecordingNow();
    });
    powerMonitor.on("unlock-screen", () => {
      log.info("==> ipcEvents", "unlock-screen");

      resumeRecordingNow();
    });
    powerMonitor.on("user-did-become-active", () => {
      log.info("==> ipcEvents", "user-did-become-active");
      resumeRecordingNow();
    });
    log.info("==> ipcEvents", "registered ipc events ");
  } catch (error) {
    log.info("==> ipcEvents", error);
  }
}
