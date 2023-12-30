import { app } from "electron";
import Store from "electron-store";
import { DEFAULT_STATE } from "./constants";
import log from "./logger";

export const store = new Store();

export const loadAppData = () => {
  app.lapse = DEFAULT_STATE;
  // ? only un comment to clear the data including licence
  // store.set("lapse-settings", app.lapse.settings);
  // store.set("lapse-user", app.lapse.user);

  if (store.get("lapse-user")) {
    app.lapse.user = store.get("lapse-user");
  } else {
    store.set("lapse-user", app.lapse.user);
  }
  if (store.get("lapse-settings")) {
    app.lapse.settings = store.get("lapse-settings");
  } else {
    store.set("lapse-settings", app.lapse.settings);
  }
  log.info(
    "loadAppData ==>",
    JSON.stringify(app.lapse.user),
    JSON.stringify(app.lapse.settings)
  );
};

export const updateStoreSettings = (settings: any) => {
  store.set("lapse-settings", settings);
};
