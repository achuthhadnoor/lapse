import { Notification } from "electron";
import { appIcon } from "./utils/tray";

function showNotification(message: string, fn?: any) {
  const notification = {
    // title: message,
    body: message,
    icon: appIcon,
  };
  let notify: any = new Notification(notification);
  notify.show();
  fn && notify.on("click", fn);
}

export default showNotification;
