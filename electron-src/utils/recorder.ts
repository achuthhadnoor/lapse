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
import {
  setIdleTrayMenu,
  setPausedTray,
  setRenderingTray,
  setTrayTitle,
} from "./tray";
import showNotification from "../notify";
import { RECORDER_STATE } from "./constants";

const { getWindows, activateWindow } = require("mac-windows");

// Initialize temporary directories
track();

// Set ffmpeg path
ffmpeg.setFfmpegPath(fixPathForAsarUnpack(ffmpegPath));

const defaultSettings: any = {
  frameCount: 0,
  imagesDir: "",
  ffmpegImgPattern: "",
  recordState: RECORDER_STATE.idle,
  sourceId: "0",
  height: "1080",
  width: "1920",
};

let screenshotInterval: NodeJS.Timeout | null = null;
let saveWindow: BrowserWindow | null = null;
let TimerWindow: BrowserWindow | null = null;
let sourcesWindow: BrowserWindow | null = null;

let recorderSettings: any = defaultSettings;

// Function to get the recording state
export const getRecordingState = () => recorderSettings.recordState;

// Initialize variables and clean up resources
export const initVariables = () => {
  // Clear the screenshot interval if it's active
  screenshotInterval && clearInterval(screenshotInterval);

  // Clean up temporary directories
  cleanupSync();

  // Reset recorder settings to default
  recorderSettings = {
    ...recorderSettings,
    recordState: RECORDER_STATE.idle,
    frameCount: 0,
    sourceId: "0",
    interval: undefined,
  };

  // Set the tray menu to the idle state
  setIdleTrayMenu();
};

// Function to create the screenshot interval
const createScreenshotInterval = (sourceId: string) => {
  screenshotInterval = setInterval(async () => {
    try {
      const sources = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: screen.getPrimaryDisplay().bounds,
      });

      const source = sources.find((source) => source.id === sourceId);

      if (source) {
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
          // Handle the case when the source is not found
          app.lapse.recordings.push(recorderSettings.imagesDir);
          initVariables();
          console.log(source, "Error while processing! The recording.");
          // stopRecording();
        }
      }
    } catch (error) {
      console.error("Error during screenshot interval:", error);
    }
  }, app.lapse.settings.intervals * 1000);
};

