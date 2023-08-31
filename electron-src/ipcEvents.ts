import { app, ipcMain, powerMonitor, net } from "electron";
import { store } from "./utils/store";
import { initializeTray, setPausedTray, setRenderingTray } from "./utils/tray";
import { windowManager } from "./windows/windowManager";
import {
  PAUSED,
  RECORDING,
  getRecordingState,
  pauseRecording,
  resumeRecording,
} from "./utils/recorder";

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
      console.log(data);
    });
  });

  request.write(params.toString());
  request.end();
};
const pauseRecordingNow = () => {
  if (getRecordingState() === RECORDING) {
    pauseRecording();
    setPausedTray();
  }
};

const resumeRecordingNow = () => {
  if (getRecordingState() === PAUSED) {
    resumeRecording();
    setRenderingTray();
  }
};

export default function init() {
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
    // createTray();
    initializeTray();
  });

  ipcMain.on("quit-app", () => {
    app.quit();
  });

  powerMonitor.on("lock-screen", pauseRecordingNow);
  powerMonitor.on("shutdown", pauseRecordingNow);
  powerMonitor.on("suspend", pauseRecordingNow);
  powerMonitor.on("user-did-resign-active", pauseRecordingNow);
  powerMonitor.on("resume", resumeRecordingNow);
  powerMonitor.on("unlock-screen", resumeRecordingNow);
  powerMonitor.on("user-did-become-active", resumeRecordingNow);
}
