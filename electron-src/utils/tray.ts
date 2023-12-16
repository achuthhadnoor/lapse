import {
  app,
  BrowserWindow,
  dialog,
  Menu,
  screen,
  shell,
  Tray,
} from "electron";
import { MenuItemConstructorOptions } from "electron/main";
import { join } from "path";
import { autoLauncher, getGlobalShortCut } from "./lib";
import {
  getRecordingState,
  pauseRecording,
  resumeRecording,
  startRecording,
  stopRecording,
} from "./recorder";
import { sendUpdateRequest } from "./lib";
import { is } from "electron-util";

import { updateStoreSettings } from "./store";
import { INTERVALS, RECORDER_STATE } from "./constants";
import { format } from "url";
import log from "./logger";

let tray: Tray | null = null;

export const appIcon = join(
  __dirname,
  is.macos ? "../../build/appTemplate.png" : "../../build/lapse.ico"
);
export const recordIcon = join(
  __dirname,
  is.macos ? "../../build/recordTemplate.png" : "../../build/lapse.ico"
);
export const loadingIcon = join(
  __dirname,
  is.macos ? "../../build/loadingTemplate.png" : "../../build/lapse.ico"
);
export const pauseIcon = join(
  __dirname,
  is.macos ? "../../build/pauseTemplate.png" : "../../build/lapse.ico"
);

export const setTrayTitle = (title: string) => {
  tray?.setTitle(title);
};

const updateSettings = (newSettings: any) => {
  app.lapse.settings = { ...app.lapse.settings, ...newSettings };
  updateStoreSettings(app.lapse.settings);
};

const prepareCheckboxMenu = (options: any, property: string) => {
  return options.map((option: any) => ({
    label: `${option}`,
    type: "checkbox",
    checked: app.lapse.settings[property] === option,
    click: () => {
      updateSettings({ [property]: option });
    },
  }));
};

const prepareFormatMenu = () =>
  prepareCheckboxMenu(["mp4", "mkv", "avi", "webm"], "format");
const prepareQualityMenu = () =>
  prepareCheckboxMenu(
    ["auto", "4k", "1080p", "720p", "480p", "360p"],
    "quality"
  );
const prepareFramerateMenu = () =>
  prepareCheckboxMenu([12, 24, 30, 60], "framerate");

const getIdleContextMenu = () => {
  const {
    autolaunch,
    intervals,
    savePath,
    countdown,
    askSavePath,
    format,
    quality,
    framerate,
  } = app.lapse.settings;

  const intervalSettings = () => prepareCheckboxMenu(INTERVALS, "intervals");
  // @ts-ignore
  const template: MenuItemConstructorOptions[] = [
    {
      label: "Start recording",
      accelerator: getGlobalShortCut(),
      click: () => {
        startRecording().catch((error) => {
          log.error("Recording start error:", error);
        });
      },
    },
    { type: "separator" },
    { label: "Settings", enabled: false },
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
    { type: "separator" },
    { label: "Export options", enabled: false },
    { label: `Format (${format})`, submenu: prepareFormatMenu() },
    { label: `Quality (${quality})`, submenu: prepareQualityMenu() },
    { label: `Framerate (${framerate})`, submenu: prepareFramerateMenu() },
    { type: "separator" },
    { label: "Output path", enabled: false },
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
      click: () => chooseSavePath(),
    },
    { type: "separator" },
    { label: "Help", enabled: false },
    {
      label: "Guide",
      click: () =>
        openExternalLink(
          "https://achuth.notion.site/Press-Kit-1a3b994e395d43efbaf6727fed4429f1"
        ),
    },
    {
      label: "Changelog",
      click: () =>
        openExternalLink(
          "https://achuth.notion.site/Changelog-4c898f8b4ec140abb1d6a6d2e9108a15"
        ),
    },
    {
      label: "Send Feedback",
      click: () =>
        openExternalLink(
          "mailto:hey@achuth.dev?subject=I am looking for information about the app."
        ),
    },
    { type: "separator" },
    {
      label: "Give a tip!",
      click: () =>
        openExternalLink("https://www.buymeacoffee.com/achuthhadnoor"),
    },
    {
      label: "Follow us",
      click: () => openExternalLink("https://twitter.com/achuth_hadnoor"),
    },
    { type: "separator" },
    { label: `Version ${app.getVersion()}`, enabled: false },
    {
      label: "About",
      click: () => openExternalLink("https://getlapseapp.com"),
    },
    {
      label: "Auto launch",
      type: "checkbox",
      checked: autolaunch,
      click: () => {
        updateSettings({ autolaunch: !autolaunch });
        if (!is.development) {
          autolaunch ? autoLauncher.enable() : autoLauncher.disable();
        }
      },
    },
    { label: "Check for updates", click: () => sendUpdateRequest(true) },
    { type: "separator" },
    { label: "Quit", role: "quit", accelerator: "meta+q" },
  ];
  return Menu.buildFromTemplate(template);
};

