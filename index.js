"use strict";

// ****************** start of EOS settings

// name and version
const packagejson = require("./package.json");
const PLUGIN_NAME = packagejson.name;
const PLATFORM_NAME = packagejson.platformname;
const PLUGIN_VERSION = packagejson.version;

// required node modules
const fs = require("fs");
const fsPromises = require("fs").promises;

const path = require("path");
const debug = require("debug")("eosstb"); // https://github.com/debug-js/debug
// good example of debug usage https://github.com/mqttjs/MQTT.js/blob/main/lib/client.js
const semver = require("semver"); // https://github.com/npm/node-semver

const mqtt = require("mqtt"); // https://github.com/mqttjs
const qs = require("qs"); // https://github.com/ljharb/qs
const WebSocket = require("ws"); // https://github.com/websockets/ws   for the mqtt websocket

// needed for sso logon with pkce OAuth 2.0
const { randomBytes, createHash, randomUUID } = require("node:crypto");
const puppeteer = require("puppeteer-core"); // headless browser to executes a page's JavaScript

// axios-cookiejar-support v2.0.2 syntax
const { wrapper: axiosCookieJarSupport } = require("axios-cookiejar-support"); // as of axios-cookiejar-support v2.0.x, see https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md
const tough = require("tough-cookie");
const cookieJar = new tough.CookieJar();

const axios = require("axios"); //.default;	// https://github.com/axios/axios
axios.defaults.xsrfCookieName = undefined; // change  xsrfCookieName: 'XSRF-TOKEN' to  xsrfCookieName: undefined, we do not want this default,
const axiosWS = axios.create({
  jar: cookieJar, //added in axios-cookiejar-support v2.0.x, see https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md
});

// remove default header in axios that causes trouble with Telenet
axiosWS.defaults.headers.common = {}; // remove default header in axios that causes trouble with Telenet
axiosWS.defaults.headers.post = {}; // ensure no default post header, upsets some logon routines
// setup the cookieJar support with axiosWS
axiosCookieJarSupport(axiosWS);

// ++++++++++++++++++++++++++++++++++++++++++++
// config start
// ++++++++++++++++++++++++++++++++++++++++++++

// base url varies by country
// without any trailing /
// refer https://github.com/Sholofly/lghorizon-python/blob/features/telenet/lghorizon/const.py
const COUNTRY_BASE_URLS = {
  //https://spark-prod-be.gnp.cloud.telenet.tv/be/en/config-service/conf/web/backoffice.json
  "be-fr": "https://spark-prod-be.gnp.cloud.telenet.tv", // changed 15.06.2024, be still needs 2 x language variants: be-fr and be-nl
  "be-nl": "https://spark-prod-be.gnp.cloud.telenet.tv", // changed 15.06.2024, be still needs 2 x language variants: be-fr and be-nl
  // https://spark-prod-ch.gnp.cloud.sunrisetv.ch/ch/en/config-service/conf/web/backoffice.json
  //'ch': 		'https://prod.spark.sunrisetv.ch',
  ch: "https://spark-prod-ch.gnp.cloud.sunrisetv.ch", // verified 14.01.2024
  gb: "https://spark-prod-gb.gnp.cloud.virgintvgo.virginmedia.com", // verified 14.01.2024
  ie: "https://spark-prod-ie.gnp.cloud.virginmediatv.ie", // verified 14.01.2024
  nl: "https://prod.spark.ziggogo.tv", // verified 14.01.2024
  //'pl':		'https://prod.spark.upctv.pl',
  pl: "https://spark-prod-pl.gnp.cloud.upctv.pl", // verified 14.01.2024
  //'sk':		'https://prod.spark.upctv.sk',
  sk: "https://spark-prod-sk.gnp.cloud.upctv.sk", // verified 14.01.2024
};

// Webclient URLs, used as Referer header for API calls
// Note: be-fr and be-nl share the same webclient
const COUNTRY_WEB_URLS = {
  "be-fr": "https://www.telenet.tv/",
  "be-nl": "https://www.telenet.tv/",
  ch: "https://www.sunrisetv.ch/",
  gb: "https://virgintvgo.virginmedia.com/",
  ie: "https://www.virginmediatv.ie/",
  nl: "https://www.ziggogo.tv/",
  pl: "https://www.upctv.pl/",
  sk: "https://www.upctv.sk/",
};

// mqtt endpoints varies by country, unchanged after backend change on 13.10.2022
/*
const mqttUrlArray = {
    'be-fr':  	'wss://obomsg.prod.be.horizon.tv/mqtt',
    'be-nl': 	'wss://obomsg.prod.be.horizon.tv/mqtt',
    'ch': 		'wss://messagebroker-prod-ch.gnp.cloud.dmdsdp.com/mqtt', // from 11.02.2024
    'gb':       'wss://obomsg.prod.gb.horizon.tv/mqtt',
    'ie':       'wss://obomsg.prod.ie.horizon.tv/mqtt',
    'nl': 		'wss://obomsg.prod.nl.horizon.tv/mqtt',
    'pl': 		'wss://obomsg.prod.pl.horizon.tv/mqtt',
	'sk':		'wss://obomsg.prod.sk.horizon.tv/mqtt'
};*/

// openid logon url used in Telenet.be Belgium for be-nl and be-fr sessions
const BE_AUTH_URL = "https://login.prd.telenet.be/openid/login.do";
// Keycloak redirect target for Sunrise TV Switzerland CH login success
// Puppeteer waits for navigation to this URL to extract the authorization code
const CH_LOGIN_SUCCESS_URL = "https://www.sunrisetv.ch/sso/login_success.html";

// oidc logon url used in VirginMedia for gb sessions
// still in use after logon session changes on 13.10.2022 for other countries
// the url that worked in v1.7: 'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web'
// this may also work: https://prod.oesp.virginmedia.com/oesp/v4/GB/eng/web/authorization
const GB_AUTH_OESP_URL =
  "https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web";
// https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true
const GB_AUTH_URL =
  "https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true";

// general constants
const NO_INPUT_ID = 99; // an input id that does not exist. Must be > 0 as a uint32 is expected. integer
const NO_CHANNEL_ID = "ID_UNKNOWN"; // id for a channel not in the channel list, string
const NO_CHANNEL_NAME = "UNKNOWN"; // name for a channel not in the channel list
const MAX_INPUT_SOURCES = 95; // max input services. Default = 95. Cannot be more than 96 (100 - all other services)
const SESSION_WATCHDOG_INTERVAL_MS = 15000; // session watchdog interval in millisec. Default = 15000 (15s)
const MASTER_CHANNEL_LIST_VALID_FOR_S = 1800; // master channel list stays valid for 1800s (30min) from last refresh from July 2023. Triggers reauthentication process as well
const SETTOPBOX_NAME_MINLEN = 3; // min len of the set-top box name
const SETTOPBOX_NAME_MAXLEN = 14; // max len of the set-top box name

// Remote key press timing defaults
const DEFAULT_DOUBLE_PRESS_DELAY_TIME = 300;
const DEFAULT_TRIPLE_PRESS_DELAY_TIME = 800; // default, in case config missing

// Remote button layer indices
const SINGLE_TAP = 0;
const DOUBLE_TAP = 1;
const TRIPLE_TAP = 2;
const DEFAULT_KEYNAME = 3;

// state constants. Need to add an array for any characteristic that is not an array, or the array is not contiguous
const sessionState = Object.freeze({
  DISCONNECTED: 0,
  LOADING: 1,
  LOGGING_IN: 2,
  AUTHENTICATING: 3,
  VERIFYING: 4,
  AUTHENTICATED: 5,
  CONNECTED: 6,
});
const powerStateName = Object.freeze(["OFF", "ON"]); // custom
const recordingState = Object.freeze({
  IDLE: 0,
  ONGOING_NDVR: 1,
  ONGOING_LOCALDVR: 2,
}); // custom
const statusActiveName = Object.freeze(["NOT_ACTIVE", "ACTIVE"]); // custom, characteristic is boolean, not an array

// exec spawns child process to run a bash script
const exec = require("child_process").exec;
let PLUGIN_ENV = ""; // controls the development environment, appended to UUID to make unique device when developing

let Accessory, Characteristic, Service, Categories, UUID;
let CHAR_NAMES; // declared here, populated once Characteristic is available

// Returns the path to the system Chromium/Chrome executable.
// Used by getSessionCH() which requires puppeteer-core (no bundled browser).
// Checks candidate paths in order and returns the first one that exists.
function getChromiumExecutablePath() {
  // Ordered list of candidate paths per platform
  const candidates = {
    win32: [
      // Chrome stable (most common)
      "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
      "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
      // Chrome via user profile
      process.env.LOCALAPPDATA + "\\Google\\Chrome\\Application\\chrome.exe",
      // Chromium (less common on Windows)
      "C:\\Program Files\\Chromium\\Application\\chrome.exe",
    ],
    linux: [
      "/usr/bin/chromium", // Debian/Ubuntu Bookworm — used on Raspberry Pi
      "/usr/bin/chromium-browser", // older Debian/Raspbian
      "/usr/bin/google-chrome", // Google Chrome on Linux
      "/usr/bin/google-chrome-stable",
    ],
    darwin: [
      "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      "/Applications/Chromium.app/Contents/MacOS/Chromium",
    ],
  };

  const platform = process.platform; // "win32", "linux", or "darwin"
  const paths = candidates[platform] || candidates.linux;

  for (const candidate of paths) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (e) {
      // ignore and try next
    }
  }

  throw new Error(
    `getSessionCH: Could not find a Chromium or Chrome executable on ${platform}. ` +
      `On Debian/Raspberry Pi run: sudo apt install -y chromium. ` +
      `On Windows, install Google Chrome from https://www.google.com/chrome/`,
  );
}

// transform current media state of 0,1,2,4,5 to 1,2,3,4,5 to work with Object.keys
function currentMediaStateName(currentMediaState) {
  let i = currentMediaState + 1; // get the new index
  // modify if > 3 to get 1,2,3,4,5
  if (i > 3) {
    i = i - 1;
  }
  return CHAR_NAMES.CurrentMediaState[i];
}

// helper function to create consistent log text for set-to vs changed-from
function logCharValueChange(
  log,
  name,
  label,
  input,
  previousValue,
  previousLabel,
  currentValue,
  currentLabel,
) {
  if (previousValue === null || previousValue === undefined) {
    log("%s: %s set to %s [%s]", name, label, currentValue, currentLabel);
  } else if (input === null || input === undefined) {
    log(
      "%s: %s changed from %s [%s] to %s [%s]",
      name,
      label,
      previousValue,
      previousLabel,
      currentValue,
      currentLabel,
    );
  } else {
    log(
      "%s: %s changed on input %s from %s [%s] to %s [%s]",
      name,
      label,
      input,
      previousValue,
      previousLabel,
      currentValue,
      currentLabel,
    );
  }
}

