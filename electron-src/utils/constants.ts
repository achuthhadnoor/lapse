import { app } from "electron";
import { is } from "electron-util";
import { hostname } from "os";

export const uniqueName = hostname();

export const USER_DEFAULT = is.development
  ? {
      id: "0",
      email: "hi@achuth.dev",
      code: "DEVIL_MAY_CRY",
      name: "Achuth Hadnoor",
      isVerified: true,
    }
  : {
      id: "",
      email: "",
      code: "",
      name: "",
      isVerified: false,
    };

export const IMAGE_TYPE_DEFAULT: "png" | "jpg" = "png";

export const IMAGE_DIR_DEFAULT = "~/var/temp/lapse/";
export const FORMAT_DEFAULT = "mp4";
export const SAVE_PATH_DEFAULT = `${app.getPath("documents")}/`;
export const SETTINGS_DEFAULT = {
  showTimer: true,
  intervals: 2, // 2,3,4,5
  countdown: true,
  imageType: IMAGE_TYPE_DEFAULT,
  imagesDir: IMAGE_DIR_DEFAULT,
  framerate: 30, //12 24,30,60,
  format: FORMAT_DEFAULT,
  quality: "auto", //256 12 18 24 30 36 42 48
  key: null,
  autolaunch: true,
  savePath: SAVE_PATH_DEFAULT,
  height: "1080",
  width: "1920",
  displayHideList: [], // ? Contains list of screens/apps to hide while starting to record ; {name,id,imageAsdataURI,byDev}
  askSavePath: false,
  lapse_recording_count: 0,
  failed_recordings_count: 0,
  updateAvailable: false,
};
export const INTERVALS = [2, 3, 4, 5];
export const RECORDER_STATE = {
  idle: "IDLE",
  recording: "RECORDING",
  paused: "PAUSED",
  rendering: "RENDERING",
};
export const DEFAULT_STATE = {
  timerText: "00:00:00",
  user: USER_DEFAULT,
  settings: SETTINGS_DEFAULT,
};

export const trimString = (inputString: string) => {
  if (inputString.length > 50) {
    const trimmedString = "...." + inputString.slice(-46); // Trim the first (length - 4) characters
    return trimmedString;
  }
  return inputString;
};
