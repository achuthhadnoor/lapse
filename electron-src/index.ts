import { app, shell } from "electron";
import { enforceMacOSAppLocation, is } from "electron-util";
import prepareNext from "electron-next";

import "./windows/load";
import "./utils/recorder";
import ipcEvents from "./ipcEvents";
import { ensureScreenCapturePermissions } from "./utils/permission";
import { initializeTray } from "./utils/tray";
import { getRecordingState, stopRecording } from "./utils/recorder";
import { windowManager } from "./windows/windowManager";
import { autoLauncher, checkIfAppIsOpen, checkUpdates } from "./utils/lib";
import { loadAppData } from "./utils/store";
import { RECORDER_STATE } from "./utils/constants";

// ? Check open state to avoid duplicate app launches
checkIfAppIsOpen();
// ? Load app data
loadAppData();
// ? init IPC Events
ipcEvents();

app.whenReady().then(async () => {
  // ? Disable CORS to send API request from the browserView
  app.commandLine.appendSwitch("disable-features", "CrossOriginOpenerPolicy");
  // ? About panel when user press space bar on the app icon
  app.setAboutPanelOptions({ copyright: "Copyright © lapse" });
  // ? Set default protocol to app name lapse:// like notion:// to capture sign in
  if (!app.isDefaultProtocolClient("lapse")) {
    app.setAsDefaultProtocolClient("lapse");
  }
  // * Ensure the .app is moved to application folder as it will only be in read-only mode outside that
  !is.development && enforceMacOSAppLocation();
  // ? Load the nextJS app
  try {
    await prepareNext("./renderer");
    console.log("==> renderer", "loaded renderer");
  } catch (error) {
    console.log("====================================");
    console.log("==> renderer", error);
    console.log("====================================");
  }
  // ? check for updates
  // ? Check for permissions & user is verified to start using the app
  if (ensureScreenCapturePermissions()) {
    if (
      !app.getLoginItemSettings().wasOpenedAtLogin &&
      app.lapse.user.isVerified
    ) {
      // ! We can add an onboarding logic of explaining how to use the app
      //? hide the dock icon to shift the uSer focus to the menubar
      if (app.dock) app.dock.hide();
      // ? Initialize the tray menu
      initializeTray();
      // ? Give a beep sound saying the app is loaded and ready to use
      shell.beep();
    } else {
      // ? License verification
      console.log("==> ipcEvents", "license window opening...");
      windowManager.license?.open();
    }
    if (!is.development) {
      checkUpdates();
      app.lapse.settings.autolaunch && autoLauncher.enable();
    }
  }
  // ? The app does not quit on closing all windows on MacOs
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  app.on("before-quit", async () => {
    // ! Pause and ask user to save recording or not
    // ? Prompt the user to save recording before quit
    if (getRecordingState() === RECORDER_STATE.recording) {
      await stopRecording();
    }
  });
});
