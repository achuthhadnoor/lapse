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

const { getWindows, activateWindow } = require("mac-windows");
track();
ffmpeg.setFfmpegPath(fixPathForAsarUnpack(ffmpegPath));
const defaultSettings: any = {
  frameCount: 0,
  imagesDir: "",
  ffmpegImgPattern: "",
  interval: undefined,
  recordState: RECORDER_STATE.idle,
  sourceId: "0",
  height: "1080",
  width: "1920",
};

let recorderSettings: any = defaultSettings;

export const getRecordingState = () => recorderSettings.recordState;

export const UpdateSettings = (newSettings: any) => {
  if (newSettings.autolaunch) {
    autoLauncher.enable();
  } else {
    autoLauncher.disable();
  }
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
    interval: undefined,
  };
  setIdleTrayMenu();
};

const createScreenshotInterval = (sourceId: string) => {
  recorderSettings.interval = setInterval(async () => {
    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
      thumbnailSize: screen.getPrimaryDisplay().bounds,
    });
    const source = sources.find((source) => source.id === sourceId);

    if (source) {
      // frameCount += 1;
      const imgBuffer = Buffer.from(
        source.thumbnail.toDataURL().split(",")[1],
        "base64"
      );
      const filePath = join(
        recorderSettings.imagesDir,
        `lapse${recorderSettings.frameCount++}.png`
      );
      console.log(filePath);
      writeFileSync(filePath, imgBuffer);
    } else {
      if (getRecordingState() === RECORDER_STATE.paused) {
        pauseRecording();
        setPausedTray();
        return;
      } else {
        // ! TODO: if the recording state is in recording then save the video or path so user can get the output.
        initVariables();
        console.log(source, "Error while processing! The recording.");
        // stopRecording();
      }
    }
  }, app.lapse.settings.intervals * 1000);
};

export const prepareVideo = (outputPath: any) => {
  let startTime = Date.now();
  console.log("Start Time Create Timelape " + startTime);
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
    .on("end", () => {
      console.log("Complete! Click to open the video ");
      initVariables();
      showNotification("Complete! Click to open the video", () => {
        shell.openPath(outputPath);
      });
    })
    .on("error", (err) => {
      console.log(`An error occurred: ${err.message}`);
      showNotification(`An error occurred: ${err.message}`);
      // ! TODO: save the path to make a video later
      initVariables();
    })
    .on("progress", (process) => {
      console.log("====================================");
      console.log(`progress  =>>>>>>>>> ${process?.percent?.toFixed(2)}`);
      console.log("====================================");
      if (process) {
        process?.percent && setTrayTitle(` ${process?.percent?.toFixed(2)}% `);
      }
    })
    .on("stderr", (progress) => {
      const progressMatch = progress
        .toString()
        .match(/time=(\d+:\d+:\d+\.\d+)/);
      if (progressMatch) {
        const numberOfImages = recorderSettings.frameCount;
        const videoDurationInSeconds = numberOfImages / framerate;
        const timeString = progressMatch[1];
        const [hours, minutes, seconds] = timeString.split(":").map(parseFloat);
        const totalTimeInSeconds = hours * 3600 + minutes * 60 + seconds;
        const progressPercentage =
          (totalTimeInSeconds / videoDurationInSeconds) * 100;
        console.log(`Progress: ${progressPercentage.toFixed(2)}%`);
        progressPercentage && setTrayTitle(`${progressPercentage.toFixed(2)}%`);
      }
    })
    .on("close", (code) => {
      if (code === 0) {
        console.log("Video rendering completed successfully!");
        // Do something when rendering is complete
      } else {
        console.error(`Video rendering failed with code ${code}`);
        // Handle the error
      }
    })
    .run();
};

export const stopRecording = async () => {
  let filePath = null;
  clearInterval(recorderSettings.interval);
  recorderSettings.recordState = RECORDER_STATE.rendering;
  setRenderingTray();
  if (app.lapse.settings.askSavePath) {
    // open dialog here
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
    dialogWindow.webContents.on("did-finish-load", async () => {
      if (dialogWindow) {
        dialogWindow.focus();
        const result = await dialog.showSaveDialog(dialogWindow, {
          title: "Save File",
          defaultPath: `${app.lapse.settings.savePath}/lapse-${Date.now()}.${
            app.lapse.settings.format
          }`,
        });
        if (!result.canceled) {
          const path = result.filePath;
          prepareVideo(path);
        } else {
          initVariables();
        }
        // Close the dialog window
        dialogWindow?.close();
        dialogWindow = null;
      }
    });
  } else {
    filePath = app.lapse.settings.savePath;
    prepareVideo(
      `${filePath}/lapse-${Date.now()}.${app.lapse.settings.format}`
    );
  }
  return;
};

