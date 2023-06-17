 

import { app } from "electron";

export const suspend = () => {
    console.log('suspend', '[sleep: ON]');
    app.lapse.isSystemSuspended = true;
};

export const resume = () => {
    console.log('resume', '[sleep: OFF]');
    app.lapse.isSystemSuspended = false;
};

export const lockScreen = () => {
    console.log('lockScreen', '[lock-screen: ON]');
    app.lapse.isSystemLocked = true;
};

export const unlockScreen = () => {
    console.log('unlockScreen', '[lock-screen: OFF]');
    app.lapse.isSystemLocked = false;
};