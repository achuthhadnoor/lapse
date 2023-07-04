import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  nativeImage,
  screen,
  shell,
  Tray,
} from "electron";
import { MenuItemConstructorOptions } from "electron/main";
import { join } from "path";
import { autoLauncher, getGlobalShortCut } from "./lib";
import {
  getRecordingState,
  IDLE,
  PAUSED,
  pauseRecording,
  RECORDING,
  RENDERING,
  resumeRecording,
  startRecording,
  stopRecording,
} from "./recorder";
import { sendUpdateRequest } from "./lib";
import { is } from "electron-util";
import { format } from "url";

let tray: Tray | null = null;

// App icons to show record and stop
export const appIcon = join(__dirname, "../../build/appTemplate.png");
export const recordIcon = join(__dirname, "../../build/recordTemplate.png");
export const loadingIcon = join(__dirname, "../../build/loadingTemplate.png");
export const pauseIcon = join(__dirname, "../../build/pauseTemplate.png");

export const setTrayTitle = (title: string) => {
  tray?.setTitle(title);
};

const prepareFormatMenu: () => MenuItemConstructorOptions[] = () => {
  const options = ["mp4", "mkv", "avi", "webm"];
  return options.map((option) => ({
    label: option,
    type: "checkbox",
    checked: app.lapse.settings.format === option,
    click: () => {
      updateSettings({ format: option });
    },
  }));
};

const prepareQualityMenu: () => MenuItemConstructorOptions[] = () => {
  const options = ["auto", "4k", "1080p", "720p", "480p", "360p"];
  return options.map((option) => ({
    label: option,
    type: "checkbox",
    checked: app.lapse.settings.quality === option,
    click: () => {
      updateSettings({ quality: option });
    },
  }));
};

const prepareFramerateMenu: () => MenuItemConstructorOptions[] = () => {
  const options = [12, 24, 30, 60];
  return options.map((option) => ({
    label: `${option}`,
    checked: option === app.lapse.settings.framerate,
    type: "checkbox",
    click: () => {
      updateSettings({ framerate: option });
    },
  }));
};

const updateSettings = (newsettings: any) => {
  app.lapse.settings = {
    ...app.lapse.settings,
    ...newsettings,
  };
};

const getIdelContextMenu = () => {
  const { autolaunch, intervals, savePath, countdown } = app.lapse.settings;
  const intervalSettings: () => MenuItemConstructorOptions[] = () => {
    const options = [2, 3, 4, 5];
    return options.map((option) => ({
      label: `${option}`,
      checked: option === intervals,
      type: "checkbox",
      click: () => {
        updateSettings({ intervals: option });
      },
    }));
  };
  const template: MenuItemConstructorOptions[] = [
    {
      label: "Start recording",
      accelerator: getGlobalShortCut(),
      click: async () => {
        try {
          await startRecording();
          // ? We change the icon and tooltip to let user know the selected screen is recording.
          tray?.setImage(recordIcon);
          tray?.setToolTip("Recording...");
        } catch (error) {
          // ! Global fallback when recording is interrupted 

        }
      },
    },
    { type: "separator" },
    {
      label: "Settings",
      enabled: false,
    },
    {
      label: "Screenshot Intervals",
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
    // {
    //   label: "Show Timer",
    //   type: "checkbox",
    //   checked: showTimer,
    //   click: () => {
    //     updateSettings({ showTimer: !showTimer });
    //   },
    // },
    {
      type: "separator",
    },
    {
      label: "Export options",
      enabled: false,
    },
    {
      label: "Format",
      submenu: prepareFormatMenu(),
    },
    {
      label: "Quality",
      submenu: prepareQualityMenu(),
    },
    {
      label: "Framerate",
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
      label: savePath,
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
            debugger;
            dialogWindow.focus();
          }
          dialogWindow &&
            dialog
              .showOpenDialog(dialogWindow, {
                properties: ["openDirectory"],
                buttonLabel: "Choose Folder",
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

const getPausedContextmenu = () => {
  let contextmenu: MenuItemConstructorOptions[] = [
    {
      label: "Resume Recording",
      click: () => {
        tray?.setImage(recordIcon);
        tray?.setToolTip("Recording..");
        resumeRecording();
      },
    },
    {
      label: "Stop Recording",
      click: () => {
        tray?.setImage(appIcon);
        tray?.setToolTip("Lapse | timelapse screen recorder");
        stopRecording();
      },
    },
    {
      role: "quit",
    },
  ];
  return Menu.buildFromTemplate(contextmenu);
};

const setPausedTray = () => {
  tray?.setImage(pauseIcon);
  tray?.setToolTip("Paused");
  tray?.popUpContextMenu(getPausedContextmenu());
};

export const setRenderingTray = () => {
  tray?.setImage(loadingIcon);
  tray?.setToolTip("Preparing...");
};

export const idelTrayMenu = () => {
  tray?.setImage(
    process.platform === "darwin" ? appIcon : nativeImage.createEmpty()
  );
  process.platform !== "darwin" && tray?.setTitle("lapse");

  tray?.setToolTip("Lapse | Start recording");
  tray?.setTitle("");
  tray?.popUpContextMenu(getIdelContextMenu());
};

export const initializeTray = () => {
  // ? Create a tray in the menubar
  tray = new Tray(
    process.platform === "darwin" ? appIcon : nativeImage.createEmpty()
  );
  /* 
    ? In windows the icon should be colored or show the name of the app in the taskbar
    ? or check if dark mode and light mode and change the icon programmatically
  */
  process.platform !== "darwin" && tray.setTitle("lapse");
  tray?.setToolTip("Lapse | Start recording");

  // ? Here is where all the content menu is prepared and shown to the user 
  tray?.on("click", () => {
    // ?  Based on the state of the Recording show the contextMenus ( Idel, recording, paused )
    switch (getRecordingState()) {
      case IDLE:
        idelTrayMenu();
        break;
      case RECORDING:
        // ! maybe put the text or change to pause icon in the try as paused to indicate paused state 
        pauseRecording();
        setPausedTray();
        break;
      case PAUSED:
        setPausedTray();
        break;
      case RENDERING:
        // setRenderingTray();
        break;
      default:
        tray?.popUpContextMenu(getIdelContextMenu());
        break;
    }
  });
};
