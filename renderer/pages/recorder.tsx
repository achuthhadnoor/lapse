import React, { useEffect, useRef, useState } from "react";
import cl from "classnames";
declare global {
  interface Window {
    electron: any;
  }
}

export default function recorder() {
  const [isWindows, setIsWindows] = useState(false);
  const [pause, setPause] = useState(false);
  const [Ro, setRo] = useState(false);

  useEffect(() => {
    if (window) {
      setIsWindows(window.electron.ipcRenderer.platform() !== "darwin");
    }
  });

  const startRecording = () => {
    navigator.mediaDevices
      .getDisplayMedia({ video: true, audio: false })
      .then((source) => {
        debugger;
      });
  };
  return (
    <div
      className={cl(
        "flex h-full items-center px-2 pt-1 select-none w-auto gap-2",
        isWindows &&
          "dark:bg-[#161d18] dark:text-50 bg-gray-50 text-[#161d18] rounded",
        " text-neutral-800 relative  dragable dark:text-neutral-400"
      )}
    >
      <span className="px-2">00:00:00</span>
      <span className="w-[1px] h-[40px] bg-neutral-500 rounded" />
      {pause ? (
        <button
          className="px-3 p-2 hover:bg-black/10 rounded"
          onClick={() => {
            setPause(!pause);
          }}
        >
          ▶
        </button>
      ) : (
        <button
          className="px-3 p-2 hover:bg-black/10 rounded rotate-90"
          onClick={() => {
            setPause(!pause);
          }}
        >
          =
        </button>
      )}
      <button
        className="px-3 p-2  rounded hover:bg-black/10  text-red-400"
        title="Stop Recording"
      >
        ◉
      </button>
    </div>
  );
}
