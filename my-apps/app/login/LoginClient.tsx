"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const friendlyRole = (role: string): string => {
  switch (role.toLowerCase()) {
    case "swmo":
      return "SWMO Head";
    case "tcemo":
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

const routeFromRole = (role: string): string => {
  switch (role.toLowerCase().trim()) {
    case "swmo head":
      return "swmo";
    case "tcemo head":
      return "tcemo";
    case "bwmc":
      return "bwmc";
    case "secretary":
      return "secretary";
    case "gcp":
      return "gcp";
    case "resident":
      return "resident";
    default:
      return "resident";
  }
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
    // Start animation after mount
    setShow(true);
  }, []);

  const handleClose = () => {
    setShow(false);
    setTimeout(onClose, 250); // allow animation to finish before removing from DOM
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`bg-white rounded-lg p-6 shadow-lg max-w-xs w-full border border-red-200 transform transition-all duration-300
          ${
            show
              ? "scale-100 opacity-100 translate-y-0"
              : "opacity-0 scale-90 translate-y-12"
          }
        `}
      >
        <h2 className="text-lg font-bold mb-3 text-red-600 flex items-center gap-2">
          <span>⚠️</span> Account Notice
        </h2>
        <p className="text-gray-800 mb-4">{message}</p>
        <button
          onClick={handleClose}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded shadow w-full"
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
  const role = roleParam.toLowerCase();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const handleCloseModal = () => setErrorMessage("");

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
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
          "Your account profile is incomplete. Please contact the administrator."
        );
        await supabase.auth.signOut();
        return;
      }

      if (
        userProfile.status &&
        userProfile.status.toLowerCase() === "inactive"
      ) {
        setErrorMessage(
          "Your account has been deactivated. Please contact the system administrator."
        );
        await supabase.auth.signOut();
        return;
      }

      // Step 5: Block resident login unless status is exactly "approved"
      if (
        userProfile.role.toLowerCase() === "resident" &&
        userProfile.status?.toLowerCase() !== "approved"
      ) {
        setErrorMessage(
          userProfile.status?.toLowerCase() === "pending"
            ? "Your account is pending approval by the BWMC. Please wait for activation."
            : "Your account is not approved for login."
        );
        await supabase.auth.signOut();
        return;
      } else if (
        userProfile.role.toLowerCase() !== "resident" &&
        userProfile.status?.toLowerCase() === "rejected"
      ) {
        setErrorMessage("Your account has been rejected.");
        await supabase.auth.signOut();
        return;
      }

      // Step 6: Other approved users can enter
      router.push(`/dashboard/${routeFromRole(userProfile.role)}`);
    }
  };

  return (
    <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-green-50 to-green-100">
      {errorMessage && (
        <ErrorModal message={errorMessage} onClose={handleCloseModal} />
      )}
      <form
        onSubmit={handleSubmit}
        className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md"
      >
        <h1 className="text-3xl font-bold mb-6 text-center text-green-700">
          Login as {friendlyRole(role)}
        </h1>
        <div className="mb-4">
          <label className="block mb-2 text-green-900 font-semibold">
            Email
          </label>
          <input
            className="w-full px-4 py-2 border border-green-200 rounded-md focus:outline-none focus:ring focus:ring-green-300 text-black"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="Enter your email"
          />
        </div>
        <div className="mb-4">
          <label className="block mb-2 text-green-900 font-semibold">
            Password
          </label>
          <input
            className="w-full px-4 py-2 border border-green-200 rounded-md focus:outline-none focus:ring focus:ring-green-300 text-black"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Password"
          />
        </div>
        <button
          type="submit"
          className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 rounded-md transition duration-200"
        >
          Login
        </button>
        {role === "resident" && (
          <div className="mt-2 text-center">
            <span className="text-green-700">or </span>
            <a
              href="/register"
              className="underline font-semibold text-black hover:text-green-900"
            >
              Register
            </a>
          </div>
        )}
        <a
          href="/"
          className="w-full mt-4 block bg-gray-200 hover:bg-gray-300 text-green-700 font-semibold py-2 rounded-md text-center transition duration-200"
        >
          Back to Home
        </a>
      </form>
    </div>
  );
}
