import React, { useEffect, useState } from "react";
declare global {
  interface Window {
    electron: any;
  }
}
export default function Timer() {
  const [count, setCount] = useState(3);
  useEffect(() => {
    let counter = 0;
    setInterval(() => {
      counter = counter + 1;
      setCount(3 - counter);
      if (counter === 3) {
        window.electron.ipcRenderer.send("done-timer", {});
      }
    }, 1000);
    return () => {};
  }, []);

  return (
    <div className="flex justify-center align-middle absolute items-center h-screen w-screen">
      <div className="flex justify-center align-middle absolute h-[300px] w-[300px] rounded-full bg-gray-900 text-gray-50 text-9xl bold items-center">
        {count}
      </div>
    </div>
  );
}
