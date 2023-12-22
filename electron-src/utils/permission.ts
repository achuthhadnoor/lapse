import { shell, dialog, app, systemPreferences } from "electron";
import { is, openSystemPreferences } from "electron-util";
import { ensureDockIsShowing } from "./dock";
import log from "./logger";

let isDialogShowing = false;

const promptSystemPreferences =
  (options: {
    message: string;
    detail: string;
    systemPreference: any;
    systemPreferencesPath: string;
  }) =>
  async ({ hasAsked }: { hasAsked?: boolean } = {}) => {
    if (hasAsked || isDialogShowing) {
      return false;
    }

    isDialogShowing = true;
    await ensureDockIsShowing(async () => {
      shell.beep();
      const { response } = await dialog.showMessageBox({
        type: "warning",
        buttons: ["Open System Preferences", "Cancel"],
        defaultId: 0,
        message: options.message,
        detail: options.detail,
        cancelId: 1,
      });
      isDialogShowing = false;
      if (response === 0) {
        console.log("==> preferences", "opening system settings..");
        await openSystemPreferences(
          options.systemPreference,
          options.systemPreferencesPath
        );
        app.quit();
      } else {
        app.quit();
      }
    });

    return false;
  };

// Screen Capture (10.15 and newer)
export const screenCaptureFallback = promptSystemPreferences({
  message: "Lapse cannot record the screen.",
  detail:
    "Lapse requires screen capture access to be able to record the screen. You can grant this in the System Preferences. Afterwards, launch Lapse for the changes to take effect.",
  systemPreference: "security",
  systemPreferencesPath: "Privacy_ScreenCapture",
});

export const ensureScreenCapturePermissions = async () =>
  // fallback = screenCaptureFallback
  {
    if (is.macos) {
      log.info("==> OS", "macOs");
      log.info(
        "==> permissions",
        systemPreferences.getMediaAccessStatus("screen")
      );
      const hasAccess =
        systemPreferences.getMediaAccessStatus("screen") === "granted"
          ? true
          : false;

      if (hasAccess) {
        return true;
      }
      // fallback();
      const { response } = await dialog.showMessageBox({
        type: "error",
        buttons: ["Quit Lapse"],
        defaultId: 0,
        message: "Screen Recording Permission Required for Lapse",
        detail: `To enable screen recording, please grant permission in your system settings.

       Open 'System Preferences' on your Mac.
       Navigate to 'Security & Privacy.'
       Select the 'Privacy' tab.
       In the left sidebar, click on 'Screen and system audio Recording.'
       Check the box next to the application that requires screen recording.
       After granting permission, restart the application.
       
       Thank you for your understanding and cooperation.`,
        cancelId: 1,
      });
      if (response) {
        app.quit();
      }
      return false;
    } else {
      log.info("==> OS", "windows or linux");

      return true;
    }
  };
