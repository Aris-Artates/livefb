// Facebook JS SDK wrapper
// Docs: https://developers.facebook.com/docs/javascript/reference/
//
// This project uses TWO separate Facebook apps:
//   1. Login App      — for FB.login() / OAuth  (NEXT_PUBLIC_FACEBOOK_LOGIN_APP_ID)
//   2. Livestream App — for fb-video XFBML embeds (NEXT_PUBLIC_FACEBOOK_LIVESTREAM_APP_ID)
//
// The Facebook JS SDK can only be initialised once per page load.
// Login pages call initFacebookLogin(); livestream pages call initFacebookLivestream().
// If the SDK is already initialised when the second function is called, it is a
// no-op and the existing instance is reused (video embeds work regardless of
// which App ID was used to init the SDK).

declare global {
  interface Window {
    FB: {
      init(params: {
        appId: string;
        cookie: boolean;
        xfbml: boolean;
        version: string;
      }): void;
      login(
        callback: (res: FBAuthResponse) => void,
        options?: { scope: string }
      ): void;
      getLoginStatus(callback: (res: FBAuthResponse) => void): void;
      XFBML?: { parse(): void };
    };
    fbAsyncInit?(): void;
  }
}

interface FBAuthResponse {
  status: "connected" | "not_authorized" | "unknown";
  authResponse?: {
    accessToken: string;
    userID: string;
    expiresIn: number;
  };
}

let _sdkReady = false;

/** Load the Facebook JS SDK and call FB.init() with the given App ID. */
function _loadSdk(appId: string): Promise<void> {
  if (_sdkReady) return Promise.resolve();

  return new Promise((resolve) => {
    const doInit = () => {
      window.FB.init({
        appId,
        // Do NOT use FB cookies — we manage sessions via our own JWT
        cookie: false,
        xfbml: true,
        version: "v18.0",
      });
      _sdkReady = true;
      resolve();
    };

    // SDK already loaded (e.g. cached from previous page visit) — init directly
    if (typeof window.FB !== "undefined") {
      doInit();
      return;
    }

    // SDK not yet loaded — set the async init callback
    window.fbAsyncInit = doInit;

    if (document.getElementById("facebook-jssdk")) {
      // Script tag already in DOM and loading — fbAsyncInit will fire when ready
      return;
    }

    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    document.head.appendChild(script);
  });
}

/**
 * Initialise the Facebook JS SDK for the Login / OAuth App.
 * Call this on the login page before invoking FB.login().
 * Uses NEXT_PUBLIC_FACEBOOK_LOGIN_APP_ID.
 */
export function initFacebookLogin(): Promise<void> {
  return _loadSdk(process.env.NEXT_PUBLIC_FACEBOOK_LOGIN_APP_ID || "");
}

/**
 * Initialise the Facebook JS SDK for the Livestream / Video Embed App.
 * Call this on pages that render the LivestreamEmbed component.
 * Uses NEXT_PUBLIC_FACEBOOK_LIVESTREAM_APP_ID.
 */
export function initFacebookLivestream(): Promise<void> {
  return _loadSdk(process.env.NEXT_PUBLIC_FACEBOOK_LIVESTREAM_APP_ID || "");
}

/** Open Facebook login popup and return the user access token, or null. */
export async function facebookLogin(): Promise<string | null> {
  await initFacebookLogin();
  return new Promise((resolve) => {
    window.FB.login(
      (res) => {
        resolve(
          res.status === "connected" && res.authResponse
            ? res.authResponse.accessToken
            : null
        );
      },
      { scope: "public_profile,email" }
    );
  });
}

/** Check existing Facebook login status without a popup. */
export async function checkFacebookLoginStatus(): Promise<string | null> {
  await initFacebookLogin();
  return new Promise((resolve) => {
    window.FB.getLoginStatus((res) => {
      resolve(
        res.status === "connected" && res.authResponse
          ? res.authResponse.accessToken
          : null
      );
    });
  });
}
