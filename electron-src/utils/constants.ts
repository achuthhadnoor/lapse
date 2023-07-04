import { app } from "electron";

export const USER_DEFAULT = {
  id: "",
  email: "",
  code: "",
  name: "",
  isVerified: false,
};

export const IMAGE_TYPE_DEFAULT: "png" | "jpg" = "png";

export const IMAGE_DIR_DEFAULT = "~/var/temp/lapse/";
export const FORMAT_DEFAULT = "mp4";
export const SAVE_PATH_DEFAULT = `${app.getPath("documents")}/lapse`;
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
};

export const DEFAULT_STATE = {
  timerText: "00:00:00",
  user: USER_DEFAULT,
  settings: SETTINGS_DEFAULT,
};
