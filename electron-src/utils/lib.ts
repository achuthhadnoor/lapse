import { BrowserWindow, app, dialog, net, screen, shell } from "electron";
import { is } from "electron-util";
import { join } from "path";
import { format } from "url";

export const checkForUpdates = (click: boolean) => {
  // get latest version number and compare with app.getVersion() and send notification to user
  const url = is.development
    ? "http://localhost:3000/api/updates"
    : "https://getlapseapp.com/api/updates";
  const request = net.request(url);

  request.on("response", (response) => {
    let body = "";
    response.on("data", (chunk) => {
      body += chunk;
    });
    response.on("end", async () => {
      const data = JSON.parse(body);
      console.log(`Version: ${data.version}`);
      if (app.getVersion() !== data.version) {
        const { response } = await dialog.showMessageBox({
          type: "info",
          buttons: ["Download Updates", "Cancel"],
          defaultId: 0,
          message: "New Update available",
          detail: "Click below to download latest version",
          cancelId: 1,
        });
        if (response === 0) {
          console.log("====================================");
          console.log(
            `https://getlapseapp.com/download?email=${app.lapse.user.email}&&code=${app.lapse.user.code}`
          );
          console.log("====================================");
          shell.openExternal(
            `https://getlapseapp.com/download?email=${app.lapse.user.email}&&code=${app.lapse.user.code}`
          );
        }
      } else {
        if (click) {
          await dialog.showMessageBox({
            type: "info",
            buttons: ["ok"],
            defaultId: 0,
            message: "Lapse runs the latest version already",
          });
        }
      }
    });
  });
  request.on("error", (err) => {
    console.log("====================================");
    console.log(err);
    console.log("====================================");
    debugger;
  });
  request.end();
};

export const tempWindow = () => {
  const screenBounds = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint()
  ).bounds;
  let dialogWindow: BrowserWindow | null = new BrowserWindow({
    height: screenBounds.height,
    width: screenBounds.width,
    show: false, // Create the window initially hidden
    alwaysOnTop: true,
    transparent: true,
    frame: false,
  });
  // Load a blank HTML page
  const url = is.development
    ? "http://localhost:8000/empty"
    : format({
        pathname: join(__dirname, "../../renderer/out/empty.html"),
        protocol: "file:",
        slashes: true,
      });
  dialogWindow.loadURL(url);

  // When the window is ready, show the dialog
  dialogWindow.webContents.on("did-finish-load", () => {
    // do the logic here
  });

  // Handle the dialog window being closed
  dialogWindow.on("closed", () => {
    dialogWindow = null;
  });
};
