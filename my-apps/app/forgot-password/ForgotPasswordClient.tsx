"use client";

import { useState, FormEvent, ChangeEvent } from "react";

const BACKEND_BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "";

export default function ForgotPasswordClient() {
  const [identifier, setIdentifier] = useState("");
  const [status, setStatus] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus(null);
    setIsSubmitting(true);

    try {
      const res = await fetch(`${BACKEND_BASE_URL}/api/forgot-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        setStatus({
          type: "error",
          message: json?.error || "Failed to reset password.",
        });
      } else {
        setStatus({
          type: "success",
          message: json?.message || "Password reset SMS sent.",
        });
      }
    } catch (err) {
      setStatus({
        type: "error",
        message: "Unable to reach the server. Please try again later.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 px-4">
      <div className="w-full max-w-md rounded-3xl border border-emerald-500/30 bg-slate-900/80 p-8 shadow-2xl shadow-emerald-900/30 backdrop-blur-xl">
        <h1 className="text-center text-2xl font-bold text-emerald-200 mb-4">
          Forgot Password
        </h1>
        <p className="text-sm text-slate-300 mb-6">
          Enter your email, username, or phone number. A new password will be
          generated and sent to your phone via SMS.
        </p>

        {status && (
          <div
            className={`mb-4 rounded-2xl px-4 py-3 text-sm font-medium ${
              status.type === "success"
                ? "bg-emerald-500/15 text-emerald-200 border border-emerald-500/30"
                : "bg-rose-500/10 text-rose-200 border border-rose-500/30"
            }`}
          >
            {status.message}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wide">
            Email, username, or phone
          </label>
          <input
            className="w-full rounded-2xl border border-slate-700 bg-slate-900/70 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/70 transition-all duration-300"
            type="text"
            value={identifier}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setIdentifier(e.target.value)
            }
            placeholder="e.g. user@example.com or 09123456789"
            required
          />

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-gradient-to-r from-emerald-500/90 to-teal-500/90 px-4 py-3 text-sm font-bold text-slate-900 shadow-lg shadow-emerald-500/30 hover:from-emerald-400 hover:to-teal-400 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Sending SMS…" : "Send reset SMS"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">
          Remembered your password?{" "}
          <a
            href="/login"
            className="font-semibold text-emerald-200 hover:text-emerald-100"
          >
            Sign in
          </a>
          .
        </p>
      </div>
    </div>
  );
}
