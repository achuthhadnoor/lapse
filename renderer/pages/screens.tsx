import React, { useEffect, useState } from "react";
import cl from "classnames";
declare global {
  interface Window {
    electron: any;
  }
}

export default function Screens() {
  const [source, setSource] = useState<null | {
    appIcon: boolean;
    display_id: string;
    height: number;
    id: string;
    name: string;
    thumbnail: string;
    width: number;
  }>(null);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const handleMessage = (event) => {
      if (event.data && event.data.sourceId) {
        window.close();
      }
    };
    getSources();
    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

  const getSources = () => {
    setLoading(true);
    window.electron.ipcRenderer.invoke("get-sources").then((src) => {
      setSources(JSON.parse(src));
      setLoading(false);
    });
  };

  const startRecording = () => {
    window.electron.ipcRenderer.send("selected-screen", source);
    window.postMessage(source, "*");
  };
  const selectSource = (src) => {
    setSource(src);
  };

  return (
    <>
      {loading ? (
        <div className="flex justify-center h-screen items-center w-full">
          <svg
            className="animate-spin  -ml-1 mr-3 h-5 w-5 text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          <span className="text-neutral-400">Fetching your screens..</span>
        </div>
      ) : (
        <div className=" flex flex-col dragable text-neutral-800 dark:text-neutral-100 h-screen pb-5">
          <div className="flex items-center justify-between p-4">
            <div>Select Screen</div>
            <div className="flex gap-2 align-middle text-neutral-800 dark:text-neutral-100">
              <span className=" p-2" onClick={getSources}>
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M17.25 3V7.5H12.75"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M0.75 15V10.5H5.25"
                    stroke="currentColor"
                    stroke-width="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M2.6325 6.75006C3.01288 5.67515 3.65935 4.71411 4.5116 3.95662C5.36385 3.19913 6.3941 2.66988 7.50621 2.41825C8.61833 2.16662 9.77607 2.20081 10.8714 2.51764C11.9667 2.83446 12.9639 3.42359 13.77 4.23006L17.25 7.50006M0.75 10.5001L4.23 13.7701C5.03606 14.5765 6.03328 15.1657 7.12861 15.4825C8.22393 15.7993 9.38167 15.8335 10.4938 15.5819C11.6059 15.3302 12.6361 14.801 13.4884 14.0435C14.3407 13.286 14.9871 12.325 15.3675 11.2501"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <span
                className="p-2"
                onClick={() => {
                  window.electron.ipcRenderer.send("close-screen", {
                    status: "close",
                  });
                }}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    d="M18 6L6 18"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                  <path
                    d="M6 6L18 18"
                    stroke="white"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  ></path>
                </svg>
              </span>
            </div>
          </div>
          {/* <div className="flex flex-1"> */}
          <div className="flex-1 py-5 max-h-screen overflow-auto grid grid-cols-3 px-5 gap-2 align-middle dark:text-neutral-400 text-neutral-800">
            {sources?.map((src) => (
              <div className="relative px-2 pt-5 cursor-pointer " key={src.id}>
                <img
                  className={cl(
                    " h-[100px]  rounded-md gap-1 hover:ring-2 hover:ring-green-700 relative",
                    source?.id === src.id && "ring-2 ring-green-700"
                  )}
                  src={src.thumbnail}
                  onClick={() => {
                    selectSource(src);
                  }}
                />
                <div className="text-xs font-semibold pt-4 overflow-ellipsis w-[150px] overflow-hidden">
                  {src.name}
                </div>
                {/* <img
                className="rounded hover:ring-2 hover:ring-green-700 m-5 relative h-10 w-10"
                src={src.thumbnail}
              /> */}
              </div>
            ))}
          </div>
          {/* </div> */}
          {/* <div className=" flex flex-col w-1/2 gap-4 text-neutral-800 dark:text-neutral-100">
        <h1 className="px-2 text-2xl mt-10">Options</h1>
        <div className="flex gap-2 items-center">
          <label className="px-2">Dimensions</label>
          <input
            type="number"
            className="bg-neutral-200 dark:bg-neutral-900 focus:ring-2 focus:ring-green-600 rounded p-2 outline-none"
            placeholder="height"
          />
          <span>x</span>
          <input
            type="number"
            className="bg-neutral-200 dark:bg-neutral-900 focus:ring-2 focus:ring-green-600 rounded p-2 outline-none"
            placeholder="width"
          />
        </div>
        <div className="flex">
          <label className="inline px-2 w-1/5">Framerate</label>
          <input
            type="number"
            className="bg-neutral-200 dark:bg-neutral-900 focus:ring-2 focus:ring-green-600 rounded p-2 outline-none"
            placeholder="Framerate"
          />
        </div>
        <div className="flex">
          <label className="inline px-2 w-1/5">Quality</label>
          <input
            type="number"
            className="bg-neutral-200 dark:bg-neutral-900 focus:ring-2 focus:ring-green-600 rounded p-2 outline-none"
            placeholder="Quality"
          />
        </div>
        <div className="flex">
          <label className="inline px-2 w-1/5">Export format</label>
          <select
            className="bg-neutral-200 dark:bg-neutral-900 focus:ring-2 focus:ring-green-600 rounded px-2 outline-none"
            defaultValue={"mkv"}
          >
            <option value={"mp4"}>mp4</option>
            <option value={"mkv"}>mkv</option>
            <option value={"webm"}>webm</option>
          </select>
        </div>
        <div className="flex items-center">
          <label className="inline px-2 w-1/5">Save path</label>
          <input
            type="file"
            className="bg-neutral-200 dark:bg-neutral-900 focus:ring-2 focus:ring-green-600 rounded p-2 outline-none"
            placeholder="Quality"
          />
        </div>

      </div> */}
          <button
            className="bg-green-800 mx-10 my-2 rounded p-2 text-neutral-50"
            onClick={startRecording}
          >
            Record
          </button>
        </div>
      )}
    </>
  );
}
