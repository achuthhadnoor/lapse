import { app, ipcMain, net } from "electron";
import { store } from "./utils/store";
import { initializeTray } from "./utils/tray";
import { windowManager } from "./windows/windowManager";

export const verifyUser = () => {
  const url = "https://getlapseapp.com/api/verify";
  const params = new URLSearchParams({
    email: "example@example.com",
    license: "12345",
  });
  const request = net.request({
    method: "POST",
    url: url,
    // headers: {
    //   "Content-Type": "application/x-www-form-urlencoded",
    // },
  });

  request.on("response", (response) => {
    let body = "";
    response.on("data", (chunk) => {
      body += chunk;
    });
    response.on("end", () => {
      const data = JSON.parse(body);
      console.log(data);
    });
  });

  request.write(params.toString());
  request.end();
};

export default function init() {
  ipcMain.on("verified", (event, { id, email, code, name }) => {
    event.returnValue = "Verified";
    let user = {
      id,
      email,
      code,
      name,
      isVerified: true,
    };
    app.lapse.user = user;
    store.set("lapse-user", app.lapse.user);
    windowManager.license?.close();
    // createTray();
    initializeTray();
  });

  ipcMain.on("quit-app", () => {
    app.quit();
  });
}
