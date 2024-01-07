import { app, dialog, shell } from "electron";
import prepareNext from "electron-next";
import { enforceMacOSAppLocation, is } from "electron-util";

import "./utils/update";
import "./windows/load";

import initializeIPCEvents from "./ipcEvents";
import { autoLauncher, checkIfAppIsOpen } from "./utils/lib";
import log from "./utils/logger";
import { loadAppData } from "./utils/store";
import { tray } from "./utils/tray";
import { windowManager } from "./windows/windowManager";
import { recorder } from "./utils/recorder";

// Check open state to avoid duplicate app launches
checkIfAppIsOpen();

log.info("Starting the application...");

app.allowRendererProcessReuse = true;

// Load app data
loadAppData();

// Initialize IPC Events
initializeIPCEvents();

async function setupApp() {
  // Disable CORS to send API request from the browserView
  // app.commandLine.appendSwitch("disable-features", "CrossOriginOpenerPolicy");

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
  }
}

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
  if (!app.lapse.user.isVerified) app.quit();
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
app.whenReady().then(setupApp);