// clean a name so it is acceptable for HomeKit
function cleanNameForHomeKit(name) {
  // HomeKit does not allow non-alphanumeric characters apart from [ .,-]
  // Use only alphanumeric, space, and apostrophe characters.
  // Start and end with an alphabetic or numeric character.
  // Don't include emojis.
  // https://developer.apple.com/design/human-interface-guidelines/homekit/overview/setup/
  // [^A-Za-zÀ-ÖØ-öø-ÿ0-9 .,-] allows all accented characters
  // https://stackoverflow.com/questions/6664582/regex-accent-insensitive

  // HomeKit however displays all these characters, so allow them
  let result = name;

  // replace + with plus, for 3+ HD in CH
  //result.replace('+', 'plus');
  //console.log("cleanNameForHomeKit after replacing + [%s]", result);

  // replace unwanted characters with whitespace
  //result = result.replace(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ .,-]/gi, ' ');

  // for now just replace forward slash with whitespace
  result = result.replace(/\//g, " "); // replaces all slashes
  //console.log("cleanNameForHomeKit after replace [%s]", result);

  // replace any double whitespace with single whitespace
  //while(result.indexOf('  ')!=-1) { result.replace('  ',' '); }
  //console.log("cleanNameForHomeKit after replacing double whitespace [%s]", result);

  // trim to remove resultant leading and trailing whitespace
  result = result.trim();

  //ensure ends with a non-alphanumeric character
  // testing shows
  // OK     ending with .
  // Not OK ending with ,-
  // append . if not ending in a alpha-numeric character
  /*
	if (RegExp(/[^0-9A-Za-zÀ-ÖØ-öø-ÿ.]\z/gi).test(result)) {
		console.log("cleanNameForHomeKit last char not allowed, appending .");
		result = result + '.'; // append a .
	}
	*/
  //console.log("cleanNameForHomeKit result [%s]", result);
  return result;
}

// wait function
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// generate PKCE code verifier pair for OAuth 2.0
function generatePKCEPair() {
  // verifier: 64 random bytes → 86-char base64url string (well within 43-128 char limit)
  const code_verifier = randomBytes(64).toString("base64url"); // Node 16+ has base64url built in

  // challenge: SHA-256 of verifier, base64url encoded, no padding
  const code_challenge = createHash("sha256")
    .update(code_verifier)
    .digest("base64url"); // base64url automatically handles + → -, / → _, strips =

  return { verifier: code_verifier, code_challenge };
}

// ++++++++++++++++++++++++++++++++++++++++++++
// config end
// ++++++++++++++++++++++++++++++++++++++++++++

// ++++++++++++++++++++++++++++++++++++++++++++
// platform setup
// ++++++++++++++++++++++++++++++++++++++++++++
module.exports = (api) => {
  Accessory = api.platformAccessory;
  Characteristic = api.hap.Characteristic;
  Service = api.hap.Service;
  Categories = api.hap.Categories;
  UUID = api.hap.uuid;

  // Build CHAR_NAMES here, now that Characteristic is assigned
  // Cached key name arrays for logging. These enums never change at runtime so build them once.
  CHAR_NAMES = Object.freeze({
    StatusFault: Object.keys(Characteristic.StatusFault),
    ProgramMode: Object.keys(Characteristic.ProgramMode),
    InputDeviceType: Object.keys(Characteristic.InputDeviceType),
    InputSourceType: Object.keys(Characteristic.InputSourceType),
    ClosedCaptions: Object.keys(Characteristic.ClosedCaptions),
    PictureMode: Object.keys(Characteristic.PictureMode),
    InUse: Object.keys(Characteristic.InUse),
    CurrentVisibilityState: Object.keys(Characteristic.CurrentVisibilityState),
    CurrentMediaState: Object.keys(Characteristic.CurrentMediaState),
    TargetMediaState: Object.keys(Characteristic.TargetMediaState),
  });

  const isDynamicPlatform = true;

  api.registerPlatform(
    PLUGIN_NAME,
    PLATFORM_NAME,
    StbPlatform,
    isDynamicPlatform,
  );
};

class StbPlatform {
  // build the platform. Runs once on restart
  // All platform-specific code goes in this class
  constructor(log, config, api) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.accessories = [];
    this.stbDevices = []; // store stbDevice in this.stbDevices
    this.masterChannelList = [];
    this.masterChannelListExpiryDate = 0; // epoch = always expired on first run
    this.checkChannelListTimeout = null; // nightly scheduler handler
    this.isDev = config.devMode === true;
    this.debugLevel = this.config.debugLevel || 0; // debugLevel defaults to 0 (minimum)

    // moved from globals — owned by this platform instance
    this.mqttClient = null; // null is better than {} for "not yet connected"
    this.mqttUsername = undefined;
    this.subscribedTopics = []; // initialise empty array, populated after MQTT connects
    this.isShuttingDown = false;

    // show some useful version info
    this.log.info(
      "%s v%s, node %s, homebridge v%s",
      packagejson.name,
      packagejson.version,
      process.version,
      this.api.serverVersion,
    );

    // only load if mandatory items exist. Homebridge checks for platform itself, and name is not critical
    const configWarningText =
      '%s config incomplete: "{configItemName}" missing. Initialization aborted.';
    if (!this.config.country) {
      this.log.warn(
        configWarningText.replace("{configItemName}", "country"),
        PLUGIN_NAME,
      );
      return;
    }
    if (!this.config.username) {
      this.log.warn(
        configWarningText.replace("{configItemName}", "username"),
        PLUGIN_NAME,
      );
      return;
    }
    if (!this.config.password) {
      this.log.warn(
        configWarningText.replace("{configItemName}", "password"),
        PLUGIN_NAME,
      );
      return;
    }

    // session flags
    this.currentSessionState = sessionState.DISCONNECTED;
    this.sessionWatchdogRunning = false;
    this.watchdogCounter = 0;
    this.mqttClientConnecting = false;
    this.currentStatusFault = null;

    /*
     * Platforms should wait until the "didFinishLaunching" event has fired before registering any new accessories.
     */
    this.api.on("didFinishLaunching", async () => {
      if (this.debugLevel > 2) {
        this.log.warn("API event: didFinishLaunching");
      }
      debug("StbPlatform:apievent :: didFinishLaunching");

      // call the session watchdog once to create the session initially
      setTimeout(this.sessionWatchdog.bind(this), 500); // wait 500ms then call this.sessionWatchdog

      // the session watchdog creates a session when none exists, and recreates one if the session ever fails due to internet failure or anything else
      if ((this.config.watchdogDisabled || false) === true) {
        this.log.warn("WARNING: Session watchdog disabled");
      } else {
        // clearInterval guards before each setInterval. This protects against any runaway duplicate timers if the startup block ever runs twice (defensive, low cost).
        if (this.checkSessionInterval) {
          clearInterval(this.checkSessionInterval);
        }
        this.checkSessionInterval = setInterval(
          this.sessionWatchdog.bind(this),
          SESSION_WATCHDOG_INTERVAL_MS,
        );
      }

      // Schedule once-a-night refreshes at a random time between 00:00–06:00
      this._scheduleNightlyChannelListRefresh();

      debug("StbPlatform:apievent :: didFinishLaunching end of code block");
    });

    /*
     * shutdown event is fired when homebridge shuts down
     * api.on('shutdown') fires before SIGTERM and
     */
    this.api.on("shutdown", async () => {
      debug("StbPlatform:apievent :: shutdown");
      if (this.debugLevel > 2) {
        this.log.warn("API event: shutdown");
      }
      this.isShuttingDown = true; // set before awaiting

      // ensure timers are shutdown
      clearTimeout(this.checkChannelListTimeout);
      clearInterval(this.checkSessionInterval);

      // shutdown mqtt
      await this.endMqttSession();

      this.log("Goodbye");
      debug("StbPlatform :apievent :: shutdown end of code block");
    });

    /*
     * SIGTERM event is fired when homebridge ends the bridge process
     * SIGTERM fires after api.on('shutdown')
     * This is a robustness backup in case shutdown is not captured for any reason
     */
    process.on("SIGTERM", async () => {
      if (this.isShuttingDown) return; // prevent double cleanup
      this.isShuttingDown = true; // set before awaiting
      this.log.warn(
        "SIGTERM received (shutdown missed), shutting down MQTT cleanly...",
      );

      // ensure timers are shutdown
      clearTimeout(this.checkChannelListTimeout);
      clearInterval(this.checkSessionInterval);

      // shutdown mqtt
      await this.endMqttSession();
      this.log("Goodbye");
      process.exit(0);
    });
  } // end of constructor

  /**
   * REQUIRED - Homebridge will call the "configureAccessory" method once for every cached accessory restored
   * This is called BEFORE the didFinishLaunching event
   */
  configureAccessory(accessory) {
    // Note: Applies only to accessories linked to the Bridge. Does not apply to ExternalAccessories
    this.log("configurePlatformAccessory %s", accessory.displayName);
    this.accessories.push(accessory);
  } // end of configureAccessory

  removeAccessory(accessory) {
    // Note: Applies only to accessories linked to the Bridge. Does not apply to ExternalAccessories
    this.log("removeAccessory %s", accessory.displayName);
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [
      accessory,
    ]);
  } // end of removeAccessory

  // persist config to disc
  persistConfig(deviceId, jsonData) {
    // we want to save channel names and visibilityState

    // storage path, constant
    const filename = path.join(
      this.api.user.storagePath(),
      "persist",
      "AccessoryInfo." + PLATFORM_NAME + "." + deviceId + ".json",
    );
    this.log("filename", filename);

    //this.log("jsonData", jsonData)
    let jsonString = JSON.stringify(jsonData);
    this.log("jsonString", jsonString);

    // write to file
    fs.writeFile(filename, jsonString, (err) => {
      if (err) {
        this.log("persistConfig", err); // `this` now correctly refers to the class
      }
    });
  } // end of persistConfig

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // START session handler (web)
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++

  /**
   * sessionWatchdog
   *
   * Called once immediately on startup (via setTimeout), then on a fixed
   * interval (SESSION_WATCHDOG_INTERVAL_MS) via setInterval.
   *
   * Responsibilities:
   *  - Exit immediately if Homebridge is shutting down.
   *  - Exit immediately if a previous watchdog invocation is still running
   *    (prevents overlapping connection attempts).
   *  - Exit immediately if the session AND mqtt are already fully connected.
   *  - Exit immediately if a connection attempt is already in progress
   *    (session state is between DISCONNECTED and CONNECTED).
   *  - If session is CONNECTED but mqtt has dropped: attempt mqtt-only reconnect.
   *  - If session is DISCONNECTED: run the full 10-step startup sequence.
   *
   * The key fix vs. the original:
   *  Previously the startup sequence used `await promise.then().then()...` which
   *  does NOT actually await the full chain — the `await` only waits for the first
   *  promise, and all subsequent `.then()` calls run asynchronously. This meant
   *  `sessionWatchdogRunning` was reset to false before the chain finished,
   *  allowing overlapping watchdog runs.
   *
   *  The fix uses `async/await` with `try/catch/finally` throughout, so every
   *  step is truly awaited and `sessionWatchdogRunning` is guaranteed to reset
   *  in the `finally` block regardless of success or failure.
   */
  async sessionWatchdog() {
    this.watchdogCounter++;
    // A unique label for this invocation, useful when multiple watchdog ticks
    // appear in the logs at the same time.
    const watchdogInstance = `sessionWatchdog(${this.watchdogCounter})`;
    const debugPrefix = "\x1b[33msessionWatchdog :: "; // 33=yellow

    debug(debugPrefix + "started");
    if (this.debugLevel > 2) {
      this.log.warn(
        "%s: Started watchdog instance %s",
        watchdogInstance,
        this.watchdogCounter,
      );
    }

    // ── Robustness guard ──────────────────────────────────────────────────────
    // If the session state has been set to DISCONNECTED externally (e.g. by an
    // mqtt error handler), make sure mqttClientConnecting is also cleared so the
    // next watchdog run doesn't skip the reconnect path.
    if (this.currentSessionState === sessionState.DISCONNECTED) {
      this.mqttClientConnecting = false;
    }

    // Build a status snapshot for debug logging (only when needed to avoid the
    // string allocation cost on every tick at lower debug levels).
    if (this.debugLevel > 2) {
      const statusOverview = [
        `sessionState=${Object.keys(sessionState)[this.currentSessionState]}`,
        `mqttClient.connected=${this.mqttClient?.connected}`,
        `sessionWatchdogRunning=${this.sessionWatchdogRunning}`,
      ].join(" ");
      this.log.warn("%s: Status: %s", watchdogInstance, statusOverview);
    }

    // ── Early-exit checks (in order of likelihood) ───────────────────────────

    if (this.isShuttingDown) {
      if (this.debugLevel > 2) {
        this.log.warn(
          "%s: Homebridge is shutting down, exiting without action",
          watchdogInstance,
        );
      }
      return;
    }

    // A previous watchdog invocation is still executing its startup sequence.
    // Return immediately — the running instance will reset the flag when done.
    if (this.sessionWatchdogRunning) {
      if (this.debugLevel > 2) {
        this.log.warn(
          "%s: Previous watchdog still running, exiting without action",
          watchdogInstance,
        );
      }
      return;
    }

    // Session and mqtt are both healthy — nothing to do.
    if (
      this.currentSessionState === sessionState.CONNECTED &&
      this.mqttClient?.connected
    ) {
      if (this.debugLevel > 2) {
        this.log.warn(
          "%s: Session and mqtt fully connected, exiting without action",
          watchdogInstance,
        );
      }
      return;
    }

    // Session is CONNECTED but mqtt is still in the process of connecting —
    // give it more time, do not start another connect attempt.
    if (
      this.currentSessionState === sessionState.CONNECTED &&
      this.mqttClientConnecting
    ) {
      if (this.debugLevel > 2) {
        this.log.warn(
          "%s: Session connected, mqtt still connecting, exiting without action",
          watchdogInstance,
        );
      }
      return;
    }

    // Session is in a transitional state (LOADING → AUTHENTICATED) — a connect
    // attempt is already in progress, do not start another one.
    if (
      this.currentSessionState !== sessionState.DISCONNECTED &&
      this.currentSessionState !== sessionState.CONNECTED
    ) {
      if (this.debugLevel > 2) {
        this.log.warn(
          "%s: Session is connecting (state=%s), exiting without action",
          watchdogInstance,
          Object.keys(sessionState)[this.currentSessionState],
        );
      }
      return;
    }

    // ── Determine which reconnect path to take ────────────────────────────────
    // At this point we know:
    //   A) this.currentSessionState === CONNECTED  AND  !this.mqttClient?.connected  AND  !mqttClientConnecting
    //      → session is fine, only mqtt needs reconnecting
    //   B) this.currentSessionState === DISCONNECTED
    //      → full startup sequence required

    const mqttOnlyReconnect =
      this.currentSessionState === sessionState.CONNECTED &&
      !this.mqttClient?.connected;

    // ── Flag that this watchdog is now actively working ───────────────────────
    // IMPORTANT: this must be set BEFORE any await so that a concurrent watchdog
    // tick that fires before the first await sees the flag and exits early.
    this.sessionWatchdogRunning = true;
    if (this.debugLevel > 2) {
      this.log.warn(
        "%s: sessionWatchdogRunning set to true, beginning reconnect",
        watchdogInstance,
      );
    }

    // ── Development environment detection ────────────────────────────────────
    // Set PLUGIN_ENV once, only when running in a known dev environment.
    // Uses config.json "devMode": true or NODE_ENV
    // Uses NODE_ENV so any developer can activate it without touching the code.
    if (!PLUGIN_ENV) {
      if (this.isDev || process.env.NODE_ENV === "development") {
        PLUGIN_ENV = " DEV";
      }
    }
    if (PLUGIN_ENV) {
      this.log.warn(
        "%s: %s running in %s environment with debugLevel %s",
        watchdogInstance,
        PLUGIN_NAME,
        PLUGIN_ENV.trim(),
        (this.config || {}).debugLevel || 0,
      );
    }

    // ── Reconnect logic — guarded by try/finally ──────────────────────────────
    // `finally` guarantees sessionWatchdogRunning is always reset, even if an
    // unexpected exception escapes the inner try/catch.
    try {
      if (mqttOnlyReconnect) {
        await this._reconnectMqtt(watchdogInstance, debugPrefix);
      } else {
        await this._runFullStartupSequence(watchdogInstance, debugPrefix);
      }
    } finally {
      // Reset the running flag so the next watchdog tick can proceed.
      this.sessionWatchdogRunning = false;
      if (this.debugLevel > 2) {
        this.log.warn(
          "%s: sessionWatchdogRunning reset to false, exiting",
          watchdogInstance,
        );
      }
      debug(debugPrefix + "exiting sessionWatchdog");
    }
  } // end of sessionWatchdog

  /**
   * _reconnectMqtt
   *
   * Called by sessionWatchdog when the session is CONNECTED but mqtt has
   * dropped. Skips all auth/discovery steps and goes straight to getting a
   * fresh mqtt token and reconnecting the client.
   *
   * This path was previously a no-op in the original code — the watchdog would
   * set sessionWatchdogRunning=true, find CONNECTED state, skip the full-
   * startup `if` block entirely, and immediately reset the flag. Nothing
   * actually reconnected mqtt. This method fixes that gap.
   *
   * @param {string} watchdogInstance - log prefix for this watchdog invocation
   * @param {string} debugPrefix      - debug() colour prefix
   */
  async _reconnectMqtt(watchdogInstance, debugPrefix) {
    this.log.warn(
      "%s: Session is CONNECTED but mqtt has dropped. Attempting mqtt-only reconnect...",
      watchdogInstance,
    );
    debug(debugPrefix + "mqtt-only reconnect: calling getMqttToken");

    try {
      // Refresh the access token first, in case it expired while mqtt was down.
      this.log.debug(
        "%s: mqtt-only reconnect: refreshing access token",
        watchdogInstance,
      );
      await this.refreshAccessToken();

      // Get a fresh mqtt token and reconnect.
      this.log.debug(
        "%s: mqtt-only reconnect: calling getMqttToken",
        watchdogInstance,
      );
      const mqttToken = await this.getMqttToken(
        this.session.username,
        this.session.accessToken,
        this.session.householdId,
      );
      if (mqttToken) {
        this.mqttUsername = this.session.householdId; // assignment is explicit and visible
      }

      this.log.debug(
        "%s: mqtt-only reconnect: token retrieved, calling startMqttClient",
        watchdogInstance,
      );
      debug(debugPrefix + "mqtt-only reconnect: calling startMqttClient");
      await this.startMqttClient(this.session.householdId, mqttToken);

      this.log(
        "%s: mqtt-only reconnect: mqtt client reconnected successfully",
        watchdogInstance,
      );
    } catch (errorReason) {
      // If mqtt reconnect fails, drop the session entirely so the next watchdog
      // tick triggers a full re-authentication rather than looping here.
      this.log.warn(
        "%s: mqtt-only reconnect failed (%s). Resetting session to DISCONNECTED for full re-auth on next tick.",
        watchdogInstance,
        errorReason,
      );
      this.currentSessionState = sessionState.DISCONNECTED;
      this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
    }
  } // end of _reconnectMqtt

  /**
   * Perform a single master channel list refresh cycle (token + list).
   * Extracted so it can be called both on startup and by the nightly scheduler.
   */
  async _refreshChannelList() {
    if (this.debugLevel > 0) {
      this.log.warn("StbPlatform: _refreshChannelList start");
    }
    try {
      await this.refreshAccessToken();
      if (this.debugLevel > 0) {
        this.log.warn("StbPlatform: refreshAccessToken completed OK");
      }
      await this.refreshMasterChannelList();
      if (this.debugLevel > 0) {
        this.log.warn("StbPlatform: refreshMasterChannelList completed OK");
      }
    } catch (error) {
      const status = error.response?.status ?? "";
      const url = error.config?.url ?? error.hostname ?? "";
      const code = error.code ?? "";
      const msg = error.message ?? String(error);
      this.log.warn(
        `StbPlatform: _refreshChannelList error — ${msg} | status=${status} code=${code} url=${url}`,
      );
    }
  } // end of _refreshChannelList

  /**
   * Schedule the next nightly master channel list refresh.
   * Picks a random time between 00:00 and 06:00 the following day,
   * then reschedules itself so the pattern repeats indefinitely.
   *
   * Using setTimeout (not setInterval) means each day gets a fresh
   * random time, and there is no risk of overlapping ticks.
   */
  _scheduleNightlyChannelListRefresh() {
    // Build a Date for midnight at the start of tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    // Add a random offset: anywhere from 0 ms up to (but not including) 6 hours
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    const randomOffsetMs = Math.floor(Math.random() * SIX_HOURS_MS);

    const nextRefreshAt = new Date(tomorrow.getTime() + randomOffsetMs);
    const msUntilRefresh = nextRefreshAt.getTime() - Date.now();

    if (this.debugLevel > 0) {
      this.log.warn(
        `StbPlatform: next master channel list refresh scheduled for ${nextRefreshAt.toLocaleString()}`,
      );
    }

    // Store the timer handle so shutdown can cancel it
    this.checkChannelListTimeout = setTimeout(async () => {
      if (this.isShuttingDown) return; // bail out if we're going down
      await this._refreshChannelList();
      this._scheduleNightlyChannelListRefresh(); // reschedule for the next day
    }, msUntilRefresh);
  } // end of _scheduleNightlyChannelListRefresh

  /**
   * _runFullStartupSequence
   *
   * Called by sessionWatchdog when the session is fully DISCONNECTED.
   * Runs the complete 10-step startup sequence:
   *   1.  getConfig            — fetch backend endpoint URLs for the country
   *   2.  createSession        — authenticate and obtain householdId + tokens
   *   3.  getPersonalizationData — fetch customer profile and assigned devices
   *   4.  getEntitlements      — fetch feature entitlements (PVR, etc.)
   *   5.  refreshMasterChannelList — fetch the full channel list
   *   6.  getRecordingState    — fetch current recording state (if entitled)
   *   7.  getRecordingBookings — fetch recording schedule (if entitled)
   *   8.  discoverDevices      — map backend devices to HomeKit accessories
   *   9.  getMqttToken         — get the broker token for the mqtt session
   *  10.  startMqttClient      — connect to the mqtt broker
   *
   * Each step is individually awaited, so failures are caught at the right
   * step and stepName is accurate when logged.
   *
   * @param {string} watchdogInstance - log prefix for this watchdog invocation
   * @param {string} debugPrefix      - debug() colour prefix
   */
  async _runFullStartupSequence(watchdogInstance, debugPrefix) {
    this.log(
      "Session %s. Starting full session connection process",
      Object.keys(sessionState)[this.currentSessionState],
    );

    // stepName tracks which step we're on so the catch block can log a
    // meaningful message rather than a generic "something failed".
    let stepName = '';

    try {
      // ── Step 1: Get backend config (endpoint URLs) for the country ──────────
      stepName = "get config";
      this.log.debug("%s: ++++ step 1: calling getConfig", watchdogInstance);
      debug(debugPrefix + "calling getConfig");

      await this.getConfig(this.config.country.toLowerCase());
      // Result stored in this.configsvc by getConfig()

      this.log.debug(
        "%s: ++++++ step 1 done: config retrieved for country %s",
        watchdogInstance,
        this.config.country.toLowerCase(),
      );

      // ── Step 2: Authenticate and create a session ──────────────────────────
      stepName = "create session";
      this.log.debug(
        "%s: ++++ step 2: calling createSession for country %s",
        watchdogInstance,
        this.config.country.toLowerCase(),
      );
      this.log("Creating session...");
      debug(debugPrefix + "calling createSession");

      const sessionHouseholdId = await this.createSession();
      // Result stored in this.session by createSession()

      this.log.debug(
        "%s: ++++++ step 2 done: session created, householdId %s",
        watchdogInstance,
        sessionHouseholdId,
      );

      // ── Step 3: Fetch customer profile and assigned devices ────────────────
      stepName = "discover platform";
      this.log.debug(
        "%s: ++++ step 3: calling getPersonalizationData for householdId %s",
        watchdogInstance,
        this.session.householdId,
      );
      this.log("Discovering platform...");
      debug(debugPrefix + "calling getPersonalizationData");

      const objCustomer = await this.getPersonalizationData(
        this.session.householdId,
      );
      // Result stored in this.customer by getPersonalizationData()

      this.log.debug(
        "%s: ++++++ step 3 done: personalization data retrieved, customerId %s customerStatus %s",
        watchdogInstance,
        objCustomer.customerId,
        objCustomer.customerStatus,
      );

      // ── Step 4: Fetch entitlements (PVR, LOCALDVR, etc.) ──────────────────
      this.log.debug(
        "%s: ++++ step 4: calling getEntitlements for customerId %s",
        watchdogInstance,
        objCustomer.customerId,
      );
      debug(debugPrefix + "calling getEntitlements");

      const objEntitlements = await this.getEntitlements(
        this.customer.customerId,
      );
      // Result stored in this.entitlements by getEntitlements()

      this.log.debug(
        "%s: ++++++ step 4 done: entitlements retrieved, token %s",
        watchdogInstance,
        objEntitlements.token,
      );

      // ── Step 5: Fetch the master channel list ──────────────────────────────
      this.log.debug(
        "%s: ++++ step 5: calling refreshMasterChannelList",
        watchdogInstance,
      );
      debug(debugPrefix + "calling refreshMasterChannelList");

      const objChannels = await this.refreshMasterChannelList();
      // Result stored in this.masterChannelList by refreshMasterChannelList()

      this.log.debug(
        "%s: ++++++ step 5 done: %s channels retrieved",
        watchdogInstance,
        objChannels.length,
      );

      // ── Steps 6 & 7: Recording state and bookings (PVR-entitled users only) ─
      // Check entitlement once and reuse for both calls.
      const pvrFeatureFound = this.entitlements.features.find(
        (feature) => feature === "PVR" || feature === "LOCALDVR",
      );
      this.log.debug(
        "%s: ++++++ step 6/7: PVR entitlement found: %s",
        watchdogInstance,
        pvrFeatureFound,
      );

      if (pvrFeatureFound) {
        // Step 6: Recording state
        this.log.debug(
          "%s: ++++ step 6: calling getRecordingState for householdId %s",
          watchdogInstance,
          this.session.householdId,
        );
        // NOTE: getRecordingState is intentionally not awaited here — it updates
        // internal state as a side-effect and its result is not needed for the
        // startup sequence to continue. Errors are handled inside the method.
        // If you wish to ensure it completes before step 7, add `await` here.
        this.getRecordingState(this.session.householdId);

        // Step 7: Recording bookings
        this.log.debug(
          "%s: ++++ step 7: calling getRecordingBookings for householdId %s",
          watchdogInstance,
          this.session.householdId,
        );
        // Same fire-and-forget approach as getRecordingState above.
        this.getRecordingBookings(this.session.householdId);
      } else {
        this.log.debug(
          "%s: ++++++ step 6/7: no PVR entitlement, skipping recording setup",
          watchdogInstance,
        );
      }

      // ── Step 8: Discover and configure HomeKit accessories ─────────────────
      stepName = "discover devices";
      this.log.debug(
        "%s: ++++ step 8: calling discoverDevices",
        watchdogInstance,
      );
      debug(debugPrefix + "calling discoverDevices");

      const objStbDevices = await this.discoverDevices();
      // Result stored in this.stbDevices by discoverDevices()

      this.log("Discovery completed");
      this.log.debug(
        "%s: ++++++ step 8 done: %s device(s) discovered",
        watchdogInstance,
        this.devices.length,
      );

      // ── Step 9: Get the mqtt broker token ─────────────────────────────────
      stepName = "start mqtt session";
      this.log.debug("%s: ++++ step 9: calling getMqttToken", watchdogInstance);
      debug(debugPrefix + "calling getMqttToken");

      const mqttToken = await this.getMqttToken(
        this.session.username,
        this.session.accessToken,
        this.session.householdId,
      );
      if (mqttToken) {
        this.mqttUsername = this.session.householdId; // assignment is explicit and visible
      }
      this.log.debug(
        "%s: ++++++ step 9 done: mqtt token retrieved",
        watchdogInstance,
      );

      // ── Step 10: Connect the mqtt client ───────────────────────────────────
      this.log.debug(
        "%s: ++++ step 10: calling startMqttClient",
        watchdogInstance,
      );
      debug(debugPrefix + "calling startMqttClient");

      await this.startMqttClient(this.session.householdId, mqttToken);

      this.log.debug(
        "%s: ++++++ step 10 done: mqtt client started",
        watchdogInstance,
      );

      debug(debugPrefix + "full startup sequence complete");
      this.log.debug(
        "%s: Full startup sequence completed successfully",
        watchdogInstance,
      );
    } catch (errorReason) {
      // One of the steps above threw or rejected. Log the failed stepName
      // alongside the error message for easy diagnosis.
      const errMsg = errorReason instanceof Error ? errorReason.message : String(errorReason);
      this.log.warn("%s: Failed to %s: %s", watchdogInstance, stepName, errMsg);
      this.currentSessionState = sessionState.DISCONNECTED;
      this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
      // sessionWatchdogRunning is reset in the finally block of the caller.
    }
  } // end of _runFullStartupSequence

  /**
   * _handleWebError
   *
   * Standardised catch-block handler for all outbound HTTP/Axios calls.
   * Builds a consistent human-readable error message, sets session state
   * to DISCONNECTED on ENOTFOUND, logs at debug level, then re-throws.
   *
   * @param {Error}  error   - the caught error
   * @param {string} action  - what the caller was trying to do, e.g.
   *                           "get config data for countryCode ch"
   * @param {string|URL} url - the URL that was called (for debug context)
   */
  _handleWebError(error, action, url) {
    const urlStr = String(url ?? error.config?.url ?? "");
    let errReason = `Could not ${action}:`;

    if (error.isAxiosError) {
      errReason += ` ${error.code}`;
      if (error.code === "ENOTFOUND") {
        errReason += " - no internet connection";
        this.currentSessionState = sessionState.DISCONNECTED;
      }
    } else {
      errReason += ` — ${error.message ?? String(error)}`;
    }

    if (urlStr) errReason += ` — ${urlStr}`;

    this.log.debug("_handleWebError: %s — full error:", errReason, error);
    throw new Error(errReason, { cause: error });
  }

  /**
   * Discovers all physical devices from the backend and maps them to HomeKit accessories.
   * Creates new accessories for uncached devices, and restores existing ones from cache.
   * @returns {this.stbDevices} Resolves with the array of stbDevice objects
   * @throws {Error} If no devices or device settings are found
   */
  async discoverDevices() {
    this.log("Discovering devices...");

    // Guard: ensure devices exist and have valid settings
    if (
      !this.devices ||
      this.devices.length === 0 ||
      !this.devices[0].settings
    ) {
      this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
      this.sessionWatchdogRunning = false;
      throw new Error(
        "No devices found. The backend systems may be down, or you have no supported devices on your customer account",
      );
    }

    // Log the device count with correct singular/plural
    const count = this.devices.length;
    this.log(`Found ${count} device${count > 1 ? "s" : ""}`);

    // Build config tip and set up accessories in a single pass
    this.log.debug("Processing devices...");
    const tipParts = [];
    let deviceFoundInConfig = true;

    for (const [i, device] of this.devices.entries()) {
      const deviceName = device.settings.deviceFriendlyName;

      // --- Config tip section ---
      // Build a JSON snippet for this device to help the user configure Homebridge
      tipParts.push(
        ` {\n   "deviceId": "${device.deviceId}",\n   "name": "${deviceName}"\n }`,
      );

      // Check whether this device is already listed in the user's config
      if (this.config.devices) {
        const isInConfig = this.config.devices.some(
          (devConfig) => devConfig.deviceId === device.deviceId,
        );
        if (!isInConfig) {
          this.log("Device not found in config: %s", device.deviceId);
          deviceFoundInConfig = false;
        }
      } else {
        deviceFoundInConfig = false;
      }

      // --- Accessory setup section ---
      this.log("Device %s: %s %s", i + 1, deviceName, device.deviceId);

      // Generate a stable UUID for this device — this must never change
      // so that HomeKit can consistently identify the accessory across restarts
      const uuid = this.api.hap.uuid.generate(device.deviceId + PLUGIN_ENV);

      // Look for an existing accessory in the cache to avoid duplicates
      const foundStbDevice = this.stbDevices.find(
        (stbDevice) => (stbDevice.accessory || {}).UUID === uuid,
      );

      if (foundStbDevice) {
        // Accessory already exists — restore it from cache
        this.log(
          "Device found in cache: [%s] %s",
          foundStbDevice.name,
          foundStbDevice.deviceId,
        );
      } else {
        // No cached accessory found — create and register a new one
        this.log("Setting up device %s of %s: %s", i + 1, count, deviceName);
        // Note: customer and entitlements are accessed via the platform object (this)
        const newStbDevice = new StbDevice(
          this.log,
          this.config,
          this.api,
          device,
          this,
        );
        this.stbDevices.push(newStbDevice);
      }
    }

    // If any device is missing from the user's config, show a helpful tip
    // so they know how to add custom configuration for each device
    if (!deviceFoundInConfig) {
      this.log(
        `Config tip: Add these lines to your Homebridge ${PLATFORM_NAME} config ` +
          `if you wish to customise your device config: \n"devices": [\n${tipParts.join(",\n")}\n]`,
      );
    }

    // Return all registered devices (both newly created and restored from cache)
    return this.stbDevices;
  } // end of discoverDevices

  // get a new access token
  async refreshAccessToken() {
    // robustness: exit immediately if no session expiry exists yet (session not yet established)
    if (!this.session.accessTokenExpiry) {
      if (this.debugLevel > 0) {
        this.log.warn(
          "refreshAccessToken: No access token expiry set yet, session not yet established. Exiting.",
        );
      }
      return false;
    }

    // exit immediately if access token has not expired
    if (this.session.accessTokenExpiry > Date.now()) {
      if (this.debugLevel > 0) {
        this.log.warn(
          "refreshAccessToken: Access token has not expired yet. Next refresh will occur after %s",
          this.session.accessTokenExpiry.toLocaleString(),
        );
      }
      return true;
    }

    if (this.debugLevel > 0) {
      this.log.warn(
        "refreshAccessToken: Access token has expired at %s. Requesting refresh",
        this.session.accessTokenExpiry.toLocaleString(),
      );
    }

    if (!this.configsvc.authorizationService.URL) {
      this.log.warn(
        "refreshAccessToken: Cannot refresh access token: authorizationService.URL not found",
      );
      return false;
    }

    // needed to suppress the XSRF-TOKEN which upsets the auth refresh
    axiosWS.defaults.xsrfCookieName = undefined; // change  xsrfCookieName: 'XSRF-TOKEN' to  xsrfCookieName: undefined, we do not want this default,

    const axiosConfig = {
      method: "POST",
      // https://prod.spark.sunrisetv.ch/auth-service/v1/authorization/refresh
      //url: COUNTRY_BASE_URLS[this.config.country.toLowerCase()] + '/auth-service/v1/authorization/refresh',
      url:
        this.configsvc.authorizationService.URL + "/v1/authorization/refresh",
      headers: {
        accept: "*/*", // mandatory
        "content-type": "application/json; charset=UTF-8", // mandatory
        "x-oesp-username": this.session.username,
        "x-tracking-id": this.customer.hashedCustomerId, // hashed customer id
      },
      jar: cookieJar,
      data: {
        refreshToken: this.session.refreshToken,
        username: this.config.username,
      },
    };

    if (this.debugLevel > 0) {
      this.log.warn(
        "refreshAccessToken: Post auth refresh request to",
        axiosConfig.url,
      );
    }

    // throws on HTTP/network error → caller's catch or .catch() handles it
    const response = await axiosWS(axiosConfig);

    if (this.debugLevel > 1) {
      this.log(
        "refreshAccessToken: auth refresh response:",
        response.status,
        response.statusText,
      );
      this.log("refreshAccessToken: response data (saved to this.session):");
      this.log(response.data);
      //this.log(response.headers);
    }
    this.session = response.data;

    // add an expiry date for the access token: 2 min (120000ms) after created date
    this.session.accessTokenExpiry = new Date(Date.now() + 2 * 60000);

    // check if householdId exists, if so, we have authenticated ok
    if (this.session.householdId) {
      this.currentSessionState = sessionState.AUTHENTICATED;
    }
    this.log.debug("Session username:", this.session.username);
    this.log.debug("Session householdId:", this.session.householdId);
    this.log.debug("Session accessToken:", this.session.accessToken);
    this.log.debug(
      "Session accessTokenExpiry:",
      this.session.accessTokenExpiry,
    );
    this.log.debug("Session refreshToken:", this.session.refreshToken);
    this.log.debug(
      "Session refreshTokenExpiry:",
      this.session.refreshTokenExpiry,
    );
    // Robustness: Observed that new APLSTB Apollo box on NL did not always return username during session logon, so store username from settings if missing
    if (this.session.username === "") {
      this.log.debug(
        "Session username empty, setting to %s",
        this.config.username,
      );
      this.session.username = this.config.username;
    } else {
      this.log.debug("Session username exists: %s", this.session.username);
    }
    this.currentSessionState = sessionState.CONNECTED;
    this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
    return this.session.householdId;
  } // end of refreshAccessToken

  // select the right session to create
  async createSession() {
    // Guard with optional chaining to safely handle missing authorizationService
    if (!this.configsvc.authorizationService?.URL) {
      throw new Error(
        `Cannot create session: missing authorizationService.URL`,
      );
    }

    this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
    //switch using authmethod with backup of country
    switch ((this.config.authmethod || this.config.country).toLowerCase()) {
      case "be-nl":
      case "be-fr":
      case "b":
        return this.getSessionBE();

      case "gb":
      case "c":
        return this.getSessionGB();

      case "ch":
      case "d": // auth method E = CH Keycloak SSO
        return this.getSessionCH();

      case "e": // OAuth 2.0 with PKCE
        return this.getSessionOAuth2Pkce();

      default: // nl, ie, at, method A
        return this.getSession();
    }
  } // end of createSession

  // get session for OAuth 2.0 PKCE (special logon sequence)
  getSessionOAuth2Pkce() {
    return new Promise((resolve, reject) => {
      this.log("Creating %s OAuth 2.0 PKCE session...", PLATFORM_NAME);
      this.log.warn(
        "++++ PLEASE NOTE: This is current test code with lots of debugging. Do not expect it to work yet. ++++",
      );
      this.currentSessionState = sessionState.LOADING;

      // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
      // axios interceptors to log request and response for debugging
      // works on all following requests in this sub
      /*
			axiosWS.interceptors.request.use(req => {
				this.log.warn('+++INTERCEPTED BEFORE HTTP REQUEST COOKIEJAR:\n', cookieJar.getCookies(req.url)); 
				this.log.warn('+++INTERCEPTOR HTTP REQUEST:', 
				'\nMethod:', req.method, '\nURL:', req.url, 
				'\nBaseURL:', req.baseURL, '\nHeaders:', req.headers,
				'\nParams:', req.params, '\nData:', req.data
				);
				this.log.warn(req); 
				return req; // must return request
			});
			axiosWS.interceptors.response.use(res => {
				this.log.warn('+++INTERCEPTED HTTP RESPONSE:', res.status, res.statusText, 
				'\nHeaders:', res.headers, 
				'\nUrl:', res.url, 
				//'\nData:', res.data, 
				'\nLast Request:', res.request
				);
				//this.log.warn(res); 
				this.log('+++INTERCEPTED AFTER HTTP RESPONSE COOKIEJAR:'); 
				if (cookieJar) { this.log(cookieJar); }// watch out for empty cookieJar
				return res; // must return response
			});
			*/
      // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

      // good description of PKCE
      // https://www.authlete.com/developers/pkce/
      // create a PKCE code pair and save it
      this.pkcePair = generatePKCEPair();
      //this.log('PKCE pair:', pkcePair);

      // Step 1: # get authentication details
      // Recorded sequence step 1: https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true
      // const GB_AUTH_OESP_URL = 'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web';
      // https://spark-prod-gb.gnp.cloud.virgintvgo.virginmedia.com/auth-service/v1/sso/authorization?code_challenge=aHsoE2kJlwA4qGOcx1OCH7i__1bBdV1l6yLOKUvW24U&language=en
      let apiAuthorizationUrl =
        this.configsvc.authorizationService.URL +
        "/v1/sso/authorization?" +
        "code_challenge=" +
        this.pkcePair.code_challenge +
        "&language=en";

      this.log("Step 1 of 7: get authentication details");
      if (this.debugLevel > 1) {
        this.log.warn(
          "Step 1 of 7: get authentication details from",
          apiAuthorizationUrl,
        );
      }
      axiosWS
        .get(apiAuthorizationUrl)
        .then((response) => {
          this.log(
            "Step 1 of 7: response:",
            response.status,
            response.statusText,
          );
          this.log("Step 1 of 7: response.data", response.data);

          // get the data we need for further steps
          let auth = response.data;
          let authState = auth.state;
          let authAuthorizationUri = auth.authorizationUri;
          let authValidityToken = auth.validityToken;
          this.log("Step 1 of 7: results: authState", authState);
          this.log(
            "Step 1 of 7: results: authAuthorizationUri",
            authAuthorizationUri,
          );
          this.log(
            "Step 1 of 7: results: authValidityToken",
            authValidityToken,
          );

          // Step 2: # follow authorizationUri to get AUTH cookie (ULM-JSESSIONID)
          this.log("Step 2 of 7: get AUTH cookie");
          this.log.debug(
            "Step 2 of 7: get AUTH cookie ULM-JSESSIONID from",
            authAuthorizationUri,
          );
          axiosWS
            .get(authAuthorizationUri, {
              jar: cookieJar,
              // unsure what minimum headers will here
              headers: {
                Accept: "application/json, text/plain, */*",
                //Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
              },
            })
            .then((response) => {
              this.log(
                "Step 2 of 7: response:",
                response.status,
                response.statusText,
              );
              this.log.warn("Step 2 of 7 response.data", response.data); // an html logon page

              // Step 3: # login
              this.log(
                "Step 3 of 7: logging in with username %s",
                this.config.username,
              );
              this.currentSessionState = sessionState.LOGGING_IN;

              // we want to POST to
              // 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';
              // see https://auth0.com/intro-to-iam/what-is-openid-connect-oidc
              this.log.debug(
                "Step 3 of 7: POST for username: %s [password hidden]",
                this.config.username,
              );
              axiosWS(GB_AUTH_URL, {
                //axiosWS('https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true',{
                jar: cookieJar,
                // However, since v2.0, axios-cookie-jar will always ignore invalid cookies. See https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md
                data: JSON.stringify({
                  username: this.config.username,
                  credential: this.config.password,
                }),
                method: "POST",
                // minimum headers are "accept": "*/*", "content-type": "application/json; charset=UTF-8",
                headers: {
                  accept: "*/*", // mandatory
                  "content-type": "application/json; charset=UTF-8", // mandatory
                },
                maxRedirects: 0, // do not follow redirects
                validateStatus: function (status) {
                  return (status >= 200 && status < 300) || status === 302; // allow 302 redirect as OK. GB returns 200
                },
              })
                .then((response) => {
                  this.log(
                    "Step 3 of 7: response:",
                    response.status,
                    response.statusText,
                  );
                  this.log.warn(
                    "Step 3 of 7: response.headers:",
                    response.headers,
                  );
                  // responds with a userId, this will need to be used somewhere...
                  this.log.warn("Step 3 of 7: response.data:", response.data); // { userId: 28786528, runtimeId: 79339515 }

                  let url = response.headers["x-redirect-location"]; // must be lowercase
                  if (!url) {
                    // robustness: fail if url missing
                    this.log.warn(
                      "getSessionGB: Step 3: x-redirect-location url empty!",
                    );
                    this.currentSessionState = sessionState.DISCONNECTED;
                    this.currentStatusFault =
                      Characteristic.StatusFault.GENERAL_FAULT;
                    reject(
                      "getSessionGB: Step 3: x-redirect-location url empty!",
                    );
                    return;
                  }
                  //location is h??=... if success
                  //location is https?? if not authorised
                  //location is https:... error=session_expired if session has expired
                  if (url.indexOf("authentication_error=true") > 0) {
                    // >0 if found
                    //this.log.warn('Step 3 of 7: Unable to login: wrong credentials');
                    reject("Step 3 of 7: Unable to login: wrong credentials"); // reject the promise and return the error
                  } else if (url.indexOf("error=session_expired") > 0) {
                    // >0 if found
                    //this.log.warn('Step 3 of 7: Unable to login: session expired');
                    cookieJar.removeAllCookies(); // remove all the locally cached cookies
                    reject("Step 3 of 7: Unable to login: session expired"); // reject the promise and return the error
                  } else {
                    this.log.debug("Step 3 of 7: login successful");

                    // Step 4: # follow redirect url
                    this.log("Step 4 of 7: follow redirect url");
                    axiosWS
                      .get(url, {
                        jar: cookieJar,
                        maxRedirects: 0, // do not follow redirects
                        validateStatus: function (status) {
                          return (
                            (status >= 200 && status < 300) || status === 302
                          ); // allow 302 redirect as OK
                        },
                      })
                      .then((response) => {
                        this.log(
                          "Step 4 of 7: response:",
                          response.status,
                          response.statusText,
                        );
                        this.log.warn(
                          "Step 4 of 7: response.headers.location:",
                          response.headers.location,
                        ); // is https://www.telenet.be/nl/login_success_code=... if success
                        this.log.warn(
                          "Step 4 of 7: response.data:",
                          response.data,
                        );
                        url = response.headers.location;
                        if (!url) {
                          // robustness: fail if url missing
                          this.log.warn(
                            "getSessionGB: Step 4 of 7 location url empty!",
                          );
                          this.currentSessionState = sessionState.DISCONNECTED;
                          this.currentStatusFault =
                            Characteristic.StatusFault.GENERAL_FAULT;
                          reject(
                            "getSessionGB: Step 4 of 7 location url empty!",
                          );
                          return;
                        }

                        // look for login_success?code=
                        if (url.indexOf("login_success?code=") < 0) {
                          // <0 if not found
                          //this.log.warn('Step 4 of 7: Unable to login: wrong credentials');
                          reject(
                            "Step 4 of 7: Unable to login: wrong credentials",
                          ); // reject the promise and return the error
                        } else if (url.indexOf("error=session_expired") > 0) {
                          //this.log.warn('Step 4 of 7: Unable to login: session expired');
                          cookieJar.removeAllCookies(); // remove all the locally cached cookies
                          reject(
                            "Step 4 of 7: Unable to login: session expired",
                          ); // reject the promise and return the error
                        } else {
                          // Step 5: # obtain authorizationCode
                          this.log("Step 5 of 7: extract authorizationCode");
                          /*
													url = response.headers.location;
													if (!url) {		// robustness: fail if url missing
														this.log.warn('getSessionGB: Step 5: location url empty!');
														this.currentSessionState = sessionState.DISCONNECTED;
														this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
														return false;						
													}				
													*/
                          // robustness: .match() returns null if code= not found in url
                          const matchResult = url.match(/code=(?:[^&]+)/g);
                          if (!matchResult) {
                            this.log.warn(
                              "Step 5 of 7: Unable to extract authorizationCode: code= not found in url",
                            );
                            reject(
                              "Step 5 of 7: Unable to extract authorizationCode",
                            ); // unblocks the caller
                            return;
                          }
                          let codeMatches = matchResult[0].split("=");
                          let authorizationCode = codeMatches[1];
                          if (codeMatches.length !== 2) {
                            // length must be 2 if code found
                            this.log.warn(
                              "Step 5 of 7: Unable to extract authorizationCode",
                            );
                          } else {
                            this.log("Step 5 of 7: authorizationCode OK");
                            this.log.debug(
                              "Step 5 of 7: authorizationCode:",
                              authorizationCode,
                            );

                            // Step 6: # authorize again
                            this.log(
                              "Step 6 of 7: post auth data with valid code",
                            );
                            this.log.debug(
                              "Step 6 of 7: post auth data with valid code to",
                              apiAuthorizationUrl,
                            );
                            this.currentSessionState =
                              sessionState.AUTHENTICATING;
                            let payload = {
                              authorizationGrant: {
                                authorizationCode: authorizationCode,
                                validityToken: authValidityToken,
                                state: authState,
                              },
                            };
                            axiosWS
                              .post(apiAuthorizationUrl, payload, {
                                jar: cookieJar,
                              })
                              .then((response) => {
                                this.log(
                                  "Step 6 of 7: response:",
                                  response.status,
                                  response.statusText,
                                );
                                this.log.debug(
                                  "Step 6 of 7: response.data:",
                                  response.data,
                                );

                                auth = response.data;
                                this.log.debug(
                                  "Step 6 of 7: refreshToken:",
                                  auth.refreshToken,
                                );

                                // Step 7: # get OESP code
                                this.log(
                                  "Step 7 of 7: post refreshToken request",
                                );
                                this.log.debug(
                                  "Step 7 of 7: post refreshToken request to",
                                  apiAuthorizationUrl,
                                );
                                payload = {
                                  refreshToken: auth.refreshToken,
                                  username: auth.username,
                                };
                                // must resolve to
                                // 'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web/session';',
                                let sessionUrl = GB_AUTH_OESP_URL + "/session";
                                axiosWS
                                  .post(sessionUrl + "?token=true", payload, {
                                    jar: cookieJar,
                                  })
                                  .then((response) => {
                                    this.log(
                                      "Step 7 of 7: response:",
                                      response.status,
                                      response.statusText,
                                    );
                                    this.currentSessionState =
                                      sessionState.VERIFYING;

                                    this.log.debug(
                                      "Step 7 of 7: response.headers:",
                                      response.headers,
                                    );
                                    this.log.debug(
                                      "Step 7 of 7: response.data:",
                                      response.data,
                                    );
                                    this.log.debug(
                                      "Cookies for the session:",
                                      cookieJar.getCookies(sessionUrl),
                                    );
                                    if (this.debugLevel > 2) {
                                      this.log(
                                        "getSessionGB: response data (saved to this.session):",
                                      );
                                      this.log(response.data);
                                    }

                                    // get device data from the session
                                    this.session = response.data;
                                    // New APLSTB Apollo box on NL does not return username in during session logon, so store username from settings if missing
                                    if (this.session.username === "") {
                                      this.session.username =
                                        this.config.username;
                                    }

                                    this.currentSessionState =
                                      sessionState.CONNECTED;
                                    this.currentStatusFault =
                                      Characteristic.StatusFault.NO_FAULT;
                                    this.log("Session created");
                                    resolve(this.session.householdId); // resolve the promise with the householdId
                                  })
                                  // Step 7 http errors
                                  .catch((error) => {
                                    this.log.debug(
                                      "Step 7 of 7: error:",
                                      error,
                                    );
                                    reject(
                                      "Step 7 of 7: Unable to get OESP token: " +
                                        error.response.status +
                                        " " +
                                        error.response.statusText,
                                    ); // reject the promise and return the error
                                  });
                              })
                              // Step 6 http errors
                              .catch((error) => {
                                reject(
                                  "Step 6 of 7: Unable to authorize with oauth code, http error: " +
                                    error.response.status +
                                    " " +
                                    error.response.statusText,
                                ); // reject the promise and return the error
                              });
                          }
                        }
                      })
                      // Step 4 http errors
                      .catch((error) => {
                        this.log.debug("Step 4 of 7: error:", error);
                        this.log.warn("Step 4 of 7: error:", error);
                        reject(
                          "Step 4 of 7: Unable to oauth authorize: " +
                            error.response.status +
                            " " +
                            error.response.statusText,
                        ); // reject the promise and return the error
                      });
                  }
                })
                // Step 3 http errors
                .catch((error) => {
                  this.log.debug("Step 3 of 7: error:", error);
                  this.log.warn("Step 3 of 7: error:", error);
                  reject(
                    "Step 3 of 7: Unable to login: " +
                      error.response.status +
                      " " +
                      error.response.statusText,
                  ); // reject the promise and return the error
                });
            })
            // Step 2 http errors
            .catch((error) => {
              this.log.debug("Step 2 of 7: error:", error);
              reject(
                "Step 2 of 7: Could not get authorizationUri: " +
                  error.response.status +
                  " " +
                  error.response.statusText,
              ); // reject the promise and return the error
            });
        })
        // Step 1 http errors
        .catch((error) => {
          this.log.debug("Step 1 of 7: error:", error);
          reject(
            "Step 1 of 7: Failed to create session - check your internet connection",
          ); // reject the promise and return the error
        });

      this.currentSessionState = sessionState.DISCONNECTED;
      this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
    });
  } // end of getSessionOAuth2Pkce

  // get session nl, ie, at
  // using new auth method, as of 13.10.2022
  async getSession() {
    return new Promise((resolve, reject) => {
      this.log("Creating %s session...", PLATFORM_NAME);
      this.currentSessionState = sessionState.LOADING;

      // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
      // axios interceptors to log request and response for debugging
      // works on all following requests in this sub
      /*
			axiosWS.interceptors.request.use(req => {
				this.log.warn('+++INTERCEPTOR HTTP REQUEST:', 
				'\nMethod:',req.method, '\nURL:', req.url, 
				'\nBaseURL:', req.baseURL, '\nHeaders:', req.headers,  
				//'\nParams:', req.params, '\nData:', req.data
				);
				this.log('+++INTERCEPTED SESSION COOKIEJAR:\n', cookieJar.getCookies(req.url)); 
				return req; // must return request
			});
			axiosWS.interceptors.response.use(res => {
				this.log.warn('+++INTERCEPTED HTTP RESPONSE:', res.status, res.statusText, 
				'\nHeaders:', res.headers, 
				'\nData:', res.data, 
				//'\nLast Request:', res.request
				);
				//this.log('+++INTERCEPTED SESSION COOKIEJAR:\n', cookieJar.getCookies(res.url)); 
				return res; // must return response
			});
			*/
      // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

      const axiosConfig = {
        method: "POST",
        //url: COUNTRY_BASE_URLS[this.config.country.toLowerCase()] + '/auth-service/v1/authorization',
        url: this.configsvc.authorizationService.URL + "/v1/authorization",
        headers: {
          accept: "*/*", // added 07.08.2023
          "content-type": "application/json; charset=utf-8", // added 07.08.2023
          "x-device-code": "web", // mandatory
          //'x-oesp-username': this.session.username , // added 07.08.2023
          //"x-profile": profile.profileId,  // added 07.08.2023
          //"x-tracking-id": this.customer.hashedCustomerId, // hashed customer id  // added 07.08.2023
        },
        jar: cookieJar,
        data: {
          username: this.config.username,
          password: this.config.password,
          stayLoggedIn: false, // could also set to true
        },
      };

      // robustness: fail if url missing
      if (!axiosConfig.url) {
        this.log.warn("getSession: axiosConfig.url empty!");
        this.currentSessionState = sessionState.DISCONNECTED;
        this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
        reject(new Error("getSession: axiosConfig.url empty!"));
        return; // guard: ensure no further code runs after reject()
      }

      this.log(
        "Step 1 of 1: logging in with username %s",
        this.config.username,
      );
      if (this.debugLevel > 1) {
        this.log.warn("Step 1 of 1: post login to", axiosConfig.url);
      }
      axiosWS(axiosConfig)
        .then((response) => {
          this.log(
            "Step 1 of 1: response:",
            response.status,
            response.statusText,
          );
          if (this.debugLevel > 2) {
            this.log("getSession: response data (saved to this.session):");
            this.log(response.data);
          }
          this.session = response.data;

          // add an expiry date for the access token: 2 min (120000ms) after created date
          this.session.accessTokenExpiry = new Date(
            new Date().getTime() + 2 * 60000,
          );

          // check if householdId exists, if so, we have authenticated ok
          if (this.session.householdId) {
            this.currentSessionState = sessionState.AUTHENTICATED;
          }
          this.log.debug("Session username:", this.session.username);
          this.log.debug("Session householdId:", this.session.householdId);
          this.log.debug("Session accessToken:", this.session.accessToken);
          this.log.debug(
            "Session accessTokenExpiry:",
            this.session.accessTokenExpiry,
          );
          this.log.debug("Session refreshToken:", this.session.refreshToken);
          this.log.debug(
            "Session refreshTokenExpiry:",
            this.session.refreshTokenExpiry,
          );
          // Robustness: Observed that new APLSTB Apollo box on NL did not always return username during session logon, so store username from settings if missing
          if (this.session.username === "") {
            this.log.debug(
              "Session username empty, setting to %s",
              this.config.username,
            );
            this.session.username = this.config.username;
          } else {
            this.log.debug(
              "Session username exists: %s",
              this.session.username,
            );
          }
          this.currentSessionState = sessionState.CONNECTED;
          this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
          this.log(
            "Session %s",
            Object.keys(sessionState)[this.currentSessionState],
          );
          resolve(this.session.householdId); // resolve the promise with the householdId
        })
        .catch((error) => {
          let errReason;
          if (
            error.response &&
            error.response.status >= 400 &&
            error.response.status < 500
          ) {
            errReason =
              "check your " +
              PLATFORM_NAME +
              " username and password: " +
              error.response.status +
              " " +
              (error.response.statusText || "");
          } else if (
            error.response &&
            error.response.status >= 500 &&
            error.response.status < 600
          ) {
            errReason =
              "try again later: " +
              error.response.status +
              " " +
              (error.response.statusText || "");
          } else if (error.response && error.response.status) {
            errReason =
              "check your internet connection: " +
              error.response.status +
              " " +
              (error.response.statusText || "");
          } else if (error.code) {
            errReason =
              "check your internet connection: " +
              error.code +
              " " +
              (error.hostname || "");
          } else {
            errReason = "unexpected error: " + error;
          }
          //this.log('%s %s', errText, (errReason || ''));
          this.log.debug("getSession: error:", error);
          reject(errReason); // reject the promise and return the error
        });
    });
  } // end of getSession

  // get session for BE only (special logon sequence)
  async getSessionBE() {
    return new Promise((resolve, reject) => {
      // only for be-nl and be-fr users, as the session logon using openid is different
      // looks like also for gb users:
      this.log("Creating %s BE session...", PLATFORM_NAME);
      this.currentSessionState = sessionState.LOADING;

      // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
      // axios interceptors to log request and response for debugging
      // works on all following requests in this sub
      /*
			axiosWS.interceptors.request.use(req => {
				this.log.warn('+++INTERCEPTOR HTTP REQUEST:', 
				'\nMethod:',req.method, '\nURL:', req.url, 
				'\nBaseURL:', req.baseURL, '\nHeaders:', req.headers,  
				//'\nParams:', req.params, '\nData:', req.data
				);
				this.log('+++INTERCEPTED SESSION COOKIEJAR:\n', cookieJar.getCookies(req.url)); 
				return req; // must return request
			});
			axiosWS.interceptors.response.use(res => {
				this.log('+++INTERCEPTED HTTP RESPONSE:', res.status, res.statusText, 
				'\nHeaders:', res.headers, 
				//'\nData:', res.data, 
				//'\nLast Request:', res.request
				);
				this.log('+++INTERCEPTED SESSION COOKIEJAR:\n', cookieJar.getCookies(res.url)); 
				return res; // must return response
			});
			*/
      // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

      // ensure the required POST header is set
      axiosWS.defaults.headers.post = {
        "Content-Type": "application/x-www-form-urlencoded",
      }; // needed for axios-cookiejar-support v2.0.x

      // Step 1: # get authentication details
      //let apiAuthorizationUrl = COUNTRY_BASE_URLS[this.config.country.toLowerCase()] + '/auth-service/v1/sso/authorization';
      let apiAuthorizationUrl =
        this.configsvc.authorizationService.URL + "/v1/sso/authorization";
      this.log("Step 1 of 6: get authentication details");
      if (this.debugLevel > 1) {
        this.log.warn(
          "Step 1 of 6: get authentication details from",
          apiAuthorizationUrl,
        );
      }
      axiosWS
        .get(apiAuthorizationUrl)
        .then((response) => {
          this.log(
            "Step 1 of 6: response:",
            response.status,
            response.statusText,
          );

          // get the data we need for further steps
          let auth = response.data;
          let authState = auth.state;
          let authAuthorizationUri = auth.authorizationUri;
          let authValidityToken = auth.validityToken;

          // Step 2: # follow authorizationUri to get AUTH cookie
          this.log("Step 2 of 6: get AUTH cookie");
          this.log.debug(
            "Step 2 of 6: get AUTH cookie from",
            authAuthorizationUri,
          );
          axiosWS
            .get(authAuthorizationUri, {
              jar: cookieJar,
              // unsure what minimum headers will here
              headers: {
                Accept:
                  "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
              },
            })
            .then((response) => {
              this.log(
                "Step 2 of 6: response:",
                response.status,
                response.statusText,
              );

              // Step 3: # login
              this.log(
                "Step 3 of 6: logging in with username %s",
                this.config.username,
              );
              this.log.debug(
                "Step 3 of 6: post login to auth url:",
                BE_AUTH_URL,
              );
              this.log.debug(
                "Step 3 of 6: Cookies for the auth url:",
                cookieJar.getCookies(BE_AUTH_URL),
              );
              this.currentSessionState = sessionState.LOGGING_IN;
              let payload = qs.stringify({
                j_username: this.config.username,
                j_password: this.config.password,
                rememberme: "true",
              });
              this.log.debug("Step 3 of 6: using payload", payload);
              axiosWS
                .post(BE_AUTH_URL, payload, {
                  jar: cookieJar,
                  maxRedirects: 0, // do not follow redirects
                  validateStatus: function (status) {
                    return (status >= 200 && status < 300) || status === 302; // allow 302 redirect as OK
                  },
                })
                .then((response) => {
                  this.log(
                    "Step 3 of 6: response:",
                    response.status,
                    response.statusText,
                  );
                  this.log.debug(
                    "Step 3 response.headers.location:",
                    response.headers.location,
                  );
                  this.log.debug("Step 3 response.headers:", response.headers);
                  let url = response.headers.location;
                  if (!url) {
                    // robustness: fail if url missing
                    this.log.warn("getSessionBE: Step 3: location url empty!");
                    this.currentSessionState = sessionState.DISCONNECTED;
                    reject("getSessionBE: Step 3: location url empty!");
                    return;
                  }

                  // locations unsure after change of login method in October 2022
                  //location is https://login.prd.telenet.be/openid/login?response_type=code&state=... if success
                  //location is https://login.prd.telenet.be/openid/login?authentication_error=true if not authorised
                  //location is https://login.prd.telenet.be/openid/login?error=session_expired if session has expired
                  if (url.indexOf("authentication_error=true") > 0) {
                    // >0 if found
                    //this.log.warn('Step 3 of 6: Unable to login: wrong credentials');
                    reject("Step 3 of 6: Unable to login: wrong credentials"); // reject the promise and return the error
                    //this.currentSessionState = sessionState.DISCONNECTED;;	// flag the session as dead
                    //this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
                  } else if (url.indexOf("error=session_expired") > 0) {
                    //this.log.warn('Step 3 of 6: Unable to login: session expired');
                    cookieJar.removeAllCookies(); // remove all the locally cached cookies
                    reject("Step 3 of 6: Unable to login: session expired"); // reject the promise and return the error
                  } else {
                    // Step 4: # follow redirect url
                    this.log("Step 4 of 6: follow redirect url");
                    //this.log('Cookies for the redirect url:',cookieJar.getCookies(url));
                    axiosWS
                      .get(url, {
                        jar: cookieJar,
                        maxRedirects: 0, // do not follow redirects
                        validateStatus: function (status) {
                          return (
                            (status >= 200 && status < 300) || status === 302
                          ); // allow 302 redirect as OK
                        },
                      })
                      .then((response) => {
                        this.log(
                          "Step 4 of 6: response:",
                          response.status,
                          response.statusText,
                        );
                        this.log.debug(
                          "Step 4 response.headers.location:",
                          response.headers.location,
                        );
                        this.log.debug(
                          "Step 4 response.headers:",
                          response.headers,
                        );
                        this.log.debug("Step 4 response:", response);
                        url = response.headers.location;
                        if (!url) {
                          // robustness: fail if url missing
                          //this.log.warn('Step 4 of 6: location url empty!');
                          reject("Step 4 of 6: location url empty!"); // reject the promise and return the error
                          return;
                          // look for login_success.html?code=
                        } else if (
                          url.indexOf("login_success.html?code=") < 0
                        ) {
                          // <0 if not found
                          //this.log.warn('Step 4 of 6: Unable to login: wrong credentials');
                          reject(
                            "Step 4 of 6: Unable to login: wrong credentials",
                          ); // reject the promise and return the error
                        } else if (url.indexOf("error=session_expired") > 0) {
                          //this.log.warn('Step 4 of 6: Unable to login: session expired');
                          cookieJar.removeAllCookies(); // remove all the locally cached cookies
                          reject(
                            "Step 4 of 6: Unable to login: session expired",
                          ); // reject the promise and return the error
                        } else {
                          // Step 5: # obtain authorizationCode
                          this.log("Step 5 of 6: extract authorizationCode");
                          url = response.headers.location;
                          if (!url) {
                            // robustness: fail if url missing
                            //this.log.warn('Step 5 of 6: location url empty!');
                            reject("Step 5 of 6: location url empty!"); // reject the promise and return the error
                          }

                          // robustness: .match() returns null if code= not found in url
                          const matchResult = url.match(/code=(?:[^&]+)/g);
                          if (!matchResult) {
                            this.log.warn(
                              "Step 5 of 6: Unable to extract authorizationCode: code= not found in url",
                            );
                            reject(
                              "Step 5 of 6: Unable to extract authorizationCode",
                            ); // unblocks the caller
                            return;
                          }
                          let codeMatches = matchResult[0].split("=");
                          let authorizationCode = codeMatches[1];
                          if (codeMatches.length !== 2) {
                            // length must be 2 if code found
                            //this.log.warn('Step 5 of 6: Unable to extract authorizationCode');
                            reject(
                              "Step 5 of 6: Unable to extract authorizationCode",
                            ); // reject the promise and return the error
                          } else {
                            this.log("Step 5 of 6: authorizationCode OK");
                            this.log.debug(
                              "Step 5 of 6: authorizationCode:",
                              authorizationCode,
                            );

                            // Step 6: # authorize again
                            this.log("Step 6 of 6: post auth data");
                            this.log.debug(
                              "Step 6 of 6: post auth data to",
                              apiAuthorizationUrl,
                            );
                            this.currentSessionState =
                              sessionState.AUTHENTICATING;
                            payload = {
                              authorizationGrant: {
                                authorizationCode: authorizationCode,
                                validityToken: authValidityToken,
                                state: authState,
                              },
                            };
                            //this.log('Cookies for the session:',cookieJar.getCookies(apiAuthorizationUrl));
                            axiosWS
                              .post(apiAuthorizationUrl, payload, {
                                jar: cookieJar,
                                // minimum headers are "accept": "*/*", "content-type": "application/json; charset=UTF-8",
                                headers: {
                                  accept: "*/*", // mandatory
                                  "content-type":
                                    "application/json; charset=UTF-8", // mandatory
                                },
                              })
                              .then((response) => {
                                this.log(
                                  "Step 6 of 6: response:",
                                  response.status,
                                  response.statusText,
                                );
                                if (this.debugLevel > 2) {
                                  this.log(
                                    "getSessionBE: response data (saved to this.session):",
                                  );
                                  this.log(response.data);
                                }

                                // get device data from the session
                                this.session = response.data;
                                // New APLSTB Apollo box on NL does not return username in during session logon, so store username from settings if missing
                                if (this.session.username === "") {
                                  this.session.username = this.config.username;
                                }
                                this.log("Session created");
                                this.currentSessionState =
                                  sessionState.CONNECTED;
                                this.currentStatusFault =
                                  Characteristic.StatusFault.NO_FAULT;
                                resolve(this.session.householdId); // resolve the promise with the householdId
                              })
                              // Step 6 http errors
                              .catch((error) => {
                                //this.log.warn("Step 6 of 6: Unable to authorize with oauth code:", error.response.status, error.response.statusText);
                                this.log.debug(
                                  "Step 6 of 6: Unable to authorize with oauth code:",
                                  error,
                                );
                                reject(
                                  "Step 6 of 6: Unable to authorize with oauth code: " +
                                    error.response.status +
                                    " " +
                                    error.response.statusText,
                                ); // reject the promise and return the error
                              });
                          }
                        }
                      })
                      // Step 4 http errors
                      .catch((error) => {
                        //this.log.warn("Step 4 of 6: Unable to oauth authorize:", error.response.status, error.response.statusText);
                        this.log.debug(
                          "Step 4 of 6: Unable to oauth authorize:",
                          error,
                        );
                        //reject("Step 4 of 6: Unable to oauth authorize: " + error.response.status + ' ' + error.response.statusText); // reject the promise and return the error
                        reject(
                          "Step 4 of 6: Unable to oauth authorize: " + error,
                        ); // reject the promise and return the error
                      });
                  }
                })
                // Step 3 http errors
                .catch((error) => {
                  this.log.debug("Step 3 of 6: Unable to login:", error);
                  this.log("Step 3 of 6: Unable to login:", error);
                  reject(
                    "Step 3 of 6: Unable to login: " +
                      error.response.status +
                      " " +
                      error.response.statusText,
                  ); // reject the promise and return the error
                });
            })
            // Step 2 http errors
            .catch((error) => {
              this.log.debug(
                "Step 2 of 6: Could not get authorizationUri:",
                error,
              );
              //this.log.warn("Step 2 of 6: Could not get authorizationUri", error.response.status, error.response.statusText);
              reject(
                "Step 2 of 6: Could not get authorizationUri: " +
                  error.response.status +
                  " " +
                  error.response.statusText,
              ); // reject the promise and return the error
            });
        })
        // Step 1 http errors
        .catch((error) => {
          if (!error.response) {
            this.log(
              "Step 1 of 6: Failed to create BE session - check your internet connection.",
            );
          } else {
            this.log(
              "Step 1 of 6: Failed to create BE session: %s",
              error.response.status,
              error.response.statusText,
            );
          }
          this.log.debug("Step 1 of 6: getSessionBE: error:", error);
          reject(
            "Step 1 of 6: Failed to create BE session: check your internet connection",
          ); // reject the promise and return the error
        });

      this.currentSessionState = sessionState.DISCONNECTED;
      this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
    });
  } // end of getSessionBE

  // ─────────────────────────────────────────────────────────────────────────────
  // getSessionCH
  // ─────────────────────────────────────────────────────────────────────────────
  //
  // Get a session for CH (Switzerland) using Keycloak SSO + Liberty Global token
  // exchange.
  //
  // Steps 2–4 use Puppeteer (headless Chromium) so that the Akamai Bot Manager
  // JavaScript embedded in the Keycloak login page runs naturally and generates
  // the required sensor-data tokens. Without a real browser these tokens are
  // absent and Akamai returns "The requested URL was rejected" before Keycloak
  // ever sees the credentials.
  //
  // Full login sequence:
  //
  //  Step 1: GET  {authorizationService.URL}/v1/sso/authorization        (axios)
  //               ?code_challenge=<pkce_challenge>&language=en
  //               Returns: { state, authorizationUri, validityToken }
  //
  //  Step 2: Puppeteer navigates to authorizationUri  (Keycloak login page)
  //               Akamai JavaScript initialises and sets bot-detection cookies
  //
  //  Step 3: Puppeteer fills username + password fields and submits the form
  //               Akamai JavaScript generates and injects sensor-data tokens
  //               into the POST body automatically before form submission
  //
  //  Step 4: Puppeteer intercepts the redirect to login_success.html
  //               Extracts the authorization code from the redirect URL
  //               Browser is closed — no further Puppeteer use
  //
  //  Step 5: POST {authorizationService.URL}/v1/sso/authorization        (axios)
  //               Body: { authorizationGrant: { authorizationCode,
  //                         validityToken, state, codeVerifier } }
  //               Returns: { accessToken, householdId, refreshToken,
  //                          refreshTokenExpiry, username, issuedAt }
  //               Response is saved directly to this.session — no further
  //               token exchange is needed.
  //
  async getSessionCH() {
    this.log("Creating %s CH session...", PLATFORM_NAME);
    this.currentSessionState = sessionState.LOADING;

    // browser is declared here so the catch block can close it if an error
    // occurs at any point during Steps 2–4
    let browser = null;

    try {
      // ── Step 1: get authentication details ────────────────────────────────
      const { verifier: codeVerifier, code_challenge: codeChallenge } =
        generatePKCEPair();

      const apiAuthorizationUrl =
        this.configsvc.authorizationService.URL + "/v1/sso/authorization";

      this.log("Step 1 of 5: get authentication details");
      if (this.debugLevel > 1) {
        this.log.warn("Step 1 of 5: GET", apiAuthorizationUrl);
      }

      const step1Response = await axiosWS.get(apiAuthorizationUrl, {
        params: {
          code_challenge: codeChallenge,
          language: "en",
        },
        headers: {
          "x-cvp": "upc_ch",
          "x-device-code": "web",
          "x-profile": "anonymous",
        },
      });

      if (this.debugLevel > 1) {
        this.log.warn(
          "Step 1 of 5: response:",
          step1Response.status,
          step1Response.statusText,
        );
      }
      if (this.debugLevel > 2) {
        this.log.warn("Step 1 of 5: response data:", step1Response.data);
      }

      const {
        state: authState,
        authorizationUri,
        validityToken: authValidityToken,
      } = step1Response.data;

      if (!authState || !authorizationUri || !authValidityToken) {
        throw new Error(
          "Step 1 of 5: missing state, authorizationUri or validityToken in response",
        );
      }

      // ── Step 2: launch headless browser ───────────────────────────────────
      this.log("Step 2 of 5: launch headless browser for Keycloak login");

      // --disable-blink-features=AutomationControlled removes the CDP
      // automation flag that Akamai reads via document.$cdc_* properties.
      browser = await puppeteer.launch({
        headless: true,
        executablePath: getChromiumExecutablePath(),
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-blink-features=AutomationControlled",
        ],
      });
      const page = await browser.newPage();

      // Patch the browser properties that Akamai Bot Manager uses to detect
      // headless/automated Chrome. evaluateOnNewDocument fires before any
      // page script runs, so these patches are in place before Akamai loads.
      //
      // 1. navigator.webdriver — Puppeteer sets this to true by default.
      //    It is the single strongest bot signal Akamai checks.
      // 2. window.chrome — absent in headless mode; real Chrome always
      //    has it. Akamai checks chrome.runtime specifically.
      // 3. permissions.query — headless returns a different state for
      //    'notifications', which Akamai uses as an environment probe.
      const realUserAgent = (await browser.userAgent()).replace(
        "HeadlessChrome",
        "Chrome",
      );
      await page.setUserAgent(realUserAgent);

      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, "webdriver", { get: () => false });

        window.chrome = {
          runtime: {},
          loadTimes: function () {},
          csi: function () {},
          app: {},
        };

        const originalQuery = window.navigator.permissions.query;
        window.navigator.permissions.query = (parameters) =>
          parameters.name === "notifications"
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
      });

      // Allow stylesheets, images, scripts and XHR through so that Akamai's
      // environment fingerprinting checks pass. Only fonts and media are
      // blocked — they are unused by the login form and safe to drop.
      await page.setRequestInterception(true);
      page.on("request", (req) => {
        if (["font", "media"].includes(req.resourceType())) {
          req.abort();
        } else {
          req.continue();
        }
      });

      if (this.debugLevel > 2) {
        page.on("framenavigated", (frame) => {
          if (frame === page.mainFrame()) {
            this.log.warn("Step 2: navigated to:", frame.url());
          }
        });
        page.on("requestfailed", (req) => {
          // net::ERR_FAILED is produced by our own req.abort() calls above —
          // not a real network failure. Only log genuine errors.
          if (req.failure()?.errorText === "net::ERR_FAILED") return;
          this.log.warn(
            "Step 2: request failed:",
            req.url(),
            req.failure()?.errorText,
          );
        });
      }

      // ── Step 2 (cont): navigate to Keycloak login page ────────────────────
      //
      // waitUntil: "networkidle2" waits until there are no more than 2
      // in-flight requests for 500ms, giving Akamai JS time to initialise.
      if (this.debugLevel > 1) {
        this.log.warn("Step 2 of 5: navigate to Keycloak login page");
        this.log.warn("Step 2 of 5: navigating to:", authorizationUri);
      }

      await page.goto(authorizationUri, {
        waitUntil: "networkidle2",
        timeout: 30000,
      });

      // Confirm we landed on the expected Keycloak login form and not an
      // Akamai block page or other error page.
      const usernameSelector = 'input[name="username"]';
      const passwordSelector = 'input[name="password"]';

      try {
        await page.waitForSelector(usernameSelector, { timeout: 10000 });
      } catch (e) {
        if (this.debugLevel > 1) {
          const html = await page.content();
          this.log.warn(
            "Step 2 of 5: unexpected page content (first 1000 chars):",
            html.substring(0, 1000),
          );
        }
        throw new Error(
          "Step 2 of 5: username field not found — unexpected page or Akamai block",
        );
      }

      // ── Step 3: fill credentials and submit ───────────────────────────────
      //
      // page.type() simulates real keystroke events (50ms delay between
      // keystrokes) which helps satisfy Akamai's behavioural analysis.
      this.log(
        "Step 3 of 5: logging in with username %s",
        this.config.username,
      );
      this.currentSessionState = sessionState.LOGGING_IN;

      await page.type(usernameSelector, this.config.username, { delay: 50 });
      await page.type(passwordSelector, this.config.password, { delay: 50 });

      if (this.debugLevel > 1) {
        this.log.warn("Step 3 of 5: credentials entered, submitting form");
      }

      // Locate the submit button. The Sunrise SRTV Keycloak theme uses a
      // custom layout so we try all three selector forms in parallel and take
      // whichever resolves first. .catch(() => null) prevents the two losing
      // promises from becoming unhandled rejections when they time out.
      const submitSelector = await Promise.race([
        page
          .waitForSelector("#kc-login", { timeout: 10000 })
          .then(() => "#kc-login")
          .catch(() => null),
        page
          .waitForSelector('button[type="submit"]', { timeout: 10000 })
          .then(() => 'button[type="submit"]')
          .catch(() => null),
        page
          .waitForSelector('input[type="submit"]', { timeout: 10000 })
          .then(() => 'input[type="submit"]')
          .catch(() => null),
      ]);

      if (!submitSelector) {
        if (this.debugLevel > 1) {
          const html = await page.content();
          this.log.warn(
            "Step 3 of 5: page HTML (first 2000 chars):",
            html.substring(0, 2000),
          );
        }
        throw new Error(
          "Step 3 of 5: submit button not found " +
            "(tried #kc-login, button[type=submit], input[type=submit])",
        );
      }

      if (this.debugLevel > 1) {
        this.log.warn("Step 3 of 5: submit button found:", submitSelector);
      }

      // Click and wait simultaneously — if we awaited them sequentially the
      // redirect could complete before waitForNavigation starts listening.
      await Promise.all([
        page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000 }),
        page.click(submitSelector),
      ]);

      const finalUrl = page.url();
      if (this.debugLevel > 1) {
        this.log.warn("Step 3 of 5: post-submit URL:", finalUrl);
      }

      // ── Step 4: extract the authorization code ────────────────────────────
      //
      // A successful login redirects to:
      //   https://www.sunrisetv.ch/sso/login_success.html
      //     ?state=<state>&session_state=<uuid>&code=<authorization-code>
      this.log("Step 4 of 5: extract authorization code");

      if (!finalUrl.startsWith(CH_LOGIN_SUCCESS_URL)) {
        if (this.debugLevel > 1) {
          const html = await page.content();
          this.log.warn(
            "Step 4 of 5: unexpected final URL:",
            finalUrl,
            "page content (first 500):",
            html.substring(0, 500),
          );
        }
        throw new Error(
          // use a simple clean message to tell the user his credentials are likely wrong
          `Step 4 of 5: login failed — check your username and password`,
        );
      }

      const authorizationCode = new URL(finalUrl).searchParams.get("code");
      if (!authorizationCode) {
        throw new Error(
          `Step 4 of 5: authorization code not found in redirect URL: ${finalUrl}`,
        );
      }

      if (this.debugLevel > 2) {
        this.log.warn("Step 4 of 5: authorization code OK");
        this.log.warn("Step 4 of 5: authorizationCode:", authorizationCode);
      }

      // Browser is no longer needed — close it before the axios step
      await browser.close();
      browser = null;

      // ── Step 5: exchange the authorization code for session tokens ────────
      this.log("Step 5 of 5: exchange authorization code");
      this.currentSessionState = sessionState.AUTHENTICATING;

      if (this.debugLevel > 1) {
        this.log.warn("Step 5 of 5: POST to", apiAuthorizationUrl);
      }

      const step5Response = await axiosWS.post(
        apiAuthorizationUrl,
        {
          authorizationGrant: {
            authorizationCode,
            validityToken: authValidityToken,
            state: authState,
            codeVerifier,
          },
        },
        {
          jar: cookieJar,
          headers: {
            accept: "*/*",
            "content-type": "application/json; charset=UTF-8",
          },
        },
      );

      if (this.debugLevel > 2) {
        this.log.warn(
          "Step 5 of 5: response:",
          step5Response.status,
          step5Response.statusText,
        );
        this.log.warn("Step 5 of 5: response data:", step5Response.data);
      }

      if (!step5Response.data.refreshToken) {
        throw new Error("Step 5 of 5: refreshToken missing from response");
      }

      // Step 5 returns the complete authenticated session — accessToken,
      // householdId, refreshToken, refreshTokenExpiry, username, issuedAt.
      // No further token exchange is needed.
      this.session = step5Response.data;
      if (!this.session.username) {
        this.session.username = this.config.username;
      }

      this.log("Session created");
      this.currentSessionState = sessionState.CONNECTED;
      this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;

      return this.session.householdId;
    } catch (error) {
      if (browser) await browser.close().catch(() => {});
      this.currentSessionState = sessionState.DISCONNECTED;
      this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
      const message = error.response
        ? `${error.message}: ${error.response.status} ${error.response.statusText}`
        : error.message || String(error);
      throw new Error(`Failed to create CH session: ${message}`);
    }
  }

  // get session for GB only (special logon sequence)
  getSessionGB() {
    return new Promise((resolve, reject) => {
      this.log("Creating %s GB session...", PLATFORM_NAME);
      this.currentSessionState = sessionState.LOADING;

      // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
      // axios interceptors to log request and response for debugging
      // works on all following requests in this sub
      /*
			axiosWS.interceptors.request.use(req => {
				this.log.warn('+++INTERCEPTED BEFORE HTTP REQUEST COOKIEJAR:\n', cookieJar.getCookies(req.url)); 
				this.log.warn('+++INTERCEPTOR HTTP REQUEST:', 
				'\nMethod:', req.method, '\nURL:', req.url, 
				'\nBaseURL:', req.baseURL, '\nHeaders:', req.headers,
				'\nParams:', req.params, '\nData:', req.data
				);
				this.log.warn(req); 
				return req; // must return request
			});
			axiosWS.interceptors.response.use(res => {
				this.log.warn('+++INTERCEPTED HTTP RESPONSE:', res.status, res.statusText, 
				'\nHeaders:', res.headers, 
				'\nUrl:', res.url, 
				//'\nData:', res.data, 
				'\nLast Request:', res.request
				);
				//this.log.warn(res); 
				this.log('+++INTERCEPTED AFTER HTTP RESPONSE COOKIEJAR:'); 
				if (cookieJar) { this.log(cookieJar); }// watch out for empty cookieJar
				return res; // must return response
			});
			*/
      // ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++

      // Step 1: # get authentication details
      // https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web/authorization
      // https://prod.oesp.virginmedia.com/oesp/v4/GB/eng/web/authorization
      // Recorded sequence step 1: https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true
      // const GB_AUTH_OESP_URL = 'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web';
      let apiAuthorizationUrl = GB_AUTH_OESP_URL + "/authorization";
      this.log("Step 1 of 7: get authentication details");
      if (this.debugLevel > 1) {
        this.log.warn(
          "Step 1 of 7: get authentication details from",
          apiAuthorizationUrl,
        );
      }
      axiosWS
        .get(apiAuthorizationUrl)
        .then((response) => {
          this.log(
            "Step 1 of 7: response:",
            response.status,
            response.statusText,
          );
          //this.log('Step 1 of 7: response.data',response.data);

          // get the data we need for further steps
          let auth = response.data;
          let authState = auth.session.state;
          let authAuthorizationUri = auth.session.authorizationUri;
          let authValidityToken = auth.session.validityToken;
          //this.log('Step 1 of 7: results: authState',authState);
          //this.log('Step 1 of 7: results: authAuthorizationUri',authAuthorizationUri);
          //this.log('Step 1 of 7: results: authValidityToken',authValidityToken);

          // Step 2: # follow authorizationUri to get AUTH cookie (ULM-JSESSIONID)
          this.log("Step 2 of 7: get AUTH cookie");
          this.log.debug(
            "Step 2 of 7: get AUTH cookie ULM-JSESSIONID from",
            authAuthorizationUri,
          );
          axiosWS
            .get(authAuthorizationUri, {
              jar: cookieJar,
              // unsure what minimum headers will here
              headers: {
                Accept: "application/json, text/plain, */*",
                //Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
              },
            })
            .then((response) => {
              this.log(
                "Step 2 of 7: response:",
                response.status,
                response.statusText,
              );
              //this.log.warn('Step 2 of 7 response.data',response.data); // an html logon page

              // Step 3: # login
              this.log(
                "Step 3 of 7: logging in with username %s",
                this.config.username,
              );
              this.currentSessionState = sessionState.LOGGING_IN;

              // we want to POST to
              // 'https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true';
              const GB_AUTH_URL =
                "https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true";
              axiosWS(GB_AUTH_URL, {
                //axiosWS('https://id.virginmedia.com/rest/v40/session/start?protocol=oidc&rememberMe=true',{
                jar: cookieJar,
                // However, since v2.0, axios-cookie-jar will always ignore invalid cookies. See https://github.com/3846masa/axios-cookiejar-support/blob/main/MIGRATION.md
                data:
                  '{"username":"' +
                  this.config.username +
                  '","credential":"' +
                  this.config.password +
                  '"}',
                method: "POST",
                // minimum headers are "accept": "*/*", "content-type": "application/json; charset=UTF-8",
                headers: {
                  accept: "*/*", // mandatory
                  "content-type": "application/json; charset=UTF-8", // mandatory
                },
                maxRedirects: 0, // do not follow redirects
                validateStatus: function (status) {
                  return (status >= 200 && status < 300) || status === 302; // allow 302 redirect as OK. GB returns 200
                },
              })
                .then((response) => {
                  this.log(
                    "Step 3 of 7: response:",
                    response.status,
                    response.statusText,
                  );
                  //this.log.debug('Step 3 of 7: response.headers:',response.headers);
                  //this.log.debug('Step 3 of 7: response.data:',response.data);

                  // X-Redirect-Location
                  // https://id.virginmedia.com/oidc/authorize?response_type=code&state=8ce19449-6cc9-4a65-bcbc-cea7e1884733&nonce=49b0119d-1673-41c5-97b7-eb6092c60b40&client_id=9b471ffe-7ff5-497b-9059-8dcb7c0d66f5&redirect_uri=https://virgintvgo.virginmedia.com/obo_en/login_success&claims={"id_token":{"ukHouseholdId":null}}
                  let url = response.headers["x-redirect-location"]; // must be lowercase
                  if (!url) {
                    // robustness: fail if url missing
                    this.log.warn(
                      "getSessionGB: Step 3: x-redirect-location url empty!",
                    );
                    this.currentSessionState = sessionState.DISCONNECTED;
                    this.currentStatusFault =
                      Characteristic.StatusFault.GENERAL_FAULT;
                    return false;
                  }
                  //location is h??=... if success
                  //location is https?? if not authorised
                  //location is https:... error=session_expired if session has expired
                  if (url.indexOf("authentication_error=true") > 0) {
                    // >0 if found
                    //this.log.warn('Step 3 of 7: Unable to login: wrong credentials');
                    reject("Step 3 of 7: Unable to login: wrong credentials"); // reject the promise and return the error
                  } else if (url.indexOf("error=session_expired") > 0) {
                    // >0 if found
                    //this.log.warn('Step 3 of 7: Unable to login: session expired');
                    cookieJar.removeAllCookies(); // remove all the locally cached cookies
                    reject("Step 3 of 7: Unable to login: session expired"); // reject the promise and return the error
                  } else {
                    this.log.debug("Step 3 of 7: login successful");

                    // Step 4: # follow redirect url
                    this.log("Step 4 of 7: follow redirect url");
                    axiosWS
                      .get(url, {
                        jar: cookieJar,
                        maxRedirects: 0, // do not follow redirects
                        validateStatus: function (status) {
                          return (
                            (status >= 200 && status < 300) || status === 302
                          ); // allow 302 redirect as OK
                        },
                      })
                      .then((response) => {
                        this.log(
                          "Step 4 of 7: response:",
                          response.status,
                          response.statusText,
                        );
                        this.log.debug(
                          "Step 4 of 7: response.headers.location:",
                          response.headers.location,
                        ); // is https://www.telenet.be/nl/login_success_code=... if success
                        this.log.debug(
                          "Step 4 of 7: response.data:",
                          response.data,
                        );
                        url = response.headers.location;
                        if (!url) {
                          // robustness: fail if url missing
                          this.log.warn(
                            "getSessionGB: Step 4 of 7 location url empty!",
                          );
                          this.currentSessionState = sessionState.DISCONNECTED;
                          this.currentStatusFault =
                            Characteristic.StatusFault.GENERAL_FAULT;
                          return false;
                        }

                        // look for login_success?code=
                        if (url.indexOf("login_success?code=") < 0) {
                          // <0 if not found
                          //this.log.warn('Step 4 of 7: Unable to login: wrong credentials');
                          reject(
                            "Step 4 of 7: Unable to login: wrong credentials",
                          ); // reject the promise and return the error
                        } else if (url.indexOf("error=session_expired") > 0) {
                          //this.log.warn('Step 4 of 7: Unable to login: session expired');
                          cookieJar.removeAllCookies(); // remove all the locally cached cookies
                          reject(
                            "Step 4 of 7: Unable to login: session expired",
                          ); // reject the promise and return the error
                        } else {
                          // Step 5: # obtain authorizationCode
                          this.log("Step 5 of 7: extract authorizationCode");
                          /*
													url = response.headers.location;
													if (!url) {		// robustness: fail if url missing
														this.log.warn('getSessionGB: Step 5: location url empty!');
														this.currentSessionState = sessionState.DISCONNECTED;
														this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
														return false;						
													}				
													*/

                          // robustness: .match() returns null if code= not found in url
                          const matchResult = url.match(/code=(?:[^&]+)/g);
                          if (!matchResult) {
                            this.log.warn(
                              "Step 5 of 7: Unable to extract authorizationCode: code= not found in url",
                            );
                            reject(
                              "Step 5 of 7: Unable to extract authorizationCode",
                            ); // unblocks the caller
                            return;
                          }
                          let codeMatches = matchResult[0].split("=");
                          let authorizationCode = codeMatches[1];
                          if (codeMatches.length !== 2) {
                            // length must be 2 if code found
                            this.log.warn(
                              "Step 5 of 7: Unable to extract authorizationCode",
                            );
                          } else {
                            this.log("Step 5 of 7: authorizationCode OK");
                            this.log.debug(
                              "Step 5 of 7: authorizationCode:",
                              authorizationCode,
                            );

                            // Step 6: # authorize again
                            this.log(
                              "Step 6 of 7: post auth data with valid code",
                            );
                            this.log.debug(
                              "Step 6 of 7: post auth data with valid code to",
                              apiAuthorizationUrl,
                            );
                            this.currentSessionState =
                              sessionState.AUTHENTICATING;
                            let payload = {
                              authorizationGrant: {
                                authorizationCode: authorizationCode,
                                validityToken: authValidityToken,
                                state: authState,
                              },
                            };
                            axiosWS
                              .post(apiAuthorizationUrl, payload, {
                                jar: cookieJar,
                              })
                              .then((response) => {
                                this.log(
                                  "Step 6 of 7: response:",
                                  response.status,
                                  response.statusText,
                                );
                                this.log.debug(
                                  "Step 6 of 7: response.data:",
                                  response.data,
                                );

                                auth = response.data;
                                this.log.debug(
                                  "Step 6 of 7: refreshToken:",
                                  auth.refreshToken,
                                );

                                // Step 7: # get OESP code
                                this.log(
                                  "Step 7 of 7: post refreshToken request",
                                );
                                this.log.debug(
                                  "Step 7 of 7: post refreshToken request to",
                                  apiAuthorizationUrl,
                                );
                                payload = {
                                  refreshToken: auth.refreshToken,
                                  username: auth.username,
                                };
                                // must resolve to
                                // 'https://web-api-prod-obo.horizon.tv/oesp/v4/GB/eng/web/session';',
                                let sessionUrl = GB_AUTH_OESP_URL + "/session";
                                axiosWS
                                  .post(sessionUrl + "?token=true", payload, {
                                    jar: cookieJar,
                                  })
                                  .then((response) => {
                                    this.log(
                                      "Step 7 of 7: response:",
                                      response.status,
                                      response.statusText,
                                    );
                                    this.currentSessionState =
                                      sessionState.VERIFYING;

                                    this.log.debug(
                                      "Step 7 of 7: response.headers:",
                                      response.headers,
                                    );
                                    this.log.debug(
                                      "Step 7 of 7: response.data:",
                                      response.data,
                                    );
                                    this.log.debug(
                                      "Cookies for the session:",
                                      cookieJar.getCookies(sessionUrl),
                                    );
                                    if (this.debugLevel > 2) {
                                      this.log(
                                        "getSessionGB: response data (saved to this.session):",
                                      );
                                      this.log(response.data);
                                    }

                                    // get device data from the session
                                    this.session = response.data;
                                    // New APLSTB Apollo box on NL does not return username in during session logon, so store username from settings if missing
                                    if (this.session.username === "") {
                                      this.session.username =
                                        this.config.username;
                                    }

                                    this.currentSessionState =
                                      sessionState.CONNECTED;
                                    this.currentStatusFault =
                                      Characteristic.StatusFault.NO_FAULT;
                                    this.log("Session created");
                                    resolve(this.session.householdId); // resolve the promise with the householdId
                                  })
                                  // Step 7 http errors
                                  .catch((error) => {
                                    //this.log.warn("Step 7 of 7: Unable to get OESP token:",error.response.status, error.response.statusText);
                                    this.log.debug(
                                      "Step 7 of 7: error:",
                                      error,
                                    );
                                    reject(
                                      "Step 7 of 7: Unable to get OESP token: " +
                                        error.response.status +
                                        " " +
                                        error.response.statusText,
                                    ); // reject the promise and return the error
                                  });
                              })
                              // Step 6 http errors
                              .catch((error) => {
                                //this.log.warn("Step 6 of 7: Unable to authorize with oauth code, http error:",error);
                                reject(
                                  "Step 6 of 7: Unable to authorize with oauth code, http error: " +
                                    error.response.status +
                                    " " +
                                    error.response.statusText,
                                ); // reject the promise and return the error
                              });
                          }
                        }
                      })
                      // Step 4 http errors
                      .catch((error) => {
                        //this.log.warn("Step 4 of 7: Unable to oauth authorize:",error.response.status, error.response.statusText);
                        this.log.debug("Step 4 of 7: error:", error);
                        reject(
                          "Step 4 of 7: Unable to oauth authorize: " +
                            error.response.status +
                            " " +
                            error.response.statusText,
                        ); // reject the promise and return the error
                      });
                  }
                })
                // Step 3 http errors
                .catch((error) => {
                  //this.log.warn("Step 3 of 7: Unable to login:",error.response.status, error.response.statusText);
                  this.log.debug("Step 3 of 7: error:", error);
                  reject(
                    "Step 3 of 7: Unable to login: " +
                      error.response.status +
                      " " +
                      error.response.statusText,
                  ); // reject the promise and return the error
                });
            })
            // Step 2 http errors
            .catch((error) => {
              //this.log.warn("Step 2 of 7: Unable to get authorizationUri:",error.response.status, error.response.statusText);
              this.log.debug("Step 2 of 7: error:", error);
              reject(
                "Step 2 of 7: Could not get authorizationUri: " +
                  error.response.status +
                  " " +
                  error.response.statusText,
              ); // reject the promise and return the error
            });
        })
        // Step 1 http errors
        .catch((error) => {
          //this.log('Failed to create GB session - check your internet connection');
          //this.log.warn("Step 1 of 7: Could not get apiAuthorizationUrl:",error.response.status, error.response.statusText);
          this.log.debug("Step 1 of 7: error:", error);
          reject(
            "Step 1 of 7: Failed to create GB session - check your internet connection",
          ); // reject the promise and return the error
        });

      this.currentSessionState = sessionState.DISCONNECTED;
      this.currentStatusFault = Characteristic.StatusFault.GENERAL_FAULT;
    });
  } // end of getSessionCH

  // Fetches the full channel list (subscribed + unsubscribed) from the linear service.
  // Skips the fetch if the cached list has not yet expired.
  // Expiry is driven by the server's Cache-Control max-age, with a config/constant fallback.
  async refreshMasterChannelList() {
    // exit immediately if the session does not exist
    if (this.currentSessionState !== sessionState.CONNECTED) {
      if (this.debugLevel > 1) {
        this.log.warn(
          "refreshMasterChannelList: Session does not exist, exiting",
        );
      }
      return;
    }

    // exit immediately if channel list has not expired
    if (Date.now() < this.masterChannelListExpiryDate) {
      if (this.debugLevel > 1) {
        this.log.warn(
          "refreshMasterChannelList: Master channel list has not expired yet. Next refresh will occur after %s",
          new Date(this.masterChannelListExpiryDate).toLocaleString(), // ✅ format for display only
        );
      }
      return;
    }

    this.log("Refreshing master channel list");

    // channels can be retrieved for the country without having a mqtt session going  but then the list is not relevant for the user's locationId
    // so you should add the user's locationId as a parameter, and this needs the accessToken
    // syntax:
    // https://prod.oesp.virginmedia.com/oesp/v4/GB/eng/web/channels?byLocationId=41043&includeInvisible=true&includeNotEntitled=true&personalised=true&sort=channelNumber
    // https://prod.spark.sunrisetv.ch/eng/web/linear-service/v2/channels?cityId=401&language=en&productClass=Orion-DASH
    /*
			let url = COUNTRY_BASE_URLS[this.config.country.toLowerCase()] + '/channels';
			url = url + '?byLocationId=' + this.session.locationId // locationId needed to get user-specific list
			url = url + '&includeInvisible=true' // includeInvisible
			url = url + '&includeNotEntitled=true' // includeNotEntitled
			url = url + '&personalised=true' // personalised
			url = url + '&sort=channelNumber' // sort
			*/
    //url = 'https://prod.spark.sunrisetv.ch/eng/web/linear-service/v2/channels?cityId=401&language=en&productClass=Orion-DASH'
    //let url = COUNTRY_BASE_URLS[this.config.country.toLowerCase()] + '/eng/web/linear-service/v2/channels';
    const url = new URL(`${this.configsvc.linearService.URL}/v2/channels`);
    url.searchParams.set("cityId", this.customer.cityId);
    url.searchParams.set("language", "en");
    url.searchParams.set("productClass", "Orion-DASH");
    //url = url + '&includeNotEntitled=false' // includeNotEntitled testing to see if this parameter is accepted
    if (this.debugLevel > 1) {
      this.log.warn("refreshMasterChannelList: GET %s", url);
    }
    try {
      // call the webservice to get all available channels
      const config = {
        method: "GET",
        url: url,
        headers: {
          accept: "*/*",
          "x-oesp-token": this.session.accessToken,
          "x-oesp-username": this.session.username,
          Referer:
            COUNTRY_WEB_URLS[this.config.country.toLowerCase()] ??
            "https://www.horizon.tv/",
        },
      };
      const response = await axiosWS(config);
      if (this.debugLevel > 1) {
        this.log.warn(
          "refreshMasterChannelList: response: %s %s",
          response.status,
          response.statusText,
        );
        this.log.warn(
          "refreshMasterChannelList: channels found: %s",
          response.data.length,
        );
      }
      //this.log(response.data);

      // the header contains the following:
      // Cache-Control: max-age=600, public, stale-if-error=43200
      // this could be used to set expiry date...
      const cacheControl = response.headers["cache-control"];
      const maxAgeMatch = cacheControl?.match(/max-age=(\d+)/);
      const serverMaxAge = maxAgeMatch ? parseInt(maxAgeMatch[1], 10) : null;
      const validForSecs =
        serverMaxAge ||
        this.config.masterChannelListValidFor ||
        MASTER_CHANNEL_LIST_VALID_FOR_S;

      // Expiry priority: server Cache-Control max-age → config override → hardcoded constant
      this.masterChannelListExpiryDate = Date.now() + validForSecs * 1000; // always a number

      // load the channel list with all channels found
      this.masterChannelList = [];
      const channels = response.data;
      this.log.debug("Channels to process:", channels.length);
      for (const channel of channels) {
        if (this.debugLevel > 2) {
          this.log(
            "Processing channel:",
            channel.logicalChannelNumber,
            channel.id,
            channel.name,
          );
        }
        this.masterChannelList.push({
          id: channel.id,
          name: cleanNameForHomeKit(channel.name),
          logicalChannelNumber: channel.logicalChannelNumber,
          linearProducts: channel.linearProducts,
        });
      }
      // add a map for faster access to the master channel list
      this.masterChannelMap = new Map(
        this.masterChannelList.map((ch) => [ch.id, ch]),
      );

      this.log(
        "MasterChannelList contains %s channels, valid until %s",
        this.masterChannelList.length,
        new Date(this.masterChannelListExpiryDate).toLocaleString(), // format for display only
      );

      if (this.debugLevel > 1) {
        this.log.warn(
          "refreshMasterChannelList: Master channel list refreshed with %s channels, valid until %s",
          this.masterChannelList.length,
          new Date(this.masterChannelListExpiryDate).toLocaleString(),
        );
      }
      return this.masterChannelList;
    } catch (error) {
      const errReason = error.isAxiosError
        ? `${error.code}: ${error.hostname ?? error.config?.url ?? ""}`
        : (error.message ?? String(error));

      if (error.isAxiosError && error.code === "ENOTFOUND") {
        this.currentSessionState = sessionState.DISCONNECTED;
      }
      this.log.warn("refreshMasterChannelList error:", errReason);
      throw new Error(errReason, { cause: error }); // { cause } preserves the original for debugging
    }
  } // end of refreshMasterChannelList

  // load all recording states and bookings
  // called when a mqtt topic is received indicating a recording settings change
  async refreshRecordings(householdId) {
    this.log("Refreshing recordings");

    // can only refresh recordings if entitled to recordings
    const pvrFeatureFound = this.entitlements.features.some(
      (feature) => feature === "PVR" || feature === "LOCALDVR",
    );
    this.log.debug(
      "refreshRecordings: foundPvrEntitlement %s",
      pvrFeatureFound,
    );
    if (!pvrFeatureFound) {
      this.log.debug("refreshRecordings: no recordings entitlement found");
      return;
    }
    try {
      await this.getRecordingState(householdId);
      await this.getRecordingBookings(householdId);
    } catch (error) {
      this.log.warn("refreshRecordings error:", error);
      throw error; // re-throw so the caller knows it failed
    }
  } // end of refreshRecordings

  // get the config (containing all endpoints) for the country
  async getConfig(countryCode) {
    this.log("Retrieving config for countryCode %s", countryCode);

    // https://spark-prod-ch.gnp.cloud.sunrisetv.ch/ch/en/config-service/conf/web/backoffice.json
    // https://spark-prod-be.gnp.cloud.telenet.tv/be/en/config-service/conf/web/backoffice.json
    // use countryCode.substring(0, 2) to allow be-fr to map to be for the backoffice url
    const ctryCodeForUrl = countryCode.substring(0, 2);

    //const url = 'https://spark-prod-ch.gnp.cloud.sunrisetv.ch/ch/en/config-service/conf/web/backoffice.json'
    //             https://spark-prod-ch.gnp.cloud.sunrisetv.ch/ch/en/config-service/backoffice?platform=web&language=en&version=5.25.13707"
    const url = new URL(
      `${COUNTRY_BASE_URLS[countryCode]}/${ctryCodeForUrl}/en/config-service/conf/web/backoffice.json`,
    );

    if (this.debugLevel > 1) {
      this.log.warn("getConfig: GET %s", url);
    }
    try {
      const response = await axiosWS.get(url);
      if (this.debugLevel > 1) {
        this.log.warn(
          "getConfig: response: %s %s",
          response.status,
          response.statusText,
        );
      }

      if (this.debugLevel > 1) {
        this.log.warn("getConfig: response data (saved to this.configsvc):");
        this.log.warn(response.data);
      }
      this.configsvc = response.data; // store the entire config data for future use in this.configsvc
      return this.configsvc;
    } catch (error) {
      this._handleWebError(error, `get config data for countryCode ${countryCode}`, url);
    }
  } // end of getConfig

  // get Personalization Data via web request GET
  // may not have the full data from GB...
  async getPersonalizationData(householdId) {
    this.log("Refreshing personalization data for householdId %s", householdId);

    if (!this.configsvc.personalizationService.URL) {
      this.log.warn(
        "getPersonalizationData: Cannot get personalization data: personalizationService.URL not found",
      );
      return;
    }

    //const url = personalizationServiceUrlArray[this.config.country.toLowerCase()].replace("{householdId}", this.session.householdId) + '/' + requestType;
    //const url='https://prod.spark.sunrisetv.ch/eng/web/personalization-service/v1/customer/' + householdId + '?with=profiles%2Cdevices';
    // https://spark-prod-ch.gnp.cloud.sunrisetv.ch/eng/web/personalization-service
    const url = new URL(
      `${this.configsvc.personalizationService.URL}/v1/customer/${householdId}`,
    );
    url.searchParams.set("with", "profiles,devices");

    const baseHeaders = {
      "x-oesp-username": this.session.username,
      Referer:
        COUNTRY_WEB_URLS[this.config.country.toLowerCase()] ??
        "https://www.horizon.tv/",
    };

    const config =
      this.config.country.toLowerCase() === "gb"
        ? {
            headers: {
              ...baseHeaders,
            },
          }
        : { headers: baseHeaders };
    4;
    if (this.debugLevel > 1) {
      this.log.warn("getPersonalizationData: GET %s", url);
    }

    try {
      const response = await axiosWS.get(url, config);
      if (this.debugLevel > 1) {
        this.log.warn(
          "getPersonalizationData: response: %s %s",
          response.status,
          response.statusText,
        );
      }
      if (this.debugLevel > 1) {
        this.log.warn(
          "getPersonalizationData: assignedDevices found: %s, profiles found: %s",
          response.data.assignedDevices.length,
          response.data.profiles.length,
        );
      }
      if (this.debugLevel > 2) {
        this.log.warn(
          "getPersonalizationData: response data (saved to this.customer):",
        );
        this.log.warn(response.data);
        this.log.warn("getPersonalizationData: profiles: next log entry");
        this.log.warn(response.data.profiles);
        this.log.warn(
          "getPersonalizationData: assignedDevices: next log entry",
        );
        this.log.warn(response.data.assignedDevices);
        this.log.warn("getPersonalizationData: customerOptIns: next log entry");
        this.log.warn(response.data.customerOptIns);
      }

      this.customer = response.data; // store the entire personalization data for future use in this.customer
      this.devices = response.data.assignedDevices; // store the entire device array at platform level

      // closed captions are stored in
      // response.data.profiles[profileId].options.showSubtitles    boolean, true or false

      // update all the devices in the array. Don't trust the index order in the Personalization Data message
      //this.log('getPersonalizationData: this.stbDevices.length:', this.stbDevices.length)
      if (this.stbDevices.length > 0) {
        this.devices.forEach((device) => {
          if (this.debugLevel > 2) {
            // DEBUG
            this.log.warn(
              "getPersonalizationData: device settings for device %s:",
              device.deviceId,
            );
            this.log.warn(device.settings);
            this.log.warn(
              "getPersonalizationData: device capabilities for device %s:",
              device.deviceId,
            );
            this.log.warn(device.capabilities);
          }
          const deviceId = device.deviceId;
          const stbDevice = this.stbDevices.find(
            (stb) => stb.deviceId === deviceId,
          );
          if (stbDevice) {
            stbDevice.device = device;
            stbDevice.customer = this.customer; // store entire customer object
            this.mqttDeviceStateHandler(deviceId, {
              powerState: null,
              mediaState: null,
              recState: null,
              channelId: null,
              eventId: null,
              sourceType: null,
              profileDataChanged: true,
              statusFault: null,
              programMode: null,
              statusActive: null,
              inputDeviceType: null,
              inputSourceType: null,
            });
          }
        });
      }

      // profiles are an array named profiles, store entire array in this.profiles
      //this.profiles = response.data.profiles; // set this.profiles to the profile data we just received
      //this.log('getPersonalizationData: this.profiles:')
      //this.log(this.profiles)
      ///let testProfile1 = this.profiles.find(profile => profile.name === 'Test');
      //this.log("getPersonalizationData: freshly stored profile data: Profile '%s' last modified at %s", testProfile1.name, testProfile1.lastModified);
      //this.log(testProfile1)
      /*
					// for every personalization data update, update all devices device.customer per device with the new this.customer data
					// but only if stbDevices has been created...
					this.log('getPersonalizationData: this.stbDevices.length:', this.stbDevices.length)
					if (this.stbDevices.length > 0) {
						this.devices.forEach((device) => {
							device.customer = this.customer; // update the device with the refreshed customer data, including the profiles array
							this.log('getPersonalizationData: new customer data stored in device.customer:')
							//this.log(device.profiles)
							let testProfile = device.customer.profiles.find(profile => profile.name === 'Test');
							this.log("getPersonalizationData: Profile '%s' last modified at %s", testProfile.name, testProfile.lastModified); 
							this.log(testProfile)
						});
					}
					*/
      // now we have the cityId data, load the MasterChannelList
      //this.refreshMasterChannelList(); // async function, processing continues, must load after customer data is loaded

      //this.log.warn('getPersonalizationData: all done, returnng customerStatus: %s', this.customer.customerStatus);
      return this.customer;
    } catch (error) {
      this._handleWebError(error, `get personalization data for household ${householdId}`, url);
    }
  } // end of getPersonalizationData

  // set the Personalization Data for the current device via web request PUT
  async setPersonalizationDataForDevice(deviceId, deviceSettings) {
    if (this.debugLevel > 0) {
      this.log.warn(
        "setPersonalizationDataForDevice: deviceSettings:",
        deviceSettings,
      );
    }
    // https://prod.spark.sunrisetv.ch/eng/web/personalization-service/v1/customer/1012345_ch/devices/3C36E4-EOSSTB-003656123456
    //const url = COUNTRY_BASE_URLS[this.config.country.toLowerCase()] + '/eng/web/personalization-service/v1/customer/' + this.session.householdId + '/devices/' + deviceId;
    const url = new URL(
      `${this.configsvc.personalizationService.URL}/v1/customer/${this.session.householdId}/devices/${deviceId}`,
    );

    const data = { settings: deviceSettings };
    // gb needs x-cus, x-oesp-token and x-oesp-username
    const baseHeaders = {
      "x-oesp-username": this.session.username,
      Referer:
        COUNTRY_WEB_URLS[this.config.country.toLowerCase()] ??
        "https://www.horizon.tv/",
    };
    const config =
      this.config.country.toLowerCase() === "gb"
        ? {
            headers: {
              ...baseHeaders,
              "x-cus": this.session.householdId,
              "x-oesp-token": this.session.accessToken,
            },
          }
        : { headers: baseHeaders };
    if (this.debugLevel > 0) {
      this.log.warn("setPersonalizationDataForDevice: PUT %s", url);
    }
    try {
      const response = await axiosWS.put(url, data, config);
      // returns 204 No Content when successful
      if (this.debugLevel > 1) {
        this.log.warn(
          "setPersonalizationDataForDevice: response: %s %s",
          response.status,
          response.statusText,
        );
      }
    } catch (error) {
      this._handleWebError(error, `set personalization data for device ${deviceId}`, url);
    }
  } // end of setPersonalizationDataForDevice

  // get the entitlements for the householdId
  async getEntitlements(householdId) {
    this.log("Refreshing entitlements for householdId %s", householdId);

    if (!this.configsvc.purchaseService.URL) {
      this.log.warn(
        "getEntitlements: Cannot get entitlements data: purchaseService.URL not found",
      );
      return;
    }

    //const url='https://prod.spark.sunrisetv.ch/eng/web/purchase-service/v2/customers/107xxxx_ch/entitlements?enableDaypass=true'
    const url = new URL(
      `${this.configsvc.purchaseService.URL}/v2/customers/${householdId}/entitlements`,
    );
    url.searchParams.set("enableDaypass", "true");
    const isNl = this.config.country.toLowerCase() === "nl";
    const config = {
      headers: {
        "x-cus": householdId,
        [isNl ? "ACCESSTOKEN" : "x-oesp-token"]: this.session.accessToken,
        "x-oesp-username": this.session.username,
        Referer:
          COUNTRY_WEB_URLS[this.config.country.toLowerCase()] ??
          "https://www.horizon.tv/",
      },
    };
    if (this.debugLevel > 1) {
      this.log.warn("getEntitlements: GET %s", url);
    }
    // this.log('getEntitlements: GET %s', url);
    try {
      const response = await axiosWS.get(url, config);
      if (this.debugLevel > 1) {
        this.log.warn(
          "getEntitlements: response: %s %s",
          response.status,
          response.statusText,
        );
      }
      if (this.debugLevel > 2) {
        this.log.warn(
          "getEntitlements: response data (saved to this.entitlements):",
        );
        this.log.warn(response.data);
      }
      this.entitlements = response.data; // store the entire entitlements data for future use in this.customer.entitlements
      if (this.debugLevel > 1) {
        this.log.warn(
          "getEntitlements: entitlements found:",
          this.entitlements.entitlements.length,
        );
      }
      return this.entitlements;
    } catch (error) {
      this._handleWebError(error, `get entitlements data for household ${householdId}`, url);
    }
  } // end of getEntitlements

  // get the recording state via web request GET
  async getRecordingState(householdId) {
    this.log("Refreshing recording state for householdId %s", householdId);

    // getRecordingState: backend will return a 402 Payment Required error if an attempt was made to get recording status when the customer is not entitled:
    // 	httpStatusCode: 402,
    // 	statusCode: 1031,
    //	message: 'Customer disabled',
    //	details: 'Customer entitlements token must contain one of the features: PVR, LOCALDVR',
    // so handle the 402 error cleanly

    // get all recordings. We only need to know if any are ongoing.
    // https://prod.spark.sunrisetv.ch/eng/web/recording-service/customers/107xxxx_ch/recordings/state?channelIds=SV09039
    // https://prod.spark.sunrisetv.ch/eng/web/recording-service/customers/107xxxx_ch/recordings?isAdult=false&offset=0&limit=100&sort=time&sortOrder=desc&profileId=4eb38207-d869-4367-8973-9467a42cad74&language=en
    // const url = COUNTRY_BASE_URLS[this.config.country.toLowerCase()] + '/' + 'networkdvrrecordings?isAdult=false&plannedOnly=false&range=1-20'; // works
    // parameter plannedOnly=false did not work
    //const url = COUNTRY_BASE_URLS[this.config.country.toLowerCase()] + '/eng/web/recording-service/customers/' + householdId + '/recordings/state'; // limit to 20 recordings for performance
    const url = new URL(
      `${this.configsvc.recordingService.URL}/customers/${householdId}/recordings/state`,
    );
    // headers for the connection
    const config = {
      headers: {
        "x-cus": this.session.householdId,
        "x-oesp-username": this.session.username,
        Referer:
          COUNTRY_WEB_URLS[this.config.country.toLowerCase()] ??
          "https://www.horizon.tv/",
      },
      // allow 402 'Payment Required' as OK
      validateStatus: (status) =>
        (status >= 200 && status < 300) || status === 402,
    };
    if (this.debugLevel > 1) {
      this.log.warn("getRecordingState: GET %s", url);
    }

    try {
      const response = await axiosWS.get(url, config);

      if (this.debugLevel > 1) {
        this.log.warn(
          "getRecordingState: response: %s %s",
          response.status,
          response.statusText,
        );
      }
      if (this.debugLevel > 1) {
        this.log.warn("getRecordingState: response data:");
        this.log.warn(response.data);
      }

      // only process if we have a 200 OK
      if (response.status === 200) {
        // a recording carries these properties:
        // for type='single'
        // recordingState: 'ongoing', 'recorded', 'planned' or ??, for all types
        // recordingType: 'nDVR', 'localDVR', 'LDVR',
        // cpeId: '3C36E4-EOSSTB-003597101009', only for local DVRs

        // for type='season':
        // mostRelevantEpisode.recordingState: 'ongoing',
        // mostRelevantEpisode.recordingType: 'nDVR',
        // logging at level 2
        if (this.debugLevel > 1) {
          this.log.warn(
            "getRecordingState: Recordings length %s:",
            response.data.data.length,
          );
          response.data.data.forEach((recording) => {
            this.log.warn(
              "getRecordingState: Recording channelId %s, recordingState %s, eventId: %s",
              recording.channelId,
              recording.recordingState,
              recording.eventId,
            );
            //this.log.warn(recording.mostRelevantEpisode)
          });
        }

        let currRecordingState = recordingState.IDLE; // default
        let localOngoingRecordings = 0,
          networkOngoingRecordings = 0;

        // look for planned network single recordings: (type = "single" = one object, type = "season" = array)
        if (this.debugLevel > 1) {
          this.log.warn(
            "getRecordingState: searching for ongoing network recordings",
          );
        }

        let recordingNetworkOngoing = [].concat(
          response.data.data.find(
            (recording) => recording.recordingState === "ongoing",
          ) ?? [],
        );
        //let recordingNetworkSeasonOngoing = [].concat(response.data.data.find(recording => recording.source === 'season' && recording.mostRelevantEpisode.recordingState === 'ongoing') ?? []);
        //networkOngoingRecordings = recordingNetworkSingleOngoing.length + recordingNetworkSeasonOngoing.length;
        networkOngoingRecordings = recordingNetworkOngoing.length;

        // find if any local device recordings are ongoing, for each device, as each device can have a HDD
        this.devices.forEach((device) => {
          if (this.debugLevel > 1) {
            this.log.warn(
              "getRecordingState: Checking device %s for ongoing local HDD recordings",
              device.deviceId,
            );
          }
          if (device.capabilities.hasHDD) {
            // device has HDD, look for local recordings
            // look for ongoing local single recordings: (type = "single" = one object, type = "season" = array)
            if (this.debugLevel > 0) {
              this.log.warn(
                "getRecordingState: %s: searching for ongoing local recordings for this device",
                device.deviceId,
              );
            }
            let recordingLocalSingleOngoing = [].concat(
              response.data.data.find(
                (recording) =>
                  recording.cpeId === device.deviceId &&
                  recording.source === "single" &&
                  recording.recordingState === "ongoing",
              ) ?? [],
            );
            let recordingLocalSeasonOngoing = [].concat(
              response.data.data.find(
                (recording) =>
                  recording.cpeId === device.deviceId &&
                  recording.source === "season" &&
                  recording.mostRelevantEpisode.recordingState === "ongoing",
              ) ?? [],
            );
            localOngoingRecordings =
              recordingLocalSingleOngoing.length +
              recordingLocalSeasonOngoing.length;
          }

          // log state
          if (localOngoingRecordings > 0) {
            currRecordingState = recordingState.ONGOING_LOCALDVR;
          } else if (networkOngoingRecordings > 0) {
            currRecordingState = recordingState.ONGOING_NDVR;
          }

          // update the device state. Set StatusFault to nofault as connection is working
          this.log(
            "%s: Recording state: ongoing recordings: local %s, network %s, current Recording State %s [%s]",
            device.settings.deviceFriendlyName + PLUGIN_ENV,
            localOngoingRecordings,
            networkOngoingRecordings,
            currRecordingState,
            Object.keys(recordingState)[currRecordingState],
          );
          this.mqttDeviceStateHandler(device.deviceId, {
            powerState: null,
            mediaState: null,
            recState: currRecordingState,
            channelId: null,
            eventId: null,
            sourceType: null,
            profileDataChanged: null,
            statusFault: Characteristic.StatusFault.NO_FAULT,
            programMode: null,
            statusActive: null,
            inputDeviceType: null,
            inputSourceType: null,
          });
        });
      }

      return this.currentRecordingState;
    } catch (error) {
      this._handleWebError(error, `get recording status for household ${householdId}`, url);
    }
  } // end of getRecordingState

  // get the recording bookings via web request GET
  async getRecordingBookings(householdId) {
    this.log("Refreshing recording bookings for householdId %s", householdId);

    // getRecordingState: backend will return a 402 Payment Required error if an attempt was made to get recording status when the customer is not entitled:
    // 	httpStatusCode: 402,
    // 	statusCode: 1031,
    //	message: 'Customer disabled',
    //	details: 'Customer entitlements token must contain one of the features: PVR, LOCALDVR',
    // so handle the 402 error cleanly

    // get all planned recordings. We only need to know if any results exist.
    // 0 results = Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED
    // >0 results = Characteristic.ProgramMode.PROGRAM_SCHEDULED
    // https://prod.spark.sunrisetv.ch/eng/web/recording-service/customers/107xxxx_ch/recordings/state?channelIds=SV09039
    // https://prod.spark.sunrisetv.ch/eng/web/recording-service/customers/107xxxx_ch/recordings?isAdult=false&offset=0&limit=100&sort=time&sortOrder=desc&profileId=4eb38207-d869-4367-8973-9467a42cad74&language=en
    // parameter plannedOnly=false did not work

    // get all booked series recordings: these are planned future recordings
    // I need a test user to get me the html endpoints for local HDD recording state
    // https://prod.spark.sunrisetv.ch/eng/web/recording-service/customers/107xxxx_ch/bookings?isAdult=false&offset=0&limit=100&sort=time&sortOrder=asc&language=en
    //const url = COUNTRY_BASE_URLS[this.config.country.toLowerCase()] + '/eng/web/recording-service/customers/' + householdId + '/bookings?limit=10&sort=time&sortOrder=asc'; // limit to 10 recordings for performance
    const url = new URL(
      `${this.configsvc.recordingService.URL}/customers/${householdId}/bookings`,
    );
    url.searchParams.set("limit", "10"); // limit to 10 recordings for performance
    url.searchParams.set("sort", "time");
    url.searchParams.set("sortOrder", "asc");
    // headers for the connection
    const config = {
      headers: {
        "x-cus": householdId,
        "x-oesp-username": this.session.username,
        Referer:
          COUNTRY_WEB_URLS[this.config.country.toLowerCase()] ??
          "https://www.horizon.tv/",
      },
      validateStatus: (status) =>
        (status >= 200 && status < 300) || status === 402, // allow 402 'Payment Required' as OK
    };
    if (this.debugLevel > 1) {
      this.log.warn("getRecordingBookings: GET %s", url);
    }

    try {
      const response = await axiosWS.get(url, config);
      // log at level 1, 2
      if (this.debugLevel > 1) {
        this.log.warn(
          "getRecordingBookings: response: %s %s",
          response.status,
          response.statusText,
        );
      }
      if (this.debugLevel > 1) {
        this.log.warn("getRecordingBookings: response data:");
        this.log.warn(response.data);
      }

      // only process if we have a 200 OK
      if (response.status === 200) {
        // a recording carries these properties:
        // for type='single'
        // recordingState: 'ongoing', 'recorded', 'planned' or ??, for all types
        // recordingType: 'nDVR', 'localDVR', 'LDVR',
        // cpeId: '3C36E4-EOSSTB-003597101009', only for local DVRs

        // for type='season':
        // mostRelevantEpisode.recordingState: 'ongoing',
        // mostRelevantEpisode.recordingType: 'nDVR',
        // logging at level 2
        if (this.debugLevel > 1) {
          this.log.warn(
            "getRecordingBookings: Recordings length %s:",
            response.data.data.length,
          );
          response.data.data.forEach((recording) => {
            this.log.warn(
              'getRecordingBookings: Recording title "%s", type %s, recordingState %s, recordingType %s, mostRelevantEpisode:',
              recording.title,
              recording.type,
              recording.recordingState,
              recording.recordingType,
            );
            this.log.warn(recording.mostRelevantEpisode);
          });
        }
        let currProgramMode = Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED; // default
        let localPlannedRecordings = 0,
          networkPlannedRecordings = 0;

        // look for planned network recordings: (type = "single" = one object, type = "season" = array)
        if (this.debugLevel > 1) {
          this.log.warn(
            "getRecordingBookings: searching for planned network recordings",
          );
        }
        let recordingNetworkSinglePlanned = [].concat(
          response.data.data.find(
            (recording) =>
              recording.type === "single" &&
              recording.recordingState === "planned",
          ) ?? [],
        );
        let recordingNetworkSeasonPlanned = [].concat(
          response.data.data.find(
            (recording) =>
              recording.type === "season" &&
              recording.mostRelevantEpisode.recordingState === "planned",
          ) ?? [],
        );
        networkPlannedRecordings =
          recordingNetworkSinglePlanned.length +
          recordingNetworkSeasonPlanned.length;

        // find if any local recordings are booked, for each device, as each device can have a HDD
        this.devices.forEach((device) => {
          if (this.debugLevel > 1) {
            this.log.warn(
              "getRecordingBookings: Checking device %s for planned local HDD recordings",
              device.deviceId,
            );
          }
          if (device.capabilities.hasHDD) {
            // device has HDD, look for local recordings
            // look for planned local single recordings: (type = "single")
            if (this.debugLevel > 0) {
              this.log.warn(
                "getRecordingBookings: %s: searching for planned local recordings for this device",
                device.deviceId,
              );
            }
            let recordingLocalSinglePlanned = [].concat(
              response.data.data.find(
                (recording) =>
                  recording.cpeId === device.deviceId &&
                  recording.type === "single" &&
                  recording.recordingState === "planned",
              ) ?? [],
            );
            let recordingLocalSeasonPlanned = [].concat(
              response.data.data.find(
                (recording) =>
                  recording.cpeId === device.deviceId &&
                  recording.type === "season" &&
                  recording.mostRelevantEpisode.recordingState === "planned",
              ) ?? [],
            );
            localPlannedRecordings =
              recordingLocalSinglePlanned.length +
              recordingLocalSeasonPlanned.length;
          }

          // log state
          if (localPlannedRecordings + networkPlannedRecordings > 0) {
            currProgramMode = Characteristic.ProgramMode.PROGRAM_SCHEDULED;
          }

          // update the device state. Set StatusFault to nofault as connection is working
          this.log(
            "%s: Recording bookings: planned recordings found: local %s, network %s, current Program Mode %s [%s]",
            device.settings.deviceFriendlyName + PLUGIN_ENV,
            localPlannedRecordings,
            networkPlannedRecordings,
            currProgramMode,
            CHAR_NAMES.ProgramMode[currProgramMode + 1],
          );
          this.mqttDeviceStateHandler(device.deviceId, {
            powerState: null,
            mediaState: null,
            recState: null,
            channelId: null,
            eventId: null,
            sourceType: null,
            profileDataChanged: true,
            statusFault: Characteristic.StatusFault.NO_FAULT,
            programMode: currProgramMode,
            statusActive: null,
            inputDeviceType: null,
            inputSourceType: null,
          });
        });
      }

      return this.currentRecordingState;
    } catch (error) {
      this._handleWebError(error, `get recording bookings for household ${householdId}`, url);
    }
  } // end of getRecordingBookings

  // get getExperimentalEndpoint for the householdId
  async getExperimentalEndpoint(householdId) {
    this.log("getExperimentalEndpoint: householdId %s", householdId);

    //const url = personalizationServiceUrlArray[this.config.country.toLowerCase()].replace("{householdId}", this.session.householdId) + '/' + requestType;
    //const url='https://prod.spark.sunrisetv.ch/eng/web/purchase-service/v2/customers/107xxxx_ch/entitlements?enableDaypass=true'
    // 'https://web-api-prod-obo.horizon.tv/oesp/v4/CH/eng/web'
    //url=COUNTRY_BASE_URLS[this.config.country.toLowerCase()] + '/eng/web/purchase-service/v2/customers/' + householdId + '/entitlements?enableDaypass=true';
    //url='https://web-api-prod-obo.horizon.tv/oesp/v4/CH/eng/web/eng/session'
    //url='https://prod.spark.upctv.ch/ch/en/session-service'
    const url = new URL(this.configsvc.sessionService.URL);
    const config = {
      headers: {
        "x-cus": householdId,
        "x-oesp-token": this.session.accessToken,
        "x-oesp-username": this.session.username,
        Referer:
          COUNTRY_WEB_URLS[this.config.country.toLowerCase()] ??
          "https://www.horizon.tv/",
      },
    };
    this.log.warn("getExperimentalEndpoint: GET %s", url);
    // this.log('getEntitlements: GET %s', url);
    try {
      const response = await axiosWS.get(url, config);
      this.log.warn(
        "getExperimentalEndpoint: response: %s %s",
        response.status,
        response.statusText,
      );
      this.log.warn(response.data);
      return true;
    } catch (error) {
      this._handleWebError(error, `get experimental endpoint for household ${householdId}`, url);
    }
  } // end of getExperimentalEndpoint

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // END session handler (web)
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // START session handler mqtt
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++

  // get a JSON web token from the supplied accessToken and householdId
  async getMqttToken(oespUsername, accessToken, householdId) {
    this.log.debug("Getting mqtt token for householdId %s", householdId);
    if (this.debugLevel > 1) {
      this.log.warn("getMqttToken");
    }

    const missing = (label) => {
      this.log.warn(`Cannot get mqtt token: ${label} not set`);
      return false;
    };

    // robustness checks
    if (this.currentSessionState !== sessionState.CONNECTED) {
      const stateLabel =
        Object.keys(sessionState).find(
          (key) => sessionState[key] === this.currentSessionState,
        ) ?? this.currentSessionState;
      this.log.warn(
        "Cannot get mqtt token: currentSessionState incorrect:",
        stateLabel,
      );
      return false;
    }
    if (!accessToken) return missing("accessToken");
    if (!oespUsername) return missing("oespUsername");
    if (!householdId) return missing("householdId");

    let url;
    try {
      url = new URL(`${this.configsvc.authorizationService.URL}/v1/mqtt/token`);
    } catch {
      this.log.warn(
        "Cannot get mqtt token: authorizationService.URL is invalid",
      );
      return false;
    }

    const axiosConfig = {
      method: "GET",
      url: url.href,
      headers: {
        "X-OESP-Token": accessToken,
        "X-OESP-Username": oespUsername,
      },
    };
    this.log.debug("getMqttToken: axiosConfig:", axiosConfig);

    try {
      const response = await axiosWS(axiosConfig);
      if (this.debugLevel > 1) {
        this.log.warn("getMqttToken: response.data:", response.data);
      }
      return response.data.token;
    } catch (error) {
      this.log.debug("getMqttToken error details:", error);
      this.currentSessionState = sessionState.DISCONNECTED;
      const code = error.code ?? "UNKNOWN";
      const host = error.hostname ? ` (${error.hostname})` : "";
      throw new Error(`Failed to get mqtt token: ${code}${host}`);
    }
  } // end of getMqttToken

  // start the mqtt client and handle mqtt messages
  // https://github.com/mqttjs/MQTT.js#readme
  // http://www.steves-internet-guide.com/mqtt-publish-subscribe/
  startMqttClient(householdId, mqttPassword) {
    if (this.currentSessionState !== sessionState.CONNECTED) {
      this.log.warn(
        "Cannot start mqttClient: currentSessionState incorrect:",
        this.currentSessionState,
      );
      return Promise.reject(
        new Error(
          "Cannot start mqttClient: currentSessionState incorrect: " +
            this.currentSessionState,
        ),
      );
    }

    // used identically in close, reconnect, disconnect, offline, and error events.
    const faultState = {
      powerState: null,
      mediaState: null,
      recState: null,
      channelId: null,
      eventId: null,
      sourceType: null,
      profileDataChanged: null,
      statusFault: Characteristic.StatusFault.GENERAL_FAULT,
      programMode: null,
      statusActive: null,
      inputDeviceType: null,
      inputSourceType: null,
    };

    return new Promise((resolve, reject) => {
      if (this.debugLevel > 0) {
        this.log("Starting mqttClient...");
      }

      // make a new mqttClientId on every session start (much more robust), then connect
      const newMqttClientId = randomUUID();

      // from 24 Jan 2024 we need to set the sub protocols mqtt, mqttv3.1, mqttv3.11 to connect
      // the required header looks like this:
      // "sec-websocket-protocol": "mqtt, mqttv3.1, mqttv3.11",
      // make a new custom websocket so we can ensure the correct mqtt protocols are used in the headers
      // see https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketaddress-protocols-options
      const createCustomWebsocket = (url, _websocketSubProtocols, _options) => {
        return new WebSocket(url, ["mqtt", "mqttv3.1", "mqttv3.11"]);
      };

      try {
        this.mqttClient = mqtt.connect(this.configsvc.mqttBroker.URL, {
          createWebsocket: createCustomWebsocket,
          clientId: newMqttClientId,
          connectTimeout: 10 * 1000,
          username: householdId,
          password: mqttPassword,
        });
      } catch (err) {
        reject(new Error("Cannot connect to mqtt broker: " + err.message));
        return;
      }

      if (this.debugLevel > 0) {
        this.log.warn(
          "startMqttClient: mqttBroker connect request sent using mqttClientId %s, waiting for connect event",
          newMqttClientId,
        );
      }

      // mqtt client event: connect
      // https://github.com/mqttjs/MQTT.js#event-connect
      this.mqttClient.on("connect", () => {
        try {
          this.log("mqttClient: Connected");
          this.mqttClientConnecting = false;

          // ----- About Subscriptions -----
          // + — Single-level wildcard
          // Matches exactly one topic level. It stands in for any single segment between slashes.
          // subscribe: "home/+/temperature"
          // matches:
          //   home/living-room/temperature  ✅
          //   home/bedroom/temperature      ✅
          //   home/kitchen/temperature      ✅
          // You can use multiple + wildcards in a single topic:
          //
          // # — Multi-level wildcard
          // Matches zero or more topic levels from that point forward. It must always appear at the end of the subscription topic.
          // subscribe: "home/#"
          // matches:
          //   home/temperature              ✅
          //   home/living-room/temperature  ✅
          //   home/floor1/bedroom/lights    ✅
          //   home/anything/deep/nested     ✅
          // It can also match the parent topic itself (zero levels):
          //   subscribe: "home/#"
          // also matches:
          //   home    ✅  (zero additional levels)

          // ------ household subscriptions ------
          // subscribe only to what we need

          // householdId: subscribe to all our own household messages
          this.mqttSubscribeToTopic(householdId); // subscribe to entire householdId

          // https://prod.spark.sunrisetv.ch/eng/web/personalization-service/v1/customer/107xxxx_ch/profiles
          // householdId/personalizationService: subscribe to personalization service for the household
          this.mqttSubscribeToTopic(householdId + "/personalizationService");

          // householdId/recordingStatus: subscribe to recording status for the household
          // recording status is used to update the accessory characteristics
          this.mqttSubscribeToTopic(householdId + "/recordingStatus");
          // other related endpoints that might be useful:
          //this.mqttSubscribeToTopic(householdId + "/recordingStatus/lastUserAction",);

          // purchaseService and watchlistService are not needed, but add if desired if we want to monitor these services
          // bookmarkService is not needed
          //this.mqttSubscribeToTopic(householdId + "/purchaseService"); // subscribe fails
          //this.mqttSubscribeToTopic(householdId + "/watchlistService"); // subscribe fails
          //this.mqttSubscribeToTopic(householdId + '/#'); // everything! multilevel wildcard
          //this.mqttSubscribeToTopic(householdId + '/bookmarkService');

          // ------ device subscriptions ------
          // subscribe only to what we need

          // turn on our clientId. This is similar to turning on a box, it tells the server we are online
          // our clientId must be up and running to send commands (power, channel, etc) to the physical device
          // this.setHgoOnlineRunning(householdId, mqttClientId);

          // householdId/mqttClientId: subscribe to own clientId to get data for ourselves
          // subscribe to all devices after the setHgoOnlineRunning is sent
          this.mqttSubscribeToTopic(
            householdId + "/" + this.mqttClient.options.clientId,
          ); // subscribe to our own mqttClientId to get all data

          // householdId/deviceId/status: subscribe to status from each physical device
          // This allows us to receive current device status, such as power, channel and more.
          // Note: subscribing to householdId/deviceId (e.g. 1021602528_ch/000378-EOS2STB-001234567890)
          // is not permitted by the broker ACL - the device hardware topic is reserved for the box itself
          this.devices.forEach((device) => {
            this.mqttSubscribeToTopic(
              householdId + "/" + device.deviceId + "/status",
            );
            //this.mqttSubscribeToTopic(householdId + "/" + device.deviceId + "/#"); // not allowed
            // this.mqttSubscribeToTopic(householdId + "/" + device.deviceId + "/personalizationService"); // does not exist
          });

          // DO NOT DO THIS: householdId/+/status: subscribe to status from any device (+ = single-level wildcard)
          // do not subscribe to householdId/+/status, as this gets status from every single running device, physical and virtual
          // this includes all physical devices and webclients that are running, and all previous mqtt sessions from this plugin
          // this will flood the plugin with unnecessary messages
          //this.mqttSubscribeToTopic(householdId + '/+/status'); // subscribe to householdId/+/status = wildcard

          // householdId/+/localRecordings: subscribe to local recordings from any device (+ = single-level wildcard)
          this.mqttSubscribeToTopic(householdId + "/+/localRecordings");
          //this.mqttSubscribeToTopic(householdId + "/+/localRecordings/capacity",); // subscribe fails, might be if the box has no local drive

          // other possible endpoints to try
          //this.mqttSubscribeToTopic(householdId + '/' + device.deviceId + '/audioStatus'); // a guess
          //this.mqttSubscribeToTopic(householdId + '/' + device.deviceId + '/radioStatus'); // a guess
          //this.mqttSubscribeToTopic(householdId + '/' + device.deviceId + '/source'); // a guess
          //this.mqttSubscribeToTopic(householdId + '/' + device.deviceId + '/radio'); // a guess
          //this.mqttSubscribeToTopic(householdId + '/' + device.deviceId + '/audio'); // a guess

          // reset so the 10-second retry fires correctly if the box doesn't respond
          this.lastMqttUiStatusMessageReceived = null;

          // CPE.uiStatus messages are received via the householdId and mqttClientId
          // topics which are already subscribed above.
          // getUiStatus is called here to request the initial UI state from each device.
          // retain: false is used (see getUiStatus) so a retry is scheduled in case the box
          // is temporarily unreachable when the initial request is sent.
          this.devices.forEach((device) => {
            // request the initial UI status for each device
            this.getUiStatus(device.deviceId, this.mqttClient.options.clientId);

            // retry getUiStatus after 10 seconds if no CPE.uiStatus response has arrived yet
            // (handles case where box is briefly offline when the initial request is sent)
            setTimeout(() => {
              if (!this.lastMqttUiStatusMessageReceived) {
                if (this.debugLevel > 0) {
                  this.log.warn(
                    "getUiStatus: no CPE.uiStatus received yet for %s, retrying",
                    device.deviceId,
                  );
                }
                this.getUiStatus(
                  device.deviceId,
                  this.mqttClient.options.clientId,
                );
              }
            }, 10 * 1000); // 10 second retry delay
          });

          resolve(true); // all subscriptions registered — session is ready
        } catch (err) {
          this.log.error(
            "Error trapped in mqttClient connect event:",
            err.message,
          );
          this.log.error(err);
          this.currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
          reject(err);
        }
      }); // end of this.mqttClient.on('connect'... event

      // mqtt client event: message received
      // https://github.com/mqttjs/MQTT.js#event-message
      this.mqttClient.on("message", (topic, message) => {
        try {
          // store some mqtt diagnostic data
          this.lastMqttMessageReceived = Date.now();

          let mqttMessage = JSON.parse(message);
          if (this.debugLevel > 0) {
            this.log.warn(
              "mqttClient: Received Message: \r\nTopic: %s\r\nMessage: (next log entry)",
              topic,
            );
            this.log.warn(mqttMessage);
          }

          // variables for just in this function
          let deviceId,
            stbState,
            currPowerState,
            currMediaState,
            currChannelId,
            currEventId,
            currSourceType,
            profileDataChanged = false, // initialise to false
            currRecordingState,
            currStatusActive,
            currInputDeviceType,
            currInputSourceType;

          // handle personalizationService messages
          // Topic: 107xxxx_ch/personalizationService
          // Message: { action: 'OPS.getProfilesUpdate', source: '3C36E4-EOSSTB-00365657xxxx', ... }
          // Message: { action: 'OPS.getDeviceUpdate', source: '3C36E4-EOSSTB-00365657xxxx', deviceId: '3C36E4-EOSSTB-00365657xxxx' }
          if (topic.includes(householdId + "/personalizationService")) {
            if (this.debugLevel > 0) {
              this.log.warn("mqttClient: %s: action", mqttMessage.action);
            }
            if (
              mqttMessage.action === "OPS.getProfilesUpdate" ||
              mqttMessage.action === "OPS.getDeviceUpdate"
            ) {
              if (this.debugLevel > 0) {
                this.log.warn(
                  "mqttClient: %s, calling getPersonalizationData",
                  mqttMessage.action,
                );
              }
              deviceId = mqttMessage.source;
              profileDataChanged = true;
              this.getPersonalizationData(this.session.householdId); // async function
            }
          }

          // handle recordingState messages
          // Topic: Topic: 107xxxx_ch/recordingStatus
          // Message: {"id":"crid:~~2F~~2Fgn.tv~~2F2004781~~2FEP019440730003,imi:2d369682b865679f2e5182ea52a93410171cfdc8","event":"scheduleEvent","transactionId":"/CH/eng/web/networkdvrrecordings - 013f12fc-23ef-4b77-a244-eeeea0c6901c"}
          if (topic.includes(householdId + "/recordingStatus")) {
            if (this.debugLevel > 0) {
              this.log.warn("mqttClient: event: %s", mqttMessage.event);
            }
            this.refreshRecordings(this.session.householdId); // request a refresh of recording data
          }

          // handle status messages for the STB
          // Topic: 107xxxx_ch/3C36E4-EOSSTB-00365657xxxx/status
          // Message: {"deviceType":"STB","source":"3C36E4-EOSSTB-00365657xxxx","state":"ONLINE_RUNNING","mac":"F8:F5:32:45:DE:52","ipAddress":"192.168.0.33/255.255.255.0"}
          if (topic.includes("/status")) {
            if (mqttMessage.deviceType === "STB") {
              if (this.debugLevel > 0) {
                this.log.warn(
                  "mqttClient: STB status: Detecting Power State: Received Message of deviceType %s for %s",
                  mqttMessage.deviceType,
                  mqttMessage.source,
                );
              }
              // mac.length = 0 when the box is physically offline, but we
              // always use the reported state regardless - the switch below handles all cases
              deviceId = mqttMessage.source;
              stbState = mqttMessage.state;

              // Look up the per-device instance so we can read device-specific state
              // (e.g. previousPowerState) before the switch runs
              const deviceIndex = this.devices.findIndex(
                (device) => device.deviceId === deviceId,
              );
              const stbDevice = deviceIndex > -1 ? this.stbDevices[deviceIndex] : null;

              // Box setting: StandbyPowerConsumption = FastStart / ActiveStart / EcoSlowstart
              // "Fast start":  when turned off, goes to ONLINE_STANDBY and stays there. Box can be turned on via mqtt
              // "Active start": when turned off, stays at ONLINE_STANDBY for 5min, then goes to OFFLINE_NETWORK_STANDBY. box can be turned on via ??
              // "Eco (slow start)": when turned off, stays at ONLINE_STANDBY for 5min, then goes to OFFLINE. Box cannot be turned on by mqtt. Physical remote turns on via IR
              switch (stbState) {
                case "ONLINE_RUNNING": // ONLINE_RUNNING: power is on
                  currStatusActive = Characteristic.Active.ACTIVE; // bool, 0 = not active, 1 = active
                  currPowerState = Characteristic.Active.ACTIVE;
                  // Detect power-off → power-on transition per device.
                  // Set PLAY immediately; CPE.uiStatus will overwrite with the
                  // accurate speed-derived state shortly after.
                  if (stbDevice?.previousPowerState === Characteristic.Active.INACTIVE) {
                    currMediaState = Characteristic.CurrentMediaState.PLAY;
                    if (this.debugLevel > 0) {
                      this.log.warn(
                        "mqttClient: STB status: power-on transition for %s, setting mediaState to PLAY",
                        deviceId,
                      );
                    }
                  }                 
                  break;
                case "ONLINE_STANDBY": // ONLINE_STANDBY: power is off, device is on standby, still reachable over the network, can be turned on via mqtt.
                  currStatusActive = Characteristic.Active.ACTIVE; // bool, 0 = not active, 1 = active
                  currPowerState = Characteristic.Active.INACTIVE;
                  currMediaState = Characteristic.CurrentMediaState.STOP; // set media to STOP when power is off
                  break;
                case "OFFLINE_NETWORK_STANDBY": // OFFLINE_NETWORK_STANDBY: power is off, device is still reachable on the network but cannot be turned on by mqtt
                  currStatusActive = Characteristic.Active.INACTIVE; // bool, 0 = not active, 1 = active
                  currPowerState = Characteristic.Active.INACTIVE;
                  currMediaState = Characteristic.CurrentMediaState.STOP; // set media to STOP when power is off
                  break;
                case "OFFLINE": // OFFLINE: power is off, device is not reachable over the network, cannot be turned on by mqtt
                  currStatusActive = Characteristic.Active.INACTIVE; // bool, 0 = not active, 1 = active
                  currPowerState = Characteristic.Active.INACTIVE;
                  currMediaState = Characteristic.CurrentMediaState.STOP; // set media to STOP when power is off
                  break;
                default:
                  // unknown state - log it so we can add support if the platform introduces new states
                  this.log.warn(
                    "mqttClient: STB status: unknown stbState received: %s for %s",
                    stbState,
                    deviceId,
                  );
                  break;
              }
              if (this.debugLevel > 0) {
                this.log.warn("mqttClient: %s %s", deviceId, stbState);
              }
            }
          }

          // handle CPE UI status messages for the STB
          // topic can be many, so look for mqttMessage.type
          // Topic: 107xxxx_ch/vy9hvvxo8n6r1t3f4e05tgg590p8s0
          // Message: {"version":"1.3.10","type":"CPE.uiStatus","source":"3C36E4-EOSSTB-00365657xxxx","messageTimeStamp":1607205483257,"status":{"uiStatus":"mainUI","playerState":{"sourceType":"linear","speed":1,"lastSpeedChangeTime":1607203130936,"source":{"channelId":"SV09259","eventId":"crid:~~2F~~2Fbds.tv~~2F394850976,imi:3ef107f9a95f37e5fde84ee780c834b502be1226"}},"uiState":{}},"id":"fms4mjb9uf"}
          if (mqttMessage.type === "CPE.uiStatus") {
            // deduplicate: the broker delivers CPE.uiStatus on multiple subscribed topics
            // simultaneously (householdId and householdId/mqttClientId). The box generates
            // two messages with slightly different messageTimeStamps (within ~10ms) for the
            // same logical state, so timestamp alone cannot deduplicate. Instead, compare
            // the state fingerprint (channelId + speed + uiStatus) within a 500ms window.
            const uiStatusFingerprint =
              `${mqttMessage.source}|` +
              `${mqttMessage.status?.uiStatus}|` +
              `${mqttMessage.status?.playerState?.source?.channelId}|` +
              `${mqttMessage.status?.playerState?.speed}`;
            const now = Date.now();
            if (
              uiStatusFingerprint === this.lastUiStatusFingerprint &&
              now - this.lastUiStatusFingerprintTime < 500
            ) {
              if (this.debugLevel > 0) {
                this.log.warn(
                  "mqttClient: CPE.uiStatus: duplicate state fingerprint within 500ms, skipping",
                );
              }
              return; // skip - already processed this identical state recently
            }
            this.lastUiStatusFingerprint = uiStatusFingerprint;
            this.lastUiStatusFingerprintTime = now;

            if (this.debugLevel > 0) {
              this.log.warn(
                "mqttClient: CPE.uiStatus received from %s",
                mqttMessage.source,
              );
              this.log.warn(
                "mqttClient: CPE.uiStatus status:",
                mqttMessage.status,
              );
              this.log.warn(
                "mqttClient: CPE.uiStatus status.uiStatus:",
                mqttMessage.status.uiStatus,
              );
            }
            // if we have this message, then the power is on. Sometimes the message arrives before the status topic with the power state
            currStatusActive = Characteristic.Active.ACTIVE; // ensure StatusActive is set to Active
            currPowerState = Characteristic.Active.ACTIVE; // ensure power is set to ON

            this.lastMqttUiStatusMessageReceived = now;
            deviceId = mqttMessage.source;
            const cpeUiStatus = mqttMessage.status;
            // normal TV: 	cpeUiStatus = mainUI
            // app: 		cpeUiStatus = apps (YouTube, Netflix, etc)
            if (this.debugLevel > 0) {
              this.log.warn(
                "mqttClient: CPE.uiStatus: cpeUiStatus:",
                cpeUiStatus,
              );
              /*
                this.log.warn(
                  "mqttClient: CPE.uiStatus: cpeUiStatus.uiStatus:",
                  cpeUiStatus.uiStatus,
                );
                */
            }
            switch (cpeUiStatus.uiStatus) {
              case "mainUI":
                // destructure playerState for cleaner access to nested properties
                const playerState = cpeUiStatus.playerState;
                currSourceType = playerState.sourceType;
                if (this.debugLevel > 1) {
                  this.log.warn(
                    "mqttClient: mainUI: Detected mqtt playerState.speed:",
                    playerState.speed,
                  );
                }

                // get playerState.speed (shows if playing or paused)
                // speed can be one of: -64 -30 -6 -2 0 2 6 30 64. 0=Paused, 1=Play, >1=FastForward, <0=Rewind
                if (playerState.speed === 0) {
                  // speed 0 is PAUSE
                  currMediaState = Characteristic.CurrentMediaState.PAUSE;
                } else if (playerState.speed === 1) {
                  // speed 1 is PLAY
                  currMediaState = Characteristic.CurrentMediaState.PLAY;
                } else {
                  // default for all speeds (-64 -30 -6 2 6 30 64) is LOADING
                  currMediaState = Characteristic.CurrentMediaState.LOADING;
                }

                // get sourceType to set the currInputSourceType and currInputDeviceType
                // playerState.sourceType
                // linear = normal TV
                // reviewbuffer = delayed buffered TV playback
                // replay = replay TV
                // nDVR = playback from saved program (network Digital Video Recorder)
                // lDVR = playback from saved program (local Digital Video Recorder)
                // '' (empty string) = when radio is playing
                switch (playerState.sourceType) {
                  case "linear": // linear: normal tv
                  case "reviewbuffer": // delayed playback
                    currInputDeviceType = Characteristic.InputDeviceType.TV; // linear TV
                    currInputSourceType = Characteristic.InputSourceType.TUNER;
                    break;
                  case "replay": // replay TV
                  case "nDVR": // network DVR
                  case "localDVR": // local DVR
                  case "lDVR": // local DVR
                  case "LDVR": // local DVR
                    currInputDeviceType =
                      Characteristic.InputDeviceType.PLAYBACK; // replay TV
                    currInputSourceType = Characteristic.InputSourceType.OTHER;
                    break;
                  case "": // '' (empty string), happens when radio is playing
                    currInputDeviceType = Characteristic.InputDeviceType.TUNER; // use tuner for radio
                    currInputSourceType = Characteristic.InputSourceType.OTHER;
                    break;
                  default:
                    // unknown sourceType - treat as tuner and log for investigation
                    this.log.warn(
                      "mqttClient: mainUI: unknown sourceType: %s",
                      playerState.sourceType,
                    );
                    currInputDeviceType = Characteristic.InputDeviceType.OTHER;
                    currInputSourceType = Characteristic.InputSourceType.OTHER;
                    break;
                }

                // get channelId (current playing channel eg SV09038) from linear TV
                // Careful: source is not always present in the data
                if (playerState.source) {
                  currChannelId = playerState.source.channelId || NO_CHANNEL_ID; // must be a string
                  currEventId = playerState.source.eventId; // the title (program) id
                  if (this.debugLevel > 0 && this.masterChannelList) {
                    let currentChannelName; // let is scoped to the current {} block
                    let curChannel = this.masterChannelMap?.get(currChannelId);
                    if (curChannel) {
                      currentChannelName = curChannel.name;
                    }
                    this.log.warn(
                      "mqttClient: Detected mqtt channelId: %s [%s]",
                      currChannelId,
                      currentChannelName,
                    );
                  }
                } else {
                  // if playerState.source is null, then the settop box could be playing a radio station
                  // the code will pass a null through the code but no change will occur, so deliberately set a NO_CHANNEL_ID
                  // when playing radio playerState.sourceType='' and playerState.source is null, and a relativePosition=0 appears, this could be maybe used for Radio detection
                  currChannelId = NO_CHANNEL_ID;
                }

                break;

              case "apps":
                //this.log('mqttClient: apps: Detected mqtt app channelId: %s', cpeUiStatus.appsState.id);
                //this.log("mqttClient: apps: Detected mqtt app appName %s", cpeUiStatus.appsState.appName);
                // we get id and appName here, load to the channel list...
                // useful for YouTube and Netflix
                currInputSourceType =
                  Characteristic.InputSourceType.APPLICATION;
                currInputDeviceType = Characteristic.InputDeviceType.OTHER; // apps
                switch (cpeUiStatus.appsState.id) {
                  case "com.bbc.app.launcher":
                  case "com.bbc.app.crb":
                    // ignore the following apps to ensure channel name is not overridden:
                    // com.bbc.app.launcher 	button launcher app??
                    // com.bbc.app.crb 			Connected Red Button app, this is the Red Button special control on the remote
                    currChannelId = null;
                    this.log(
                      "App %s [%s] detected. Ignoring",
                      cpeUiStatus.appsState.id,
                      cpeUiStatus.appsState.appName,
                    );
                    break;

                  default:
                    // check if the app channel exists in the master channel list, if not, push it, using the user-defined name if one exists
                    currChannelId = cpeUiStatus.appsState.id;
                    if (!this.masterChannelMap.has(currChannelId)) {
                      this.log(
                        "App %s detected. Adding to the master channel list at index %s with channelId %s",
                        cpeUiStatus.appsState.appName,
                        this.masterChannelList.length,
                        currChannelId,
                      );
                      const entitlementId =
                        this.entitlements.entitlements[0].id;
                      // for easy identification, make the logicalChannelNumber and channelNumber app10000 + the index number
                      const newAppChannel = {
                        id: currChannelId,
                        name: cleanNameForHomeKit(
                          cpeUiStatus.appsState.appName,
                        ),
                        logicalChannelNumber:
                          10000 + this.masterChannelList.length,
                        linearProducts: entitlementId,
                      };
                      this.masterChannelList.push(newAppChannel);
                      this.masterChannelMap.set(currChannelId, newAppChannel);
                    }
                }
                break;

              default:
            }
          }

          // handle CPE pushToTV messages for the STB
          // seen on VirginMedia connections in GB
          // Topic: 10950xxxx_gb/qc76wses7wfqhox2uqqteoedbyqgtt
          // Message: {	type: 'CPE.pushToTV.rsp',	source: '3C36E4-EOSSTB-003597101009',	id: 'TrgPON8eV8',	version: '1.3.12',	status: [Object]  }:
          // there's also a pullFromTV
          // {"source":"7028f103-8494-4f79-9b76-beb67a2e5caa","type":"CPE.pullFromTV","runtimeType":"pull"}
          if (mqttMessage.type === "CPE.pushToTV.rsp") {
            if (this.debugLevel > 0) {
              this.log.warn(
                "mqttClient: CPE.pushToTV.rsp: received from %s",
                mqttMessage.source,
              );
              this.log.warn(
                "mqttClient: mqttMessage.status",
                mqttMessage.status,
              );
            }
            return; // no state to extract - CPE.uiStatus carries the actual new channel state
          }

          if (deviceId === this.mqttClient.options.clientId) {
            this.log.warn(
              "mqttClient: deviceId same as mqttClientId %s ",
              this.mqttClient.options.clientId,
            );
          }

          // notify HomeKit of the device state
          this.mqttDeviceStateHandler(deviceId, {
            powerState: currPowerState,
            mediaState: currMediaState,
            recState: currRecordingState,
            channelId: currChannelId,
            eventId: currEventId,
            sourceType: currSourceType,
            profileDataChanged: profileDataChanged,
            statusFault: Characteristic.StatusFault.NO_FAULT,
            programMode: null,
            statusActive: currStatusActive,
            inputDeviceType: currInputDeviceType,
            inputSourceType: currInputSourceType,
          });
        } catch (err) {
          // catch all mqtt errors
          this.log.error(
            "Error trapped in mqttClient message event:",
            err.message,
          );
          this.log.error(err);
        }
      }); // end of mqtt client event: message received

      // mqtt client event: close
      // Emitted after a disconnection.
      // https://github.com/mqttjs/MQTT.js#event-close
      this.mqttClient.on("close", () => {
        try {
          // notify HomeKit of the fault state so accessories show as unresponsive
          this.log("mqttClient: Connection closed");
          this.currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
          if (!this.isShuttingDown) {
            this.mqttDeviceStateHandler(null, faultState);
          }
        } catch (err) {
          this.log.error(
            "Error trapped in mqttClient close event:",
            err.message,
          );
          this.log.error(err);
        }
      }); // end of mqtt client event: close

      // mqtt client event: reconnect
      // Emitted when a reconnect starts.
      // https://github.com/mqttjs/MQTT.js#event-reconnect
      this.mqttClient.on("reconnect", () => {
        try {
          // notify HomeKit of the fault state so accessories show as unresponsive
          this.log("mqttClient: Reconnect started");
          this.mqttDeviceStateHandler(null, faultState);
        } catch (err) {
          this.log.error(
            "Error trapped in mqttClient reconnect event:",
            err.message,
          );
          this.log.error(err);
        }
      }); // end of mqtt client event: reconnect

      // mqtt client event: disconnect
      // Emitted after receiving disconnect packet from broker. MQTT 5.0 feature.
      // https://github.com/mqttjs/MQTT.js#event-disconnect
      this.mqttClient.on("disconnect", () => {
        try {
          // notify HomeKit of the fault state so accessories show as unresponsive
          this.log("mqttClient: Disconnect command received");
          this.currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
          this.mqttDeviceStateHandler(null, faultState);
        } catch (err) {
          this.log.error(
            "Error trapped in mqttClient disconnect event:",
            err.message,
          );
          this.log.error(err);
        }
      }); // end of mqtt client event: disconnect

      // mqtt client event: offline
      // Emitted when the client goes offline.
      // https://github.com/mqttjs/MQTT.js#event-offline
      this.mqttClient.on("offline", () => {
        try {
          // notify HomeKit of the fault state so accessories show as unresponsive
          this.log("mqttClient: Client is offline");
          this.currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
          this.mqttDeviceStateHandler(null, faultState);
        } catch (err) {
          this.log.error(
            "Error trapped in mqttClient offline event:",
            err.message,
          );
          this.log.error(err);
        }
      }); // end of mqtt client event: offline

      // mqtt client event: error
      // Emitted when the client cannot connect (i.e. connack rc !== 0) or when a parsing error occurs.
      // https://github.com/mqttjs/MQTT.js#event-error
      this.mqttClient.on("error", (err) => {
        try {
          // notify HomeKit of the fault state so accessories show as unresponsive
          this.log.warn(
            "mqttClient: Error",
            (err.syscall || "") +
              " " +
              (err.code || "") +
              " " +
              (err.hostname || ""),
          );
          this.log.debug("mqttClient: Error object:", err);
          this.currentSessionState = sessionState.DISCONNECTED; // to force a session reconnect
          this.mqttDeviceStateHandler(null, faultState);
          this.mqttClient.end();
        } catch (err) {
          this.log.error(
            "Error trapped in mqttClient error event:",
            err.message,
          );
          this.log.error(err);
        }
      }); // end of mqtt client event: error
    });
  } // end of startMqttClient

  // end the mqtt session cleanly, ensuring all subscribed topics are unsubscribed
  endMqttSession() {
    return new Promise((resolve, reject) => {
      this.log.info("mqttClient: Shutting down...");
      if (!this.mqttClient) {
        this.log.info(
          "mqttClient: mqttClient not initialised, skipping cleanup.",
        );
        return resolve(true);
      }

      if (this.mqttClient.disconnected || this.mqttClient.disconnecting) {
        this.log.info(
          "mqttClient already disconnected or disconnecting, skipping cleanup.",
        );
        return resolve(true);
      }

      // unsubscribe from all subscribedTopics before tearing down the session
      const topics = this.subscribedTopics ?? [];
      if (topics.length === 0) {
        this.log.info(
          "mqttClient: No topics to unsubscribe from, skipping unsubscribe.",
        );
        this.mqttClient.end(false, {}, (err) => {
          if (err) {
            this.log.error("MQTT end error:", err);
            return reject(err);
          }
          this.log.info(
            "mqttClient: Disconnected cleanly. No topics found to unsubscribe from.",
          );
          resolve(true);
        });
        return;
      }

      this.mqttClient.unsubscribe(topics, (err) => {
        if (err) {
          this.log.error("MQTT unsubscribe error:", err);
          // still attempt to end even if unsubscribe failed
        }
        this.mqttClient.end(false, {}, (err) => {
          if (err) {
            this.log.error("MQTT end error:", err);
            return reject(err);
          }
          this.log.info(
            "mqttClient: Disconnected cleanly. All topics unsubscribed.",
          );
          resolve(true);
        });
      });
    });
  }

  // handle the state change of the device, calling the updateDeviceState of the relevant device
  // handles multiple devices by deviceId, should the user have more than one device
  mqttDeviceStateHandler(deviceId, deviceState) {
    if (!deviceState) {
      this.log.error(
        "mqttDeviceStateHandler: deviceState is null or undefined",
      );
      return;
    }

    // capture if the handler was called due to a fault state
    const isFaultBroadcast =
      deviceId === null &&
      deviceState.statusFault === Characteristic.StatusFault.GENERAL_FAULT;

    // only gate on session state for normal updates, not fault broadcasts
    if (
      !isFaultBroadcast &&
      this.currentSessionState !== sessionState.CONNECTED
    ) {
      this.log.warn(
        "mqttDeviceStateHandler: session not connected, skipping update",
      );
      return;
    }

    try {
      // guard against stbDevices not existing yet due to startup
      if (this.stbDevices.length === 0) return;

      if (isFaultBroadcast) {
        // update all devices due to a fault broadcast
        if (this.debugLevel > 0) {
          this.log.warn(
            "mqttDeviceStateHandler: calling updateDeviceState for all devices with fault broadcast",
            deviceId,
            deviceState,
          );
        }
        this.stbDevices.forEach((stbDevice) =>
          stbDevice.updateDeviceState(deviceState),
        );
      } else {
        // update individual physical devices with full status
        // this guards against deviceIds which are virtual devices
        const deviceIndex = this.devices.findIndex(
          (device) => device.deviceId === deviceId,
        );
        if (deviceIndex > -1) {
          if (this.debugLevel > 0) {
            this.log.warn(
              "mqttDeviceStateHandler: calling updateDeviceState with deviceId %s, deviceState %o",
              deviceId,
              deviceState,
            );
          }
          this.stbDevices[deviceIndex].updateDeviceState(deviceState);
        }
      }
    } catch (err) {
      this.log.error("Error trapped in mqttDeviceStateHandler:", err.message);
      this.log.error(err);
    }
  }

  // publish an mqtt message, with logging, to help in debugging
  mqttPublishMessage(Topic, Message, Options) {
    try {
      // Syntax: {'test1': {qos: 0}, 'test2': {qos: 1}}
      if (this.debugLevel > 0) {
        this.log.warn(
          "mqttPublishMessage: Publish Message:\r\nTopic: %s\r\nMessage: %s\r\nOptions: %s",
          Topic,
          Message,
          Options,
        );
      }
      this.mqttClient.publish(Topic, Message, Options, (err) => {
        if (err) {
          // err can be a plain string or an Error object depending on MQTT.js version and broker response
          // use String(err) to safely capture both cases
          const errDetail = err instanceof Error ? err.message : String(err);
          this.log.error(
            "mqttPublishMessage: Failed to publish to %s: %s",
            Topic,
            errDetail,
          );
        } else {
          if (this.debugLevel > 0) {
            this.log.warn("mqttPublishMessage: Published OK to %s", Topic);
          }
        }
      });
    } catch (err) {
      this.log.error("Error trapped in mqttPublishMessage:", err.message);
      this.log.error(err);
    }
  }

  // subscribe to an mqtt topic, with logging, to help in debugging
  mqttSubscribeToTopic(Topic) {
    if (this.debugLevel > 0) {
      this.log.warn("mqttSubscribeToTopic: Subscribe to topic:", Topic);
    }
    this.mqttClient.subscribe(Topic, (err, granted) => {
      if (err) {
        // log full error object to capture broker return code alongside message
        // err can be a plain string or an Error object depending on MQTT.js version and broker response
        // use String(err) to safely capture both cases
        const errDetail = err instanceof Error ? err.message : String(err);
        this.log.error(
          "mqttSubscribeToTopic: Failed to subscribe to %s: %s",
          Topic,
          errDetail,
        );
      } else {
        // granted is an array of {topic, qos} objects confirmed by the broker
        // a granted QoS of 128 means the broker refused the subscription in the SUBACK
        const grantedQos = granted?.[0]?.qos;
        if (grantedQos === 128) {
          // QoS 128 means the broker returned a failure code in the SUBACK
          this.log.error(
            "mqttSubscribeToTopic: Broker rejected subscription to %s (SUBACK QoS 128 = refused)",
            Topic,
          );
        } else {
          this.subscribedTopics.push(Topic);
          if (this.debugLevel > 0) {
            this.log.warn(
              "mqttSubscribeToTopic: Subscribed OK to %s (granted QoS: %s)",
              Topic,
              grantedQos,
            );
          }
        }
      }
    });
  }

  // unsubscribe to an mqtt topic, with logging, to help in debugging
  mqttUnsubscribeToTopic(Topic) {
    if (this.debugLevel > 0) {
      this.log.warn("mqttUnsubscribeToTopic: Unsubscribe from topic:", Topic);
    }
    this.mqttClient.unsubscribe(Topic, (err) => {
      if (err) {
        // err can be a plain string or an Error object depending on MQTT.js version and broker response
        // use String(err) to safely capture both cases
        const errDetail = err instanceof Error ? err.message : String(err);
        this.log.error(
          "mqttUnsubscribeToTopic: Failed to unsubscribe from %s: %s",
          Topic,
          errDetail,
        );
      } else {
        if (this.debugLevel > 0) {
          this.log.warn(
            "mqttUnsubscribeToTopic: Unsubscribed OK from %s",
            Topic,
          );
        }
      }
    });
  }

  // start the HGO session (switch on)
  setHgoOnlineRunning(householdId, mqttClientId) {
    // {"source":"fd29b575-5f2b-49a0-8efe-62a844ac2b40","state":"ONLINE_RUNNING","deviceType":"HGO","mac":"","ipAddress":""}
    const topic = `${householdId}/${mqttClientId}/status`;
    const message = JSON.stringify({
      source: mqttClientId,
      state: "ONLINE_RUNNING",
      deviceType: "HGO",
      mac: "",
      ipAddress: "",
    });
    if (this.debugLevel > 0) {
      this.log.warn("setHgoOnlineRunning: publishing to topic:", topic);
    }
    this.mqttPublishMessage(topic, message, { qos: 2, retain: true });
  }

  // send a channel change request to the settopbox via mqtt
  // using the CPE.pushToTV message
  // the friendlyDeviceName appears on the TV in a popup window
  switchChannel(mqttClientId, deviceId, deviceName, channelId, channelName) {
    try {
      if (this.debugLevel > 0) {
        this.log.warn(
          "switchChannel: channelId %s %s on %s %s",
          channelId,
          channelName,
          deviceId,
          deviceName,
        );
      }
      this.log(
        "Change channel to %s [%s] on %s %s",
        channelId,
        channelName,
        deviceName,
        deviceId,
      );
      if (this.mqttUsername) {
        const topic = `${this.mqttUsername}/${deviceId}`;
        const payload = JSON.stringify({
          id: randomUUID(),
          type: "CPE.pushToTV",
          source: {
            clientId: mqttClientId,
            friendlyDeviceName: "HomeKit",
          },
          status: {
            sourceType: "linear",
            source: { channelId },
            relativePosition: 0,
            speed: 1,
          },
        });
        if (this.debugLevel > 0) {
          this.log.warn("switchChannel: publishing to topic:", topic);
        }
        this.mqttPublishMessage(topic, payload, {
          qos: 2,
          retain: true,
        });
      } else {
        this.log.error("switchChannel: mqttUsername not set, cannot publish");
      }
    } catch (err) {
      this.log.error("Error trapped in switchChannel:", err.message);
      this.log.error(err);
    }
  }

  // set the media state of the settopbox via mqtt
  // media state is controlled by speedRate
  // speedRate can be one of: -64 -30 -6 -2 0 2 6 30 64. 0=Paused, 1=Play, >1=FastForward, <0=Rewind
  setMediaState(deviceId, deviceName, channelId, speedRate) {
    try {
      if (this.debugLevel > 0) {
        this.log.warn(
          "setMediaState: set state to %s for channelId %s on %s %s",
          speedRate,
          channelId,
          deviceId,
          deviceName,
        );
      }
      if (this.mqttUsername) {
        const topic = `${this.mqttUsername}/${deviceId}`;
        const payload = JSON.stringify({
          id: randomUUID(),
          type: "CPE.pushToTV",
          source: {
            clientId: this.mqttClient.options.clientId,
            friendlyDeviceName: "HomeKit",
          },
          status: {
            sourceType: "linear",
            source: { channelId },
            relativePosition: 0,
            speed: speedRate,
          },
        });
        if (this.debugLevel > 0) {
          this.log.warn("setMediaState: publishing to topic:", topic);
        }
        this.log.warn(payload);
        this.mqttPublishMessage(topic, payload, {
          qos: 2,
          retain: true,
        });
      } else {
        this.log.error("setMediaState: mqttUsername not set");
      }
    } catch (err) {
      this.log.error("Error trapped in setMediaState:", err.message);
      this.log.error(err);
    }
  }

  // setPlayerPosition via mqtt
  // move forwards or backwards through the buffer
  // Topic: 107xxxx_ch/3C36E4-EOSSTB-00365657xxxx
  // Message: {"id":"8b8g26joaa","type":"CPE.setPlayerPosition","source":"qcanbxjfg4cq3n99i2lmi94f9nl47v","status":{"relativePosition":410985}}
  // Retain: false, QOS: 0
  setPlayerPosition(deviceId, deviceName, relativePosition) {
    try {
      if (this.debugLevel > 0) {
        this.log.warn("setPlayerPosition: deviceId:", deviceId);
      }
      if (this.mqttUsername) {
        const payload = JSON.stringify({
          id: randomUUID(),
          type: "CPE.setPlayerPosition",
          source: {
            clientId: this.mqttClient.options.clientId,
            friendlyDeviceName: "HomeKit",
          },
          status: {
            relativePosition: relativePosition,
          },
        });
        this.mqttPublishMessage(`${this.mqttUsername}/${deviceId}`, payload, {
          qos: 2,
          retain: true,
        });
      } else {
        this.log.error("setPlayerPosition: mqttUsername not set");
      }
    } catch (err) {
      this.log.error("Error trapped in setPlayerPosition:", err.message);
      this.log.error(err);
    }
  } // end of getMqttToken

  // send a remote control keySequence to the settopbox via mqtt
  async sendKey(deviceId, deviceName, keySequence) {
    try {
      if (this.debugLevel > 0) {
        this.log.warn(
          "sendKey: keySequence %s, deviceName %s, deviceId %s",
          keySequence,
          deviceName,
          deviceId,
        );
      }
      if (this.mqttUsername) {
        let hasJustBooted = false; // indicates if the box just booted up during this keyMacro
        let keyCanBeSkippedAfterBootup = false; // indicates if the current key can be skipped
        let firstNonSkippableKeyFound = false; // indicates if a non-skippable key was found
        let defaultWaitDelayActive = false; // indicates if the default wait delay is being used

        let keyArray = keySequence.trim().split(" ");
        if (keyArray.length > 1) {
          this.log(
            "%s: Send key: processing keySequence for %s: %s",
            deviceName,
            deviceName,
            keySequence,
          );
        }
        // supported key1 key2 key3 wait() wait(100)
        for (let i = 0; i < keyArray.length; i++) {
          const keyName = keyArray[i].trim();
          this.log(
            "%s: Send key: processing key %s of %s: %s",
            deviceName,
            i + 1,
            keyArray.length,
            keyName,
          );
          const defaultWaitDelay = 200; // default 200ms
          const maxWaitDelay = 20000; // default 200ms
          const waitReadyDelayStep = 500; // the ms wait time in each waitReady loop
          const maxWaitReadyLoops = maxWaitDelay / waitReadyDelayStep; // the max loop iterations to wait for ready
          const currKeyIsEscapeOrTvOrWait =
            keyName.toLowerCase().startsWith("wait(") || // current key is a wait
            keyName.toLowerCase() === "escape" || // or current key is an Escape
            keyName.toLowerCase() === "tv"; // or current key is TV
          if (!firstNonSkippableKeyFound && !currKeyIsEscapeOrTvOrWait) {
            firstNonSkippableKeyFound = true; // first non-escape or non-wait key found
          }
          keyCanBeSkippedAfterBootup = false; // reset for each key
          defaultWaitDelayActive = false; // reset for each key

          // for all keys except Power:
          // check if box is ready (up and running), if not, loop until we hit maxWaitDelay, waiting waitReadyDelayStep ms each loop
          // loop only while i < maxWaitReadyLoops and current media state = STOP
          // The device changes CurrentMediaState from STOP to PLAY when it has powered up and is streaming TV
          // CurrentMediaState=STOP only occurs when the set-top box is turned off, so is a good indicator that it is streaming content
          // TEST THIS WITH NETFLIX!
          const deviceIndex = this.devices.findIndex(
            (device) => device.deviceId === deviceId,
          );
          if (keyName.toLowerCase() !== "power") {
            // detect CurrentMediaState=STOP to show box has just booted
            if (
              this.stbDevices[deviceIndex].currentMediaState ===
              Characteristic.CurrentMediaState.STOP
            ) {
              this.log(
                "sendKey: key %s: waiting for ready for %s",
                i + 1,
                deviceName,
              );
              for (
                let j = 0;
                j < maxWaitReadyLoops &&
                this.stbDevices[deviceIndex].currentMediaState ===
                  Characteristic.CurrentMediaState.STOP;
                j++
              ) {
                hasJustBooted = true; // indicates that the box just booted up during this keyMacro
                await wait(waitReadyDelayStep); // wait waitReadyDelayStep ms on each loop
                this.log.debug(
                  "sendKey: key %s: loop %s: wait %s ms done, hasJustBooted %s, currentMediaState %s",
                  i + 1,
                  j,
                  hasJustBooted,
                  waitReadyDelayStep,
                  currentMediaStateName(
                    this.stbDevices[deviceIndex].currentMediaState,
                  ),
                );
              }
              this.log.debug(
                "sendKey: key %s: waiting one more delay of %s ms",
                i + 1,
                waitReadyDelayStep,
              );
              await wait(waitReadyDelayStep); // wait waitReadyDelayStep ms one last time to ensure we have one wait after change from STOP to PLAY
              this.log(
                "%s: Send key: key %s: waiting for ready done, hasJustBooted %s, currentMediaState %s",
                deviceName,
                i + 1,
                hasJustBooted,
                currentMediaStateName(
                  this.stbDevices[deviceIndex].currentMediaState,
                ),
              );
            }
          }

          // check if current key can be skipped.
          // leading Escape and wait keys can be skipped after a bootup to speed up the selection of a radio channel using a scene
          // any skipping must stop when the first non-Escape and non-wait key is found
          this.log.debug(
            "sendKey: key %s: keyArray.length %s, prevKey %s, currKey %s, nextKey %s",
            i + 1,
            keyArray.length,
            keyArray[i - 1],
            keyArray[i],
            keyArray[i + 1],
          );
          if (
            hasJustBooted && // box has just booted
            currKeyIsEscapeOrTvOrWait && // current key is escape or tv or wait
            !firstNonSkippableKeyFound // have not yet found the first non-skippable key
          ) {
            keyCanBeSkippedAfterBootup = true; // we can skip this key as it is a wait or escape
          }

          // to help with debug
          this.log.debug(
            "sendKey: key %s: hasJustBooted %s, currKeyIsEscapeOrTvOrWait %s, firstNonSkippableKeyFound %s, keyCanBeSkippedAfterBootup %s",
            i + 1,
            hasJustBooted,
            currKeyIsEscapeOrTvOrWait,
            firstNonSkippableKeyFound,
            keyCanBeSkippedAfterBootup,
          );

          // process any wait command if found
          // but ignore if keyCanBeSkippedAfterBootup
          let waitDelay;
          if (
            keyName.toLowerCase().startsWith("wait(") &&
            !keyCanBeSkippedAfterBootup
          ) {
            this.log.debug(
              "sendKey: key %s: reading delay from %s",
              i + 1,
              keyName,
            );
            // accepts wait(), wait(n)
            waitDelay = keyName
              .toLowerCase()
              .replace("wait(", "")
              .replace(")", "");
            if (waitDelay === "") {
              waitDelay = defaultWaitDelay;
            } // default wait
            if (waitDelay > maxWaitDelay) {
              waitDelay = maxWaitDelay;
            } // max wait
            this.log.debug(
              "sendKey: key %s: delay read as %s",
              i + 1,
              waitDelay,
            );
          }
          // else if not key can be skipped, and not first key and previous key was not wait, and current key is not wait, then set a default delay of defaultWaitDelay ms
          else if (
            !keyCanBeSkippedAfterBootup &&
            i > 0 &&
            //&& i<keyArray.length-1
            !(keyArray[i - 1] || "").toLowerCase().startsWith("wait(") &&
            !(keyArray[i] || "").toLowerCase().startsWith("wait(")
          ) {
            this.log.debug(
              "sendKey: key %s: not keyCanBeSkippedAfterBootup and not first key and neither previous key %s nor current key %s is wait(). Setting default wait of %s ms",
              i + 1,
              keyArray[i - 1],
              keyArray[i],
              defaultWaitDelay,
            );
            defaultWaitDelayActive = true;
            waitDelay = defaultWaitDelay;
          }

          // add a wait if a waitDelay is set
          //this.log('sendKey: key %s: waitDelay', i+1, waitDelay);
          if (waitDelay) {
            if (!defaultWaitDelayActive) {
              this.log(
                "%s: Send key: key %s: waiting %s ms",
                deviceName,
                i + 1,
                waitDelay,
              );
            } // reduce logging in minimum mode if default wait
            await wait(waitDelay);
            this.log.debug("sendKey: key %s: wait done", i + 1);
          }

          // send the key
          if (hasJustBooted && keyCanBeSkippedAfterBootup) {
            // when a box has just booted, leading Escapes and waits can be skipped until the first non-Escape and non-wait command
            this.log(
              "%s: Send key: key %s: box has just booted, skipping key %s",
              deviceName,
              i + 1,
              keyName,
            );
          } else if (!keyName.toLowerCase().startsWith("wait(")) {
            // send the key if not a wait
            this.log(
              "%s: Send key: key %s: sending key %s to %s %s",
              deviceName,
              i + 1,
              keyName,
              deviceName,
              deviceId,
            );
            // the web client uses qos:2, so we should as well
            // 1076582_ch/3C36E4-EOSSTB-003656579806..
            //{"source":"6a93bac6-5402-42a7-9d8a-c7a93e00e68e","id":"864cf658-2d7b-46eb-a065-6d44c129989f","status":{"w3cKey":"Escape","eventType":"keyDownUp"},"type":"CPE.KeyEvent","runtimeType":"key"}
            const topic = `${this.mqttUsername}/${deviceId}`;
            // format prior to 17.01.2022
            //'{"id":"' + randomUUID() + '","type":"CPE.KeyEvent","source":"' + mqttClientId + '","status":{"w3cKey":"' + keyName + '","eventType":"keyDownUp"}}',
            // format from March 2026:
            /*
            {
              "source": "the client id"",
              "type": "CPE.KeyEvent",
              "runtimeType": "key",
              "id": "the uuid",
              "status": {
                "w3cKey": "Enter",
                "uniCodeChar": null,
                "eventType": "keyDownUp"
              }
            }
            */
            const payload = JSON.stringify({
              source: this.mqttClient.options.clientId,
              type: "CPE.KeyEvent",
              runtimeType: "key",
              id: randomUUID(),
              status: {
                w3cKey: keyName,
                uniCodeChar: null,
                eventType: "keyDownUp",
              },
            });
            this.mqttPublishMessage(topic, payload, { qos: 2, retain: true });
            this.log.debug("sendKey: key %s: send %s done", i + 1, keyName);

            // set the Target Media State after key has been sent
            // check if we need to set target media state to one of PLAY, PAUSE and STOP
            // MediaPlayPause: toggles between PLAY and PAUSE depending on current value of TargetMediaState
            // MediaPlay: sets PLAY
            // MediaPause: sets PAUSE
            // MediaStop: sets STOP
            if (
              !keyCanBeSkippedAfterBootup &&
              [
                "MediaPlayPause",
                "MediaPlay",
                "MediaPause",
                "MediaStop",
              ].indexOf(keyName) >= 0
            ) {
              let targetMediaState;
              switch (keyName) {
                case "MediaPlayPause":
                  // toggle from PLAY to PAUSE and vice versa
                  if (
                    this.stbDevices[deviceIndex].targetMediaState ===
                    Characteristic.TargetMediaState.PLAY
                  ) {
                    targetMediaState = Characteristic.TargetMediaState.PAUSE;
                  } else if (
                    this.stbDevices[deviceIndex].targetMediaState ===
                    Characteristic.TargetMediaState.PAUSE
                  ) {
                    targetMediaState = Characteristic.TargetMediaState.PLAY;
                  }
                  break;

                case "MediaPlay":
                  targetMediaState = Characteristic.TargetMediaState.PLAY;
                  break;

                case "MediaPause":
                  targetMediaState = Characteristic.TargetMediaState.PAUSE;
                  break;

                case "MediaStop":
                  targetMediaState = Characteristic.TargetMediaState.STOP;
                  break;
              }
              // set the target media state via the setTargetMediaState function
              this.stbDevices[deviceIndex].setTargetMediaState(
                targetMediaState,
                true,
              );
            }
          }
        } // end for loop
      } else {
        this.log.error("sendKey: mqttUsername not set");
      }
    } catch (err) {
      this.log.error("Error trapped in sendKey:", err.message);
      this.log.error(err);
    }
  } // end of sendKey

  // get the settopbox UI status from the settopbox via mqtt
  getUiStatus(deviceId, mqttClientId) {
    try {
      if (this.debugLevel > 0) {
        this.log.warn("getUiStatus for deviceId %s", deviceId);
      }
      if (this.mqttUsername) {
        // the web client uses qos:2, so we should as well
        const payload = JSON.stringify({
          source: mqttClientId,
          id: randomUUID(),
          type: "CPE.getUiStatus",
          runtimeType: "getUiStatus",
        });
        this.mqttPublishMessage(`${this.mqttUsername}/${deviceId}`, payload, {
          qos: 2,
          retain: false,
        });
      } else {
        this.log.error("getUiStatus: mqttUsername not set");
      }
    } catch (err) {
      this.log.error("Error trapped in getUiStatus:", err.message);
      this.log.error(err);
    }
  } // end of getUiStatus

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // END session handler mqtt
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
} // end of class StbPlatform