// Function to prepare the video
export const prepareVideo = (outputPath: any) => {
  let startTime = Date.now();
  console.log("Start Time Create Timelapse " + startTime);

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

  try {
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
        console.error(`An error occurred: ${err.message}`);
        showNotification(`An error occurred: ${err.message}`);
        // TODO: Save the path to make a video later
        initVariables();
      })
      .on("progress", (process) => {
        console.log("====================================");
        console.log(`progress  =>>>>>>>>> ${process?.percent?.toFixed(2)}`);
        console.log("====================================");
        if (process) {
          process?.percent &&
            setTrayTitle(` ${process?.percent?.toFixed(2)}% `);
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
          const [hours, minutes, seconds] = timeString
            .split(":")
            .map(parseFloat);
          const totalTimeInSeconds = hours * 3600 + minutes * 60 + seconds;
          const progressPercentage =
            (totalTimeInSeconds / videoDurationInSeconds) * 100;
          console.log(`Progress: ${progressPercentage.toFixed(2)}%`);
          progressPercentage &&
            setTrayTitle(`${progressPercentage.toFixed(2)}%`);
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
  } catch (err: any) {
    console.error(`An unexpected error occurred: ${err.message}`);
    showNotification(`An unexpected error occurred: ${err.message}`);
    initVariables();
  }
};

// Function to stop recording

// Function to stop recording
export const stopRecording = async () => {
  let filePath = null;

  try {
    // Clear the screenshot interval
    screenshotInterval && clearInterval(screenshotInterval);

    // Set the recording state to rendering
    recorderSettings.recordState = RECORDER_STATE.rendering;
    setRenderingTray();
    setTrayTitle(`0%`);

    if (app.lapse.settings.askSavePath) {
      // Open a save dialog
      const screenBounds = screen.getDisplayNearestPoint(
        screen.getCursorScreenPoint()
      ).bounds;

      saveWindow = new BrowserWindow({
        height: screenBounds.height,
        width: screenBounds.width,
        show: false,
        alwaysOnTop: true,
        transparent: true,
        frame: false,
        hiddenInMissionControl: true,
        webPreferences: {
          nodeIntegration: true,
          allowRunningInsecureContent: true,
          preload: join(__dirname, "../preload.js"),
        },
      });

      // Load a blank HTML page
      const url = is.development
        ? "http://localhost:8000/empty"
        : format({
            pathname: join(__dirname, "../../renderer/out/empty.html"),
            protocol: "file:",
            slashes: true,
          });

      saveWindow.loadURL(url);

      // When the window is ready, show the dialog
      saveWindow.webContents.on("did-finish-load", async () => {
        if (saveWindow) {
          saveWindow.focus();

          const result = await dialog.showSaveDialog(saveWindow, {
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
          saveWindow?.close();
          saveWindow = null;
        }
      });
    } else {
      filePath = app.lapse.settings.savePath;
      prepareVideo(
        `${filePath}/lapse-${Date.now()}.${app.lapse.settings.format}`
      );
    }
  } catch (err: any) {
    console.error(`An unexpected error occurred: ${err.message}`);
    // Handle the error as needed
  }
};

// Function to process recording (empty for now)
export const processRecording = () => {};

// Function to resume recording
export const resumeRecording = () => {
  recorderSettings.recordState = RECORDER_STATE.recording;
  createScreenshotInterval(recorderSettings.sourceId);
};

// Function to pause recording
export const pauseRecording = () => {
  // Send a notification saying recording paused
  recorderSettings.recordState = RECORDER_STATE.paused;
  screenshotInterval && clearInterval(screenshotInterval);
};

// Function to select the recording source
async function selectSource() {
  /*
    This function pops up a window to select the screen/app to record.
    Give an option for the user to select the screens that can be added to the hide list from the next time.
  */
  let selectedSourceId: string = "0";
  let closeWindowMessage = false;

  // Get all the available sources and their metadata
  const sources = await desktopCapturer.getSources({
    types: ["window", "screen"],
    thumbnailSize: screen.getPrimaryDisplay().bounds,
  });

  // By default, set the entire screen as the default source
  selectedSourceId = sources[0].id;

  return new Promise(async (resolve, reject) => {
    try {
      sourcesWindow = new BrowserWindow({
        height: 600,
        width: 500,
        fullscreen: false,
        resizable: false,
        frame: false,
        alwaysOnTop: true,
        transparent: platform() === "darwin" ? true : false,
        vibrancy: "sidebar",
        hiddenInMissionControl: true,
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

      sourcesWindow.loadURL(url);

      is.development &&
        sourcesWindow.webContents.openDevTools({ mode: "detach" });
      const selectScreen = (_e: any, args: any) => {
        // Check if the window still exists before interacting with it
        if (!sourcesWindow || sourcesWindow.isDestroyed()) {
          return;
        }

        activateWindow(args.ownerName);
        selectedSourceId = args.id;

        // Close the window once the source is selected
        sourcesWindow.close();
      };

      const closeScreen = (_e: any, _args: any) => {
        // Check if the window still exists before interacting with it
        if (!sourcesWindow || sourcesWindow.isDestroyed()) {
          return;
        }

        sourcesWindow.close();
        closeWindowMessage = true;
      };

      sourcesWindow?.webContents.on("did-finish-load", () => {
        ipcMain.once("selected-screen", selectScreen);
        ipcMain.once("close-screen", closeScreen);
      });

      sourcesWindow?.on("closed", () => {
        // Remove event listeners when the window is closed
        ipcMain.removeListener("selected-screen", selectScreen);
        ipcMain.removeListener("close-screen", closeScreen);

        if (closeWindowMessage) {
          closeWindowMessage = false;
        } else {
          resolve(selectedSourceId);
        }
      });
    } catch (error) {
      reject(`error: ${error}`);
    }
  });
}

// Function to start recording
export const startRecording = async () => {
  // Clear the interval if the recording is not happening
  screenshotInterval && clearInterval(screenshotInterval);

  // We resolve this promise if recording started or we tell the user if it fails
  recorderSettings.sourceId = await selectSource();
  recorderSettings.frameCount = 0;

  if (recorderSettings.sourceId) {
    // Add custom images save location
    const d = new Date();
    mkdir(
      {
        prefix: "lapse_images",
        suffix: `${d.getDate()}-${d.getMonth()}-${d.getFullYear()}-${d.getTime()}`,
      },
      (err: any, dirPath: any) => {
        if (err) {
          console.error("Error creating image directory", err);
          throw err;
        }
        recorderSettings.ffmpegImgPattern = join(dirPath, "lapse%d.png");
        recorderSettings.imagesDir = dirPath;
        console.log("Image directory:", dirPath);
      }
    );

    // Set recording state to 'recording'
    recorderSettings.recordState = RECORDER_STATE.recording;

    // Check if countdown is enabled
    if (app.lapse.settings.countdown) {
      // Create a temporary browser window to show timer and close it once done
      const screenBounds = screen.getDisplayNearestPoint(
        screen.getCursorScreenPoint()
      ).bounds;

      TimerWindow = new BrowserWindow({
        height: screenBounds.height,
        width: screenBounds.width,
        alwaysOnTop: true,
        transparent: true,
        frame: false,
        hiddenInMissionControl: true,
        webPreferences: {
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

      TimerWindow.loadURL(url);

      TimerWindow.webContents.on("did-finish-load", () => {
        ipcMain.on("done-timer", () => {
          TimerWindow?.close();
          createScreenshotInterval(recorderSettings.sourceId);
        });
      });

      TimerWindow.setIgnoreMouseEvents(true);

      // Handle the dialog window being closed
      TimerWindow.on("closed", () => {
        TimerWindow = null;
      });
    } else {
      createScreenshotInterval(recorderSettings.sourceId);
    }
  }
};

// IPC handler to get sources
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
