import {
  app,
  BrowserWindow,
  desktopCapturer,
  dialog,
  ipcMain,
  screen,
  shell,
} from "electron";
import { track, cleanupSync, mkdir } from "temp";
import { join } from "path";
import { platform } from "os";
import { writeFileSync } from "fs";
import { format } from "url";
import { fixPathForAsarUnpack, is } from "electron-util";

import ffmpeg from "fluent-ffmpeg";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";

import { autoLauncher } from "./lib";
import { store } from "./store";
import {
  setIdleTrayMenu,
  setPausedTray,
  setRenderingTray,
  setTrayTitle,
} from "./tray";
import showNotification from "../notify";
import { RECORDER_STATE } from "./constants";
import log from "./logger";

const { getWindows, activateWindow } = require("mac-windows");
track();
ffmpeg.setFfmpegPath(fixPathForAsarUnpack(ffmpegPath));

let recorderSettings: any = {
  frameCount: 0,
  imagesDir: "",
  ffmpegImgPattern: "",
  interval: undefined,
  recordState: RECORDER_STATE.idle,
  sourceId: "0",
  height: "1080",
  width: "1920",
};

export const getRecordingState = () => recorderSettings.recordState;

export const updateSettings = (newSettings: any) => {
  autoLauncher[newSettings.autolaunch ? "enable" : "disable"]();
  app.lapse.settings = newSettings;
  store.set("lapse", newSettings);
};

export const initVariables = () => {
  clearInterval(recorderSettings.interval);
  cleanupSync();
  recorderSettings = {
    ...recorderSettings,
    recordState: RECORDER_STATE.idle,
    frameCount: 0,
    sourceId: "0",
  };
  setIdleTrayMenu();
};

const createScreenshotInterval = (sourceId: string) => {
  recorderSettings.interval = setInterval(async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: screen.getPrimaryDisplay().bounds,
      });
      const source = sources.find((src) => src.id === sourceId);

      if (source) {
        const imgBuffer = Buffer.from(
          source.thumbnail.toDataURL().split(",")[1],
          "base64"
        );
        const filePath = join(
          recorderSettings.imagesDir,
          `lapse${recorderSettings.frameCount++}.png`
        );
        log.info(filePath);
        writeFileSync(filePath, imgBuffer);
      } else {
        handleRecordingError();
      }
    } catch (error) {
      handleRecordingError();
    }
  }, app.lapse.settings.intervals * 1000);
};

const handleRecordingError = () => {
  if (getRecordingState() === RECORDER_STATE.recording) {
    pauseRecording();
    setPausedTray();
  }
  initVariables();
  console.error(
    "Error while processing! The recording will be saved to device."
  );
};

export const prepareVideo = (outputPath: any) => {
  const command = ffmpeg();
  const { framerate, quality } = app.lapse.settings;
  const qualities: any = {
    auto: 25,
    "8k": 6,
    "4k": 12,
    "1080p": 18,
    "720p": 24,
    "480p": 32,
    "360p": 38,
    "270p": 42,
    "144p": 48,
  };

  command
    .input(recorderSettings.ffmpegImgPattern)
    .inputOptions(["-y", `-r ${framerate}`, "-f image2", "-start_number 0"])
    .outputOptions([
      "-c:v libx264",
      "-preset slow",
      "-profile:v high",
      "-vcodec libx264",
      `-crf ${qualities[quality]}`,
      "-coder 1",
      "-pix_fmt yuv420p",
      "-movflags +faststart",
      "-g 30",
      "-bf 2",
      "-c:a aac",
      "-b:a 384k",
      "-b:v 1000k",
      `-r ${framerate}`,
      `-s ${recorderSettings.width}x${recorderSettings.height}`,
      "-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
    ])
    .output(outputPath)
    .on("end", handleVideoRenderingCompletion(outputPath))
    .on("error", handleVideoRenderingError)
    .on("progress", handleVideoRenderingProgress)
    .on("close", handleVideoRenderingClose)
    .run();
};

const handleVideoRenderingCompletion = (outputPath: string) => () => {
  log.info("Complete! Click to open the video ");
  initVariables();
  showNotification("Complete! Click to open the video", () => {
    shell.openPath(outputPath);
  });
};

const handleVideoRenderingError = (err: { message: any }) => {
  console.error(`An error occurred: ${err.message}`);
  showNotification(`An error occurred: ${err.message}`);
  initVariables();
};

const handleVideoRenderingProgress = (process: { percent: number }) => {
  log.warn(`=>>>>>>>>> ${process.percent.toFixed(2)}`);
  setTrayTitle(` ${process.percent.toFixed(2)}% `);
};

const handleVideoRenderingClose = (code: number) => {
  if (code === 0) {
    log.info("Video rendering completed successfully!");
  } else {
    console.error(`Video rendering failed with code ${code}`);
  }
};

export const stopRecording = async () => {
  clearInterval(recorderSettings.interval);
  if (app.lapse.settings.askSavePath) {
    await handleSaveDialog();
  } else {
    recorderSettings.recordState = RECORDER_STATE.rendering;
    setRenderingTray();
    const filePath = app.lapse.settings.savePath;
    prepareVideo(
      `${filePath}/lapse-${Date.now()}.${app.lapse.settings.format}`
    );
  }
};

