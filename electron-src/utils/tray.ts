import {
  BrowserWindow,
  Menu,
  MenuItemConstructorOptions,
  Tray,
  app,
  dialog,
  shell,
  screen,
} from "electron";

import { recorder } from "./recorder";
import { INTERVALS, RECORDER_STATE } from "./constants";
import { is } from "electron-util";
import {
  getGlobalShortCut,
  autoLauncher,
  sendUpdateRequest,
  updateSettings,
  appIcon,
  recordIcon,
  trimSavedPath,
  pauseIcon,
  loadingIcon,
} from "./lib";

import { format } from "url";
import { join } from "path";
import log from "./logger";

export class TrayManager {
  menubar?: Tray;

  setTrayTitle = (title: string) => {
    this.menubar?.setTitle(title);
  };

  setRenderingTrayMenu = () => {
    this.menubar?.setImage(loadingIcon);
    this.menubar?.setToolTip("Preparing...");
  };

  setRecordingTrayMenu = () => {
    this.menubar?.setImage(recordIcon);
    this.menubar?.setToolTip("Recording..");
  };

  getPausedContextmenu = () => {
    let contextmenu: MenuItemConstructorOptions[] = [
      {
        label: "Resume Recording",
        click: () => {
          this.menubar?.setImage(recordIcon);
          this.menubar?.setToolTip("Recording..");
          recorder.resumeRecording();
        },
      },
      { type: "separator" },
      {
        label: "Retake Recording ",
        click: async () => {
          // show dialog box to check if they really want to retake again
          const { response } = await dialog.showMessageBox({
            type: "warning",
            buttons: ["Retake Recording", "Cancel"],
            defaultId: 0,
            message: "Do you want to Restart the recording?",
            detail:
              "Retake will delete the recording till now and restart. Do you want to continue?",
            cancelId: 1,
          });
          if (response === 0) {
            recorder.initVariables();
            recorder.startRecording();
          }
        },
      },
      {
        label: "Stop Recording",
        click: () => {
          this.menubar?.setImage(appIcon);
          this.menubar?.setToolTip("Lapse | timelapse screen recorder");
          recorder.stopRecording();
        },
      },
    ];
    return Menu.buildFromTemplate(contextmenu);
  };

  setPausedTrayMenu = () => {
    this.menubar?.setImage(pauseIcon);
    this.menubar?.setToolTip("Paused");
    this.menubar?.popUpContextMenu(this.getPausedContextmenu());
  };

