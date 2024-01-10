import { app } from "electron";
import startupApp from "./app";
import { checkIfAppIsOpen } from "./utils/lib";

// check for other instance
checkIfAppIsOpen();

app.allowRendererProcessReuse = true;

app.whenReady().then(() => startupApp.init());

app.on("window-all-closed", () => {
  if (!app.lapse.user.isVerified) app.quit();
});
