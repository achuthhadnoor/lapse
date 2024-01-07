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
import { writeFileSync, existsSync } from "fs";
import { format } from "url";
import { fixPathForAsarUnpack, is } from "electron-util";
import ffmpeg from "fluent-ffmpeg";
import { path as ffmpegPath } from "@ffmpeg-installer/ffmpeg";
import showNotification from "../notify";
import { RECORDER_STATE } from "./constants";
import { tray } from "./tray";
import { windowManager } from "../windows/windowManager";
import log from "./logger";
import { updateSettings } from "./lib";

const { getWindows, activateWindow } = require("mac-windows");

export class ScreenRecorder {
  defaultSettings: any;
  screenshotInterval: any;
  recorderSettings: any;
  sourcesWindow: BrowserWindow | null;

  constructor() {
    track();
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
    this.sourcesWindow = null;
    this.recorderSettings = { ...this.defaultSettings };
  }

  getRecordingState() {
    return this.recorderSettings.recordState;
  }

  isRecording() {
    if (this.recorderSettings.recordState !== RECORDER_STATE.idle) {
      return true;
    } else {
      return false;
    }
  }

  initVariables() {
    this.clearScreenshotInterval();
    cleanupSync();
    this.recorderSettings = {
      ...this.defaultSettings,
      recordState: RECORDER_STATE.idle,
      frameCount: 0,
      sourceId: "0",
      interval: undefined,
    };
    tray.setIdleTrayMenu();
  }

  clearScreenshotInterval() {
    if (this.screenshotInterval) {
      clearInterval(this.screenshotInterval);
      this.screenshotInterval = null;
    }
  }

  async createScreenshotInterval(sourceId: any) {
    this.clearScreenshotInterval();
    this.screenshotInterval = setInterval(async () => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["window", "screen"],
          thumbnailSize: screen.getPrimaryDisplay().bounds,
        });

        const source = sources.find((s) => s.id === sourceId);

