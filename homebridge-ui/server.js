"use strict";

const fs = require("fs").promises;
const path = require("path");
const axios = require("axios");
const tough = require("tough-cookie");
const { wrapper: axiosCookieJarSupport } = require("axios-cookiejar-support");
const { randomBytes, createHash } = require("node:crypto");

const packageJson = require("../package.json");

const GB_AUTH_SERVICE_URL =
  "https://spark-prod-gb.gnp.cloud.virgintvgo.virginmedia.com/auth-service";
const GB_SSO_AUTHORIZATION_URL =
  GB_AUTH_SERVICE_URL + "/v1/sso/authorization";
const GB_LOGIN_SUCCESS_URL =
  "https://virgintvgo.virginmedia.com/sso/login_success.html";
const PENDING_MAX_AGE_MS = 20 * 60 * 1000;

function base64Url(buffer) {
  return buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function generatePKCEPair() {
  const verifier = base64Url(randomBytes(96)).slice(0, 128);
  const code_challenge = base64Url(
    createHash("sha256").update(verifier).digest(),
  );
  return { verifier, code_challenge };
}

function createUiServer(HomebridgePluginUiServer, RequestError) {
  return class UiServer extends HomebridgePluginUiServer {
    constructor() {
      super();

      this.cookieJar = new tough.CookieJar();
      this.axios = axiosCookieJarSupport(
        axios.create({
          jar: this.cookieJar,
        }),
      );
      this.axios.defaults.headers.common = {};
      this.axios.defaults.headers.post = {};

      this.onRequest("/gb-auth/status", this.handleStatus.bind(this));
      this.onRequest("/gb-auth/start", this.handleStart.bind(this));
      this.onRequest("/gb-auth/exchange", this.handleExchange.bind(this));
      this.onRequest("/gb-auth/clear", this.handleClear.bind(this));

      this.ready();
    }

  get sessionFile() {
    return path.join(
      this.homebridgeStoragePath,
      `${packageJson.name}.gb-session.json`,
    );
  }

  get pendingFile() {
    return path.join(
      this.homebridgeStoragePath,
      `${packageJson.name}.gb-auth-pending.json`,
    );
  }

  async readJson(filename) {
    try {
      return JSON.parse(await fs.readFile(filename, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  async writeJson(filename, data) {
    await fs.mkdir(path.dirname(filename), { recursive: true });
    await fs.writeFile(filename, JSON.stringify(data, null, 2), {
      mode: 0o600,
    });
    await fs.chmod(filename, 0o600);
  }

  summarizeSession(record) {
    const session = record?.session;
    return {
      paired: Boolean(session?.refreshToken),
      householdId: session?.householdId || null,
      username: session?.username || null,
      updatedAt: record?.updatedAt || null,
      refreshTokenExpiry: session?.refreshTokenExpiry || null,
    };
  }

  async handleStatus() {
    const record = await this.readJson(this.sessionFile);
    return this.summarizeSession(record);
  }

  async handleStart() {
    const { verifier, code_challenge } = generatePKCEPair();

    let response;
    try {
      response = await this.axios.get(GB_SSO_AUTHORIZATION_URL, {
        params: {
          code_challenge,
          language: "en",
        },
        headers: {
          "x-device-code": "web",
          "x-profile": "anonymous",
        },
      });
    } catch (error) {
      throw new RequestError("Could not start Virgin Media login.", {
        status: error.response?.status || 500,
      });
    }

    const {
      state,
      authorizationUri,
      validityToken,
      redirectUri,
      logoutUri,
    } = response.data || {};

    if (!state || !authorizationUri || !validityToken) {
      throw new RequestError(
        "Virgin Media did not return a complete login request.",
        {
          status: 502,
        },
      );
    }

    // Keep the PKCE verifier server-side so the browser only receives the
    // Virgin authorization URI. The verifier is needed later for code exchange.
    await this.writeJson(this.pendingFile, {
      createdAt: Date.now(),
      state,
      validityToken,
      codeVerifier: verifier,
      redirectUri,
      logoutUri,
    });

    return {
      authorizationUri,
      redirectUri,
      state,
    };
  }

  async handleExchange(payload) {
    const finalUrl = String(payload?.finalUrl || "").trim();
    if (!finalUrl) {
      throw new RequestError(
        "Paste the final Virgin TV Go login_success URL first.",
        {
          status: 400,
        },
      );
    }

    const pending = await this.readJson(this.pendingFile);
    if (!pending?.state || !pending?.validityToken || !pending?.codeVerifier) {
      throw new RequestError(
        "Start a new Virgin Media login before exchanging a code.",
        {
          status: 400,
        },
      );
    }

    if (Date.now() - pending.createdAt > PENDING_MAX_AGE_MS) {
      throw new RequestError(
        "This Virgin Media login request has expired. Start again.",
        {
          status: 400,
        },
      );
    }

    let url;
    try {
      url = new URL(finalUrl);
    } catch (error) {
      throw new RequestError("The pasted value is not a valid URL.", {
        status: 400,
      });
    }

    if (`${url.origin}${url.pathname}` !== GB_LOGIN_SUCCESS_URL) {
      throw new RequestError(
        "The URL is not the Virgin TV Go login_success URL.",
        {
          status: 400,
        },
      );
    }

    // The success URL contains a short-lived authorization code. Exchange it
    // immediately, then persist only the returned session for plugin startup.
    const authorizationCode = url.searchParams.get("code");
    const state = url.searchParams.get("state");
    if (!authorizationCode) {
      throw new RequestError(
        "The pasted URL does not contain a code parameter.",
        {
          status: 400,
        },
      );
    }
    if (!state) {
      throw new RequestError(
        "The pasted URL does not contain a state parameter.",
        {
          status: 400,
        },
      );
    }
    if (state !== pending.state) {
      throw new RequestError(
        "The pasted URL belongs to a different login request.",
        {
          status: 400,
        },
      );
    }

    let response;
    try {
      response = await this.axios.post(
        GB_SSO_AUTHORIZATION_URL,
        {
          authorizationGrant: {
            authorizationCode,
            validityToken: pending.validityToken,
            state: pending.state,
            codeVerifier: pending.codeVerifier,
          },
        },
        {
          headers: {
            accept: "*/*",
            "content-type": "application/json; charset=UTF-8",
          },
        },
      );
    } catch (error) {
      throw new RequestError("Virgin Media rejected the authorization code.", {
        status: error.response?.status || 500,
      });
    }

    const session = response.data || {};
    if (!session.refreshToken || !session.accessToken || !session.householdId) {
      throw new RequestError("Virgin Media did not return a complete session.", {
        status: 502,
      });
    }

    const record = {
      country: "gb",
      updatedAt: new Date().toISOString(),
      session,
    };

    await this.writeJson(this.sessionFile, record);
    await fs.rm(this.pendingFile, { force: true });

    return this.summarizeSession(record);
  }

  async handleClear() {
    await fs.rm(this.sessionFile, { force: true });
    await fs.rm(this.pendingFile, { force: true });
    return { paired: false };
  }
  };
}

(async () => {
  const { HomebridgePluginUiServer, RequestError } = await import(
    "@homebridge/plugin-ui-utils"
  );
  const UiServer = createUiServer(HomebridgePluginUiServer, RequestError);
  return new UiServer();
})();
