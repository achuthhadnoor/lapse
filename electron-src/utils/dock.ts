import { app } from "electron";
import { Promisable } from "type-fest";

const setDockVisibility = async (visible: boolean) => {
  if (visible) {
    await app.dock.show();
  } else {
    app.dock.hide();
  }
};

export const withVisibleDock = async (action: () => Promisable<void>) => {
  const wasDockShowing = app.dock.isVisible();
  await setDockVisibility(true);
  await action();
  await setDockVisibility(wasDockShowing);
};

export const withVisibleDockSync = (action: () => void) => {
  const wasDockShowing = app.dock.isVisible();
  setDockVisibility(true);
  action();
  setDockVisibility(wasDockShowing);
};