        if (source) {
          const imgBuffer = Buffer.from(
            source.thumbnail.toDataURL().split(",")[1],
            "base64"
          );
          const filePath = join(
            this.recorderSettings.imagesDir,
            `lapse${this.recorderSettings.frameCount++}.png`
          );
          log.info("filePath ==>", filePath);
          writeFileSync(filePath, imgBuffer);
        } else {
          this.pauseRecording();
          showNotification(
            "Paused! The recording source is not active or closed"
          );
        }
      } catch (error) {
        console.error("Error during screenshot interval:", error);
      }
    }, app.lapse.settings.intervals * 1000);
  }

  async handleVideoEnd(outputPath: string) {
    log.info("Video rendering completed successfully!");

    this.initVariables();
    showNotification("Complete! The video is saved to disk", () => {
      shell.openPath(outputPath);
    });

    const success = app.lapse.settings.lapse_recording_count || 0;
    await updateSettings({ lapse_recording_count: success + 1 });
  }

  async handleVideoError(err: { message: any }) {
    log.error(`An error occurred: ${err.message}`);
    showNotification(`An error occurred: ${err.message}`);

    const failed = app.lapse.settings.failed_recordings_count || 0;
    await updateSettings({ failed_recordings_count: failed + 1 });
  }

  async handleVideoClose(code: number) {
    if (code === 0) {
      log.info("Video rendering completed successfully!");
      const success = app.lapse.settings.lapse_recording_count || 0;
      await updateSettings({ lapse_recording_count: success + 1 });
    } else {
      log.error(`Video rendering failed with code ${code}`);
      const failed = app.lapse.settings.failed_recordings_count || 0;
      await updateSettings({ failed_recordings_count: failed + 1 });
    }
  }

  prepareVideo(outputPath: string) {
    let startTime = Date.now();
    log.info("Start Time Create Timelapse ==>" + startTime);

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
    tray.setTrayTitle(`0%`);

    try {
      const commonOptions = [
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
      ];

      const videoOptions = [
        ...commonOptions,
        `-r ${framerate}`,
        `-s ${this.recorderSettings.width}x${this.recorderSettings.height}`,
        "-vf scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2",
      ];

      command
        .input(this.recorderSettings.ffmpegImgPattern)
        .inputOptions([
          "-y",
          `-r ${app.lapse.settings.framerate}`,
          "-f image2",
          "-start_number 0",
        ])
        .outputOptions(videoOptions)
        .output(outputPath)
        .on("end", async () => {
          await this.handleVideoEnd(outputPath);
        })
        .on("error", async (err) => {
          await this.handleVideoError(err);
        })
        .on("progress", (progress) => {
          this.handleRecordingProgress(progress);
        })
        .on("stderr", (progress) => {
          this.handleRecordingProgress(progress, true);
        })
        .on("close", async (code) => {
          await this.handleVideoClose(code);
        })
        .run();
    } catch (err: any) {
      this.handleRecordingError(`An unexpected error occurred: ${err.message}`);
      const failed = app.lapse.settings.failed_recordings_count || 0;
      updateSettings({
        failed_recordings_count: failed + 1,
      });
    }
  }

  stopRecording() {
    try {
      this.clearScreenshotInterval();
      this.recorderSettings.recordState = RECORDER_STATE.rendering;
      tray.setRenderingTrayMenu();
      if (app.lapse.settings.askSavePath) {
        windowManager.save?.open();
      } else {
        const outputPath = this.getVideoOutputPath();
        this.prepareVideo(outputPath);
      }
    } catch (err: any) {
      const failed = app.lapse.settings.failed_recordings_count || 0;
      updateSettings({
        failed_recordings_count: failed + 1,
      });
      console.error(`An unexpected error occurred: ${err.message}`);
    }
  }

  handleRecordingError(errorMessage: string) {
    console.error(errorMessage);
    showNotification(errorMessage);
    this.initVariables();
  }

  handleRecordingProgress(progress: any, stderr = false) {
    if (progress && progress?.percent) {
      const progressVal = Math.round(progress?.percent || 0);
      tray.setTrayTitle(` ${progressVal}% `);
    }

    if (stderr) {
      const progressMatch = progress
        .toString()
        .match(/time=(\d+:\d+:\d+\.\d+)/);

      if (progressMatch) {
        const numberOfImages = this.recorderSettings.frameCount;
        const videoDurationInSeconds =
          numberOfImages / app.lapse.settings.framerate;
        const timeString = progressMatch[1];
        const [hours, minutes, seconds] = timeString.split(":").map(parseFloat);
        const totalTimeInSeconds = hours * 3600 + minutes * 60 + seconds;
        const progressPercentage = Math.floor(
          (totalTimeInSeconds / videoDurationInSeconds) * 100
        );

        log.info(`Progress: ${progressPercentage}%`);
        progressPercentage && tray.setTrayTitle(`${progressPercentage}%`);
      }
    }
  }

  getVideoOutputPath() {
    const filePath = join(
      app.lapse.settings.savePath,
      `lapse-${Date.now()}.${app.lapse.settings.format}`
    );

    if (existsSync(filePath)) {
      return this.getUniqueFilePath(filePath);
    }

    return filePath;
  }

  getUniqueFilePath(filePath: string, count = 1): any {
    const [name, ext] = filePath.split(".");
    const numberedFilePath = `${name}-${count}.${ext}`;

    if (existsSync(numberedFilePath)) {
      return this.getUniqueFilePath(filePath, count + 1);
    }

    return numberedFilePath;
  }

  pauseRecording = () => {
    log.info("Paused!");
    this.recorderSettings.recordState = RECORDER_STATE.paused;
    this.clearScreenshotInterval();
    tray.setPausedTrayMenu();
  };

  resumeRecording = () => {
    this.recorderSettings.recordState = RECORDER_STATE.recording;
    this.createScreenshotInterval(this.recorderSettings.sourceId);
  };

  async selectSource() {
    try {
      let selectedSourceId: string = "0";
      let closeWindowMessage = false;

      const sources = await desktopCapturer.getSources({
        types: ["window", "screen"],
        thumbnailSize: screen.getPrimaryDisplay().bounds,
      });

      selectedSourceId = sources[0].id;

      return new Promise(async (resolve) => {
        this.sourcesWindow = new BrowserWindow({
          height: 600,
          width: 500,
          fullscreen: false,
          resizable: false,
          frame: false,
          alwaysOnTop: true,
          transparent: is.macos,
          vibrancy: "sidebar",
          skipTaskbar: true,
          hiddenInMissionControl: true,
          webPreferences: {
            nodeIntegration: true,
            allowRunningInsecureContent: true,
            preload: join(__dirname, "../preload.js"),
          },
        });

        this.sourcesWindow.setSkipTaskbar(false);

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
          if (!this.sourcesWindow || this.sourcesWindow.isDestroyed()) {
            return;
          }
          activateWindow(args.ownerName);
          selectedSourceId = args.id;
          this.sourcesWindow.close();
        };

        const closeScreen = (_e: any, _args: any) => {
          if (!this.sourcesWindow || this.sourcesWindow.isDestroyed()) {
            return;
          }

          this.sourcesWindow.close();
          closeWindowMessage = true;
        };

        this.sourcesWindow.webContents.on("did-finish-load", () => {
          ipcMain.once("selected-screen", selectScreen);
          ipcMain.once("close-screen", closeScreen);
        });

        this.sourcesWindow.on("closed", () => {
          ipcMain.removeListener("selected-screen", selectScreen);
          ipcMain.removeListener("close-screen", closeScreen);

          if (closeWindowMessage) {
            closeWindowMessage = false;
          } else {
            resolve(selectedSourceId);
          }
        });
      });
    } catch (error) {
      console.error(`Error selecting source: ${error}`);
      throw error;
    }
  }

  async startRecording() {
    this.clearScreenshotInterval();
    this.recorderSettings.sourceId = await this.selectSource();
    this.recorderSettings.frameCount = 0;

    if (this.recorderSettings.sourceId) {
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
          log.info("===> Image directory:", dirPath);
        }
      );

      this.recorderSettings.recordState = RECORDER_STATE.recording;

      if (app.lapse.settings.countdown) {
        windowManager.timer?.open();
      } else {
        this.createScreenshotInterval(this.recorderSettings.sourceId);
      }
    }
  }
}

ipcMain.handle("get-sources", async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ["window", "screen"],
      thumbnailSize: screen.getDisplayNearestPoint(
        screen.getCursorScreenPoint()
      ).bounds,
    });
    const windows = await getWindows();

    const srcs = sources.map((src) => ({
      ...windows.find(
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
      ),
      ...src,
      thumbnail: src.thumbnail.toDataURL(),
      appIcon: src.appIcon !== null && src.appIcon.toDataURL(),
    }));

    return JSON.stringify(srcs);
  } catch (error) {
    console.error(`Error getting sources: ${error}`);
    throw error;
  }
});

export const recorder = new ScreenRecorder();