  getIdleContextMenu = () => {
    const {
      autolaunch,
      intervals,
      savePath,
      countdown,
      askSavePath,
      quality,
      framerate,
    } = app.lapse.settings;

    const intervalSettings = (): MenuItemConstructorOptions[] => {
      return INTERVALS.map((option) => ({
        label: `${option}`,
        checked: option === intervals,
        type: "checkbox",
        click: () => {
          try {
            updateSettings({ intervals: option });
          } catch (error) {
            console.error("Error updating settings:", error);
          }
        },
      }));
    };
    const settingsItems: MenuItemConstructorOptions[] = [
      {
        label: "Settings",
        enabled: false,
      },
      {
        label: `Screenshot Intervals (${intervals})`,
        submenu: intervalSettings(),
      },
      {
        label: "Show Countdown",
        type: "checkbox",
        checked: countdown,
        click: () => {
          updateSettings({ countdown: !countdown });
        },
      },
      {
        type: "separator",
      },
    ];
    const prepareFormatMenu = (): MenuItemConstructorOptions[] => {
      const options = ["mp4", "mkv", "avi", "webm"];
      return options.map((option) => ({
        label: option,
        type: "checkbox",
        checked: app.lapse.settings.format === option,
        click: () => {
          try {
            updateSettings({ format: option });
          } catch (error) {
            console.error("Error updating settings:", error);
          }
        },
      }));
    };

    const prepareQualityMenu = (): MenuItemConstructorOptions[] => {
      const options = ["auto", "4k", "1080p", "720p", "480p", "360p"];
      return options.map((option) => ({
        label: option,
        type: "checkbox",
        checked: app.lapse.settings.quality === option,
        click: () => {
          try {
            updateSettings({ quality: option });
          } catch (error) {
            console.error("Error updating settings:", error);
          }
        },
      }));
    };

    const prepareFramerateMenu = (): MenuItemConstructorOptions[] => {
      const options = [12, 24, 30, 60];
      return options.map((option) => ({
        label: `${option}`,
        checked: option === app.lapse.settings.framerate,
        type: "checkbox",
        click: () => {
          try {
            updateSettings({ framerate: option });
          } catch (error) {
            console.error("Error updating settings:", error);
          }
        },
      }));
    };

    const exportOptionItems: MenuItemConstructorOptions[] = [
      {
        label: "Export options",
        enabled: false,
      },
      {
        label: `Format (${app.lapse.settings.format})`,
        submenu: prepareFormatMenu(),
      },
      {
        label: `Quality (${quality})`,
        submenu: prepareQualityMenu(),
      },
      {
        label: `Framerate (${framerate})`,
        submenu: prepareFramerateMenu(),
      },
      {
        type: "separator",
      },
    ];

    const outPutPathItems: MenuItemConstructorOptions[] = [
      {
        label: "Output path",
        enabled: false,
      },
      {
        label: "Ask before saving",
        checked: askSavePath,
        type: "checkbox",
        click: () => {
          updateSettings({ askSavePath: !askSavePath });
        },
      },
      {
        label: trimSavedPath(savePath),
        click: () => {
          const screenBounds = screen.getDisplayNearestPoint(
            screen.getCursorScreenPoint()
          ).bounds;
          let dialogWindow: BrowserWindow | null = new BrowserWindow({
            height: screenBounds.height,
            width: screenBounds.width,
            show: false, // Create the window initially hidden
            alwaysOnTop: true,
            transparent: true,
            frame: false,
            skipTaskbar: true,
          });
          // Load a blank HTML page
          const url = is.development
            ? "http://localhost:8000/empty"
            : format({
                pathname: join(__dirname, "../../renderer/out/empty.html"),
                protocol: "file:",
                slashes: true,
              });
          dialogWindow.setSkipTaskbar(false);

          dialogWindow?.loadURL(url);
          // When the window is ready, show the dialog
          dialogWindow?.webContents.on("did-finish-load", () => {
            if (dialogWindow) {
              dialogWindow.focus();
            }
            dialogWindow &&
              dialog
                .showOpenDialog(dialogWindow, {
                  properties: ["openDirectory"],
                  buttonLabel: "Choose Folder",
                  defaultPath: savePath,
                  // Add any additional options as needed
                })
                .then((result) => {
                  if (!result.canceled) {
                    const folderPath = result.filePaths[0];
                    // Use the selected folder path here
                    updateSettings({ savePath: folderPath });
                  }
                  // Close the dialog window
                  dialogWindow?.close();
                  dialogWindow = null;
                })
                .catch((err) => {
                  console.log(err);
                  // Close the dialog window
                  dialogWindow?.close();
                  dialogWindow = null;
                });
          });

          // Handle the dialog window being closed
          dialogWindow.on("closed", () => {
            dialogWindow = null;
          });
        },
      },
      {
        type: "separator",
      },
    ];

    const helpItems: MenuItemConstructorOptions[] = [
      {
        label: "Help",
        enabled: false,
      },
      {
        label: "Guide", // keyboard shortcuts and settings
        click: () => {
          shell.openExternal(
            "https://achuth.notion.site/Press-Kit-1a3b994e395d43efbaf6727fed4429f1"
          );
        },
      },
      {
        label: "Changelog",
        click: () => {
          shell.openExternal(
            `https://achuth.notion.site/Changelog-4c898f8b4ec140abb1d6a6d2e9108a15`
          );
        },
      },
      {
        label: "Send Feedback", // send to google sheet
        click: () => {
          shell.openExternal(
            `mailto:hey@achuth.dev?subject=I am looking for information about the app.`
          );
        },
      },
      {
        type: "separator",
      },
      {
        label: "Give a tip!", // Buy me a coffee
        click: () => {
          shell.openExternal("https://www.buymeacoffee.com/achuthhadnoor");
        },
      },
      {
        label: "Follow us",
        click: () => {
          shell.openExternal("https://twitter.com/achuth_hadnoor");
        },
      },
      {
        type: "separator",
      },
    ];

    const appSettingsItems: MenuItemConstructorOptions[] = [
      {
        label: `Version ${app.getVersion()}`,
        enabled: false,
      },
      {
        // role: "about",
        label: "About",
        click: () => {
          shell.openExternal("https://getlapseapp.com");
        },
      },
      {
        label: "Auto launch",
        type: "checkbox",
        checked: autolaunch,
        click: () => {
          updateSettings({ autolaunch: !autolaunch });
          if (!is.development) {
            if (autolaunch) {
              autoLauncher.enable();
            } else {
              autoLauncher.disable();
            }
          }
        },
      },
      {
        label: "Check for updates",
        click: () => {
          sendUpdateRequest(true);
        },
      },
      {
        type: "separator",
      },
    ];
    const template: MenuItemConstructorOptions[] = [
      {
        label: "Start recording",
        accelerator: getGlobalShortCut(),
        click: () => {
          try {
            recorder.startRecording().then(() => {
              this.menubar?.setImage(recordIcon);
              this.menubar?.setToolTip("Recording...");
              console.log("==> Recording", `Recording: Started`);
            });
          } catch (error) {
            console.error("Error starting recording:", error);
          }
        },
      },
      { type: "separator" },
      ...settingsItems,
      ...exportOptionItems,
      ...outPutPathItems,
      ...helpItems,
      ...appSettingsItems,
      {
        label: "Quit",
        role: "quit",
        accelerator: "meta+q",
      },
    ];
    return Menu.buildFromTemplate(template);
  };

  setIdleTrayMenu = () => {
    this.menubar?.setImage(appIcon);
    this.menubar?.setToolTip("Lapse | Start recording");
    this.menubar?.setTitle("");
    this.menubar?.popUpContextMenu(this.getIdleContextMenu());
  };

  initializeTray = () => {
    this.menubar = new Tray(appIcon);
    this.menubar?.setToolTip("Lapse | Start recording");
    this.menubar?.on("click", async () => {
      try {
        switch (recorder.getRecordingState()) {
          case RECORDER_STATE.idle:
            this.setIdleTrayMenu();
            break;
          case RECORDER_STATE.recording:
            recorder.pauseRecording();
            this.setPausedTrayMenu();
            break;
          case RECORDER_STATE.paused:
            this.setPausedTrayMenu();
            break;
          case RECORDER_STATE.rendering:
            // setRenderingTray();
            break;
          default:
            this.menubar?.popUpContextMenu(this.getIdleContextMenu());
            break;
        }
      } catch (error) {
        log.error("Error handling tray click:", error);
      }
    });
    log.info("==> Tray", "tray initialized");
  };
}

export const tray = new TrayManager();
