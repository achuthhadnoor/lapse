import { Tray } from "electron";
import { join } from "path";
import { getRecordingState, pauseRecording } from "./recorder";
import { RECORDER_STATE } from "./constants";

export const appIcon =
  process.platform === "darwin"
    ? join(__dirname, "../../build/appTemplate.png")
    : join(__dirname, "../../build/lapse.ico");
export const recordIcon =
  process.platform === "darwin"
    ? join(__dirname, "../../build/recordTemplate.png")
    : join(__dirname, "../../build/lapse.ico");
export const loadingIcon =
  process.platform === "darwin"
    ? join(__dirname, "../../build/loadingTemplate.png")
    : join(__dirname, "../../build/lapse.ico");
export const pauseIcon =
  process.platform === "darwin"
    ? join(__dirname, "../../build/pauseTemplate.png")
    : join(__dirname, "../../build/lapse.ico");

export class TrayManager {
  menubar?: Tray;

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

    function trimString(inputString: string) {
      if (inputString.length > 30) {
        const trimmedString = "...." + inputString.slice(-26);
        return trimmedString;
      }
      return inputString;
    }

    const template: MenuItemConstructorOptions[] = [
      {
        label: "Start recording",
        accelerator: getGlobalShortCut(),
        click: () => {
          try {
            startRecording();
            tray?.setImage(recordIcon);
            tray?.setToolTip("Recording...");
            console.log("==> Recording", `Recording: Started`);
          } catch (error) {
            console.error("Error starting recording:", error);
          }
        },
      },
      { type: "separator" },
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
        label: trimString(savePath),
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
          });
          // Load a blank HTML page
          const url = is.development
            ? "http://localhost:8000/empty"
            : format({
                pathname: join(__dirname, "../../renderer/out/empty.html"),
                protocol: "file:",
                slashes: true,
              });
          dialogWindow.loadURL(url);
          // When the window is ready, show the dialog
          dialogWindow.webContents.on("did-finish-load", () => {
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
        // icon: nativeImage.createFromPath(
        //   join(__dirname, "../assets/manualTemplate.png")
        // ),
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
        // icon: nativeImage.createFromPath(
        //   join(__dirname, "../assets/feedbackTemplate.png")
        // ),
      },

      {
        type: "separator",
      },
      {
        label: "Give a tip!", // Buy me a coffee
        click: () => {
          shell.openExternal("https://www.buymeacoffee.com/achuthhadnoor");
        },
        icon: nativeImage.createFromPath(
          join(__dirname, "../assets/troubleTemplate.png")
        ),
      },
      {
        label: "Follow us",
        click: () => {
          shell.openExternal("https://twitter.com/achuth_hadnoor");
        },
        icon: nativeImage.createFromPath(
          join(__dirname, "../assets/followTemplate.png")
        ),
      },

      {
        type: "separator",
      },
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
      {
        label: "Quit",
        role: "quit",
        accelerator: "meta+q",
      },
    ];
    return Menu.buildFromTemplate(template);
  };

  setIdeleTray() {
    this.menubar?.setImage(appIcon);
    this.menubar?.setToolTip("Lapse | Start recording");
    this.menubar?.setTitle("");
    this.menubar?.popUpContextMenu(getIdleContextMenu());
  }

  initializeTray() {
    this.menubar = new Tray(appIcon);
    this.menubar?.setToolTip("Lapse | Start recording");
    this.menubar?.on("click", async () => {
      try {
        switch (getRecordingState()) {
          case RECORDER_STATE.idle:
            this.setIdleTrayMenu();
            break;
          case RECORDER_STATE.recording:
            pauseRecording();
            this.setPausedTray();
            break;
          case RECORDER_STATE.paused:
            this.setPausedTray();
            break;
          case RECORDER_STATE.rendering:
            // setRenderingTray();
            break;
          default:
            this.menubar?.popUpContextMenu(this.getIdleContextMenu());
            break;
        }
      } catch (error) {
        console.error("Error handling tray click:", error);
      }
    });
    console.log("==> Tray", "tray initialized");
  }
}

export const tray = new TrayManager();
