import { app } from "electron";
import log from "electron-log";

// Set the log level (error, warn, info, verbose, debug, silly)
log.transports.file.level = "info";

// Customize the log format
log.transports.file.format = "{h}:{i}:{s}:{ms} {text}";

// Set the file path for the log file
log.transports.file.fileName = `${app.getPath("userData")}/log.log`;

// Log uncaught exceptions and rejections to the log file
log.catchErrors({ showDialog: false });

// Log to console in development mode
if (process.env.NODE_ENV === "development") {
  log.transports.console.level = "debug";
}

export default log;
