import React, { useEffect, useRef, useState } from "react";
import cl from "classnames";
declare global {
  interface Window {
    electron: any;
  }
}

export default function recorder() {
  const [isWindows, setIsWindows] = useState(false);
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
        "flex h-full items-center px-2 pt-1 select-none w-auto gap-1",
        isWindows &&
          "dark:bg-[#161d18] dark:text-50 bg-gray-50 text-[#161d18] rounded",
        " text-neutral-800 relative  dragable dark:text-neutral-400"
      )}
    >
      <span
        className="px-2"
        onClick={() => {
          setRo(!Ro);
        }}
        title="/documents/achuth/home/dam/sample/photorecording/lapse"
      >
        🅧
      </span>
      <span className="w-[1px] h-[40px] bg-neutral-500 rounded" />
      <div className="flex flex-col  px-2">
        {/* <span className="label-text p-[1px]">Select Screen</span> */}
        <select className="bg-black/10 rounded-md py-1 outline-none px-2 text-xs max-w-sm relative w-32">
          <option>Select screen or app</option>
          <option>mp4</option>
          <option>mp4</option>
          <option>mp4</option>
          <option>mp4</option>
          <option>mp4</option>
        </select>
      </div>
      <div className="flex flex-col  px-2">
        {/* <span className="label-text p-[1px]">Screenshot interval</span> */}
        <input
          className="bg-black/10 rounded-md py-1 outline-none px-2 w-24 text-xs"
          placeholder=""
          type="number"
        />
      </div>
      {/* <div className="flex flex-col  px-2">
        <span className="label-text p-[1px]">Export </span>
        <select className="bg-black/20 rounded-md py-1 outline-none px-2 text-xs max-w-sm relative w-20">
          <option>MP4</option>
          <option>mp4</option>
          <option>mp4</option>
          <option>mp4</option>
          <option>mp4</option>
        </select>
      </div>
      <div className="flex flex-col  px-2">
        <span className="label-text p-[1px]">Quality</span>
        <select className="bg-black/20 rounded-md py-1 outline-none px-2 text-xs max-w-sm relative w-20">
          <option>Maximum,</option>
          <option>mp4</option>
          <option>mp4</option>
          <option>mp4</option>
          <option>mp4</option>
        </select>
      </div>
      <div className="flex flex-col  px-2">
        <span className="label-text p-[1px]">FrameRate</span>
        <select className="bg-black/20 rounded-md py-1 outline-none px-2 text-xs max-w-sm relative w-20">
          <option>12</option>
          <option>24</option>
          <option>30</option>
          <option>60</option>
        </select>
      </div> */}
      <span className="w-[1px] h-[40px] bg-neutral-500 rounded" />
      <span className="px-2">00:00:00</span>
      <button className="px-3 p-2 hover:bg-black/10 rounded">◉</button>
      {/* <button className="px-3 p-2 hover:bg-black/10 rounded">◎</button>
      <button className="px-3 p-2 hover:bg-black/10 rounded">⦿</button> */}
    </div>
  );
}
