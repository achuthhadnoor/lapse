import { Notification } from "electron";
import { appIcon } from "./utils/tray";

function showNotification(message: string) {
  const notification = {
    // title: message,
    body: message,
    icon: appIcon,
  };
  new Notification(notification).show();
}

export default showNotification;
