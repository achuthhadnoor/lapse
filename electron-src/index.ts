import { app, dialog, shell } from "electron";
import { enforceMacOSAppLocation, is } from "electron-util";
import prepareNext from "electron-next";
import log from "./utils/logger";

import "./windows/load";
import "./utils/recorder";
import ipcEvents from "./ipcEvents";
// import { ensureScreenCapturePermissions } from "./utils/permission";
import { initializeTray } from "./utils/tray";
import { getRecordingState, stopRecording } from "./utils/recorder";
import { windowManager } from "./windows/windowManager";
import { checkIfAppIsOpen, checkUpdates } from "./utils/lib";
import { loadAppData } from "./utils/store";
import { RECORDER_STATE } from "./utils/constants";

log.info("Starting the application...");
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

app.allowRendererProcessReuse = true;

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
    log.info("Application is ready.");
  } catch (error) {
    log.error("Error during app initialization:", error);
    dialog.showErrorBox(
      "Initialization Error",
      "An error occurred during application initialization."
    );
    app.quit();
  }
  // ? check for updates
  // ? user is verified to start using the app
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
    windowManager.license?.open();
  }
  !is.development && checkUpdates();

  // ? The app does not quit on closing all windows on macOS
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      log.info("All windows closed. Quitting the app.");
      app.quit();
    }
  });

  app.on("before-quit", async () => {
    // ! Pause and ask the user to save recording or not
    // ? Prompt the user to save recording before quit
    if (getRecordingState() === RECORDER_STATE.recording) {
      log.info("Recording in progress. Stopping recording before quitting.");
      await stopRecording();
    }

    log.info("Before quit event received. Exiting...");
  });
  // Log when the app is activated
  app.on("activate", () => {
    log.info("Application activated.");
  });
});
