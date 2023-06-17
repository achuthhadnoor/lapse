import { ipcRenderer, contextBridge } from "electron";
import { platform } from "os";

contextBridge.exposeInMainWorld("electron", {
  ipcRenderer: {
    platform: () => platform(),
    invoke: (name: string, payload: any) => ipcRenderer.invoke(name, payload),
    send: (name: string, payload: any) => ipcRenderer.send(name, payload),
    on: (
      name: string,
      handler: (event: Electron.IpcRendererEvent, ...args: any[]) => void
    ) => ipcRenderer.on(name, handler),
    off: (name: string | symbol, handler: (...args: any[]) => void) =>
      ipcRenderer.off(name, handler),
    addEventListener: (
      name: string | symbol,
      handler: (...args: any[]) => void
    ) => ipcRenderer.addListener(name, handler),
  },
});
