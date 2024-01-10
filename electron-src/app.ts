import { app, shell } from "electron";
import prepareNext from "electron-next";
import log from "./utils/logger";
import { loadAppData } from "./utils/store";
import initializeIPCEvents from "./ipcEvents";
import { enforceMacOSAppLocation, is } from "electron-util";
import { autoLauncher } from "./utils/lib";
import { windowManager } from "./windows/windowManager";
import { tray } from "./utils/tray";

class StartupApp {
  lapse = {};

  init = async () => {
    log.info("Starting the application...");
    loadAppData();
    this.lapse = app.lapse;
    initializeIPCEvents();

    app.setAboutPanelOptions({ copyright: "Copyright © lapse" });

    // Set default protocol to app name lapse:// like notion:// to capture sign in
    if (!app.isDefaultProtocolClient("lapse")) {
      app.setAsDefaultProtocolClient("lapse");
    }

    // Ensure the .app is moved to the application folder as it will only be in read-only mode outside that
    if (!is.development) {
      enforceMacOSAppLocation();
    }
    // Load the Next.js app
    try {
      await prepareNext("./renderer");
      log.info("==> renderer", "loaded renderer");
    } catch (error) {
      log.error("Error loading renderer:", error);
    }
    if (app.lapse.user.isVerified) {
      this.initTray();
      if (!is.development) {
        // Enable auto-launch if configured
        app.lapse.settings.autolaunch && autoLauncher.enable();
      }
    } else {
      // License verification
      this.licenseCheck();
    }
  };

  initTray = () => {
    // Additional logic for verified users
    // Hide the dock icon to shift the user focus to the menubar
    if (app.dock) app.dock.hide();

    // Initialize the tray menu
    tray.initializeTray();

    // Give a beep sound saying the app is loaded and ready to use
    shell.beep();
  };

  // startRecording = ()=>{}

  // retakeRecording = ()=>{}

  // pauseRecording = ()=>{}

  // resumeRecording = ()=>{}

  // updateSettings = ()=>{}

  licenseCheck = () => {
    // License verification
    log.info("license window opening...");
    windowManager.license?.open();
  };
}

export default new StartupApp();
