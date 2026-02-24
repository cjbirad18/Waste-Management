"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

/* ---------- Modals (dark theme) ---------- */

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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative w-full max-w-sm mx-4 rounded-2xl border border-red-700/70 bg-slate-900/95 text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,0.7)] transform transition-all duration-300 ${
          show
            ? "scale-100 opacity-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-900 via-slate-950 to-slate-900 px-4 py-2 border-b border-red-700/70">
          <div className="flex items-center gap-2">
            <span className="flex gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500/90 shadow-sm shadow-red-900" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80 shadow-sm shadow-amber-900" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400/80 shadow-sm shadow-slate-900" />
            </span>
            <span className="ml-2 text-xs font-semibold tracking-wide text-slate-100">
              Account Notice
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-sm font-semibold text-slate-400 hover:text-red-400 px-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="mb-4 text-sm text-red-200">{message}</p>
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-red-600 to-rose-600 text-slate-50 border border-red-500/80 shadow-sm shadow-red-800/70 hover:from-red-500 hover:to-rose-500 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function SuccessModal({
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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
      onClick={handleClose}
    >
      <div
        className={`relative w-full max-w-sm mx-4 rounded-2xl border border-emerald-700/70 bg-slate-900/95 text-slate-100 shadow-[0_18px_45px_rgba(0,0,0,0.7)] transform transition-all duration-300 ${
          show
            ? "scale-100 opacity-100 translate-y-0"
            : "opacity-0 scale-95 translate-y-4"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Title bar */}
        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800 px-4 py-2 border-b border-emerald-700/70">
          <div className="flex items-center gap-2">
            <span className="flex gap-1">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/90 shadow-sm shadow-emerald-900" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80 shadow-sm shadow-amber-900" />
              <span className="h-2.5 w-2.5 rounded-full bg-slate-400/80 shadow-sm shadow-slate-900" />
            </span>
            <span className="ml-2 text-xs font-semibold tracking-wide text-slate-100">
              Registration Successful
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-sm font-semibold text-slate-400 hover:text-emerald-400 px-1"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-5">
          <p className="mb-4 text-sm text-slate-200">{message}</p>
          <button
            onClick={handleClose}
            className="w-full px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 text-slate-50 border border-emerald-500/80 shadow-sm shadow-emerald-800/70 hover:from-emerald-500 hover:to-teal-500 transition-colors"
          >
            OK
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Page ---------- */

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [barangayId, setBarangayId] = useState("");
  const [barangayOptions, setBarangayOptions] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const router = useRouter();

  const isValidPhContact = (value: string) => {
    // must start with 09 and have exactly 11 digits
    return /^09\d{9}$/.test(value);
  };

  // Password strength checker
  const isStrongPassword = (pw: string) => {
    // At least 8 chars, 1 uppercase, 1 lowercase, 1 number, 1 special char
    return (
      pw.length >= 8 &&
      /[A-Z]/.test(pw) &&
      /[a-z]/.test(pw) &&
      /[0-9]/.test(pw) &&
      /[^A-Za-z0-9]/.test(pw)
    );
  };

  // Fetch all barangays from table on mount
  useEffect(() => {
    async function fetchBarangays() {
      const { data, error } = await supabase
        .from("barangay")
        .select("barangay_id, barangay_name")
        .order("barangay_name");
      if (!error && data) setBarangayOptions(data as any[]);
    }
    fetchBarangays();
  }, []);

  const handleSignUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setMessage("");

    if (!isValidPhContact(contactNumber)) {
      setError(
        "Contact number must start with 09 and be 11 digits (e.g. 09123456789).",
      );
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (!isStrongPassword(password)) {
      setError(
        "Password must be strong: at least 8 characters, include uppercase, lowercase, number, and special character.",
      );
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!barangayId) {
      setError("Please select a barangay.");
      return;
    }

    // Check for unique username
    const { data: usernameData, error: usernameError } = await supabase
      .from("users")
      .select("username")
      .eq("username", username);

    if (usernameError) {
      setError("Unable to validate username. Please try again.");
      return;
    }

    if (usernameData && usernameData.length > 0) {
      setError("Username already taken. Please choose another.");
      return;
    }

    // Create authentication user
    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      return;
    }

    if (data?.user) {
      // Insert user profile in SQL table
      const { error: profileError } = await supabase.from("users").insert([
        {
          user_id: data.user.id,
          username,
          email,
          first_name: firstName,
          last_name: lastName,
          contact_number: contactNumber,
          role: "Resident",
          status: "pending",
          date_created: new Date().toISOString(),
          barangay_id: barangayId,
        },
      ]);

      if (profileError) {
        setError(`Profile error: ${profileError.message}`);
        return;
      }
    }

    setMessage(
      "Registration successful! Your account will be activated by your BWMC once approved. Please check your Message to complete verification.",
    );
    setUsername("");
    setFirstName("");
    setLastName("");
    setEmail("");
    setContactNumber("");
    setPassword("");
    setConfirmPassword("");
    setBarangayId("");
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-slate-900 via-gray-900 to-emerald-900/80 px-4 py-8">
      <form
        onSubmit={handleSignUp}
        className="w-full max-w-2xl rounded-3xl border border-emerald-800/60 bg-gradient-to-br from-slate-900/95 to-slate-950/95 shadow-2xl shadow-emerald-900/40 backdrop-blur-2xl px-8 py-10"
      >
        <div className="mb-8 text-center">
          <p className="text-xs uppercase tracking-[0.3em] text-emerald-400 font-semibold mb-1">
            Track-the-Truck
          </p>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-slate-100 to-emerald-300 bg-clip-text text-transparent drop-shadow-lg">
            Resident Registration
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            Create your account to submit incident reports and track collection
            updates.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-sm">
          <div>
            <label
              htmlFor="username"
              className="block mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              className="w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/70"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Username"
            />
          </div>
          <div>
            <label
              htmlFor="firstName"
              className="block mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300"
            >
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              className="w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/70"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              placeholder="First name"
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="block mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300"
            >
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              className="w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/70"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              placeholder="Last name"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              className="w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/70"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label
              htmlFor="contactNumber"
              className="block mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300"
            >
              Contact Number
            </label>
            <input
              id="contactNumber"
              type="tel"
              className="w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/70"
              value={contactNumber}
              onChange={(e) => {
                const v = e.target.value.replace(/\D/g, "");
                if (v.length <= 11) setContactNumber(v);
              }}
              required
              placeholder="09123456789"
            />
          </div>
          <div>
            <label
              htmlFor="barangay"
              className="block mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300"
            >
              Barangay
            </label>
            <select
              id="barangay"
              className="w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/70"
              value={barangayId}
              onChange={(e) => setBarangayId(e.target.value)}
              required
            >
              <option value="">Select barangay...</option>
              {barangayOptions.map(({ barangay_id, barangay_name }: any) => (
                <option key={barangay_id} value={barangay_id}>
                  {barangay_name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="password"
              className="block mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/70"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
            {/* Password strength display */}
            {password && (
              <p
                className={`mt-2 text-xs font-semibold ${isStrongPassword(password) ? "text-emerald-400" : "text-red-400"}`}
              >
                {isStrongPassword(password)
                  ? "Password is strong"
                  : "Password is weak (min 8 chars, uppercase, lowercase, number, special character)"}
              </p>
            )}
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block mb-2 text-xs font-semibold uppercase tracking-wide text-slate-300"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              className="w-full px-4 py-2 rounded-xl bg-slate-900/80 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/60 focus:border-emerald-500/70"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm your password"
            />
          </div>
        </div>

        {error && (
          <p className="mt-4 text-xs text-red-300 bg-red-900/40 border border-red-700/60 rounded-xl px-3 py-2">
            {error}
          </p>
        )}

        <button
          type="submit"
          className="mt-8 w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-semibold text-slate-50 shadow-xl shadow-emerald-800/60 hover:from-emerald-500 hover:to-teal-500 transition-colors"
        >
          Register
        </button>
        <p className="mt-6 text-center text-sm text-slate-300">
          Already have an account?{" "}
          <a
            href="/login"
            className="font-semibold text-emerald-400 hover:text-emerald-300 underline-offset-4 hover:underline"
          >
            Login
          </a>
        </p>
      </form>

      {message && (
        <SuccessModal
          message={message}
          onClose={() => {
            setMessage("");
            router.push("/login");
          }}
        />
      )}

      {error && <ErrorModal message={error} onClose={() => setError("")} />}
    </div>
  );
}