class StbDevice {
  // build the device
  // called using
  // let newStbDevice = new StbDevice(this.log, this.config, this.api, this.devices[i], this.customer, this.entitlements, this);
  //constructor(log, config, api, device, customer, entitlements, platform) {
  constructor(log, config, api, device, platform) {
    this.log = log;
    this.config = config;
    this.api = api;
    this.device = device;
    this.platform = platform;
    this.customer = this.platform.customer;
    this.entitlements = this.platform.entitlements;

    this.deviceId = this.device.deviceId;
    this._configDevice = this._getConfigDevice(); // cache it once, never changes
    this.profileId = -1; // default -1

    // set default name on restart, max 14 char
    // In dev environment, truncate user defined name to ensure DEV is included as a tag for dev environment
    this.name =
      this.device.settings.deviceFriendlyName.substring(
        0,
        SETTOPBOX_NAME_MAXLEN - PLUGIN_ENV.length,
      ) + PLUGIN_ENV; // append DEV environment

    // allow user override of device name via config, but limit to max 14 char
    if (this.config.devices) {
      const configDevice = this._configDevice;
      if (configDevice && configDevice.name) {
        this.name = configDevice.name.substring(0, SETTOPBOX_NAME_MAXLEN);
      }
    }

    // ++++++++++++++++ plugin setup ++++++++++++++++
    // setup arrays
    this.debugLevel = this.config.debugLevel || 0; // debugLevel defaults to 0 (minimum)
    this.channelList = []; // subscribed channels, filtered from the masterChannelList, to be loaded into the Home app. Limited to 96
    this.inputSourceServices = []; // loaded device input source services, used by the accessory, as shown in the Home app. Limited to 95
    this.configuredInputs = []; // a list of inputs that have been renamed by the user. EXPERIMENTAL
    this.displayOrder = [0x00, 0x00]; // valid empty TLV8 terminator — safe default before prepareInputSourceServices runs

    //setup variables
    this.lastPowerKeySent; // stores when the power key was sent last to help in de-bounce
    this.accessoryConfigured; // true when the accessory is configured

    // initial states. Will be updated by mqtt messages
    this.currentStatusFault = Characteristic.StatusFault.NO_FAULT;
    this.currentInUse = Characteristic.InUse.NOT_IN_USE;
    this.currentPowerState = Characteristic.Active.INACTIVE;
    this.previousPowerState = Characteristic.Active.INACTIVE;
    this.currentStatusActive = Characteristic.Active.INACTIVE;

    this.currentChannelId = NO_CHANNEL_ID; // string eg SV09038
    this.currentClosedCaptions = Characteristic.ClosedCaptions.DISABLED;
    this.currentMediaState = Characteristic.CurrentMediaState.STOP;
    this.targetMediaState = Characteristic.TargetMediaState.STOP;
    this.currentPictureMode = Characteristic.PictureMode.STANDARD;
    this.currentRecordingState = recordingState.IDLE;
    this.currentProgramMode = Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED;
    this.currentInputSourceType = Characteristic.InputSourceType.TUNER;
    this.currentInputDeviceType = Characteristic.InputDeviceType.TV;
    this.currentMuteState = false; // default: not muted

    this.lastKeyMacroChannelId = null; // string eg $KeyMacro1

    this.customPictureMode = 0; // default 0
    this.currentSourceType = "UNKNOWN";

    // set defaults for the monitored characteristics
    this.lastRemoteKeyPressed = -1; // holds the last key pressed, -1 = no key
    this.keyPressHistory = new Map();
    this._pendingKeyTimer = null;
    this.lastVolDownKeyPress = [0, 0, 0]; // ensure initialised

    // do an initial accessory channel list update, required to configure the accessory
    // then prepare the accessory
    this.refreshDeviceChannelList(this.deviceId) // async function
      .then(() => {
        // plugin setup done, session and channels loaded, can load the accessory
        this.accessoryConfigured = false;
        this.prepareAccessory();
        this.log("%s: Initialization completed", this.name);
      });

    //this.log('%s: end of StbDevice constructor', this.name);
  } // end of constructor

