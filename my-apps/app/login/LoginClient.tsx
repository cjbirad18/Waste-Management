"use client";

import { useEffect, useState, FormEvent, ChangeEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const friendlyRole = (role: string): string => {
  switch (role.toLowerCase()) {
    case "swmo":
    case "swmo head":
      return "SWMO Head";
    case "tcemo":
    case "tcemo head":
      return "TCEMO Head";
    case "bwmc":
      return "BWMC";
    case "secretary":
      return "Secretary";
    case "gcp":
      return "GCP";
    case "resident":
      return "Resident";
    default:
      return role.charAt(0).toUpperCase() + role.slice(1);
  }
};

const normalizeRole = (role: string): string => {
  const lower = role.toLowerCase().trim();
  if (lower === "swmo head" || lower === "swmo") return "swmo";
  if (lower === "tcemo head" || lower === "tcemo") return "tcemo";
  return lower;
};

const routeFromRole = (role: string): string => {
  return normalizeRole(role);
};

function ErrorModal({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    setShow(true);
  }, []);

  const handleClose = () => {
    setShow(false);
    setTimeout(onClose, 250);
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-all duration-300 ${
        show ? "opacity-100" : "opacity-0 pointer-events-none"
      }`}
    >
      <div
        className={`w-full max-w-sm rounded-3xl border-2 border-orange-500/40 bg-gradient-to-br from-slate-800/95 to-gray-800/95 p-6 text-slate-200 shadow-2xl shadow-orange-900/30 backdrop-blur-2xl transform transition-all duration-500 ${
          show
            ? "scale-100 opacity-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-6"
        }`}
      >
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 bg-orange-500/20 rounded-2xl flex items-center justify-center border border-orange-500/30 flex-shrink-0">
            <span className="text-xl">⚠️</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-orange-300 mb-1">
              Account Notice
            </h2>
            <p className="text-xs text-slate-300 leading-relaxed">{message}</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="w-full rounded-2xl bg-gradient-to-r from-orange-600/90 to-orange-700/90 px-4 py-2.5 text-xs font-bold text-slate-100 hover:from-orange-500/90 hover:shadow-lg hover:shadow-orange-500/25 transition-all duration-300 backdrop-blur-sm border border-orange-500/30"
        >
          Close
        </button>
      </div>
    </div>
  );
}

export default function LoginClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const roleParam = searchParams.get("role") || "resident";
  const expectedRole = normalizeRole(roleParam);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleCloseModal = () => setErrorMessage("");

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMessage("");

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMessage(error.message);
      return;
    }

    if (data.user) {
      const { data: userProfile, error: profileError } = await supabase
        .from("users")
        .select("role, status")
        .eq("user_id", data.user.id)
        .single();

      if (profileError || !userProfile?.role) {
        setErrorMessage(
          "Your account profile is incomplete. Please contact the administrator.",
        );
        await supabase.auth.signOut();
        return;
      }

      const userRole = normalizeRole(userProfile.role);

      if (userRole !== expectedRole) {
        setErrorMessage(
          `This login page is for ${friendlyRole(
            expectedRole,
          )} only. Your account role is ${friendlyRole(
            userRole,
          )}. Please use the correct login page.`,
        );
        await supabase.auth.signOut();
        return;
      }

      if (
        userProfile.status &&
        userProfile.status.toLowerCase() === "inactive"
      ) {
        setErrorMessage(
          "Your account has been deactivated. Please contact the system administrator.",
        );
        await supabase.auth.signOut();
        return;
      }

      if (
        userRole === "resident" &&
        userProfile.status?.toLowerCase() !== "approved"
      ) {
        setErrorMessage(
          userProfile.status?.toLowerCase() === "pending"
            ? "Your account is pending approval by the BWMC. Please wait for activation."
            : "Your account is not approved for login.",
        );
        await supabase.auth.signOut();
        return;
      } else if (
        userRole !== "resident" &&
        userProfile.status?.toLowerCase() === "rejected"
      ) {
        setErrorMessage("Your account has been rejected.");
        await supabase.auth.signOut();
        return;
      }

      router.push(`/dashboard/${routeFromRole(userProfile.role)}`);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-gray-900 to-emerald-900/80 text-slate-200 font-sans relative overflow-hidden">
      {/* Subtle background animation */}
      <div className="fixed inset-0 opacity-30">
        <div className="absolute inset-0 bg-gradient-to-br from-green-500/10 to-emerald-500/10 animate-pulse" />
      </div>

      {errorMessage && (
        <ErrorModal message={errorMessage} onClose={handleCloseModal} />
      )}

      <div className="w-full max-w-md px-6 relative z-10">
        <div className="text-center mb-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-green-500/90 to-emerald-600/90 text-2xl shadow-2xl shadow-green-500/30 mx-auto mb-4 hover:scale-110 transition-all duration-300">
            🚛
          </div>
          <p className="text-xs uppercase tracking-[0.3em] bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent font-bold">
            Track-the-Truck
          </p>
          <h1 className="mt-2 text-2xl md:text-3xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-2xl">
            Role Login
          </h1>
          <p className="text-sm text-emerald-400 mt-1 font-medium">
            {friendlyRole(roleParam)}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-green-800/50 bg-gradient-to-br from-slate-800/95 to-gray-800/95 p-8 shadow-2xl shadow-green-900/30 backdrop-blur-2xl space-y-6 relative overflow-hidden"
        >
          {/* Subtle glow border */}
          <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-transparent to-emerald-500/10 rounded-3xl blur-xl opacity-50" />

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-emerald-300 uppercase tracking-wide">
                Email Address
              </label>
              <input
                className="w-full rounded-2xl border border-green-800/50 bg-slate-900/80 px-5 py-3 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                type="email"
                value={email}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  setEmail(e.target.value)
                }
                required
                placeholder="Enter your email"
              />
            </div>

            <div className="space-y-2">
              <label className="block text-xs font-semibold text-emerald-300 uppercase tracking-wide">
                Password
              </label>
              <div className="relative">
                <input
                  className="w-full rounded-2xl border border-green-800/50 bg-slate-900/80 px-5 py-3 pr-12 text-sm text-slate-200 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300 backdrop-blur-xl shadow-lg hover:shadow-emerald-500/20"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e: ChangeEvent<HTMLInputElement>) =>
                    setPassword(e.target.value)
                  }
                  required
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-300 transition-colors"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                      />
                    </svg>
                  ) : (
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="group relative w-full rounded-2xl bg-gradient-to-r from-green-600/95 to-emerald-600/95 px-6 py-4 text-sm font-bold text-slate-100 shadow-xl shadow-green-500/30 hover:shadow-2xl hover:shadow-emerald-500/40 hover:scale-[1.02] transition-all duration-300 backdrop-blur-xl border border-green-500/30 overflow-hidden"
            >
              <span className="relative z-10">Sign In →</span>
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            </button>
          </div>

          {expectedRole === "resident" && (
            <div className="pt-4 text-center border-t border-green-800/30">
              <p className="text-xs text-slate-400 mb-2">No account yet?</p>
              <Link
                href="/register"
                className="block w-full rounded-2xl bg-emerald-500/20 px-4 py-3 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/30 hover:text-emerald-200 transition-all duration-300 backdrop-blur-sm border border-emerald-500/40 hover:border-emerald-400/60 cursor-pointer touch-manipulation"
              >
                Create Resident Account
              </Link>
            </div>
          )}

          <Link
            href="/"
            className="block w-full rounded-2xl bg-slate-700/50 px-4 py-3 text-center text-xs font-semibold text-slate-300 hover:bg-slate-600/50 hover:text-emerald-300 transition-all duration-300 backdrop-blur-sm border border-slate-600/50 hover:border-emerald-500/50 cursor-pointer touch-manipulation"
          >
            ← Back to Dashboard
          </Link>
        </form>

        {/* Status indicator */}
        <div className="mt-6 text-center">
          <div className="inline-flex items-center gap-2 text-xs text-emerald-400 bg-slate-800/50 px-4 py-2 rounded-full backdrop-blur-sm border border-emerald-500/30">
            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
            Secured by Supabase
          </div>
        </div>
      </div>
    </div>
  );
}
