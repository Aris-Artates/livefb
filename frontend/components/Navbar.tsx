import { useRouter } from "next/router";
import { logout, type User } from "../utils/auth";

interface NavbarProps {
  user: User | null;
  dark?: boolean;
}

export default function Navbar({ user, dark = false }: NavbarProps) {
  const router = useRouter();
  const base = dark
    ? "bg-gray-900 border-gray-700 text-white"
    : "bg-white border-gray-200 text-gray-900";

  return (
    <nav className={`${base} border-b px-4 py-3 sticky top-0 z-40`}>
      <div className="max-w-screen-xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <button
          onClick={() => router.push("/dashboard")}
          className={`font-bold text-lg ${dark ? "text-white" : "text-gray-900"}`}
        >
          LMS
        </button>

        {/* Right side */}
        <div className="flex items-center gap-4">
          {user?.role === "admin" && (
            <button
              onClick={() => router.push("/admin")}
              className={`text-sm ${dark ? "text-gray-300 hover:text-white" : "text-gray-600 hover:text-gray-900"}`}
            >
              Admin
            </button>
          )}

          {/* Avatar + name */}
          <div className="flex items-center gap-2">
            {user?.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={user.avatar_url}
                alt={user.full_name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-sm font-medium">
                {user?.full_name?.[0]?.toUpperCase() || "?"}
              </div>
            )}
            <span className={`text-sm hidden sm:block ${dark ? "text-gray-300" : "text-gray-700"}`}>
              {user?.full_name}
            </span>
          </div>

          <button
            onClick={logout}
            className={`text-sm ${dark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-gray-700"}`}
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}