  //==============================================================
  // ACCESSORY AND SERVICES SETUP
  // This block handles the full lifecycle of preparing a
  // HomeKit accessory and its associated services for the
  // EOSSTB Homebridge plugin.
  //
  // HomeKit service limit: 100 services per accessory.
  // Service allocation:
  //   1  - AccessoryInformation
  //   2  - Television
  //   3  - TelevisionSpeaker
  //   4+ - InputSource (one per channel, up to MAX_INPUT_SOURCES)
  //==============================================================

  /**
   * Prepares and publishes the HomeKit accessory with all required services.
   * Must only run once per device lifetime; guarded by `this.accessoryConfigured`.
   * Called from the session watchdog when the device is ready.
   */
  prepareAccessory() {
    // Trace-level debug logging (level 3+)
    if (this.debugLevel > 1) {
      this.log.warn("%s: prepareAccessory", this.name);
    }

    // Guard: exit immediately if already configured (e.g. called again by watchdog)
    if (this.accessoryConfigured) {
      return;
    }

    this.log("%s: Initializing accessory...", this.name);

    // --- UUID Generation ---
    // UUID is derived from the unique deviceId + environment suffix (debug vs release).
    // This ensures UUID stability across restarts and uniqueness between environments.
    const uuidSeed = this.device.deviceId + PLUGIN_ENV;
    const accessoryUUID = UUID.generate(uuidSeed);

    // --- Accessory Category ---
    // Default to TV_SET_TOP_BOX; allow per-device override via config.
    // Supported categories: speaker, settopbox/stb, television/tv, receiver/audio-receiver/avr
    const configDevice = this._getConfigDevice();
    const accessoryCategory = this._resolveAccessoryCategory(configDevice);

    // --- Create Accessory ---
    // The Accessory constructor also creates a default AccessoryInformation service,
    // which we will remove and replace with our own in prepareAccessoryInformationService().
    this.accessory = new Accessory(this.name, accessoryUUID, accessoryCategory);

    // Persist device and session state on the accessory context for use across sessions
    this.accessory.context.devices = this.devices;
    this.accessory.context.session = this.session;

    // --- Register Services (in order; counts against the 100-service limit) ---
    this.prepareAccessoryInformationService(); // Service 1 of 100
    this.prepareTelevisionService(); // Service 2 of 100
    this.prepareTelevisionSpeakerService(); // Service 3 of 100
    this.prepareInputSourceServices(); // Services 4–100 of 100

    // Publish the fully-configured accessory to HomeKit.
    // IMPORTANT: All services must be added BEFORE publishing.
    // HomeKit will drop and re-discover services if published incomplete.
    this.api.publishExternalAccessories(PLUGIN_NAME, [this.accessory]);
    this.accessoryConfigured = true;

    // --- Post-publish Characteristic Updates ---
    //
    // BEFORE publish: use setCharacteristic() — stores value, no HAP notify fired.
    // AFTER publish:  use updateCharacteristic() — validates value against HAP format/range,
    //                 then emits HAP notify event. Preferred over getCharacteristic().updateValue()
    //                 which skips validation and risks sending malformed values to strict
    //                 clients like Eve.
    //
    // Eve subscribes to HAP notify events rather than polling GET.
    // setCharacteristic() stores the value but does NOT emit a notify event,
    // so Eve never receives it. updateCharacteristic() validates the value
    // and emits the notify event, which is why it must be used post-publish.

    // --- Television service ---

    // DisplayOrder: TLV8 base64-encoded byte array — guard against empty
    if (this.displayOrder?.length) {
      this.televisionService.updateCharacteristic(
        Characteristic.DisplayOrder,
        Buffer.from(this.displayOrder).toString("base64"),
      );
    } else {
      this.log.warn(
        "%s: prepareAccessory: displayOrder is empty, skipping DisplayOrder update",
        this.name,
      );
    }

    this.televisionService.updateCharacteristic(
      Characteristic.ActiveIdentifier,
      1,
    );
    this.televisionService.updateCharacteristic(
      Characteristic.ConfiguredName,
      this.name,
    );
    this.televisionService.updateCharacteristic(
      Characteristic.SleepDiscoveryMode,
      Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE,
    );
    this.televisionService.updateCharacteristic(
      Characteristic.ClosedCaptions,
      Characteristic.ClosedCaptions.DISABLED,
    );
    this.televisionService.updateCharacteristic(
      Characteristic.PictureMode,
      Characteristic.PictureMode.STANDARD,
    );
    this.televisionService.updateCharacteristic(
      Characteristic.ProgramMode,
      Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED,
    );
    this.televisionService.updateCharacteristic(
      Characteristic.StatusActive,
      Characteristic.Active.ACTIVE,
    );
    this.televisionService.updateCharacteristic(
      Characteristic.CurrentMediaState,
      this.currentMediaState,
    );
    this.televisionService.updateCharacteristic(
      Characteristic.TargetMediaState,
      this.targetMediaState,
    );
    this.televisionService.updateCharacteristic(
      Characteristic.InUse,
      Characteristic.InUse.NOT_IN_USE,
    );
    this.televisionService.updateCharacteristic(
      Characteristic.StatusFault,
      Characteristic.StatusFault.NO_FAULT,
    );

    // Custom characteristics (string type, validated as empty string)
    this.televisionService.updateCharacteristic("Active Channel Id", "");
    this.televisionService.updateCharacteristic("Active Channel Name", "");

    // --- InputSource services ---
    for (const inputSourceSvc of this.inputSourceServices) {
      inputSourceSvc.updateCharacteristic(
        Characteristic.ConfiguredName,
        inputSourceSvc.getCharacteristic(Characteristic.ConfiguredName).value,
      );
      inputSourceSvc.updateCharacteristic(
        Characteristic.IsConfigured,
        inputSourceSvc.getCharacteristic(Characteristic.IsConfigured).value,
      );
      inputSourceSvc.updateCharacteristic(
        Characteristic.CurrentVisibilityState,
        inputSourceSvc.getCharacteristic(Characteristic.CurrentVisibilityState)
          .value,
      );
      inputSourceSvc.updateCharacteristic(
        Characteristic.TargetVisibilityState,
        inputSourceSvc.getCharacteristic(Characteristic.TargetVisibilityState)
          .value,
      );
      inputSourceSvc.updateCharacteristic(
        Characteristic.InputDeviceType,
        Characteristic.InputDeviceType.TV,
      );
    }

    // --- Speaker service ---
    this.speakerService.updateCharacteristic(
      Characteristic.Active,
      Characteristic.Active.ACTIVE,
    );
    this.speakerService.updateCharacteristic(
      Characteristic.VolumeControlType,
      Characteristic.VolumeControlType.RELATIVE,
    );
    this.speakerService.updateCharacteristic(
      Characteristic.Mute,
      this.currentMuteState,
    );
  } // end of prepareAccessory

