export interface mainWindowManager {
  open: () => void;
  isOpen: () => boolean;
  close: () => void;
}

export interface canvasWindowManager {
  open: () => void;
  isOpen: () => boolean;
  toggleView: () => void;
  clickThrough: () => void;
  closeAll: () => void;
  close: () => void;
}

export interface recorderWindowManager {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}
export interface settingsWindowManager {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}
export interface screensWindowManager {
  open: () => void;
  close: () => void;
  isOpen: () => boolean;
}

export class WindowManager {
  main?: mainWindowManager;
  recorder?: recorderWindowManager;
  settings?: settingsWindowManager;
  screens?: screensWindowManager;

  closeAll = () => {
    this.main?.close();
    this.settings?.close();
    this.recorder?.close();
  };

  setMainWindow = (mainManager: mainWindowManager) => {
    this.main = mainManager;
  };
  setRecorderWindow = (recorderManager: recorderWindowManager) => {
    this.recorder = recorderManager;
  };
  setSettingsWindow = (settingsManager: settingsWindowManager) => {
    this.settings = settingsManager;
  };
  setScreensWindow = (screensManager: screensWindowManager) => {
    this.screens = screensManager;
  };
}

export const windowManager = new WindowManager();
