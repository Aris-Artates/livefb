import type { AppProps } from "next/app";
import { useEffect, useState } from "react";
import Head from "next/head";
import { getCurrentUser, type User } from "../utils/auth";
import "../styles/globals.css";

export default function App({ Component, pageProps }: AppProps) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then(setUser)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-500">Loading…</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>LMS</title>
      </Head>
      <Component {...pageProps} user={user} setUser={setUser} />
    </>
  );
}