  /**
   * Resolves the HomeKit accessory category from a per-device config override.
   * Falls back to TV_SET_TOP_BOX if no valid category is specified.
   *
   * @param {Object} configDevice - The per-device config object (may be empty {})
   * @returns {Categories} - A HomeKit Categories constant
   */
  _resolveAccessoryCategory(configDevice) {
    if (!configDevice.accessoryCategory) {
      return Categories.TV_SET_TOP_BOX; // Default
    }

    // Map of accepted string values to HomeKit category constants
    const categoryMap = {
      speaker: Categories.SPEAKER,
      settopbox: Categories.TV_SET_TOP_BOX,
      stb: Categories.TV_SET_TOP_BOX,
      television: Categories.TELEVISION,
      tv: Categories.TELEVISION,
      receiver: Categories.AUDIO_RECEIVER,
      "audio-receiver": Categories.AUDIO_RECEIVER,
      avr: Categories.AUDIO_RECEIVER,
    };

    return (
      categoryMap[configDevice.accessoryCategory.toLowerCase()] ??
      Categories.TV_SET_TOP_BOX
    );
  } // end of _resolveAccessoryCategory

  /**
   * Looks up the per-device config entry for `this.deviceId` in `this.config.devices`.
   * Returns an empty object if no match is found or if config.devices is not defined,
   * so callers can safely access properties without null checks.
   *
   * @returns {Object} The matching config device entry, or {}
   */
  _getConfigDevice() {
    if (!this.config.devices) return {};
    return (
      this.config.devices.find((device) => device.deviceId === this.deviceId) ??
      {}
    );
  } // end of _getConfigDevice

