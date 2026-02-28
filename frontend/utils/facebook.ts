// Facebook JS SDK wrapper
// Docs: https://developers.facebook.com/docs/javascript/reference/
//
// This project uses TWO separate Facebook apps:
//   1. Login App      — for FB.login() / OAuth  (NEXT_PUBLIC_FACEBOOK_LOGIN_APP_ID)
//   2. Livestream App — for fb-video XFBML embeds (NEXT_PUBLIC_FACEBOOK_LIVESTREAM_APP_ID)
//
// The Facebook JS SDK can only be initialised once per page load.
// Login pages call initFacebookLogin(); livestream pages call initFacebookLivestream().

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

// ─── Promise singleton ────────────────────────────────────────────────────────
// We store ONE shared Promise for the SDK load.  Every caller — whether from
// useEffect or the login button click — awaits the SAME Promise object.
// This eliminates the race condition that existed with the old boolean flag,
// where concurrent callers each created a different Promise and only one
// of them would ever resolve (the one whose `fbAsyncInit` callback survived).

let _sdkPromise: Promise<void> | null = null;

/** Load the Facebook JS SDK once and call FB.init() with the given App ID. */
function _loadSdk(appId: string): Promise<void> {
  // Already loading or loaded — return the shared Promise
  if (_sdkPromise) return _sdkPromise;

  // Catch misconfigured environments early so the error message is clear
  if (!appId) {
    const msg =
      "Facebook App ID is not set. " +
      "Add NEXT_PUBLIC_FACEBOOK_LOGIN_APP_ID (or NEXT_PUBLIC_FACEBOOK_LIVESTREAM_APP_ID) " +
      "to your Vercel environment variables and redeploy.";
    console.error("[facebook.ts]", msg);
    return Promise.reject(new Error(msg));
  }

  _sdkPromise = new Promise<void>((resolve, reject) => {
    function doInit() {
      window.FB.init({
        appId,
        cookie: false, // we manage sessions with our own JWT, not FB cookies
        xfbml: true,
        version: "v18.0",
      });
      resolve();
    }

    // SDK already loaded (SPA navigation — window.FB survived the route change)
    if (typeof window !== "undefined" && typeof window.FB !== "undefined") {
      doInit();
      return;
    }

    // Wire up the async-init callback BEFORE the script tag is added so the
    // SDK finds it when the script finishes executing.
    window.fbAsyncInit = doInit;

    if (document.getElementById("facebook-jssdk")) {
      // Script tag already in the DOM (added by a previous, now-abandoned call).
      // fbAsyncInit will fire once the script finishes — nothing more to do.
      return;
    }

    // First time: inject the SDK script
    const script = document.createElement("script");
    script.id = "facebook-jssdk";
    script.src = "https://connect.facebook.net/en_US/sdk.js";
    script.async = true;
    script.defer = true;
    script.onerror = () => {
      _sdkPromise = null; // allow a retry next time
      reject(new Error("Failed to load the Facebook SDK (network error or ad-blocker?)"));
    };
    document.head.appendChild(script);
  });

  return _sdkPromise;
}

/**
 * Initialise the Facebook JS SDK for the Login / OAuth App.
 * Await this before calling FB.login() or FB.getLoginStatus().
 */
export function initFacebookLogin(): Promise<void> {
  return _loadSdk(process.env.NEXT_PUBLIC_FACEBOOK_LOGIN_APP_ID || "");
}

/**
 * Initialise the Facebook JS SDK for the Livestream / Video Embed App.
 * Await this before calling XFBML.parse() on embed components.
 */
export function initFacebookLivestream(): Promise<void> {
  return _loadSdk(process.env.NEXT_PUBLIC_FACEBOOK_LIVESTREAM_APP_ID || "");
}

/** Open the Facebook login popup and return the user access token, or null. */
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

/** Check the existing Facebook login status without showing a popup. */
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
