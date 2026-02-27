// Facebook JS SDK wrapper
// Docs: https://developers.facebook.com/docs/javascript/reference/

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

export function initFacebook(): Promise<void> {
  if (_sdkReady) return Promise.resolve();

  return new Promise((resolve) => {
    window.fbAsyncInit = () => {
      window.FB.init({
        appId: process.env.NEXT_PUBLIC_FACEBOOK_APP_ID || "",
        // Do NOT use FB cookies — we manage session via our own JWT
        cookie: false,
        xfbml: true,
        version: "v18.0",
      });
      _sdkReady = true;
      resolve();
    };

    if (document.getElementById("facebook-jssdk")) {
      // SDK already loading — wait for fbAsyncInit to fire
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

/** Open Facebook login popup and return the user access token, or null. */
export async function facebookLogin(): Promise<string | null> {
  await initFacebook();
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
  await initFacebook();
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