  /**
   * Prepares the AccessoryInformation service (Service 1 of 100).
   *
   * Resolves Manufacturer, Model, SerialNumber, and FirmwareRevision from the device ID.
   * OUI = Organizationally Unique Identifier
   * Device IDs are structured as: <OUI>-<DeviceType>-<Serial>
   *   e.g. "3C36E4-EOSSTB-003792xxxxxx"
   *
   * OUI prefix determines hardware vendor:
   *   000378 → HUMAX Co., Ltd.
   *   3C36E4 → ARRIS Group, Inc.
   *   E0B7B1 → ARRIS Group, Inc. (Apollo/Ziggo NL)
   *
   * HomeKit requires: Name, Manufacturer, Model, SerialNumber, FirmwareRevision.
   * FirmwareRevision MUST be a numeric string (e.g. "1.2.3") or it won't display in Home app.
   */
  prepareAccessoryInformationService() {
    if (this.debugLevel > 1) {
      this.log.warn("%s: prepareAccessoryInformationService", this.name);
    }

    const configDevice = this._getConfigDevice();

    // FirmwareRevision: strip any pre-release suffix (e.g. "1.2.3-beta" → "1.2.3")
    // HomeKit will not display non-numeric revision strings
    const ver = PLUGIN_VERSION.split("-");

    // Device ID structure: "<OUI>-<DeviceType>-<Serial>"
    const [oui, deviceType, serialNumber] = this.device.deviceId.split("-");

    // Resolve hardware manufacturer and model from OUI and device type code
    // Unknown OUIs fall through with manufacturer/model as deviceType;
    let manufacturer, model;
    switch (oui) {
      // --- ARRIS Group, Inc. ---
      // OUI 3C36E4: Belgium, Great Britain (TV360)
      // OUI E0B7B1: Ziggo NL Apollo Gateway
      case "3C36E4":
      case "E0B7B1":
        manufacturer = "ARRIS Group, Inc.";
        switch (deviceType) {
          case "APLSTB": // Apollo box (Ziggo NL, ~Jan 2023), label: VIP5002W-ZG
            model = "VIP5002W";
            break;
          case "EOSSTB": // Most common EOS box (Belgium, Ireland, GB)
            model = "DCX960";
            break;
          default:
            model = deviceType;
            break;
        }
        break;

      // --- HUMAX Co., Ltd. ---
      // OUI 000378: Ireland, Great Britain, Switzerland (EOS1008R, 2008C-STB-TN, 2008C-STB-SUNRISE)
      case "000378":
        manufacturer = "HUMAX Co., Ltd.";
        switch (deviceType) {
          case "EOS2STB": // Launched March 2022 (Belgium) — HUMAX 2008C-STB-TN, 2008C-STB-SUNRISE TN & SUNRISE are country specific models
            model = "2008C-STB";
            break;
          case "EOSSTB": // Ireland and GB — HUMAX EOS1008R
            model = "EOS1008R";
            break;
          default:
            model = deviceType;
            break;
        }
        break;

      default:
        manufacturer = deviceType;
    }

    // for the 2008C-STB, append known suffixes of ch=SUNRISE, be=TN only if not already existing
    const modelSuffix = {
      "be-nl": "-TN",
      "be-fr": "-TN",
      ch: "-SUNRISE",
      nl: "-ZG",
      gb: "VM",
    }[this.config.country.toLowerCase()];
    if (modelSuffix && !model.endsWith(modelSuffix)) model += modelSuffix;

    // Append product/device type to model (e.g. "DCX960 [TV360]")
    // GB devices have productType (e.g. "TV360"); CH & NL use deviceType
    // Append platform type to model (e.g. "2008C-STB [EOS]")
    // CH & NL use "EOS" as platformType; GB uses "HORIZON"
    if (model) {
      model = `${model} [${this.device.productType || this.device.deviceType || this.device.platformType || ""}]`;
    }

    // Fallback chain: resolved value → device data → plugin defaults
    manufacturer = manufacturer || PLATFORM_NAME;
    model =
      model || this.device.productType || this.device.deviceType || PLUGIN_NAME;
    const firmwareRevision = configDevice.firmwareRevision || ver[0]; // Must be numeric

    this.log("%s: Set Manufacturer to %s", this.name, manufacturer);
    this.log("%s: Set Model to %s", this.name, model);
    this.log("%s: Set Serial Number to %s", this.name, serialNumber);
    this.log("%s: Set Firmware to %s", this.name, firmwareRevision);

    // Remove the default AccessoryInformation service created by the Accessory constructor,
    // then add a fresh one with our resolved values.
    this.accessory.removeService(
      this.accessory.getService(Service.AccessoryInformation),
    );

    const informationService = this.accessory.addService(
      Service.AccessoryInformation,
    );
    informationService
      .setCharacteristic(Characteristic.Name, this.name)
      .setCharacteristic(Characteristic.Manufacturer, manufacturer)
      .setCharacteristic(Characteristic.Model, model)
      .setCharacteristic(Characteristic.SerialNumber, serialNumber)
      .setCharacteristic(Characteristic.FirmwareRevision, firmwareRevision)
      .setCharacteristic(Characteristic.ConfiguredName, this.name); // required for iOS 18
  } // end of prepareAccessoryInformationService

  /**
   * Prepares the Television service (Service 2 of 100).
   *
   * Registers all standard and custom HomeKit characteristics for TV control:
   *   - Power (Active)
   *   - Active channel (ActiveIdentifier)
   *   - Media state (play/pause/stop)
   *   - Display order, closed captions, picture mode
   *   - Remote key passthrough
   *   - Extra characteristics visible in Shortcuts/Automations
   *
   * Also registers two custom HAP characteristics:
   *   - "Active Channel Id"   (UUID: 00000001-...)
   *   - "Active Channel Name" (UUID: 00000002-...)
   * These appear as "Custom" in the Shortcuts app.
   */
  prepareTelevisionService() {
    if (this.debugLevel > 1) {
      this.log.warn("%s: prepareTelevisionService", this.name);
    }

    // Determine whether to sync the accessory name from the device (default: true)
    const configDevice = this._getConfigDevice();
    const syncName = configDevice.syncName ?? true;

    // --- Create and configure the Television service ---
    // Add service first — characteristics set on an attached service are reliable
    this.televisionService = this.accessory.addService(
      Service.Television,
      this.name, // displayName
      "televisionService", // subtype
    );
    // Now set all characteristics on the already-attached service
    this.televisionService
      .setCharacteristic(Characteristic.ConfiguredName, this.name)
      .setCharacteristic(
        Characteristic.SleepDiscoveryMode,
        Characteristic.SleepDiscoveryMode.ALWAYS_DISCOVERABLE, // Required for external accessories
      )
      .setCharacteristic(
        Characteristic.CurrentMediaState,
        Characteristic.CurrentMediaState.STOP,
      )
      .setCharacteristic(
        Characteristic.TargetMediaState,
        Characteristic.TargetMediaState.STOP,
      )
      .setCharacteristic(
        Characteristic.ClosedCaptions,
        Characteristic.ClosedCaptions.DISABLED,
      )
      .setCharacteristic(
        Characteristic.PictureMode,
        Characteristic.PictureMode.STANDARD,
      )
      // The following extras are exposed in Shortcuts and Home Automations:
      .setCharacteristic(
        Characteristic.StatusFault,
        Characteristic.StatusFault.NO_FAULT, // NO_FAULT or GENERAL_FAULT
      )
      .setCharacteristic(
        Characteristic.InUse,
        Characteristic.InUse.NOT_IN_USE, // NOT_IN_USE or IN_USE
      )
      .setCharacteristic(
        Characteristic.ProgramMode,
        Characteristic.ProgramMode.NO_PROGRAM_SCHEDULED, // NO_PROGRAM_SCHEDULED | PROGRAM_SCHEDULED | PROGRAM_SCHEDULED_MANUAL_MODE
      )
      .setCharacteristic(
        Characteristic.StatusActive,
        Characteristic.Active.ACTIVE, // bool: 0 = inactive, non-zero = active
      );

    // Register handlers
    // --- Characteristics actively controlled in the Apple Home app ---
    // Power on/off
    this.televisionService
      .getCharacteristic(Characteristic.Active)
      .onGet(this.getPower.bind(this))
      .onSet(this.setPower.bind(this));

    // Accessory display name (editable in the Home app)
    // Register handlers once, conditionally apply setProps
    const configuredNameChar = this.televisionService
      .getCharacteristic(Characteristic.ConfiguredName)
      .onGet(this.getDeviceName.bind(this))
      .onSet((newName) => this.setDeviceName(newName));

    if (syncName) {
      // If the user wants to sync the device name, add the maxLen limit to the properties
      // Setting maxLen prevents "Please enter a shorter name" errors in Home
      configuredNameChar.setProps({ maxLen: SETTOPBOX_NAME_MAXLEN });
    }

    // Active channel (input source identifier, 1-based)
    // ActiveIdentifier is 1-based: 1=input1, 2=input2, etc
    // channelList      is 0-based: 0=input1, 1=input2, etc
    this.televisionService
      .getCharacteristic(Characteristic.ActiveIdentifier)
      .onGet(this.getInput.bind(this))
      .onSet((inputIdentifier) => {
        // inputIdentifier is 1-based; channelList is 0-based
        this.setInput(this.channelList[inputIdentifier - 1]);
      });

    // "View TV Settings" menu item in the Home app remote
    this.televisionService
      .getCharacteristic(Characteristic.PowerModeSelection)
      .onSet(this.setPowerModeSelection.bind(this));

    // Channel display order (TLV8 encoded)
    this.televisionService
      .getCharacteristic(Characteristic.DisplayOrder)
      .onGet(this.getDisplayOrder.bind(this))
      .onSet((newDisplayOrder) => this.setDisplayOrder(newDisplayOrder));

    // --- Characteristics NOT controllable in the current Apple Home app ---

    // Closed captions / subtitles
    this.televisionService
      .getCharacteristic(Characteristic.ClosedCaptions)
      .onGet(this.getClosedCaptions.bind(this))
      .onSet(this.setClosedCaptions.bind(this));

    // Screen picture mode
    this.televisionService
      .getCharacteristic(Characteristic.PictureMode)
      .onGet(this.getPictureMode.bind(this))
      .onSet(this.setPictureMode.bind(this));

    // Current playback state (play, pause, stop)
    this.televisionService
      .getCharacteristic(Characteristic.CurrentMediaState)
      .onGet(this.getCurrentMediaState.bind(this));

    // Desired playback state (user-requested)
    this.televisionService
      .getCharacteristic(Characteristic.TargetMediaState)
      .onGet(this.getTargetMediaState.bind(this))
      .onSet((newMediaState) => this.setTargetMediaState(newMediaState, false));

    // --- Extra characteristics (visible in Shortcuts and Automations) ---

    // Fault state (e.g. network connectivity lost)
    this.televisionService
      .getCharacteristic(Characteristic.StatusFault)
      .onGet(this.getStatusFault.bind(this));

    // Whether the set-top box is in active use
    this.televisionService
      .getCharacteristic(Characteristic.InUse)
      .onGet(this.getInUse.bind(this));

    // Current program recording mode
    this.televisionService
      .getCharacteristic(Characteristic.ProgramMode)
      .onGet(this.getProgramMode.bind(this));

    // Whether the accessory is reachable and active
    this.televisionService
      .getCharacteristic(Characteristic.StatusActive)
      .onGet(this.getStatusActive.bind(this));

    // Remote key events (from the Apple TV Remote app)
    this.televisionService
      .getCharacteristic(Characteristic.RemoteKey)
      .onSet(this.setRemoteKey.bind(this));

    // --- Custom HAP Characteristics ---
    // Visible in Shortcuts as "Custom". Uses a plugin-specific UUID namespace
    // based on the ARRIS OUI: 3C36E4-EOSSTB-003656123456
    const BASE_UUID = "-0000-3C36-E400-3C36E4FF0012";

    // Helper to create and register a read-only, notifiable string characteristic
    const addCustomCharacteristic = (name, uuidPrefix, getHandler) => {
      const characteristic = new Characteristic(name, uuidPrefix + BASE_UUID, {
        format: this.api.hap.Formats.STRING,
        perms: [this.api.hap.Perms.PAIRED_READ, this.api.hap.Perms.NOTIFY],
      });
      characteristic.value = ""; // Default empty value required by HomeKit
      characteristic.onGet(getHandler.bind(this));
      this.televisionService.addCharacteristic(characteristic);
      // Retrievable later via: this.televisionService.getCharacteristic(name)
    };

    addCustomCharacteristic(
      "Active Channel Id",
      "00000001",
      this.getActiveChannelId,
    );
    addCustomCharacteristic(
      "Active Channel Name",
      "00000002",
      this.getActiveChannelName,
    );
  } // end of prepareTelevisionService

  /**
   * Prepares the TelevisionSpeaker service (Service 3 of 100).
   *
   * Provides volume and mute control via:
   *   - VolumeSelector: maps iOS hardware volume keys to relative up/down commands (not permitted same time as absolute Volume)
   *   - Volume:         absolute volume level (0–100) (not permitted same time as relative VolumeSelector)
   *   - Mute:           mute toggle (boolean)
   *
   * Must be linked to the Television service so HomeKit associates them.
   */
  prepareTelevisionSpeakerService() {
    if (this.debugLevel > 1) {
      this.log.warn("%s: prepareTelevisionSpeakerService", this.name);
    }

    this.speakerService = this.accessory.addService(
      Service.TelevisionSpeaker,
      `${this.name} Speaker`,
      "speakerService",
    );

    this.speakerService
      .setCharacteristic(Characteristic.Active, Characteristic.Active.ACTIVE)
      .setCharacteristic(
        Characteristic.VolumeControlType,
        Characteristic.VolumeControlType.RELATIVE, // Relative: device handles step size. Supports only VolumeSelector (relative), not Volume (absolute)
      );

    // VolumeSelector: maps iOS volume buttons to relative up/down direction
    this.speakerService
      .getCharacteristic(Characteristic.VolumeSelector)
      .onSet(this.setVolume.bind(this));

    // Active: toggle audio muting if speaker set to inactive
    // 0=INACTIVE, 1=ACTIVE
    // TODO: enabe code and test
    /*
    this.speakerService
      .getCharacteristic(Characteristic.Active)
      .onGet(this.getMute.bind(this))
      .onSet(this.setMute.bind(this));
    */

    // Mute: toggle audio muting
    this.speakerService
      .getCharacteristic(Characteristic.Mute)
      .onGet(this.getMute.bind(this))
      .onSet(this.setMute.bind(this));

    // Link to Television service so HomeKit treats them as a single device
    this.televisionService.addLinkedService(this.speakerService);
  } // end of prepareTelevisionSpeakerService

  /**
   * Prepares InputSource services for each channel (Services 4–100 of 100).
   *
   * HomeKit supports up to 100 services per accessory (including non-input ones).
   * Each channel occupies one InputSource service, capped at MAX_INPUT_SOURCES (default 95).
   * The cap can be lowered per-device via `config.devices[n].maxChannels`.
   *
   * IMPORTANT: All InputSource services MUST be added before publishing the accessory.
   * HomeKit does not support dynamic addition of input sources after publish.
   * Unused slots are registered as hidden/unconfigured placeholders.
   *
   * DisplayOrder is built as a TLV8-encoded byte array during this loop:
   *   Format per entry: [0x01, 0x01, <identifier byte>]
   *   Terminated with:  [0x00, 0x00]
   */
  prepareInputSourceServices() {
    if (this.debugLevel > 1) {
      this.log.warn("%s: prepareInputSourceServices", this.name);
    }

    // Determine the effective channel limit for this device
    const configDevice = this._getConfigDevice();
    const maxSources = configDevice
      ? Math.min(
          configDevice.maxChannels || MAX_INPUT_SOURCES,
          MAX_INPUT_SOURCES,
        )
      : MAX_INPUT_SOURCES;

    this.log.debug(
      "%s: prepareInputSourceServices: maxSources",
      this.name,
      maxSources,
    );
    this.log.debug(
      "%s: prepareInputSourceServices: loading channels from this.channelList, length:",
      this.name,
      this.channelList.length,
    );

    // Reset display order array; will be populated during the loop below
    this.displayOrder = [];

    // channelList Identifiers are 1-based (i=1 is the first input, matching Characteristic.Identifier)
    // i = array index (0-based); Identifier is set to i+1 (1-based) to match ActiveIdentifier (1-based)
    // channelList is zero-based, starting at 0
    for (let i = 0; i < maxSources; i++) {
      // --- Defaults for empty/unused slots ---
      // Unused slots must still be registered but are hidden from the user
      let chFixedName = `Input ${String(i + 1).padStart(2, "0")}`; // 1-based e.g. "Input 01"
      let chName = `HIDDEN${String(i + 1).padStart(2, "0")}`; // 1-based HIDDEN01 etc
      let chId = `HIDDEN${i}`;
      let visState = Characteristic.CurrentVisibilityState.HIDDEN;
      let configState = Characteristic.IsConfigured.NOT_CONFIGURED;
      this.log.debug(
        "%s: prepareInputSourceServices loading channelList index %s input %s: %s",
        this.name,
        i,
        i + 1,
        chFixedName,
      );

      // --- Populate from channelList if a valid entry exists ---
      const channel = this.channelList[i]; // channelList is 0-based
      if (channel) {
        chName = channel.name;
        chId = channel.id;
        visState = channel.visibilityState;
        configState = Characteristic.IsConfigured.CONFIGURED;
      }

      // Channels explicitly named "HIDDEN*" are treated as invisible placeholders
      if (chName.startsWith("HIDDEN")) {
        chId = `HIDDEN${i}`;
        visState = Characteristic.CurrentVisibilityState.HIDDEN;
        configState = Characteristic.IsConfigured.NOT_CONFIGURED;
      }

      // Fixed Name (shown in Home app's input list) can only use the real channel name
      // for the shared profile (profileId === 0), since the order is immutable there.
      // For custom profiles, a generic name is used because the user can reorder channels
      // and HomeKit does not auto-update the fixed Name characteristic.
      if (this.profileId === 0) {
        chFixedName = chName;
      }

      if (this.debugLevel > 2) {
        // log 1 of 95 to 95 of 95 (1-based). i is 0-based
        this.log.warn(
          "%s: prepareInputSourceServices Adding service %s of %s: %s",
          this.name,
          i + 1,
          maxSources,
          chName,
        );
      }

      this.log.debug(
        "%s: prepareInputSourceServices: Adding index %s input %s | chId: %s | chName: [%s] | configState: %s | visState: %s",
        this.name,
        i, // 0-based for index
        i + 1, // 1-based  for input, to match ActiveIdentifier
        chId,
        chName,
        configState,
        visState,
      );

      // --- Create the InputSource service ---
      // Service.InputSource(identifier, subType, name)
      // add first, configure after
      const inputSourceService = this.accessory.addService(
        Service.InputSource,
        chName, // displayName: string, e.g. "BBC One"
        `input_${chId}`, // subtype: unique string identifier
      );
      inputSourceService
        .setCharacteristic(Characteristic.Identifier, i + 1) // Characteristic.Identifier: 1-based
        .setCharacteristic(Characteristic.Name, chFixedName)
        .setCharacteristic(Characteristic.ConfiguredName, chName)
        .setCharacteristic(
          Characteristic.InputSourceType,
          Characteristic.InputSourceType.APPLICATION, // Channels are treated as applications
        )
        .setCharacteristic(
          Characteristic.InputDeviceType,
          Characteristic.InputDeviceType.TV,
        )
        .setCharacteristic(Characteristic.IsConfigured, configState)
        .setCharacteristic(Characteristic.CurrentVisibilityState, visState)
        .setCharacteristic(Characteristic.TargetVisibilityState, visState);

      // --- Characteristic handlers ---

      // ConfiguredName: user-visible channel name (can be renamed in Home app)
      // changed to Read-Only. User is not allowed to edit the name, as the backend service defines the name
      // Omitting PAIRED_WRITE removes the edit option at the HAP protocol level
      inputSourceService
        .getCharacteristic(Characteristic.ConfiguredName)
        .setProps({
          perms: [
            this.api.hap.Perms.PAIRED_READ,
            this.api.hap.Perms.NOTIFY,
          ],
        })
        .onGet(() => this.getInputName(i));
      //.onSet((value) => this.setInputName(i, value));

      // CurrentVisibilityState: whether this input is shown in the channel list
      inputSourceService
        .getCharacteristic(Characteristic.CurrentVisibilityState)
        .onGet(() => this.getInputVisibilityState(i));

      // TargetVisibilityState: desired visibility (user can toggle in Home app)
      inputSourceService
        .getCharacteristic(Characteristic.TargetVisibilityState)
        .onGet(() => this.getInputVisibilityState(i))
        .onSet((value) => this.setInputVisibilityState(i, value));

      this.inputSourceServices.push(inputSourceService);

      // --- Build TLV8 DisplayOrder entry ---
      // Format: [type=0x01, length=0x01, value=identifier & 0xFF]
      // The identifier (1-based) is masked to 8 bits; supports up to 255 inputs.
      // Reference: https://github.com/homebridge/HAP-NodeJS/issues/644
      this.displayOrder.push(0x01, 0x01, (i + 1) & 0xff);

      // Link the service
      this.televisionService.addLinkedService(inputSourceService);
    }

    // Terminate the TLV8 DisplayOrder array with an end-of-list marker
    this.displayOrder.push(0x00, 0x00);
  } // end of prepareInputSourceServices

  //==============================================================
  // END of ACCESSORY AND SERVICES SETUP
  //==============================================================

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // START regular device update functions
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++

