import { useEffect, useState } from "react";
import axios from "axios";
import cl from "classnames";
import { Logo, codes } from "../constants";

declare global {
  interface Window {
    electron: any;
  }
}

const IndexPage = () => {
  const [licenseKey, setLicenseKey] = useState("");
  const [licenseErr, setLicenseErr] = useState(false);
  const [agree, setAgree] = useState(false);
  const [data, setData] = useState(true);
  const [errors, setErrors] = useState([]);
  const [isWindows, setIsWindows] = useState(false);
  const [permissions, setPermissions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [licenceDetails, setLicenseDetails] = useState({
    id: "",
    hostname: "",
    name: "",
    code: "",
    isVerified: false,
  });
  const limit = 10;

  useEffect(() => {
    if (window) {
      setIsWindows(window.electron.ipcRenderer.platform() !== "darwin");
    }
  }, []);

  const nestedValue = (mainObject, key) => {
    try {
      return key
        .split(".")
        .reduce((obj, property) => obj[property], mainObject);
    } catch (err) {
      return null;
    }
  };

  const gumroad = async (name) => {
    try {
      const response = await axios.post(
        "https://api.gumroad.com/v2/licenses/verify",
        {
          product_permalink: "lapse_app",
          license_key: licenseKey,
          increment_uses_count: true,
        }
      );

      const uses = nestedValue(response, "data.uses");

      if (uses > limit) {
        handleAlert("Sorry, This license has expired!");
        return;
      }

      const refunded = nestedValue(response, "data.purchase.refunded");
      if (refunded) {
        handleAlert("Sorry, This purchase has been refunded.");
        return;
      }

      const chargebacked = nestedValue(response, "data.purchase.chargebacked");
      if (chargebacked) {
        handleAlert("Sorry, This purchase has been chargebacked.");
        return;
      }

      setLicenseDetails({
        id: response.data.purchase.id,
        code: licenseKey,
        hostname: name,
        name: response.data.purchase.name,
        isVerified: true,
      });
      setPermissions(true);
    } catch (error) {
      handleGumroadError(error, name);
    } finally {
      setLoading(false);
    }
  };

  const handleGumroadError = (error, name) => {
    if (!error.response) {
      handleAlert("Please check your internet connection.");
    } else if (error.response.status && error.response.status >= 500) {
      handleAlert("Oh no. Lapse can't be reached. Please try again later.");
    } else {
      if (codes.includes(licenseKey)) {
        setLicenseDetails({
          id: licenseKey,
          hostname: name,
          code: licenseKey,
          name,
          isVerified: true,
        });
        setPermissions(true);
      } else {
        handleAlert("Sorry. This license does not exist.");
      }
    }
  };

  const handleAlert = (message) => {
    alert(message);
  };
  useEffect(() => {
    if (window) {
      setIsWindows(window.electron.ipcRenderer.platform() !== "darwin");
    }
  });

  const validateActivation = (e) => {
    e.preventDefault();
    setLoading(true);
    const newArr = [];

    if (
      licenseKey !== "" //&&
      //   licenseKey.length === 19 &&
      //   licenseKey.split("-").length === 4
    ) {
      setLicenseErr(false);
    } else {
      newArr.push("Enter License key");
      setLicenseErr(true);
    }

    if (!agree) {
      newArr.push("Accept the license agreement");
    }

    if (newArr.length > 0) {
      setErrors(newArr);
      setLoading(false);
    } else {
      window.electron.ipcRenderer.invoke("get-hostname").then((e) => {
        gumroad(e);
      });
    }
  };

  const grantedPermissions = () => {
    window.electron.ipcRenderer.send("verified", licenceDetails);
  };

  return (
    <>
      <div className="fixed flex gap-2 top-4 left-[15px] opacity-[0.3] transition ease-in-out text-neutral-700 dark:text-neutral-300">
        <svg
          width="56"
          height="16"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="8" cy="8" r="5.5" stroke="currentColor"></circle>
          <circle cx="28" cy="8" r="5.5" stroke="currentColor"></circle>
          <circle cx="48" cy="8" r="5.5" stroke="currentColor"></circle>
        </svg>
      </div>

      {!isWindows && permissions ? (
        // Render UI for granted permissions
        <form
          className="fixed flex flex-col gap-2 px-6 py-1 dragable inset-0 justify-center my-4"
          onSubmit={grantedPermissions}
        >
          <div className="flex flex-col flex-1 items-center h-full justify-center gap-4">
            <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-200 w-full">
              Grant Permissions
            </h1>
            <p className=" text-lg text-neutral-600 dark:text-neutral-400 w-full">
              Lapse require screen recording permission. Follow the below link
              on how to enable{" "}
            </p>
            <u
              className="no-drag text-neutral-400 w-full p-1 cursor-pointer"
              onClick={() => {
                window.electron.ipcRenderer.navigate(
                  "https://achuth.notion.site/Press-Kit-1a3b994e395d43efbaf6727fed4429f1"
                );
              }}
            >
              How to install
            </u>
          </div>
          <button
            type="submit"
            className="flex justify-center align-center items-center p-2 dark:bg-green-500 rounded text-green-900 font-semibold bg-green-400 no-drag "
          >
            Launch the app
          </button>
        </form>
      ) : (
        // Render UI for license activation
        <form
          className="fixed flex flex-col justify-between px-6 py-1 dragable inset-0 "
          onSubmit={validateActivation}
        >
          {/* Content for license activation */}
          <div className="flex flex-1 flex-col pt-6 ">
            <Logo />
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
              Welcome to lapse!
            </h3>
            <div className="text-sm  text-neutral-600 dark:text-neutral-400 py-2">
              Enter your license below to activate:
            </div>
            <input
              className={cl(
                licenseErr
                  ? "border-red-500"
                  : "dark:border-neutral-600 border-neutral-300",
                "my-2 px-[10px] py-[15px] rounded-md no-drag border-2 outline-none accent-green-500 w-full   bg-transparent text-neutral-900 dark:text-neutral-200"
              )}
              placeholder="XXXX-XXXX-XXXX-XXXX..."
              id="license_input"
              value={licenseKey}
              onChange={(e: any) => {
                // const inputValue = e.target.value;
                setLicenseKey(e.target.value);

                // if (
                //   inputValue.split("-").length === 4 &&
                //   inputValue.length === 18
                // ) {
                //   setLicenseKey(e.target.value);
                // } else {
                //   const sanitizedValue = inputValue.replace(
                //     /[^A-Za-z0-9]/g,
                //     ""
                //   );
                //   const formattedValue = sanitizedValue
                //     .replace(/(.{4})/g, "$1-")
                //     .slice(0, 19);
                //   setLicenseKey(formattedValue);
                // }
              }}
            />
            <div className="flex flex-col py-[10px] align-baseline justify-start gap-[14px] text-neutral-500 no-drag">
              <label className="flex align-middle items-center gap-1  text-sm">
                <input
                  type="checkbox"
                  id="license_agree"
                  checked={agree}
                  className="accent-green-500"
                  onChange={() => {
                    setAgree(!agree);
                  }}
                />
                <span className="px-2">
                  I have read and agree to the{" "}
                  <u
                    className="cursor-pointer"
                    onClick={(e) => {
                      window.electron.ipcRenderer.navigate(
                        "https://achuth.notion.site/Terms-of-Service-cf16898198bd42eeb41f4a780f04ac94"
                      );
                    }}
                  >
                    terms of the software license agreement
                  </u>
                </span>
              </label>
              <label className="hidden flex align-middle items-center gap-1  text-sm ">
                <input
                  type="checkbox"
                  id="license_data"
                  checked={data}
                  className="accent-green-500"
                  onChange={() => {
                    setData(!data);
                  }}
                />
                <span className="px-2">
                  Share anonymous usage data to help improve the app ( optional
                  )
                </span>
              </label>
            </div>
            <div className="flex flex-row flex-wrap flex-1 gap-2 p-2">
              {errors.map((error) => (
                <span
                  className="text-8px text-sm text-red-500"
                  key={`${error}`}
                >
                  {error}
                </span>
              ))}
            </div>
            <div className="flex flex-col text-center gap-2 no-drag">
              {/* <button className="p-2 ring-1 ring-neutral-600 rounded text-neutral-500 dark:text-neutral-200">
              Start 7-day-trail
            </button> */}
              <button className="flex justify-center align-center items-center p-2 dark:bg-green-500 rounded text-green-900 font-semibold bg-green-400 no-drag ">
                {loading && (
                  <svg
                    className="animate-spin -ml-1 mr-3 h-5 w-5 text-neutral-600"
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
                )}
                Activate
              </button>
              <div
                className="cursor-pointer underline text-sm p-2 text-neutral-500"
                onClick={() => {
                  window.electron.ipcRenderer.navigate(
                    "https://getlapseapp.com/"
                  );
                }}
              >
                Get your licence key
              </div>
            </div>
          </div>
        </form>
      )}
    </>
  );
};

export default IndexPage;
