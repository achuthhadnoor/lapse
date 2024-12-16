import { app, dialog, shell, systemPreferences } from "electron";
import { is, enforceMacOSAppLocation } from "electron-util";
import prepareNext from "electron-next";
import log from "./utils/logger";

import "./windows/load";
import "./utils/recorder";
import initializeIPCEvents from "./ipcEvents";
// import { ensureScreenCapturePermissions } from "./utils/permission";
import { windowManager } from "./windows/windowManager";
import { autoLauncher, checkIfAppIsOpen, checkUpdates } from "./utils/lib";
import { loadAppData } from "./utils/store";
import { tray } from "./utils/tray";
import { recorder } from "./utils/recorder";
import { exec } from "child_process";

log.info("screen", systemPreferences.getMediaAccessStatus("screen"));
if (!systemPreferences.getMediaAccessStatus("screen")) {
  shell.openExternal(
    "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"
  );
}

// Function to check screen recording permission
function checkScreenRecordingPermission() {
  exec("tccutil check ScreenCapture", (error, stdout, stderr) => {
    if (error) {
      console.error(`exec error: ${error}`);
      return;
    }
    if (stderr) {
      console.error(`stderr: ${stderr}`);
      return;
    }

    if (stdout.includes("kTCCServiceScreenCapture: ALLOWED")) {
      console.log("Screen recording permission granted");
    } else {
      console.log("Screen recording permission denied");
    }
  });
}

checkScreenRecordingPermission();

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

// Check open state to avoid duplicate app launches
checkIfAppIsOpen();

// Load app data
loadAppData();
// Initialize IPC Events
initializeIPCEvents();

export async function setupApp() {
  console.log("====================================");
  console.log("yooo");
  console.log("====================================");
  // Disable CORS to send API request from the browserView
  app.commandLine.appendSwitch("disable-features", "CrossOriginOpenerPolicy");

  // About panel when the user presses the space bar on the app icon
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

  // Check for updates
  // Check for permissions & verify the user to start using the app
  // if (!ensureScreenCapturePermissions()) {
  //   log.info("==> permissions : no permissions found");
  //   return;
  // }

  // Perform additional setup if the user is verified
  if (app.lapse.user.isVerified) {
    handleVerifiedUser();
  } else {
    handleUnverifiedUser();
  }

  // Additional tasks if not in development
  if (!is.development) {
    // Enable auto-launch if configured
    app.lapse.settings.autolaunch && autoLauncher.enable();

    // Check for updates
    checkUpdates();
  }
}

app.on("ready", setupApp);

export function handleVerifiedUser() {
  // Additional logic for verified users
  // Hide the dock icon to shift the user focus to the menubar
  if (app.dock) app.dock.hide();

  // Initialize the tray menu
  tray.initializeTray();

  // Give a beep sound saying the app is loaded and ready to use
  shell.beep();
}

function handleUnverifiedUser() {
  // License verification
  log.info("license window opening...");
  windowManager.license?.open();
}

app.on("window-all-closed", () => {
  // do not quit app
});
// Pause and ask the user to save recording or not before quitting
app.on("before-quit", async () => {
  // ! Pause and ask user to save recording or not
  // ? Prompt the user to save recording before quit
  log.info("recorder state", recorder.getRecordingState());
  if (recorder.isRecording()) {
    const { response } = await dialog.showMessageBox({
      type: "warning",
      buttons: ["Save recording", "Cancel"],
      defaultId: 0,
      message: "Do you want to Save the recording?",
      detail:
        "Cancel will delete the recording till now. Do you want to continue?",
      cancelId: 1,
    });
    if (response === 0) {
      recorder.stopRecording();
    } else {
      recorder.initVariables();
      app.quit();
    }
  }
});

// Main application setup