const handleSaveDialog = async () => {
  const screenBounds = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  ).bounds;
  let dialogWindow = new BrowserWindow({
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

  dialogWindow.webContents.on("did-finish-load", async () => {
    dialogWindow.focus();
    const result = await dialog.showSaveDialog(dialogWindow, {
      title: "Save File",
      defaultPath: `${app.lapse.settings.savePath}/lapse-${Date.now()}.${
        app.lapse.settings.format
      }`,
    });
    if (!result.canceled) {
      recorderSettings.recordState = RECORDER_STATE.rendering;
      setRenderingTray();
      const path = result.filePath;
      prepareVideo(path);
    } else {
      initVariables();
    }
    dialogWindow.close();
  });
};

export const processRecording = () => {};

export const resumeRecording = () => {
  recorderSettings.recordState = RECORDER_STATE.recording;
  createScreenshotInterval(recorderSettings.sourceId);
};

export const pauseRecording = () => {
  recorderSettings.recordState = RECORDER_STATE.paused;
  clearInterval(recorderSettings.interval);
};

export const startRecording = async () => {
  recorderSettings.sourceId = await selectSource();
  recorderSettings.frameCount = 0;
  if (recorderSettings.sourceId) {
    mkdir("lapse_images", (err, dirPath) => {
      if (err) {
        log.error(err);
        throw err;
      }
      recorderSettings.ffmpegImgPattern = join(dirPath, "lapse%d.png");
      recorderSettings.imagesDir = dirPath;
    });

    recorderSettings.recordState = RECORDER_STATE.paused;

    if (app.lapse.settings.countdown) {
      showTimerWindow(() => {
        createScreenshotInterval(recorderSettings.sourceId);
      });
    } else {
      createScreenshotInterval(recorderSettings.sourceId);
    }
  }
};

const showTimerWindow = (callback: { (): void; (): void }) => {
  const screenBounds = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  ).bounds;
  let dialogWindow: any = new BrowserWindow({
    height: screenBounds.height,
    width: screenBounds.width,
    alwaysOnTop: true,
    transparent: true,
    frame: false,
    webPreferences: {
      nodeIntegration: true,
      allowRunningInsecureContent: true,
      preload: join(__dirname, "../preload.js"),
    },
  });

  const url = is.development
    ? "http://localhost:8000/timer"
    : format({
        pathname: join(__dirname, "../../renderer/out/timer.html"),
        protocol: "file:",
        slashes: true,
      });

  dialogWindow.loadURL(url);
  dialogWindow.webContents.on("did-finish-load", () => {});

  dialogWindow.setIgnoreMouseEvents(true);

  dialogWindow.on("closed", () => {
    dialogWindow = null;
  });

  ipcMain.on("done-timer", () => {
    dialogWindow.close();
    callback();
  });
};

async function selectSource() {
  try {
    let selectedSourceId = "0";
    let closeWindowMessage = false;

    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
      thumbnailSize: screen.getPrimaryDisplay().bounds,
    });

    selectedSourceId = sources[0].id;

    return new Promise((resolve) => {
      const window = new BrowserWindow({
        height: 600,
        width: 500,
        fullscreen: false,
        resizable: false,
        frame: false,
        alwaysOnTop: true,
        transparent: platform() === "darwin" ? true : false,
        vibrancy: "sidebar",
        webPreferences: {
          nodeIntegration: true,
          allowRunningInsecureContent: true,
          preload: join(__dirname, "../preload.js"),
        },
      });

      const url = is.development
        ? "http://localhost:8000/screens"
        : format({
            pathname: join(__dirname, "../../renderer/out/screens.html"),
            protocol: "file:",
            slashes: true,
          });

      window.loadURL(url);
      is.development && window.webContents.openDevTools({ mode: "detach" });

      ipcMain.once("selected-screen", (_e, args) => {
        activateWindow(args.ownerName);
        selectedSourceId = args.id;
        window.close();
      });

      ipcMain.once("close-screen", (_e, _args) => {
        window.close();
        closeWindowMessage = true;
      });

      window.on("closed", () => {
        if (closeWindowMessage) {
          closeWindowMessage = false;
        } else {
          resolve(selectedSourceId);
        }
      });
    });
  } catch (error) {
    log.error(`Error: ${error}`);
    throw error;
  }
}

ipcMain.handle("get-sources", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
      thumbnailSize: screen.getPrimaryDisplay().bounds,
    });
    const windows = await getWindows();
    const srcs = sources.map((src) => {
      const currentWin = windows.find(
        (win: { name: string }) =>
          win.name === src.name ||
          (win.name === "Dock" && src.name === "Entire Screen")
      );

      return {
        ...currentWin,
        ...src,
        thumbnail: src.thumbnail.toDataURL(),
        appIcon: src.appIcon !== null && src.appIcon.toDataURL(),
      };
    });
    return JSON.stringify(srcs);
  } catch (error) {
    console.error(`Error: ${error}`);
    throw error;
  }
});