  // update the device state changed to async
  async updateDeviceState(deviceState) {
    try {
      const {
        powerState,
        mediaState,
        recState,
        channelId,
        eventId,
        sourceType,
        profileDataChanged,
        statusFault,
        programMode,
        statusActive,
        inputDeviceType,
        inputSourceType,
      } = deviceState;
      // runs at the very start, and then every few seconds, so don't log it unless debugging
      // doesn't get the data direct from the settop box, but rather: gets it from the this.currentPowerState and this.currentChannelId variables
      // which are received by the mqtt messages, which occurs very often
      if (this.debugLevel > 1) {
        this.log.warn(
          "%s: updateDeviceState: supplied deviceState %s",
          this.name,
          deviceState,
        );
      }
      if (this.debugLevel > 1) {
        this.log.warn(
          "%s: updateDeviceState: powerState %s, mediaState %s [%s], recState %s [%s], channelId %s, eventId %s, sourceType %s, profileDataChanged %s, statusFault %s [%s], programMode %s [%s], statusActive %s [%s], inputDeviceType %s [%s], inputSourceType %s [%s]",
          this.name,
          powerState,
          mediaState,
          currentMediaStateName(mediaState),
          recState,
          Object.keys(recordingState)[recState], // custom characteristic
          channelId,
          eventId,
          sourceType,
          profileDataChanged,
          statusFault,
          CHAR_NAMES.StatusFault[statusFault + 1],
          programMode,
          CHAR_NAMES.ProgramMode[programMode + 1],
          statusActive,
          statusActiveName[statusActive],
          inputDeviceType,
          CHAR_NAMES.InputDeviceType[inputDeviceType + 1],
          inputSourceType,
          CHAR_NAMES.InputSourceType[inputSourceType + 1],
        );
      }

      // get the config for the device, needed for a few status checks
      const configDevice = this._configDevice;

      // grab the input variables
      // A small helper — reads clearly at point of use
      const hasValue = (v) => v !== null && v !== undefined;
      if (hasValue(powerState)) this.currentPowerState = powerState;
      if (hasValue(mediaState)) this.currentMediaState = mediaState;
      if (hasValue(recState)) this.currentRecordingState = recState;
      if (hasValue(channelId)) this.currentChannelId = channelId;
      if (hasValue(eventId)) this.currentEventId = eventId;
      if (hasValue(sourceType)) this.currentSourceType = sourceType;
      if (hasValue(statusFault)) this.currentStatusFault = statusFault;
      if (hasValue(programMode)) this.currentProgramMode = programMode;
      if (hasValue(statusActive)) this.currentStatusActive = statusActive;
      if (hasValue(inputDeviceType))
        this.currentInputDeviceType = inputDeviceType;
      if (hasValue(inputSourceType))
        this.currentInputSourceType = inputSourceType;
      this.profileDataChanged = profileDataChanged || false; // already safe

      // force the keyMacro channel if a keyMacro was last selected as the input
      if (this.lastKeyMacroChannelId) {
        this.currentChannelId = this.lastKeyMacroChannelId;
      }

      // set the inUse state as a combination of power state and recording state. Added from v1.2.1
      // 1 (IN_USE) when box is on or is recording to local HDD
      // 0 (NOT_IN_USE) when box is off and not recording to local HDD
      if (
        this.currentPowerState === Characteristic.Active.ACTIVE ||
        this.currentRecordingState === recordingState.ONGOING_LOCALDVR
      ) {
        // 2 = ONGOING_LOCALDVR
        this.currentInUse = Characteristic.InUse.IN_USE;
      } else {
        this.currentInUse = Characteristic.InUse.NOT_IN_USE;
      }

      // profile data is stored on the platform
      // get the currentClosedCaptions from the currently selected profile (stored in this.profileId)
      if (
        this.customer.profiles[this.profileId] &&
        this.customer.profiles[this.profileId].options.showSubtitles
      ) {
        this.currentClosedCaptions = Characteristic.ClosedCaptions.ENABLED;
      } else {
        this.currentClosedCaptions = Characteristic.ClosedCaptions.DISABLED;
      }

      // debugging, helps a lot to see channelName
      if (this.debugLevel > 0) {
        let curChannel, currentChannelName;
        if (this.platform.masterChannelList) {
          curChannel = this.platform.masterChannelMap?.get(
            this.currentChannelId,
          );
          if (curChannel) {
            currentChannelName = curChannel.name;
          }
        }
        this.log.warn(
          "%s: updateDeviceState: currentPowerState %s, currentMediaState %s [%s], currentRecordingState %s [%s], currentChannelId %s [%s], currentSourceType %s, currentClosedCaptions %s [%s], currentPictureMode %s [%s], profileDataChanged %s, currentStatusFault %s [%s], currentProgramMode %s [%s], currentStatusActive %s",
          this.name,
          this.currentPowerState,
          this.currentMediaState,
          currentMediaStateName(this.currentMediaState),
          this.currentRecordingState,
          Object.keys(recordingState)[this.currentRecordingState],
          this.currentChannelId,
          currentChannelName,
          this.currentSourceType,
          this.currentClosedCaptions,
          CHAR_NAMES.ClosedCaptions[this.currentClosedCaptions + 1],
          this.currentPictureMode,
          CHAR_NAMES.PictureMode[this.currentPictureMode + 1],
          this.profileDataChanged,
          this.currentStatusFault,
          CHAR_NAMES.StatusFault[this.currentStatusFault + 1],
          this.currentProgramMode,
          CHAR_NAMES.ProgramMode[this.currentProgramMode + 1],
          this.currentStatusActive,
        );
      }

      // change only if configured, and update only if changed
      if (this.televisionService) {
        // set device name if changed, it may have changed due to personalisation update
        // new name is always in this.device.settings.deviceFriendlyName;
        //this.log('updateDeviceState this.name %s, this.device.settings.deviceFriendlyName %s', this.name, this.device.settings.deviceFriendlyName );
        let oldDeviceName = this.name;
        let currentDeviceName =
          this.device.settings.deviceFriendlyName.substring(
            0,
            SETTOPBOX_NAME_MAXLEN - PLUGIN_ENV.length,
          ) + PLUGIN_ENV; // append DEV environment, limit to 14 chaR

        let syncName = true; // default true
        if (configDevice && configDevice.syncName === false) {
          syncName = configDevice.syncName;
        }
        if (syncName === true && oldDeviceName !== currentDeviceName) {
          this.log(
            "%s: Device name changed from '%s' to '%s'",
            this.name,
            oldDeviceName,
            currentDeviceName,
          );
          this.name = currentDeviceName;
          this.televisionService.updateCharacteristic(
            Characteristic.ConfiguredName,
            currentDeviceName,
          );
        }

        // check for change of StatusFault state
        if (this.previousStatusFault !== this.currentStatusFault) {
          logCharValueChange(
            this.log,
            this.name,
            "Status Fault",
            null,
            this.previousStatusFault,
            CHAR_NAMES.StatusFault[this.previousStatusFault + 1],
            this.currentStatusFault,
            CHAR_NAMES.StatusFault[this.currentStatusFault + 1],
          );
          this.televisionService.updateCharacteristic(
            Characteristic.StatusFault,
            this.currentStatusFault,
          );
          this.previousStatusFault = this.currentStatusFault;
        }

        // check for change of StatusActive state
        if (this.previousStatusActive !== this.currentStatusActive) {
          logCharValueChange(
            this.log,
            this.name,
            "Status Active",
            null,
            this.previousStatusActive,
            statusActiveName[this.previousStatusActive],
            this.currentStatusActive,
            statusActiveName[this.currentStatusActive],
          );
          this.televisionService.updateCharacteristic(
            Characteristic.StatusActive,
            this.currentStatusActive,
          );
          this.previousStatusActive = this.currentStatusActive;
        }

        // check for change of power state
        // The accessory changes state immediately, and the box takes time to catch up
        // so store an old box state so we have something to log
        //this.log("Previous device power state: %s %s", this.previousPowerState, powerStateName[this.previousPowerState]);
        //this.log("Current device power state: %s %s", this.televisionService.getCharacteristic(Characteristic.Active).value, powerStateName[this.televisionService.getCharacteristic(Characteristic.Active).value]);
        //this.log("Wanted device power state: %s %s", this.currentPowerState, powerStateName[this.currentPowerState]);
        //let oldPowerState = this.televisionService.getCharacteristic(Characteristic.Active).value;
        if (this.previousPowerState !== this.currentPowerState) {
          logCharValueChange(
            this.log,
            this.name,
            "Power",
            null,
            this.previousPowerState,
            powerStateName[this.previousPowerState],
            this.currentPowerState,
            powerStateName[this.currentPowerState],
          );
          this.televisionService.updateCharacteristic(
            Characteristic.Active,
            this.currentPowerState,
          );
          this.previousPowerState = this.currentPowerState;
        }

        // check for change of InUse state
        if (this.previousInUse !== this.currentInUse) {
          logCharValueChange(
            this.log,
            this.name,
            "In Use",
            null,
            this.previousInUse,
            CHAR_NAMES.InUse[this.previousInUse + 1],
            this.currentInUse,
            CHAR_NAMES.InUse[this.currentInUse + 1],
          );
          this.televisionService.updateCharacteristic(
            Characteristic.InUse,
            this.currentInUse,
          );
          this.previousInUse = this.currentInUse;
        }

        // check for change of closed captions state
        if (this.previousClosedCaptionsState !== this.currentClosedCaptions) {
          logCharValueChange(
            this.log,
            this.name,
            "Closed Captions",
            null,
            this.previousClosedCaptionsState,
            CHAR_NAMES.ClosedCaptions[this.previousClosedCaptionsState + 1],
            this.currentClosedCaptions,
            CHAR_NAMES.ClosedCaptions[this.currentClosedCaptions + 1],
          );
          this.televisionService.updateCharacteristic(
            Characteristic.ClosedCaptions,
            this.currentClosedCaptions,
          );
          this.previousClosedCaptionsState = this.currentClosedCaptions;
        }

        // check for change of picture mode or recordingState (both stored in picture mode)
        // PictureMode is used for default function: pictureMode
        if (this.previousPictureMode !== this.currentPictureMode) {
          logCharValueChange(
            this.log,
            this.name,
            "Picture Mode",
            null,
            this.previousPictureMode,
            CHAR_NAMES.PictureMode[this.previousPictureMode + 1],
            this.currentPictureMode,
            CHAR_NAMES.PictureMode[this.currentPictureMode + 1],
          );
          this.televisionService.updateCharacteristic(
            Characteristic.PictureMode,
            this.customPictureMode,
          );
          this.previousPictureMode = this.currentPictureMode;
        }

        // check for change of ProgramMode
        if (this.previousProgramMode !== this.currentProgramMode) {
          logCharValueChange(
            this.log,
            this.name,
            "Program Mode",
            null,
            this.previousProgramMode,
            CHAR_NAMES.ProgramMode[this.previousProgramMode + 1],
            this.currentProgramMode,
            CHAR_NAMES.ProgramMode[this.currentProgramMode + 1],
          );
          this.televisionService.updateCharacteristic(
            Characteristic.ProgramMode,
            this.currentProgramMode,
          );
          this.previousProgramMode = this.currentProgramMode;
        }

        // check for change of ActiveIdentifier (channel, 1-based)
        // temporarily wrapped this in a try-catch to capture any errors
        //this.log("Before error trap");
        let searchChannelId = this.currentChannelId; // this.currentChannelId is a string eg SV09038
        let currentActiveIdentifier = NO_INPUT_ID;
        try {
          // if the current channel id is an app, search by channel name name, and not by channel id
          if (searchChannelId && searchChannelId.includes(".app.")) {
            // the current channel is an app, eg Netflix
            this.log(
              "This channel is an app, looking for this app in the masterChannelList: ",
              searchChannelId,
            );
            // get the name from the master channel list
            let masterChannelApp =
              this.platform.masterChannelMap.get(searchChannelId);
            //this.log("found masterChannelApp", masterChannelApp)
            // now look again in the master channel list to find this channel with the same name but not an app id
            if (masterChannelApp) {
              //this.log("looking for channel with same name in the masterChannelList: looking for %s", masterChannelApp.name)
              //let masterChannelByName = this.platform.masterChannelList.find(channel => channel.name === masterChannelApp.name );
              //this.log("found masterChannel", masterChannelByName)
              //this.log("looking for channel with same name but different channelId in the masterChannelList: looking for %s where channelId is not %s", masterChannelApp.name, masterChannelApp.id)
              let masterChannel = this.platform.masterChannelList.find(
                (channel) =>
                  channel.name === masterChannelApp.name &&
                  channel.id !== masterChannelApp.id,
              );
              if (masterChannel) {
                searchChannelId = masterChannel.id;
              }
            }
          }
        } catch (err) {
          this.log.error(
            "Error trapped in updateDeviceState while setting searchChannelId:",
            err.message,
          );
          this.log.error(err);
          this.log.error("Further debug info:");
          this.log.error("this.currentChannelId", this.currentChannelId);
          this.log.error("searchChannelId", searchChannelId);
        }
        //this.log("After error trap. searchChannelId:", searchChannelId);

        // search by subtype in the inputSourceServices array, index 0 = input 1, subtype: 'input_SV09038',
        // ActiveIdentifier: 1-based: 1=Input1, 2=Input2, etc
        // channelList:      0-based: 0=index0, 1=index1, etc
        // Single scan: reused for both ActiveIdentifier and InputDeviceType/InputSourceType updates below.
        // searchChannelId equals this.currentChannelId except when an app ID has been remapped,
        // in which case the remapped ID is the correct one to locate in inputSourceServices.
        let currInputIndex = this.inputSourceServices.findIndex(
          (InputSource) => InputSource.subtype === "input_" + searchChannelId,
        );
        // if nothing found, set to NO_INPUT_ID to clear the name from the Home app tile
        currentActiveIdentifier =
          currInputIndex >= 0 ? currInputIndex + 1 : NO_INPUT_ID;
        let currInputNumber = currInputIndex >= 0 ? currInputIndex + 1 : null;
        if (currInputIndex < 0) currInputIndex = null;

        if (this.previousActiveIdentifier !== currentActiveIdentifier) {
          // get names from loaded channel list. Using Ch Up/Ch Down buttons on the remote rolls around the profile channel list
          // what happens if the TV is changed to another profile?
          let oldName = NO_CHANNEL_NAME,
            newName = oldName; // default to UNKNOWN
          if (
            this.previousActiveIdentifier !== NO_INPUT_ID &&
            this.channelList[this.previousActiveIdentifier - 1]
          ) {
            oldName = this.channelList[this.previousActiveIdentifier - 1].name;
          }

          if (
            currentActiveIdentifier !== NO_INPUT_ID &&
            this.channelList[currentActiveIdentifier - 1]
          ) {
            newName = this.channelList[currentActiveIdentifier - 1].name;
          }
          logCharValueChange(
            this.log,
            this.name,
            "Channel",
            null,
            this.previousActiveIdentifier,
            oldName,
            currentActiveIdentifier,
            newName,
          );
          this.televisionService.updateCharacteristic(
            Characteristic.ActiveIdentifier,
            currentActiveIdentifier,
          );
          this.previousActiveIdentifier = currentActiveIdentifier;
        }

        // +++++++++++++++ Input Service characteristics ++++++++++++++
        /*
				inputService
				.setCharacteristic(Characteristic.Identifier, i)
				.setCharacteristic(Characteristic.Name, chFixedName)
				.setCharacteristic(Characteristic.ConfiguredName, chName)
				.setCharacteristic(Characteristic.InputSourceType, Characteristic.InputSourceType.APPLICATION) 
				.setCharacteristic(Characteristic.InputDeviceType, Characteristic.InputDeviceType.TV)
				.setCharacteristic(Characteristic.IsConfigured, configState)
				.setCharacteristic(Characteristic.CurrentVisibilityState, visState)
				.setCharacteristic(Characteristic.TargetVisibilityState, visState);
				*/
        // check for change of InputDeviceType state: (a characteristic of Input Source)
        //this.log('found input index %s input %s subtype %s', currInputIndex, currInputIndex+1, (this.inputSourceServices[currInputIndex] || {}).subtype)
        if (this.previousInputDeviceType !== this.currentInputDeviceType) {
          logCharValueChange(
            this.log,
            this.name,
            "Input Device Type",
            currInputNumber + " " + this.currentChannelId,
            this.previousInputDeviceType,
            CHAR_NAMES.InputDeviceType[this.previousInputDeviceType + 1],
            this.currentInputDeviceType,
            CHAR_NAMES.InputDeviceType[this.currentInputDeviceType + 1],
          );
          if (currInputIndex !== null) {
            this.inputSourceServices[currInputIndex].updateCharacteristic(
              Characteristic.InputDeviceType,
              this.currentInputDeviceType,
            );
          }
          this.previousInputDeviceType = this.currentInputDeviceType;
        }

        // check for change of InputSourceType state: (a characteristic of Input Source)
        if (this.previousInputSourceType !== this.currentInputSourceType) {
          logCharValueChange(
            this.log,
            this.name,
            "Input Source Type",
            currInputNumber + " " + this.currentChannelId,
            this.previousInputSourceType,
            CHAR_NAMES.InputSourceType[this.previousInputSourceType + 1],
            this.currentInputSourceType,
            CHAR_NAMES.InputSourceType[this.currentInputSourceType + 1],
          );
          if (currInputIndex !== null) {
            this.inputSourceServices[currInputIndex].updateCharacteristic(
              Characteristic.InputSourceType,
              this.currentInputSourceType,
            );
          } // generates Homebridge warning
          this.previousInputSourceType = this.currentInputSourceType;
        }

        // +++++++++++++++ end of Input Service characteristics ++++++++++++++

        // check for change of current media state
        if (this.previousMediaState !== this.currentMediaState) {
          logCharValueChange(
            this.log,
            this.name,
            "Media State",
            null,
            this.previousMediaState,
            currentMediaStateName(this.previousMediaState),
            this.currentMediaState,
            currentMediaStateName(this.currentMediaState),
          );
          // set targetMediaState to same as currentMediaState as long as currentMediaState is <= 2 (supports 0 PLAY, 1 PAUSE, 2 STOP)
          if (this.currentMediaState <= Characteristic.TargetMediaState.STOP) {
            this.targetMediaState = this.currentMediaState;
            this.televisionService.updateCharacteristic(
              Characteristic.TargetMediaState,
              this.targetMediaState,
            );
          }
          this.televisionService.updateCharacteristic(
            Characteristic.CurrentMediaState,
            this.currentMediaState,
          );
          this.previousMediaState = this.currentMediaState;
        }

        // check for change of profile
        if (this.profileDataChanged) {
          this.log("%s: Profile data changed", this.name);
          this.refreshDeviceChannelList();
        }
      }
      return null;
    } catch (err) {
      this.log.error("Error trapped in updateDeviceState:", err.message);
      this.log.error(err);
      this.log.error("Further debug info:");
      this.log.error("this.currentPowerState", this.currentPowerState);
      this.log.error("this.currentMediaState", this.currentMediaState);
      this.log.error("this.currentChannelId", this.currentChannelId);
      this.log.error("this.currentSourceType", this.currentSourceType);
      this.log.error("this.currentRecordingState", this.currentRecordingState);
      this.log.error("this.profileDataChanged", this.profileDataChanged);
    }
  } // end of updateDeviceState

  // refresh the channel list that shows in the Home app
  async refreshDeviceChannelList() {
    try {
      if (this.debugLevel > 1) {
        this.log.warn("%s: refreshDeviceChannelList", this.name);
      }
      this.log("%s: Refreshing device channel list...", this.name);
      //this.log("%s: Refreshing channel list: CURRENTLY DISABLED AS MASTER CHANNEL LIST not yet BUILT", this.name);
      //return;

      // exit if no session exists
      if (this.platform.currentSessionState !== sessionState.CONNECTED) {
        if (this.debugLevel > 1) {
          this.log.warn(
            "%s: refreshDeviceChannelList: Session not yet created, exiting",
            this.name,
          );
        }
        return;
      }

      // exit if no master channel list loaded yet (on platform level)
      if (!this.platform.masterChannelList) {
        if (this.debugLevel > 1) {
          this.log.warn(
            "%s: refreshDeviceChannelList: master channel list not yet loaded, exiting",
            this.name,
          );
        }
        return;
      }

      // limit the amount of max channels to load as Apple HomeKit is limited to 100 services per accessory.
      // if a config exists for this device, read the users configured maxSources, if it exists
      const configDevice = this._configDevice;
      const maxChannels = configDevice.maxChannels;
      const maxSources = maxChannels
        ? Math.min(maxChannels, MAX_INPUT_SOURCES)
        : MAX_INPUT_SOURCES;

      // get a user configured Profile, if it exists, otherwise we will use the default Profile for the channel list
      let wantedProfile;
      if (this.debugLevel > 1) {
        this.log.warn("%s: Getting profile data from config", this.name);
      }
      // homebridge config for this device was found, get the profile item if the name exists in the published profiles
      wantedProfile = this.customer.profiles.find(
        (profile) => profile.name === configDevice.profile,
      );
      if (wantedProfile) {
        if (this.debugLevel > 1) {
          this.log.warn(
            "%s: Configured profile found: '%s'",
            this.name,
            configDevice.profile,
          );
        }
      }

      // fallback to default profile if no user profile found
      if (!wantedProfile) {
        // no profile found, use the default profile
        wantedProfile = this.customer.profiles.find(
          (profile) => profile.profileId === this.device.defaultProfileId,
        );
        if (!wantedProfile) {
          this.log.error(
            "%s: No default profile found for deviceId %s, cannot refresh channel list",
            this.name,
            this.device.deviceId,
          );
          return;
        }

        if (this.debugLevel > 1) {
          this.log.warn(
            "%s: No user-configured profile found, reverting to default profile: '%s'",
            this.name,
            wantedProfile.name,
          );
        }
      }

      // now load the mostWatched list for this profile
      await this.getMostWatchedChannels(wantedProfile.profileId);

      // get the wanted profile configured on the stb
      this.profileId = wantedProfile.profileId;
      //this.log.warn("%s: Profile '%s' last modified at %s", this.name, wantedProfile.name, wantedProfile.lastModified);

      // load the subscribedChIds array from the favoriteChannels of the wantedProfile, in the order shown
      // Note: favoriteChannels is allowed to be empty!
      // Note: the shared profile contains no favorites
      const lastModeDate = new Date(wantedProfile.lastModified);
      this.log(
        "%s: Profile '%s' contains %s channels, profile last modified on %s",
        this.name,
        wantedProfile.name,
        wantedProfile.favoriteChannels.length,
        lastModeDate.toLocaleString(),
      );
      let subscribedChIds = []; // an array of channelIds: SV00302, SV09091, etc
      if (wantedProfile.favoriteChannels.length > 0) {
        if (this.debugLevel > 1) {
          this.log.warn(
            "%s: Loading channels from profile '%s' into the subscribedChIds",
            this.name,
            wantedProfile.name,
          );
          this.log.warn(
            "%s: Most watched list length",
            this.name,
            (this.mostWatched || []).length,
          );
        }
        // check channelOrder: new config item added in v2, config item may not exist for older users.
        //let debugChannelorder = (configDevice.channelOrder || 'channelOrder')
        //this.log.warn("%s: DEBUG debugChannelorder", this.name, debugChannelorder)
        if (
          (configDevice.channelOrder || "channelOrder") === "mostWatched" &&
          (this.mostWatched || []).length > 0
        ) {
          // load by mostWatched sort order
          if (this.debugLevel > 1) {
            this.log.warn(
              "%s: Loading channel using most watched sort order",
              this.name,
            );
          }
          // convert favoriteChannels into a Set once before the loop. A Set has O(1) lookup, so the whole operation becomes O(n).
          const favoriteChannelsSet = new Set(wantedProfile.favoriteChannels);
          this.mostWatched.forEach((mostWatchedChannelId) => {
            if (favoriteChannelsSet.has(mostWatchedChannelId)) {
              if (this.debugLevel > 2) {
                this.log.warn(
                  "%s: Loading channel using most watched sort order. Channel %s found, loading at index %s",
                  this.name,
                  mostWatchedChannelId,
                  subscribedChIds.length,
                );
              }
              subscribedChIds.push(mostWatchedChannelId);
            }
          });
        } else {
          // load by standard sort order
          if (this.debugLevel > 1) {
            this.log.warn(
              "%s: Loading channel using standard sort order",
              this.name,
            );
          }
          if (this.debugLevel > 1) {
            wantedProfile.favoriteChannels.forEach((channel, idx) => {
              this.log.warn(
                "%s: Loading channel using standard sort order. Channel %s found, loading at index %s",
                this.name,
                channel,
                idx,
              );
            });
          }
          subscribedChIds = [...wantedProfile.favoriteChannels];
        }
      }
      if (this.debugLevel > 1) {
        this.log.warn(
          "%s: subscribedChIds.length: %s",
          this.name,
          subscribedChIds.length,
        );
        this.log.warn("%s: subscribedChIds %s", this.name, subscribedChIds);
      }

      // if the subscribedChIds is empty, load the channels from the master channel list
      // sorted by logicalChannelNumber, including only entitled channels
      if (subscribedChIds.length === 0) {
        if (this.debugLevel > 1) {
          this.log(
            "%s: Profile '%s' contains 0 favorite channels. Channel list will be loaded from master channel list",
            this.name,
            wantedProfile.name,
          );
        }
        // get a clean list of entitled channels (will not be in correct order)
        // some entitlements are not in the masterchannelList, these must be ignored
        //if (this.debugLevel > 1) { this.log.warn("%s: Checking %s entitlements within %s channels in the master channel list", this.name, this.platform.session.entitlements.length, this.platform.masterChannelList.length); }

        // entitlements needs to be reworked, currently load everything
        //this.log.warn("%s: Loading all channels into the subscribedChIds", this.name)
        //this.log.warn("%s: masterChannelList.length", this.name, this.platform.masterChannelList.length)
        //this.log.warn("%s: this.entitlements %s", this.name, this.entitlements)
        //this.log.warn("%s: this.platform.entitlements.entitlements %s", this.name, this.platform.entitlements.entitlements)
        // build Set once BEFORE the masterChannelList.forEach loop:
        const entitlementIdSet = new Set(
          this.platform.entitlements.entitlements.map((e) => e.id),
        );

        this.platform.masterChannelList.forEach((channel) => {
          // check entitlements of this channel
          // channel.linearProducts is an array of entitlement codes assigned to a channel, each channel can have multiple entitlement codes
          // linearProducts: [ '601007005' ],
          // this.platform.entitlements.entitlements is an array of entitlement codes that the household has subscribed to
          // [{ casIndicator: 0, id: '600000001' }, { casIndicator: 0, id: '600000080' }, { casIndicator: 1, id: '600000070' }, { casIndicator: 1, id: '600000300' }]
          // control channel: SV09038 SRF 1 HD (entitled), with "linearProducts": [ '100000000', '100000001', '600000300'	],
          // control channel: SV06321 Nicktoons (not entitled), with linearProducts: [ '601007005' ],
          this.log.debug(
            "%s: checking entitlements for %s %s",
            this.name,
            channel.id,
            channel.name,
          );
          this.log.debug(
            "%s: channel.linearProducts %s",
            this.name,
            channel.linearProducts,
          );
          const isEntitled = channel.linearProducts.some((id) =>
            entitlementIdSet.has(id),
          );
          if (isEntitled) {
            subscribedChIds.push(channel.id);
            this.log.debug(
              "%s: %s %s is entitled, pushed to subscribedChIds, subscribedChIds.length now %s",
              this.name,
              channel.id,
              channel.name,
              subscribedChIds.length,
            );
          }
        });
        this.log.debug(
          "%s: subscribedChIds.length",
          this.name,
          subscribedChIds.length,
        );
      }
      if (this.debugLevel > 1) {
        this.log(
          "%s: Subscribed channel list loaded with %s channels",
          this.name,
          subscribedChIds.length,
        );
      }

      // recently viewed apps
      if (this.debugLevel > 1) {
        this.log.warn(
          "%s: refreshDeviceChannelList: recentlyUsedApps",
          this.name,
          wantedProfile.recentlyUsedApps,
        );
      }

      ////////////////////////////////////////////////////////
      // load the input list
      ////////////////////////////////////////////////////////

      // clear the array
      this.channelList = [];

      // check for any custom keymacros, they consume slots at the end of the channelList
      this.log.debug("%s: Checking for KeyMacros", this.name);
      let keyMacros = [];
      if (this.config.channels) {
        keyMacros = this.config.channels.filter((ch) => ch.channelKeyMacro);
        this.log.debug("%s: Found keyMacros: %s", this.name, keyMacros.length);
      }

      // limit the amount to load to all the channels and all the keyMacros
      // keyMacros will occupy top slots of channel list
      const maxChs = Math.min(
        subscribedChIds.length + keyMacros.length,
        maxSources,
      );
      const firstKeyMacroSlot = Math.max(maxChs - keyMacros.length, 0); // never go below index 0
      //this.log("%s: Loading %s channels, starting at channel 1", this.name, subscribedChIds.length);
      this.log(
        "%s: Loading %s key macros, starting at channel %s ",
        this.name,
        keyMacros.length,
        firstKeyMacroSlot + 1,
      );

      // show log of what will be loaded, very useful for debugging
      this.log("%s: Refreshing channels 1 to %s", this.name, maxChs);
      if (maxChs < maxSources) {
        this.log(
          "%s: Hiding     channels %s to %s",
          this.name,
          maxChs + 1,
          maxSources,
        );
      }

      // loop and load all channels from the subscribedChIds in the order defined by the array
      //this.log("Loading all subscribed channels")
      const configChannelMap = new Map(
        (this.config.channels || []).map((ch) => [ch.id, ch]),
      );

      for (let i = 0; i < maxChs; i++) {
        //subscribedChIds.forEach((subscribedChId, i) => {
        //this.log("In forEach loop, processing index %s %s", i, subscribedChId)

        // find the channel to load.
        const chNum = String(i + 1).padStart(2, "0");
        const chPrefix = chNum + " ";
        let channel = {};
        let k = 0;

        const rawCustomChannel = configChannelMap.get(subscribedChIds[i]);
        const customChannel = rawCustomChannel?.name
          ? {
              ...rawCustomChannel,
              name: cleanNameForHomeKit(rawCustomChannel.name),
            }
          : null;

        // load a channel if we are in the range of channel numbers not assigned to keymacros
        if (i < firstKeyMacroSlot) {
          // this slot needs to be occupied by a channel

          // check if the subscribedChId exists in the master channel list, if not, push it, using the user-defined name if one exists, and channelNumber >10000
          this.log.debug(
            "%s: Index %s: Finding %s in master channel list",
            this.name,
            i,
            subscribedChIds[i],
          );
          channel = this.platform.masterChannelMap.get(subscribedChIds[i]);
          if (!channel) {
            const newChannel = {
              id: subscribedChIds[i],
              name: customChannel?.name || "Channel " + subscribedChIds[i],
              logicalChannelNumber:
                10000 + this.platform.masterChannelList.length,
              linearProducts: this.platform.entitlements.entitlements[0].id,
            };
            newChannel.configuredName = newChannel.name;
            this.log(
              "%s: Unknown channel %s [%s] discovered. Adding to the master channel list",
              this.name,
              newChannel.id,
              newChannel.name,
            );
            // refresh channel as the not found channel will now be in the masterChannelList
            this.platform.masterChannelList.push(newChannel);
            this.platform.masterChannelMap.set(subscribedChIds[i], newChannel);
            channel = newChannel;
          } else {
            // show some useful debug data
            this.log.debug(
              "%s: Index %s: Found %s %s in master channel list",
              this.name,
              i,
              channel.id,
              channel.name,
            );
          }
          this.log.debug(
            "%s: Index %s: Loading channel %s %s",
            this.name,
            i,
            i + 1,
            channel.name,
          );
        } else {
          // this slot needs to be occupied by a keyMacro
          k = i - firstKeyMacroSlot;
          this.log.debug(
            "%s: Index %s: Loading channel %s keyMacro %s %s",
            this.name,
            i,
            i + 1,
            k + 1,
            keyMacros[k].channelName,
          );
          this.log.debug(
            "%s: Index %s: Load this keyMacro: %s",
            this.name,
            i,
            keyMacros[k],
          );
          channel = {
            id: "$KeyMacro" + (k + 1),
            name: keyMacros[k].channelName,
            logicalChannelNumber: 20000 + i,
            linearProducts: 0,
            keyMacro: keyMacros[k].channelKeyMacro,
          };
        }

        // load this channel/keyMacro as an input
        //this.log("loading input %s of %s", i + 1, maxChs)
        //this.log.warn("%s: Index %s: Checking if %s %s can be loaded", this.name, i, channel.id, channel.name);
        this.log.debug("%s: Index %s: Refreshing channel", this.name, i);

        // add the user-defined name if one exists
        if (customChannel && customChannel.name) {
          channel.name = customChannel.name;
        }

        // show channel number if user chose to do so
        // must only happen once!
        if ((configDevice || {}).showChannelNumbers) {
          // a config exists. Add channel number prefix only if the prefix does not exist
          if (
            !channel.configuredName ||
            channel.configuredName.slice(0, chPrefix.length) !== chPrefix
          ) {
            channel.configuredName = chPrefix + channel.name;
          }
        } else {
          channel.configuredName = channel.name;
        }

        // add channel visibilitystate, doesn't exist on the master channel list
        // TODO these should be read from file...
        channel.visibilityState = Characteristic.CurrentVisibilityState.SHOWN;

        // show debug and add to array
        this.log.debug(
          "%s: Index %s: Refreshing channel %s: %s [%s]",
          this.name,
          i,
          chNum,
          channel.id,
          channel.name,
        );
        this.channelList[i] = channel;

        // update accessory only when configured, as this.inputSourceServices[i] can only be updated when it exists
        if (this.accessoryConfigured) {
          // update existing services
          if (this.debugLevel > 2) {
            this.log.warn(
              "Adding %s %s to input %s at index %s",
              channel.id,
              channel.name,
              i + 1,
              i,
            );
          }
          this.inputSourceServices[i].name = channel.configuredName;
          this.inputSourceServices[i].subtype = "input_" + channel.id; // string, input_SV09038 etc

          // Name can only be set for SharedProfile where order can never be changed
          if (this.profileId === 0) {
            this.inputSourceServices[i].updateCharacteristic(
              Characteristic.Name,
              channel.name,
            ); // stays unchanged at Input 01 etc
          }
          this.inputSourceServices[i]
            .updateCharacteristic(
              Characteristic.ConfiguredName,
              channel.configuredName,
            )
            .updateCharacteristic(
              Characteristic.CurrentVisibilityState,
              channel.visibilityState,
            )
            .updateCharacteristic(
              Characteristic.IsConfigured,
              Characteristic.IsConfigured.CONFIGURED,
            );
          //inputService.updateCharacteristic(Characteristic.CurrentVisibilityState, Characteristic.TargetVisibilityState.SHOWN);
          //this.log.warn('this.inputSourceServices[i]')
          //this.log.warn(this.inputSourceServices[i])
        }
      }

      // after loading all the channels, reset the ActiveIdentifier (uint32) to the right Identifier (uint32), as it may have moved slots
      // subtype: 'input_SV09038',
      const currentInputIndex = this.inputSourceServices.findIndex(
        (ch) => ch.subtype === "input_" + this.currentChannelId,
      );
      if (currentInputIndex !== -1) {
        this.televisionService.updateCharacteristic(
          Characteristic.ActiveIdentifier,
          currentInputIndex + 1,
        );
      } else if (this.televisionService) {
        this.televisionService.updateCharacteristic(
          Characteristic.ActiveIdentifier,
          NO_INPUT_ID,
        );
      }

      // for any remaining inputs that may have been previously visible, set to not configured and hidden
      //this.log("channelList pre filter:", this.channelList);
      //let loadedChs = Math.min(chs, MAX_INPUT_SOURCES);
      //this.log("channelList, filtering to first %s items", loadedChs);
      //this.channelList = this.channelList.filter((channel, index) => index < loadedChs)
      //this.log("channelList post filter:", this.channelList);
      //this.log.debug("channelList, setting hidden items from %s to %s", maxChs + 1, maxSources);
      for (let i = maxChs; i < maxSources; i++) {
        const chNum = String(i + 1).padStart(2, "0"); // computed once
        const hiddenName = "HIDDEN" + chNum; // derived once, reused twice

        this.log.debug("Hiding channel %s of %s", chNum, maxSources);
        // array must stay same size and have elements that can be queried, but channelId must never match valid entries
        this.channelList[i] = {
          id: "hiddenChId_" + i, // channelid must be unique string, must be different from standard channel ids
          name: hiddenName,
          logicalChannelNumber: null,
          linearProducts: null,
          configuredName: hiddenName,
          visibilityState: Characteristic.CurrentVisibilityState.HIDDEN,
        };

        // get service and hide it if it exists
        const inputService = this.inputSourceServices[i];
        if (inputService) {
          inputService.updateCharacteristic(
            Characteristic.CurrentVisibilityState,
            Characteristic.CurrentVisibilityState.HIDDEN,
          );
        }
      }

      this.log(
        "%s: Channel list refreshed with %s channels (including %s key macros)",
        this.name,
        Math.min(maxChs, maxSources),
        keyMacros.length,
      );
      return false;
    } catch (err) {
      this.log.error("Error trapped in refreshDeviceChannelList:", err.message);
      this.log.error(err);
    }
  } // end of refreshDeviceChannelList

  // get the most watched channels for the profileId
  async getMostWatchedChannels(profileId) {
    const profile = this.customer.profiles.find(
      (p) => p.profileId === profileId,
    );
    try {
      if (this.debugLevel > 1) {
        this.log(
          "%s: getMostWatchedChannels started with %s",
          this.name,
          profileId,
        );
      }
      if (!profile) {
        this.log.warn(
          "%s: getMostWatchedChannels: profile not found for id %s",
          this.name,
          profileId,
        );
        return false;
      }

      this.log(
        "%s: Refreshing most watched channels for profile '%s'",
        this.name,
        profile.name,
      );

      // 	https://spark-prod-ch.gnp.cloud.sunrisetv.ch/eng/web/linear-service/v1/mostWatchedChannels?cityId=401&productClass=Orion-DASH"
      //  https://spark-prod-ch.gnp.cloud.sunrisetv.ch/eng/web/linear-service/v1/mostWatchedChannels?cityId=401&language=en&productClass=Orion-DASH"
      //let url = COUNTRY_BASE_URLS[this.config.country.toLowerCase()] + '/eng/web/linear-service/v1/mostWatchedChannels';
      const url = new URL(
        `${this.platform.configsvc.linearService.URL}/v1/mostWatchedChannels`,
      );
      url.searchParams.set("cityId", this.customer.cityId);
      url.searchParams.set("language", "en");
      url.searchParams.set("productClass", "Orion-DASH");
      const config = {
        headers: {
          "x-oesp-username": this.platform.session.username, // not sure if needed
          "x-profile": profile.profileId,
          Referer:
            COUNTRY_WEB_URLS[this.config.country.toLowerCase()] ??
            "https://www.horizon.tv/", // fallback to horizon tv
        },
      };
      if (this.debugLevel > 1) {
        this.log.warn("getMostWatchedChannels: GET %s", url);
      }
      // this.log('getMostWatchedChannels: GET %s', url);
      const response = await axiosWS.get(url.toString(), config);
      if (this.debugLevel > 1) {
        this.log.warn(
          "getMostWatchedChannels: Profile %s: response: %s %s",
          profile.name,
          response.status,
          response.statusText,
        );
        this.log.warn(
          "getMostWatchedChannels: mostWatched found: %s",
          response.data.length,
        );
      }
      if (this.debugLevel > 2) {
        this.log.warn(
          "getMostWatchedChannels: %s: response data:",
          profile.name,
        );
        this.log.warn(response.data);
      }
      this.mostWatched = response.data; // store the entire mostWatched data for future use in this.mostWatched
      this.log(
        "%s: MostWatched list refreshed with %s channels",
        this.name,
        this.mostWatched.length,
      );
    } catch (err) {
      if (err.isAxiosError) {
        const isConnectivityError = [
          "ENOTFOUND",
          "ECONNREFUSED",
          "ECONNRESET",
        ].includes(err.code);
        const reason = isConnectivityError
          ? "check your internet connection"
          : `server returned ${err.response?.status} ${err.code}`;
        this.log.warn(
          `Failed to refresh most watched channel data for profile ${profileId} (${profile.name}) - ${reason}`,
        );
        this.log.debug("getMostWatchedChannels error:", err);
        this.log.error("getMostWatchedChannels error:", err);
        if (err.code === "ENOTFOUND") {
          this.platform.currentSessionState = sessionState.DISCONNECTED;
        }
      } else {
        this.log.error("Error trapped in getMostWatchedChannels:", err.message);
        this.log.error(err);
      }
    }
  } // end of getMostWatchedChannels

