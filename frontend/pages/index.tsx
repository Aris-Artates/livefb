import { useEffect } from "react";
import { useRouter } from "next/router";
import { isTokenValid } from "../utils/auth";

export default function IndexPage() {
  const router = useRouter();
  useEffect(() => {
    if (isTokenValid()) {
      router.replace("/dashboard");
    } else {
      router.replace("/login");
    }
  }, []);
  return null;
}
