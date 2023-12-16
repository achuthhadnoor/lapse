import { shell, dialog, app, systemPreferences } from "electron";
import { is, openSystemPreferences } from "electron-util";
import { withVisibleDock } from "./dock";

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
    await withVisibleDock(async () => {
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
const screenCaptureFallback = promptSystemPreferences({
  message: "Lapse cannot record the screen.",
  detail:
    "Lapse requires screen capture access to be able to record the screen. You can grant this in the System Preferences. Afterwards, launch Lapse for the changes to take effect.",
  systemPreference: "security",
  systemPreferencesPath: "Privacy_ScreenCapture",
});

export const ensureScreenCapturePermissions = (
  fallback = screenCaptureFallback
) => {
  if (is.macos) {
    const hasAccess =
      systemPreferences.getMediaAccessStatus("screen") === "granted"
        ? true
        : false;

    if (hasAccess) {
      return true;
    }
    fallback();
    return false;
  } else {
    return true;
  }
};
const screenAccessFallback = promptSystemPreferences({
  message: "Lapse cannot record the screen.",
  detail:
    "Lapse requires screen capture access to be able to record the screen. You can grant this in the System Preferences. Afterwards, launch Lapse for the changes to take effect.",
  systemPreference: "security",
  systemPreferencesPath: "Privacy_Accessibility",
});
export const ensureAccessPermissions = (fallback = screenAccessFallback) => {
  let hasAccess = systemPreferences.isTrustedAccessibilityClient(false);
  if (hasAccess) {
    return true;
  }
  fallback({ hasAsked: false });
  return false;
};
