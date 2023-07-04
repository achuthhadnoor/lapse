import { app } from "electron";
import Store from "electron-store";
import { DEFAULT_STATE } from "./constants";

export const store = new Store();

export const getAppData = () => {
  // ? only un comment to clear the data including licence
  // store.set("lapse-settings", app.lapse.settings);
  // store.set("lapse-user", app.lapse.user);
  app.lapse = DEFAULT_STATE;

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
};