  getMaxSources() {
    // limit the amount of max channels to load as Apple HomeKit is limited to 100 services per accessory.
    // if a config exists for this device, read the users configured maxSources, if it exists
    const maxChannels = this._configDevice.maxChannels;
    return maxChannels
      ? Math.min(maxChannels, MAX_INPUT_SOURCES)
      : MAX_INPUT_SOURCES;
    //this.log("%s: Setting maxSources to %s", this.name, maxSources);
  } // end of getMaxSources

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // END regular device update functions
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // START of accessory get/set state handlers
  // HomeKit polls for status regularly at intervals from 2min to 15min
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++

  // get power state
  async getPower() {
    // fired when the user clicks away from the Remote Control, regardless of which TV was selected
    // fired when the Home app wants to refresh the TV tile. Refresh occurs when tile is displayed.
    // this.currentPowerState is updated by the polling mechanism
    //this.log('getPowerState current power state:', this.currentPowerState);
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getPower returning %s [%s]",
        this.name,
        this.currentPowerState,
        powerStateName[this.currentPowerState],
      );
    }
    return this.currentPowerState; // return current state: 0=off, 1=on
  } // end of getPower

  // set power state
  async setPower(targetPowerState) {
    // fired when the user clicks the power button in the TV accessory in the Home app
    // fired when the user clicks the TV tile in the Home app
    // fired when the first key is pressed after opening the Remote Control
    // wantedPowerState is the wanted power state: 0=off, 1=on
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: setPower targetPowerState:",
        this.name,
        targetPowerState,
        powerStateName[targetPowerState],
      );
    }
    if (this.currentPowerState !== targetPowerState) {
      this.platform.sendKey(this.deviceId, this.name, "Power");
      this.lastPowerKeySent = Date.now();
    }
  } // end of setPower

  // get device name (the accessory visible name)
  async getDeviceName() {
    // fired by the user changing a the accessory name in Home app accessory setup
    // a user can rename any box at any time
    if (this.debugLevel > 1) {
      this.log.warn("%s: getDeviceName returning '%s'", this.name, this.name);
    }
    // getDeviceName must return a non-empty string. If it returns null, undefined, or "" at the time Eve reads it, Eve shows blank.
    return this.name || this.config.name || "Set-Top Box";
  } // end of getDeviceName

  // set device name (change the accessory visible name)
  async setDeviceName(deviceName) {
    // fired by the user changing the accessory name in Home app accessory setup

    // check if user wants to sync the box name
    const syncName = this._configDevice.syncName !== false; // default true

    // sync name to physical device if enabled
    if (syncName) {
      // check name length and truncate and log if >MAX_NAME_LENGTH
      if (deviceName.length < SETTOPBOX_NAME_MINLEN) {
        deviceName = (deviceName + deviceName + deviceName).slice(
          0,
          SETTOPBOX_NAME_MINLEN,
        );
        this.log(
          "%s: Device name must be at least %s characters long, expanding to %s",
          this.name,
          SETTOPBOX_NAME_MINLEN,
          deviceName,
        );
      }
      if (deviceName.length > SETTOPBOX_NAME_MAXLEN) {
        deviceName = deviceName.slice(0, SETTOPBOX_NAME_MAXLEN);
        this.log(
          "%s: Device name is limited to %s characters, truncating to %s",
          this.name,
          SETTOPBOX_NAME_MAXLEN,
          deviceName,
        );
      }

      // ensure DEV is appended to deviceName to allow DEV and PROD environments to have the same device
      if (PLUGIN_ENV !== "" && !deviceName.endsWith(PLUGIN_ENV)) {
        this.log.warn(
          "%s: setDeviceName: [blocked in DEV environment] %s",
          this.name,
          deviceName,
        );
      } else {
        if (this.debugLevel > 1) {
          this.log.warn(
            "%s: setDeviceName: deviceName %s",
            this.name,
            deviceName,
          );
        }
        const deviceSettings = { deviceFriendlyName: deviceName };
        this.platform.setPersonalizationDataForDevice(
          this.deviceId,
          deviceSettings,
        );
      }
    }
  } // end of setDeviceName

  // get mute state
  async getMute() {
    // fired by HomeKit when reading the mute status, e.g. when Eve or Home app requests the status
    // required for HAP compliance
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getMute returning muteState: %s",
        this.name,
        this.currentMuteState,
      );
    }
    return this.currentMuteState;
  } // end of getMute

  // set mute state
  async setMute(muteState) {
    // sends the mute command. Mute is boolean
    // works for TVs that accept a mute toggle command
    if (this.debugLevel > 1) {
      this.log.warn("%s: setMute muteState: %s", this.name, muteState);
    }

    if (!this._configDevice.muteCommand) {
      this.log("%s: Mute command not configured", this.name);
      return;
    }

    // mute state is a boolean, either true or false: const NOT_MUTED = 0, MUTED = 1;
    // toggles the mute state on every send
    this.log("%s: Send key Mute", this.name);

    // Execute command to toggle mute
    try {
      await new Promise((resolve, reject) => {
        exec(this._configDevice.muteCommand, (error, _stdout, stderr) => {
          if (error) reject(stderr.trim());
          else resolve();
        });
      });
      // Success — advance state to requested value
      this.currentMuteState = muteState;
    } catch (err) {
      // Failure — currentMuteState intentionally not updated, retains previous known value
      this.log.warn("%s: setMute Error: %s", this.name, err);
    }

    // Always sync HAP to currentMuteState — whether updated (success) or reverted (failure)
    this.speakerService.updateCharacteristic(
      Characteristic.Mute,
      this.currentMuteState,
    );
  } // end of setMute

  // set volume
  async setVolume(volumeSelectorValue) {
    // set the volume of the TV using bash scripts
    // the ARRIS box remote control communicates with the stereo via IR commands, not over mqtt
    // so volume must be handled over a different method
    // here we send execute a bash command on the raspberry pi using the samsungctl command
    // to control the authors samsung stereo at 192.168.0.152
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: setVolume VolumeSelector: %s %s",
        this.name,
        volumeSelectorValue,
        volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT
          ? "DECREMENT"
          : "INCREMENT",
      );
    }

    // volumeSelectorValue: only 2 values possible: INCREMENT: 0, DECREMENT: 1,
    this.log(
      "%s: Send key Volume %s",
      this.name,
      volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT
        ? "Down"
        : "Up",
    );

    let tripleVolDownPress = Infinity; // default prevents false triple-press detection

    // triple rapid VolDown presses triggers setMute
    if (volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT) {
      // Guard: ensure array is properly initialised
      if (!Array.isArray(this.lastVolDownKeyPress) || this.lastVolDownKeyPress.length < 3) {
        this.lastVolDownKeyPress = [0, 0, 0];
      }

      // Self-limiting shift of array values
      this.lastVolDownKeyPress.unshift(Date.now());
      this.lastVolDownKeyPress = this.lastVolDownKeyPress.slice(0, 3); // keep only last 3

      // Now assign the calculated value to the outer variable
      tripleVolDownPress = this.lastVolDownKeyPress[0] - this.lastVolDownKeyPress[2];

      this.log.debug(
        "%s: setVolume: Timediff between volDownKeyPress[0] and volDownKeyPress[2]: %s ms",
        this.name,
        tripleVolDownPress,
      );      
      
    }

    // check for triple press of volDown, send setMute if tripleVolDownPress less than triplePressTime of 800ms
    const triplePressTime =
      this.config.triplePressTime || DEFAULT_TRIPLE_PRESS_DELAY_TIME;
    this.log.debug(
      "%s: setVolume: volumeSelectorValue %s, tripleVolDownPress %s, triplePressTime %s",
      this.name,
      volumeSelectorValue,
      tripleVolDownPress,
      triplePressTime,
    );
    if (
      volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT &&
      tripleVolDownPress < triplePressTime
    ) {
      // Execute command to set mute, but only if command exists
      this.log(
        "%s: Volume Down triple-press detected. Setting Mute",
        this.name,
      );
      await this.setMute(true);
      return;
    } else {
      // Execute command to change volume, but only if command exists
      const command =
        volumeSelectorValue === Characteristic.VolumeSelector.DECREMENT
          ? this._configDevice.volDownCommand
          : this._configDevice.volUpCommand;

      if (!command) {
        this.log("%s: Volume command not configured", this.name);
        return;
      }

      try {
        if (this.debugLevel > 0) {
          this.log.warn("%s: setVolume: Sending command %s", this.name, command);
        }
        await new Promise((resolve, reject) => {
          exec(command, (error, _stdout, stderr) => {
            if (error) reject(stderr.trim());
            else resolve();
          });
        });
        // Volume command succeeded — device auto-unmutes on any volume change
        this.currentMuteState = false;
        this.speakerService.updateCharacteristic(Characteristic.Mute, false);
      } catch (err) {
        this.log.warn("%s: setVolume Error: %s", this.name, err);
      }
    }
  } // end of setVolume

  // get input (TV channel)
  async getInput() {
    // fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
    // fired when the icon is clicked in the Home app and HomeKit requests a refresh
    // fired when the Home app is opened
    // polled by HomeKit every 2-15 minutes
    const currentActiveInput = this.previousActiveIdentifier ?? NO_INPUT_ID;
    if (this.debugLevel > 1) {
      const ch = this.channelList[currentActiveInput - 1];
      this.log.warn(
        "%s: getInput returning input %s %s [%s]",
        this.name,
        currentActiveInput,
        this.currentChannelId, // may lag — updated via MQTT, not synchronised here
        (ch || {}).configuredName || NO_CHANNEL_NAME,
      );
    }

    return currentActiveInput;
  } // end of getInput

  // set input (change the TV channel)
  async setInput(input) {
    if (!input) {
      this.log.warn(
        "%s: setInput called with null or undefined input",
        this.name,
      );
      return;
    }
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: setInput input %s %s",
        this.name,
        input.id,
        input.name,
      );
    }
    // get current channel, also finds keyMacro channels
    const prevChannel = this.channelList[this.previousActiveIdentifier - 1];
    this.log(
      "%s: Change channel from %s [%s] to %s [%s]",
      this.name,
      this.currentChannelId,
      (prevChannel || {}).name || NO_CHANNEL_NAME,
      input.id,
      input.name,
    );
    // robustness: only try to switch channel if an input.id exists. Handle KeyMacros
    if (input.id && input.id.startsWith("$KeyMacro")) {
      this.lastKeyMacroChannelId = input.id; // remember last keyMacro id
      this.platform.sendKey(this.deviceId, this.name, input.keyMacro);
      // Note: previousActiveIdentifier intentionally not updated — KeyMacros are not real channels
    } else if (input.id) {
      this.lastKeyMacroChannelId = null; // clear last keyMacro channelId
      this.platform.switchChannel(
        this.platform.mqttClientId,
        this.deviceId,
        this.name,
        input.id,
        input.name,
      );
      // Update the active identifier so getInput returns the correct value
      const newIdentifier =
        this.channelList.findIndex((ch) => ch.id === input.id) + 1;
      if (newIdentifier > 0) {
        this.previousActiveIdentifier = newIdentifier;
        this.televisionService.updateCharacteristic(
          Characteristic.ActiveIdentifier,
          newIdentifier,
        );
      } else {
        // log when channel not found in list
        this.log.debug(
          "%s: setInput: channel id %s not found in channelList",
          this.name,
          input.id,
        );
      }
    } else {
      this.log.warn("%s: setInput called with no input.id", this.name);
    }
  } // end of setInput

  // get input name (the TV channel name)
  async getInputName(inputId) {
    // fired by HomeKit when reading the channel name, e.g. when Eve or Home app requests the input list
    // If getInputName reads from this.channelList[i] and the list isn't fully populated yet when Eve first polls, it returns empty.
    // So ensure a fallback to a non-blank name exists
    const channel = this.channelList[inputId];
    const inputName =
      channel?.name || `Input ${String(inputId + 1).padStart(2, "0")}`;

    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getInputName for index %s input %s returning '%s'",
        this.name,
        inputId,
        inputId + 1,
        inputName,
      );
    }
    return inputName;
  } // end of getInputName

  // set input name (change the TV channel name)
  async setInputName(inputId, newInputName) {
    // fired by the user changing a channel name in Home app accessory setup
    // iOS does not like / or ! in the channel name:
    // inputId (0-based) = input id of the input

    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: setInputName for index %s input %s to %s",
        this.name,
        inputId,
        inputId + 1,
        newInputName,
      );
    }

    this.log(
      "%s: Renamed channel %s to %s (valid only for HomeKit)",
      this.name,
      inputId + 1,
      newInputName,
    );
  } // end of setInputName

  // get current channel active id (the TV channel identifier, a string)
  // added in v2.1.0
  // renamed in v2.4.0 from getCurrentChannelId to getActiveChannelId
  // custom characteristic, returns a string, the event updates the characteristic value automatically
  async getActiveChannelId() {
    // fired by the user reading the Custom characteristic in Shortcuts
    // fired when the accessory is first created and HomeKit requests a refresh
    // fired when the icon is clicked in the Home app and HomeKit requests a refresh
    // fired when the Home app is opened

    const activeChannelId = this.currentChannelId || ""; // this.currentChannelId is a string eg SV09038. Empty string if not found
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getActiveChannelId returning '%s'",
        this.name,
        activeChannelId,
      );
    }
    return activeChannelId;
  } // end of getActiveChannelId

  // get current channel name (the TV channel name)
  // added in v2.1.0
  // renamed in v2.4.0 from getCurrentChannelName to getActiveChannelName
  // custom characteristic, returns a string, the event updates the characteristic value automatically
  async getActiveChannelName() {
    // fired by the user reading the Custom characteristic in Shortcuts
    // fired when the accessory is first created and HomeKit requests a refresh
    // fired when the icon is clicked in the Home app and HomeKit requests a refresh
    // fired when the Home app is opened

    const curChannel = this.platform.masterChannelMap?.get(
      this.currentChannelId,
    );
    // consider setting to Radio if radio is playing
    const activeChannelName = (curChannel || {}).name || ""; // Empty string if not found
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getActiveChannelName returning '%s'",
        this.name,
        activeChannelName,
      );
    }
    return activeChannelName;
  } // end of getActiveChannelName

  // get input visibility state (of the TV channel in the accessory)
  async getInputVisibilityState(inputId) {
    // fired by the user views or edits channels in the Home app
    const visibilityState =
      (this.channelList[inputId] || {}).visibilityState ??
      Characteristic.CurrentVisibilityState.HIDDEN;
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getInputVisibilityState index %s input %s returning %s [%s]",
        this.name,
        inputId,
        inputId + 1,
        visibilityState,
        CHAR_NAMES.CurrentVisibilityState[visibilityState + 1],
      );
    }
    return visibilityState;
  } // end of getInputVisibilityState

  // set input visibility state (show or hide the TV channel)
  async setInputVisibilityState(inputId, visibilityState) {
    // fired by the user hiding (unselecting the tick) an input in the Home app
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: setInputVisibilityState for index %s input %s to %s [%s]",
        this.name,
        inputId,
        inputId + 1,
        visibilityState,
        CHAR_NAMES.CurrentVisibilityState[visibilityState + 1],
      );
    }
    this.inputSourceServices[inputId].updateCharacteristic(
      Characteristic.CurrentVisibilityState,
      visibilityState,
    );

    // store in channelList array
    this.channelList[inputId].visibilityState = visibilityState;
  } // end of setInputVisibilityState

  // get closed captions state
  async getClosedCaptions() {
    // fired by HomeKit when reading the closed captions state
    // polled by HomeKit every 2-15 minutes, and when the Home app tile is displayed
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getClosedCaptions returning %s [%s]",
        this.name,
        this.currentClosedCaptions,
        CHAR_NAMES.ClosedCaptions[this.currentClosedCaptions + 1],
      );
    }
    return this.currentClosedCaptions; // return current state
  } // end of getClosedCaptions

  // set closed captions state
  async setClosedCaptions(closedCaptionsState) {
    // fired when ?? Apple HomeKit has no ability to control setClosedCaptions
    // Can be controlled in Eve
    // closedCaptionsState is the wanted state
    // 0=DISABLED, 1=ENABLED
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: setClosedCaptions to %s [%s]",
        this.name,
        closedCaptionsState,
        CHAR_NAMES.ClosedCaptions[closedCaptionsState + 1],
      );
    }
    if (this.currentClosedCaptions !== closedCaptionsState) {
      this.log("setClosedCaptions: not yet implemented");
    }
  } // end of setClosedCaptions

  // get picture mode state
  async getPictureMode() {
    // fired when the Home app wants to refresh the TV tile. Refresh occurs when tile is displayed.
    if (this.debugLevel > 1) {
      const pictureModeLabel =
        this._configDevice.customPictureMode === "recordingState"
          ? Object.keys(recordingState)[this.customPictureMode]
          : CHAR_NAMES.PictureMode[this.customPictureMode + 1];
      this.log.warn(
        "%s: getPictureMode returning %s [%s]",
        this.name,
        this.customPictureMode,
        pictureModeLabel,
      );
    }
    return this.customPictureMode; // return current state
  } // end of getPictureMode

  // set picture mode state
  async setPictureMode(pictureMode) {
    // The current Home app (iOS 16.0) does not support setting this characteristic
    // Can be set by the Eve app
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: setPictureMode to %s [%s]",
        this.name,
        pictureMode,
        CHAR_NAMES.PictureMode[pictureMode + 1],
      );
    }
    if (this.customPictureMode !== pictureMode) {
      this.log("%s: setPictureMode: not supported by the device", this.name);
    }
  } // end of setPictureMode

  // set power mode selection (View TV Settings menu option)
  async setPowerModeSelection(state) {
    // fired by the View TV Settings command in the Home app TV accessory Settings
    if (this.debugLevel > 1) {
      this.log.warn("%s: setPowerModeSelection to %s", this.name, state);
    }
    this.log("%s: Menu command: View TV Settings", this.name);
    // only send the keys if the power is on
    if (this.currentPowerState === Characteristic.Active.ACTIVE) {
      this.platform.sendKey(this.deviceId, this.name, "Help"); // puts SETTINGS.INFO on the screen
      setTimeout(() => {
        this.platform.sendKey(this.deviceId, this.name, "ArrowRight");
      }, 600); // move right to select SETTINGS.PROFILES, send after 600ms
    } else {
      this.log(
        "%s: Power is Off. View TV Settings command not sent",
        this.name,
      );
    }
  } // end of setPowerModeSelection

  // get current media state
  async getCurrentMediaState() {
    // The current Home app (iOS 16.0) does not support setting this characteristic, thus is never fired
    // cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
    // Current Media State reflects what the device is actually doing right now:
    // 0 Play , 1 Pause, 2 Stop, 4 Loading (buffering), 5 Interrupted (e.g. lost signal)
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getCurrentMediaState returning %s [%s]",
        this.name,
        this.currentMediaState,
        currentMediaStateName(this.currentMediaState),
      );
    }
    return this.currentMediaState;
  } // end of getCurrentMediaState

  // get target media state
  async getTargetMediaState() {
    // The current Home app (iOS 16.0) does not support getting this characteristic, thus is never fired
    // cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
    // must never return null, so send STOP as default value
    // Target Media State reflects what the user wants the device to do:
    // 0 Play , 1 Pause, 2 Stop
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getTargetMediaState returning %s [%s]",
        this.name,
        this.targetMediaState,
        currentMediaStateName(this.targetMediaState),
      );
    }
    return this.targetMediaState;
  } // end of getTargetMediaState

  // set target media state
  async setTargetMediaState(targetMediaState, logChangeOnly) {
    // The current Home app (iOS 16.0) does not support setting this characteristic, thus is never fired
    // cannot be controlled by Apple Home app, but could be controlled by other HomeKit apps
    // can be controlled by the Apple TV Remote Control, and is called when changing Play / Pause / Stop
    // logChangeOnly = TRUE: only the changes are logged, no media state change occurs. Needed when sending remote keypresses to prevent double commands
    // CHAR_NAMES: TargetMediaState: [ 'UUID', 'PLAY', 'PAUSE', 'STOP' ]
    //if (this.debugLevel > 1) {
      this.log.info(
        "%s: setTargetMediaState to %s [%s]",
        this.name,
        targetMediaState,
        CHAR_NAMES.TargetMediaState[targetMediaState + 1],
      );
   // }

    if (!logChangeOnly) {
      // send the setMediaState command if we are not just logging the change
      // box supports only Play and Pause, HomeKit supports Play, Pause and Stop. Pause and Stop both map to Pause
      // the box media state is controlled by speed
      // speed can be one of: -64 -30 -6 -2 0 2 6 30 64. 0=Paused, 1=Play, >1=FastForward, <0=Rewind

      // Box only knows Play (1) or Pause/Stop (0). HomeKit's 0-Play maps to 1-Play, and 1-Pause and 2-Stop both map to 0-Pause/Stop.
      //  HomeKit     SettopBox
      //  PLAY  0  -  1 Play
      //  PAUSE 1  -  0 Paused
      //  STOP  2  -  0 Paused
      const newBoxMediaState = targetMediaState === Characteristic.TargetMediaState.PLAY ? 1 : 0;
      const newBoxMediaStateName = newBoxMediaState === 1 ? "Play" : "Paused";

      //if (this.debugLevel >= 0) {
        this.log(
          "%s: setTargetMediaState: Calling setMediaState with newBoxMediaState %s [%s]",
          this.name,
          newBoxMediaState,
          newBoxMediaStateName,
        );
      //}
      /*
      switch (targetMediaState) {
        case Characteristic.TargetMediaState.PLAY:
            this.platform.sendKey(this.deviceId, this.name, "MediaPlay");
            break;
        case Characteristic.TargetMediaState.PAUSE:
            this.platform.sendKey(this.deviceId, this.name, "MediaPause");
            break;
        case Characteristic.TargetMediaState.STOP:
            this.platform.sendKey(this.deviceId, this.name, "MediaStop");
            break;
        default:
      }
        */
      // send the requested media state to the box
      // setMediaState 0 will start playing if paused (1)
      this.platform.setMediaState(
        this.deviceId,
        this.name,
        this.currentChannelId,
        newBoxMediaState,
      );
    }
  } // end of setTargetMediaState

  // get display order
  async getDisplayOrder() {
    // fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
    // fired when the icon is clicked in the Home app and the Home app requests a refresh

    // log the display order
    const dispOrder = this.televisionService.getCharacteristic(
      Characteristic.DisplayOrder,
    ).value;
    if (this.debugLevel > 1) {
      this.log.warn("%s: getDisplayOrder returning '%s'", this.name, dispOrder);
    }
    return dispOrder;
  } // end of getDisplayOrder

  // set display order
  async setDisplayOrder(displayOrder) {
    // fired when the user clicks away from the iOS Device TV Remote Control, regardless of which TV was selected
    // fired when the icon is clicked in the Home app and the Home app requests a refresh
    if (this.debugLevel > 1) {
      this.log.warn("%s: setDisplayOrder to %s", this.name, displayOrder);
    }
  } // end of setDisplayOrder

  // get in use
  async getInUse() {
    // useful in Shortcuts and Automations
    // log the inUse value
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getInUse returning %s [%s]",
        this.name,
        this.currentInUse,
        CHAR_NAMES.InUse[this.currentInUse + 1],
      );
    }
    return this.currentInUse;
  } // end of getInUse

  // get program mode (recording scheduled, not scheduled)
  async getProgramMode() {
    // useful in Shortcuts and Automations
    // log the programMode value
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getProgramMode returning %s [%s]",
        this.name,
        this.currentProgramMode,
        CHAR_NAMES.ProgramMode[this.currentProgramMode + 1],
      );
    }
    return this.currentProgramMode;
  } // end of getProgramMode

  // get StatusActive state
  async getStatusActive() {
    // useful in Shortcuts and Automations
    // log the StatusActive value
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getStatusActive returning %s [%s]",
        this.name,
        this.currentStatusActive,
        statusActiveName[this.currentStatusActive],
      );
    }
    return this.currentStatusActive;
  } // end of getStatusActive

  // get status fault
  async getStatusFault() {
    // useful in Shortcuts and Automations
    // log the StatusFault
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getStatusFault returning %s [%s]",
        this.name,
        this.currentStatusFault,
        CHAR_NAMES.StatusFault[this.currentStatusFault + 1],
      );
    }
    return this.currentStatusFault;
  } // end of getStatusFault

  // get InputSourceType state
  async getInputSourceType() {
    // useful in Shortcuts and Automations
    // log the InputSourceType value
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getInputSourceType returning %s [%s]",
        this.name,
        this.currentInputSourceType,
        CHAR_NAMES.InputSourceType[this.currentInputSourceType + 1],
      );
    }
    return this.currentInputSourceType;
  } // end of getInputSourceType

  // get InputDeviceType state
  async getInputDeviceType() {
    // useful in Shortcuts and Automations
    // log the InputDeviceType value
    if (this.debugLevel > 1) {
      this.log.warn(
        "%s: getInputDeviceType returning %s [%s]",
        this.name,
        this.currentInputDeviceType,
        CHAR_NAMES.InputDeviceType[this.currentInputDeviceType + 1],
      );
    }
    return this.currentInputDeviceType;
  } // end of getInputDeviceType

  // set remote key
  async setRemoteKey(remoteKey) {
    if (this.debugLevel > 1) {
      this.log.warn("%s: setRemoteKey remoteKey:", this.name, remoteKey);
    }

    // remoteKey is the key pressed on the Apple TV Remote in the Control Center
    // keys 0...15 exist, but keys 12, 13 & 14 are not defined by Apple

    // all the keys have to mapped to a key that the EOSSTB understands
    // keys:
    // https://github.com/jsiegenthaler/homebridge-eosstb/wiki/KeyEvents

    this.log.debug(
      "%s: setRemoteKey: -- New key press! -- current key %s, last key %s",
      this.name,
      remoteKey,
      this.lastRemoteKeyPressed,
    );

    // ------------- double and triple press function ---------------
    // supports three layers of keys:
    // single press, double press, triple press

    // get the config for this device
    const configDevice = this._configDevice ?? {};

    // do the button layer mapping
    // get any user-defined button remaps
    let keyName;
    let keyNameLayer = []; // holds the keynames for each layer
    let buttonLayer = 0; // default layer 0

    switch (remoteKey) {
      case Characteristic.RemoteKey.REWIND: // 0
        // no button exists in the Apple TV Remote for REWIND (as of iOS 14 & 15)
        // but exists in the eosstb remote, so add it ready for the future
        keyNameLayer[DEFAULT_KEYNAME] = "MediaRewind";
        break;

      case Characteristic.RemoteKey.FAST_FORWARD: // 1
        // no button exists in the Apple TV Remote for FAST_FORWARD (as of iOS 14 & 15)
        // but exists in the eosstb remote, so add it ready for the future
        keyNameLayer[DEFAULT_KEYNAME] = "MediaFastForward";
        break;

      case Characteristic.RemoteKey.NEXT_TRACK: // 2 MediaTrackNext
      case Characteristic.RemoteKey.PREVIOUS_TRACK: // 3 MediaTrackPrevious
        // no button exists in the Apple TV Remote for NEXT_TRACK or PREVIOUS_TRACK (as of iOS 14 & 15) but Eve can control it
        keyNameLayer[DEFAULT_KEYNAME] = null; // no corresponding keys can be identified. not supported in Apple Remote GUI
        break;

      case Characteristic.RemoteKey.ARROW_UP:
        keyNameLayer[DEFAULT_KEYNAME] = "ArrowUp";
        keyNameLayer[SINGLE_TAP] = configDevice.arrowUpButton;
        keyNameLayer[DOUBLE_TAP] = configDevice.arrowUpButtonDoubleTap;
        keyNameLayer[TRIPLE_TAP] = configDevice.arrowUpButtonTripleTap;
        break;

      case Characteristic.RemoteKey.ARROW_DOWN:
        keyNameLayer[DEFAULT_KEYNAME] = "ArrowDown";
        keyNameLayer[SINGLE_TAP] = configDevice.arrowDownButton;
        keyNameLayer[DOUBLE_TAP] = configDevice.arrowDownButtonDoubleTap;
        keyNameLayer[TRIPLE_TAP] = configDevice.arrowDownButtonTripleTap;
        break;

      case Characteristic.RemoteKey.ARROW_LEFT:
        keyNameLayer[DEFAULT_KEYNAME] = "ArrowLeft";
        keyNameLayer[SINGLE_TAP] = configDevice.arrowLeftButton;
        keyNameLayer[DOUBLE_TAP] = configDevice.arrowLeftButtonDoubleTap;
        keyNameLayer[TRIPLE_TAP] = configDevice.arrowLeftButtonTripleTap;
        break;

      case Characteristic.RemoteKey.ARROW_RIGHT:
        keyNameLayer[DEFAULT_KEYNAME] = "ArrowRight";
        keyNameLayer[SINGLE_TAP] = configDevice.arrowRightButton;
        keyNameLayer[DOUBLE_TAP] = configDevice.arrowRightButtonDoubleTap;
        keyNameLayer[TRIPLE_TAP] = configDevice.arrowRightButtonTripleTap;
        break;

      case Characteristic.RemoteKey.SELECT:
        keyNameLayer[DEFAULT_KEYNAME] = "Enter";
        keyNameLayer[SINGLE_TAP] = configDevice.selectButton;
        keyNameLayer[DOUBLE_TAP] = configDevice.selectButtonDoubleTap;
        keyNameLayer[TRIPLE_TAP] = configDevice.selectButtonTripleTap;
        break;

      case Characteristic.RemoteKey.BACK:
      case Characteristic.RemoteKey.EXIT:
        keyNameLayer[DEFAULT_KEYNAME] = "Escape";
        keyNameLayer[SINGLE_TAP] = configDevice.backButton;
        keyNameLayer[DOUBLE_TAP] = configDevice.backButtonDoubleTap;
        keyNameLayer[TRIPLE_TAP] = configDevice.backButtonTripleTap;
        break;

      case Characteristic.RemoteKey.PLAY_PAUSE:
        keyNameLayer[DEFAULT_KEYNAME] = "MediaPlayPause";
        keyNameLayer[SINGLE_TAP] = configDevice.playPauseButton;
        keyNameLayer[DOUBLE_TAP] = configDevice.playPauseButtonDoubleTap;
        keyNameLayer[TRIPLE_TAP] = configDevice.playPauseButtonTripleTap;
        break;

      case Characteristic.RemoteKey.INFORMATION:
        keyNameLayer[DEFAULT_KEYNAME] = "MediaTopMenu";
        keyNameLayer[SINGLE_TAP] = configDevice.infoButton;
        keyNameLayer[DOUBLE_TAP] = configDevice.infoButtonDoubleTap;
        keyNameLayer[TRIPLE_TAP] = configDevice.infoButtonTripleTap;
        break;
    }

    const CURRENT_PRESS = 0; // index of the current button press
    const PREVIOUS_PRESS = 1; // index of the previous button press
    const TWO_PRESSES_AGO = 2; // index of the button press two presses ago (before the previous press)

    // initialise history ring buffer for this key if first time seen
    if (!this.keyPressHistory.has(remoteKey)) {
      this.keyPressHistory.set(remoteKey, [0, 0, 0]);
    }
    const history = this.keyPressHistory.get(remoteKey);
    history[TWO_PRESSES_AGO] = history[PREVIOUS_PRESS];
    history[PREVIOUS_PRESS] = history[CURRENT_PRESS];
    history[CURRENT_PRESS] = Date.now();

    // default to a long time ago if empty.
    const lastPressTime = {
      [CURRENT_PRESS]: history[CURRENT_PRESS],
      [PREVIOUS_PRESS]: history[PREVIOUS_PRESS] || Date.now() - 999999,
      [TWO_PRESSES_AGO]: history[TWO_PRESSES_AGO] || Date.now() - 999999,
    };

    const doublePressTime =
      this.config.doublePressTime || DEFAULT_DOUBLE_PRESS_DELAY_TIME; // default to DEFAULT_DOUBLE_PRESS_DELAY_TIME if nothing found

    // check time difference between current keyPress and last keyPress
    this.log.debug(
      "%s: setRemoteKey: remoteKey %s, time since same-key last keypress: %s ms, doublePressTime: %s",
      this.name,
      remoteKey,
      lastPressTime[CURRENT_PRESS] - lastPressTime[PREVIOUS_PRESS],
      doublePressTime,
    );

    // if the current key has the same keyName in single and double press layers, then
    // there is no need to wait for a double-press detection. The key can be sent immediately.
    if (
      keyNameLayer[SINGLE_TAP] ===
      (keyNameLayer[DOUBLE_TAP] || keyNameLayer[SINGLE_TAP])
    ) {
      // single and double press layers are the same, send immediately
      this.log.debug(
        "%s: setRemoteKey: remoteKey %s, same single- and double-press layers, sending now",
        this.name,
        remoteKey,
      );
      this.pendingKeyPress = -1; // clear any pending key press
      this.sendRemoteKeyPressAfterDelay = false; // disable send after delay
      this.readyToSendRemoteKeyPress = true; // enable immediate send

      // check if this was a double-pressed key within the double-press time limit, and is for the same key
    } else if (
      lastPressTime[CURRENT_PRESS] - lastPressTime[PREVIOUS_PRESS] <
        doublePressTime &&
      this.pendingKeyPress === remoteKey
    ) {
      // double press detected, send immediately
      this.log.debug(
        "%s: setRemoteKey: remoteKey %s, double press detected, sending now",
        this.name,
        remoteKey,
      );
      buttonLayer = DOUBLE_TAP;
      this.pendingKeyPress = -1; // clear any pending key press
      this.sendRemoteKeyPressAfterDelay = false; // disable send after delay
      this.readyToSendRemoteKeyPress = true; // enable immediate send
    } else {
      // not a double press, queue as a pending press, to be sent after delay
      this.log.debug(
        "%s: setRemoteKey: remoteKey %s, single press detected, waiting for possible next key press before sending",
        this.name,
        remoteKey,
      );
      buttonLayer = SINGLE_TAP;
      this.pendingKeyPress = remoteKey;
      this.sendRemoteKeyPressAfterDelay = true; // enable send after delay
      this.readyToSendRemoteKeyPress = false; // disable readyToSend, will send on cache timeout
    }

    // get the right keyName based on the buttonLayer, fallback to default if needed
    this.log.debug(
      "%s: setRemoteKey: setting keyName for buttonLayer %s: SingleTap=%s, DoubleTap=%s, TripleTap=%s, Default=%s",
      this.name,
      buttonLayer,
      keyNameLayer[SINGLE_TAP],
      keyNameLayer[DOUBLE_TAP],
      keyNameLayer[TRIPLE_TAP],
      keyNameLayer[DEFAULT_KEYNAME],
    );
    keyName = keyNameLayer[buttonLayer] || keyNameLayer[DEFAULT_KEYNAME];

    this.log.debug(
      "%s: setRemoteKey: remoteKey %s, buttonLayer %s, keyName %s, pendingKeyPress %s, sendRemoteKeyPressAfterDelay %s, readyToSendRemoteKeyPress %s",
      this.name,
      remoteKey,
      buttonLayer,
      keyName,
      this.pendingKeyPress,
      this.sendRemoteKeyPressAfterDelay,
      this.readyToSendRemoteKeyPress,
    );

    // handle the key code (can be a sequence)
    // send only if keyName is not null
    if (keyName) {
      if (this.readyToSendRemoteKeyPress) {
        // send immediately
        this.log.debug(
          "%s: setRemoteKey: sending key %s now",
          this.name,
          keyName,
        );
        this.platform.sendKey(this.deviceId, this.name, keyName);
        this.pendingKeyPress = -1; // clear any pending key press
      } else {
        // immediate send is not enabled.
        // start a delay equal to doublePressTime, then send only if the readyToSendRemoteKeyPress is true
        const delayTime = doublePressTime;
        this.log.debug(
          "%s: setRemoteKey: sending key %s after delay of %s milliseconds",
          this.name,
          keyName,
          delayTime,
        );

        // Cancel any previous pending timer before starting a new one
        clearTimeout(this._pendingKeyTimer);

        this._pendingKeyTimer = setTimeout(() => {
          // check if can be sent. Only send if sendRemoteKeyPressAfterDelay is still set. It may have been reset by another key press
          this.log.debug(
            "%s: setRemoteKey: setTimeout delay completed, checking sendRemoteKeyPressAfterDelay for %s",
            this.name,
            keyName,
          );
          if (this.sendRemoteKeyPressAfterDelay) {
            this.log.debug(
              "%s: setRemoteKey: setTimeout delay completed, sending %s",
              this.name,
              keyName,
            );
            this.platform.sendKey(this.deviceId, this.name, keyName);

            this.log.debug(
              "%s: setRemoteKey: setTimeout delay completed, key %s sent, resetting readyToSendRemoteKeyPress",
              this.name,
              keyName,
            );
            this.readyToSendRemoteKeyPress = true; // reset the enable flag
            this.pendingKeyPress = -1; // clear any pending key press
          } else {
            this.log.debug(
              "%s: setRemoteKey: setTimeout delay completed, checking sendRemoteKeyPressAfterDelay for %s: sendRemoteKeyPressAfterDelay is false, doing nothing",
              this.name,
              keyName,
            );
          }
        }, delayTime); // send after delayTime
      }
    }

    this.lastRemoteKeyPressed = remoteKey; // store the current key as last key pressed
  } // end of setRemoteKey

  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
  // END of accessory get/set characteristic handlers
  //+++++++++++++++++++++++++++++++++++++++++++++++++++++
} // end of class StbDevice