export const processRecording = () => {};

export const resumeRecording = () => {
  recorderSettings.recordState = RECORDER_STATE.recording;
  createScreenshotInterval(recorderSettings.sourceId);
};

export const pauseRecording = () => {
  // send a notification saying recording paused
  recorderSettings.recordState = RECORDER_STATE.paused;
  clearInterval(recorderSettings.interval);
};

async function selectSource() {
  /*
   ? This function pops up a window to select the screen/ app to record.
   ! give an option for user to select the screens that can be added to hide list in this from next time
  */
  var selectedSourceId: string = "0";
  var closeWindowMessage = false;

  // ? gets all the available sources and their metadata
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: screen.getPrimaryDisplay().bounds,
  });

  // ! By default set the Entire screen as default
  selectedSourceId = sources[0].id;

  return new Promise(async (resolve, reject) => {
    try {
      var window = new BrowserWindow({
        height: 600,
        width: 500,
        fullscreen: false,
        resizable: false,
        frame: false,
        alwaysOnTop: true,
        transparent: platform() === "darwin" ? true : false,
        vibrancy: "sidebar",
        webPreferences: {
          // devTools: true,
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
      const selectScreen = (_e: any, args: any) => {
        activateWindow(args.ownerName);
        selectedSourceId = args.id;
        window.close();
      };
      const closeScreen = (_e: any, _args: any) => {
        window.close();
        closeWindowMessage = true;
      };
      window.webContents.on("did-finish-load", () => {
        ipcMain.once("selected-screen", selectScreen);
        ipcMain.once("close-screen", closeScreen);
      });
      window.on("closed", () => {
        if (closeWindowMessage) {
          closeWindowMessage = false;
        } else {
          resolve(selectedSourceId);
        }
      });
    } catch (error) {
      // console.log(`error: ${error}`);
      reject(`error: ${error}`);
    }
  });
}

export const startRecording = async () => {
  // ? We resolve this promise if recording started or we tell user if it fails
  recorderSettings.sourceId = await selectSource();
  recorderSettings.frameCount = 0;
  if (recorderSettings.sourceId) {
    // ! add custom images save location
    mkdir("lapse_images", (err: any, dirPath: any) => {
      if (err) {
        console.log("====================================");
        console.log("==> Image dir", err);
        console.log("====================================");
        throw err;
      }
      recorderSettings.ffmpegImgPattern = join(dirPath, "lapse%d.png");
      recorderSettings.imagesDir = dirPath;
      console.log("==> Image dir", dirPath);
    });
    // ? set recording state
    recorderSettings.recordState = RECORDER_STATE.recording;
    // ? Check if countdown is enabled
    if (app.lapse.settings.countdown) {
      // ? create a temp browser window to show timer and close it once
      // create a temp browser window to show timer and close it once
      const screenBounds = screen.getDisplayNearestPoint(
        screen.getCursorScreenPoint()
      ).bounds;
      let dialogWindow: BrowserWindow | null = new BrowserWindow({
        height: screenBounds.height,
        width: screenBounds.width,
        // show: false, // Create the window initially hidden
        alwaysOnTop: true,
        transparent: true,
        frame: false,
        webPreferences: {
          // devTools: true,
          nodeIntegration: true,
          allowRunningInsecureContent: true,
          preload: join(__dirname, "../preload.js"),
        },
      });
      // Load a blank HTML page
      const url = is.development
        ? "http://localhost:8000/timer"
        : format({
            pathname: join(__dirname, "../../renderer/out/timer.html"),
            protocol: "file:",
            slashes: true,
          });
      dialogWindow.loadURL(url);
      dialogWindow.webContents.on("did-finish-load", () => {
        ipcMain.on("done-timer", () => {
          dialogWindow?.close();
          createScreenshotInterval(recorderSettings.sourceId);
        });
      });
      dialogWindow.setIgnoreMouseEvents(true);
      // Handle the dialog window being closed
      dialogWindow.on("closed", () => {
        dialogWindow = null;
      });
    } else {
      createScreenshotInterval(recorderSettings.sourceId);
    }
  }
};

ipcMain.handle("get-sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
      .bounds,
  });
  const windows = await getWindows();
  const srcs = sources.map((src) => {
    const currentWin = windows.find(
      (win: {
        pid: number;
        ownerName: string;
        name: string;
        width: number;
        height: number;
        x: number;
        y: number;
        number: number;
      }) =>
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
});
