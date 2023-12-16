import { app, ipcMain, powerMonitor, net } from "electron";
import { store } from "./utils/store";
import { initializeTray, setPausedTray, setRecordingTray } from "./utils/tray";
import { windowManager } from "./windows/windowManager";
import {
  getRecordingState,
  pauseRecording,
  resumeRecording,
} from "./utils/recorder";
import { RECORDER_STATE } from "./utils/constants";

const API_URL = "https://getlapseapp.com/api/verify";

export const makeApiRequest = (email: any, license: any) => {
  const params = new URLSearchParams({
    email,
    license,
  });

  const request = net.request({
    method: "POST",
    url: API_URL,
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
  if (getRecordingState() === RECORDER_STATE.recording) {
    pauseRecording();
    setPausedTray();
  }
};

const resumeRecordingNow = () => {
  if (getRecordingState() === RECORDER_STATE.paused) {
    resumeRecording();
    setRecordingTray();
  }
};

const handlePowerEvent = (event: any) => {
  console.log(event);
  pauseRecordingNow();
};

export default function init() {
  ipcMain.on("verified", (event, { id, code, name }) => {
    event.returnValue = "Verified";
    const user = {
      id,
      code,
      name,
      isVerified: true,
    };
    app.lapse.user = user;
    store.set("lapse-user", app.lapse.user);
    windowManager.license?.close();
    initializeTray();
  });

  ipcMain.on("quit-app", () => {
    app.quit();
  });

  powerMonitor.on("lock-screen", handlePowerEvent);
  powerMonitor.on("shutdown", handlePowerEvent);
  powerMonitor.on("suspend", handlePowerEvent);
  powerMonitor.on("user-did-resign-active", handlePowerEvent);
  powerMonitor.on("resume", resumeRecordingNow);
  powerMonitor.on("unlock-screen", resumeRecordingNow);
  powerMonitor.on("user-did-become-active", resumeRecordingNow);
}
