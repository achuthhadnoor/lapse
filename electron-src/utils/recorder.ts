import {
  app,
  BrowserWindow,
  desktopCapturer,
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
import showNotification from "../notify";
import { RECORDER_STATE } from "./constants";
import { tray } from "./tray";
import { windowManager } from "../windows/windowManager";

const { getWindows, activateWindow } = require("mac-windows");

export class ScreenRecorder {
  defaultSettings?: any;
  screenshotInterval?: any;
  recorderSettings: any;
  sourcesWindow: BrowserWindow | any;
  constructor() {
    // Initialize temporary directories
    track();
    // Set ffmpeg path
    ffmpeg.setFfmpegPath(fixPathForAsarUnpack(ffmpegPath));
    this.defaultSettings = {
      frameCount: 0,
      imagesDir: "",
      ffmpegImgPattern: "",
      recordState: RECORDER_STATE.idle,
      sourceId: "0",
      height: "1080",
      width: "1920",
    };

    this.screenshotInterval = null;
    // this.sourcesWindow = null;
    this.recorderSettings = { ...this.defaultSettings };
  }

  getRecordingState() {
    return this.recorderSettings.recordState;
  }

  initVariables() {
    // Clear the screenshot interval if it's active
    this.screenshotInterval && clearInterval(this.screenshotInterval);
    // Clean up temporary directories
    cleanupSync();
    // Reset recorder settings to default
    this.recorderSettings = {
      ...this.recorderSettings,
      recordState: RECORDER_STATE.idle,
      frameCount: 0,
      sourceId: "0",
      interval: undefined,
    };

    // Set the tray menu to the idle state
    tray.setIdleTrayMenu();
  }

  createScreenshotInterval(sourceId: any) {
    this.screenshotInterval = setInterval(async () => {
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
            this.recorderSettings.imagesDir,
            `lapse${this.recorderSettings.frameCount++}.png`
          );
          console.log(filePath);
          writeFileSync(filePath, imgBuffer);
        } else {
          if (this.getRecordingState() === RECORDER_STATE.paused) {
            this.pauseRecording();
            tray.setPausedTrayMenu();
            return;
          } else {
            // Handle the case when the source is not found
            app.lapse.recordings.push(this.recorderSettings.imagesDir);
            this.initVariables();
            console.log(source, "Error while processing! The recording.");
            // stopRecording();
          }
        }
      } catch (error) {
        console.error("Error during screenshot interval:", error);
      }
    }, app.lapse.settings.intervals * 1000);
  }

  prepareVideo(outputPath: string) {
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
        .input(this.recorderSettings.ffmpegImgPattern)
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
          `-s ${this.recorderSettings.width}x${this.recorderSettings.height}`,
          "-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
        ])
        .output(outputPath)
        .on("end", () => {
          console.log("Complete! Click to open the video ");
          this.initVariables();
          showNotification("Complete! Click to open the video", () => {
            shell.openPath(outputPath);
          });
        })
        .on("error", (err) => {
          console.error(`An error occurred: ${err.message}`);
          showNotification(`An error occurred: ${err.message}`);
          // TODO: Save the path to make a video later
          this.initVariables();
        })
        .on("progress", (process) => {
          console.log("====================================");
          console.log(`progress  =>>>>>>>>> ${process?.percent?.toFixed(2)}`);
          console.log("====================================");
          if (process) {
            process?.percent &&
              tray.setTrayTitle(` ${process?.percent?.toFixed(2)}% `);
          }
        })
        .on("stderr", (progress) => {
          const progressMatch = progress
            .toString()
            .match(/time=(\d+:\d+:\d+\.\d+)/);

          if (progressMatch) {
            const numberOfImages = this.recorderSettings.frameCount;
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
              tray.setTrayTitle(`${progressPercentage.toFixed(2)}%`);
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
      this.initVariables();
    }
  }

  stopRecording() {
    let filePath = null;

    try {
      // Clear the screenshot interval
      this.screenshotInterval && clearInterval(this.screenshotInterval);

      // Set the recording state to rendering
      this.recorderSettings.recordState = RECORDER_STATE.rendering;
      tray.setRenderingTrayMenu();
      tray.setTrayTitle(`0%`);

      if (app.lapse.settings.askSavePath) {
        windowManager.save?.open();
      } else {
        filePath = app.lapse.settings.savePath;
        this.prepareVideo(
          `${filePath}/lapse-${Date.now()}.${app.lapse.settings.format}`
        );
      }
    } catch (err: any) {
      console.error(`An unexpected error occurred: ${err.message}`);
      // Handle the error as needed
    }
  }

  pauseRecording = () => {
    // Send a notification saying recording paused
    this.recorderSettings.recordState = RECORDER_STATE.paused;
    this.screenshotInterval && clearInterval(this.screenshotInterval);
  };

  resumeRecording = () => {
    this.recorderSettings.recordState = RECORDER_STATE.recording;
    this.createScreenshotInterval(this.recorderSettings.sourceId);
  };

  async selectSource() {
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
        this.sourcesWindow = new BrowserWindow({
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

        this.sourcesWindow.loadURL(url);

        is.development &&
          this.sourcesWindow.webContents.openDevTools({ mode: "detach" });
        const selectScreen = (_e: any, args: any) => {
          // Check if the window still exists before interacting with it
          if (!this.sourcesWindow || this.sourcesWindow.isDestroyed()) {
            return;
          }

          activateWindow(args.ownerName);
          selectedSourceId = args.id;

          // Close the window once the source is selected
          this.sourcesWindow.close();
        };

        const closeScreen = (_e: any, _args: any) => {
          // Check if the window still exists before interacting with it
          if (!this.sourcesWindow || this.sourcesWindow.isDestroyed()) {
            return;
          }

          this.sourcesWindow.close();
          closeWindowMessage = true;
        };

        this.sourcesWindow?.webContents.on("did-finish-load", () => {
          ipcMain.once("selected-screen", selectScreen);
          ipcMain.once("close-screen", closeScreen);
        });

        this.sourcesWindow?.on("closed", () => {
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

  startRecording = async () => {
    // Clear the interval if the recording is not happening
    this.screenshotInterval && clearInterval(this.screenshotInterval);

    // We resolve this promise if recording started or we tell the user if it fails
    this.recorderSettings.sourceId = await this.selectSource();
    this.recorderSettings.frameCount = 0;

    if (this.recorderSettings.sourceId) {
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
          this.recorderSettings.ffmpegImgPattern = join(dirPath, "lapse%d.png");
          this.recorderSettings.imagesDir = dirPath;
          console.log("Image directory:", dirPath);
        }
      );

      // Set recording state to 'recording'
      this.recorderSettings.recordState = RECORDER_STATE.recording;

      // Check if countdown is enabled
      if (app.lapse.settings.countdown) {
        windowManager.timer?.open(this.recorderSettings.sourceId);
      } else {
        this.createScreenshotInterval(this.recorderSettings.sourceId);
      }
    }
  };
}
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

export const recorder = new ScreenRecorder();