const getPausedContextmenu = () => {
  return Menu.buildFromTemplate([
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
    { role: "quit" },
  ]);
};

export const setPausedTray = () => {
  tray?.setImage(pauseIcon);
  tray?.setToolTip("Paused");
  tray?.popUpContextMenu(getPausedContextmenu());
};

export const setRecordingTray = () => {
  tray?.setImage(recordIcon);
  tray?.setToolTip("Recording..");
};
export const setRenderingTray = () => {
  tray?.setImage(loadingIcon);
  tray?.setToolTip("Preparing...");
};

export const setIdleTrayMenu = () => {
  tray?.setImage(appIcon);
  tray?.setToolTip("Lapse | Start recording");
  tray?.setTitle("");
  tray?.popUpContextMenu(getIdleContextMenu());
};

export const initializeTray = () => {
  tray = new Tray(appIcon);
  tray?.setToolTip("Lapse | Start recording");

  tray?.on("click", () => {
    switch (getRecordingState()) {
      case RECORDER_STATE.idle:
        setIdleTrayMenu();
        break;
      case RECORDER_STATE.recording:
        pauseRecording();
        setPausedTray();
        break;
      case RECORDER_STATE.paused:
        setPausedTray();
        break;
      case RECORDER_STATE.rendering:
        break;
      default:
        tray?.popUpContextMenu(getIdleContextMenu());
        break;
    }
  });

  log.info("Tray initialized.");
};

const trimString = (inputString: string) => {
  if (inputString.length > 30) {
    return "...." + inputString.slice(-26);
  }
  return inputString;
};

const chooseSavePath = () => {
  const screenBounds = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  ).bounds;
  let dialogWindow: BrowserWindow | null = new BrowserWindow({
    height: screenBounds.height,
    width: screenBounds.width,
    show: false,
    alwaysOnTop: true,
    transparent: true,
    frame: false,
  });

  const url = is.development
    ? "http://localhost:8000/empty"
    : format({
        pathname: join(__dirname, "../../renderer/out/empty.html"),
        protocol: "file:",
        slashes: true,
      });

  dialogWindow.loadURL(url);

  dialogWindow.webContents.on("did-finish-load", () => {
    if (dialogWindow) {
      dialogWindow.focus();
    }
    dialogWindow &&
      dialog
        .showOpenDialog(dialogWindow, {
          properties: ["openDirectory"],
          buttonLabel: "Choose Folder",
          defaultPath: app.lapse.settings.savePath,
        })
        .then((result) => {
          if (!result.canceled) {
            const folderPath = result.filePaths[0];
            updateSettings({ savePath: folderPath });
          }
          dialogWindow?.close();
          dialogWindow = null;
        })
        .catch((err) => {
          log.error("Choose Save Path error:", err);
          dialogWindow?.close();
          dialogWindow = null;
        });
  });

  dialogWindow.on("closed", () => {
    dialogWindow = null;
  });
};

const openExternalLink = (url: string) => {
  shell.openExternal(url);
};
