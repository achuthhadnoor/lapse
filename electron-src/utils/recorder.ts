import {
  app,
  BrowserWindow,
  desktopCapturer,
  // dialog,
  ipcMain,
  screen,
  shell,
} from "electron";
import { path as _path } from "@ffmpeg-installer/ffmpeg";
import { track, cleanupSync, mkdir } from "temp";
import { join } from "path";
import { autoLauncher } from "./lib";
import { store } from "./store";
import { platform } from "os";
import { writeFileSync } from "fs";
import { format } from "url";
import ffmpeg from "fluent-ffmpeg";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import { idelTrayMenu, setPausedTray, setRenderingTray } from "./tray";
import showNotification from "../notify";
import { fixPathForAsarUnpack, is } from "electron-util";
const { getWindows, activateWindow } = require("mac-windows");
track();
ffmpeg.setFfmpegPath(fixPathForAsarUnpack(ffmpegPath));

export const IDLE = "ideal",
  RECORDING = "recording",
  PAUSED = "paused",
  RENDERING = "rendering";

let frameCount = 0,
  imagesDir = "",
  ffmpegImgPattern = "",
  interval: NodeJS.Timeout,
  recordState = IDLE,
  sourceId: any = "0",
  height = "1080",
  width = "1920";

export const getRecordingState = () => recordState;

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
  clearInterval(interval);
  cleanupSync();
  recordState = IDLE;
  frameCount = 0;
  sourceId = "0";
  idelTrayMenu();
};

const createScreenshotInterval = (sourceId: string) => {
  interval = setInterval(async () => {
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
      const filePath = join(imagesDir, `lapse${frameCount++}.png`);
      console.log(filePath);
      writeFileSync(filePath, imgBuffer);
    } else {
      if (getRecordingState() === RECORDING) {
        pauseRecording();
        setPausedTray();
        return;
      }
      initVariables();
      console.log(
        source,
        "Error while processing! The recording will be saved to device."
      );
      // stopRecording();
    }
  }, app.lapse.settings.intervals * 1000);
};

export const stopRecording = async () => {
  setRenderingTray();
  recordState = RENDERING;
  let filePath = app.lapse.settings.savePath;
  if (filePath) {
    let outputPath = `${filePath}/lapse-${Date.now()}.${
      app.lapse.settings.format
    }`;
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
      .input(ffmpegImgPattern)
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
        `-s ${width}x${height}`,
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
        initVariables();
      })
      .run();
  }
  return;
};

export const processRecording = () => {};

export const resumeRecording = () => {
  recordState = RECORDING;
  createScreenshotInterval(sourceId);
};

export const pauseRecording = () => {
  // send a notification saying recording paused
  recordState = PAUSED;
  clearInterval(interval);
};

export const startRecording = async () => {
  // ? We resolve this promise if recording started or we tell user if it fails
  sourceId = await selectSource();
  frameCount = 0;
  if (sourceId) {
    // ! add custom images save location
    mkdir("lapse_images", (err: any, dirPath: any) => {
      if (err) {
        console.log("====================================");
        console.log(err);
        console.log("====================================");
        throw err;
      }
      ffmpegImgPattern = join(dirPath, "lapse%d.png");
      imagesDir = dirPath;
    });
    // ? set recording state
    recordState = RECORDING;
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
      dialogWindow.webContents.on("did-finish-load", () => {});
      dialogWindow.setIgnoreMouseEvents(true);
      // Handle the dialog window being closed
      dialogWindow.on("closed", () => {
        dialogWindow = null;
      });
      ipcMain.on("done-timer", () => {
        dialogWindow?.close();
        createScreenshotInterval(sourceId);
      });
    } else {
      createScreenshotInterval(sourceId);
    }
  }
};

async function selectSource() {
  /*
   ? This function pops up a window to select the screen/ app to record.
   ! give an option for user to select the screens that can be added to hide list in this from next time
  */
  let selectedSourceId: string = "0";
  let closeWindowMessage = false;

  // ? gets all the available sources and their metadata
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: screen.getPrimaryDisplay().bounds,
  });

  // ! By default set the Entire screen as default
  selectedSourceId = sources[0].id;

  return new Promise(async (resolve, reject) => {
    try {
      let window = new BrowserWindow({
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
    } catch (error) {
      // console.log(`error: ${error}`);
      reject(`error: ${error}`);
    }
  });
}

ipcMain.handle("get-sources", async () => {
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: screen.getPrimaryDisplay().bounds,
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
