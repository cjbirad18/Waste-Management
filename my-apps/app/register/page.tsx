"use client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`bg-white rounded-lg p-6 shadow-lg max-w-xs w-full border border-red-200 transform transition-all duration-300 ${
          show
            ? "scale-100 opacity-100 translate-y-0"
            : "opacity-0 scale-90 translate-y-12"
        }`}
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
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 transition-opacity duration-300 ${
        show ? "opacity-100" : "opacity-0"
      }`}
    >
      <div
        className={`bg-white rounded-lg p-6 shadow-lg max-w-xs w-full border border-green-200 transform transition-all duration-300 ${
          show
            ? "scale-100 opacity-100 translate-y-0"
            : "opacity-0 scale-90 translate-y-12"
        }`}
      >
        <h2 className="text-lg font-bold mb-3 text-green-600 flex items-center gap-2">
          <span>✅</span> Registration Successful
        </h2>
        <p className="text-gray-800 mb-4">{message}</p>
        <button
          onClick={handleClose}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded shadow w-full"
        >
          OK
        </button>
      </div>
    </div>
  );
}

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
      // Insert user profile in SQL table (with status: pending, and barangay as FK)
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
          barangay_id: barangayId, // FK ID, not name!
        },
      ]);

      if (profileError) {
        setError(`Profile error: ${profileError.message}`);
        return;
      }
    }

    setMessage(
      "Registration successful! Your account will be activated by your BWMC once approved. Please check your email to complete verification."
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
    <div className="min-h-screen flex justify-center items-center bg-gradient-to-br from-green-50 to-green-100 p-4">
      <form
        onSubmit={handleSignUp}
        className="bg-white p-8 rounded-lg shadow-lg w-full max-w-2xl"
      >
        <h1 className="text-3xl font-bold mb-8 text-center text-green-700">
          Register
        </h1>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label
              htmlFor="username"
              className="block mb-2 text-green-900 font-semibold"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              className="w-full px-4 py-2 border border-green-200 rounded-md focus:outline-none focus:ring focus:ring-green-300 text-black"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              placeholder="Username"
            />
          </div>
          <div>
            <label
              htmlFor="firstName"
              className="block mb-2 text-green-900 font-semibold"
            >
              First Name
            </label>
            <input
              id="firstName"
              type="text"
              className="w-full px-4 py-2 border border-green-200 rounded-md focus:outline-none focus:ring focus:ring-green-300 text-black"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              placeholder="First name"
            />
          </div>
          <div>
            <label
              htmlFor="lastName"
              className="block mb-2 text-green-900 font-semibold"
            >
              Last Name
            </label>
            <input
              id="lastName"
              type="text"
              className="w-full px-4 py-2 border border-green-200 rounded-md focus:outline-none focus:ring focus:ring-green-300 text-black"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              placeholder="Last name"
            />
          </div>
          <div>
            <label
              htmlFor="email"
              className="block mb-2 text-green-900 font-semibold"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              className="w-full px-4 py-2 border border-green-200 rounded-md focus:outline-none focus:ring focus:ring-green-300 text-black"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
            />
          </div>
          <div>
            <label
              htmlFor="contactNumber"
              className="block mb-2 text-green-900 font-semibold"
            >
              Contact Number
            </label>
            <input
              id="contactNumber"
              type="tel"
              className="w-full px-4 py-2 border border-green-200 rounded-md focus:outline-none focus:ring focus:ring-green-300 text-black"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              required
              placeholder="Contact number"
            />
          </div>
          <div>
            <label
              htmlFor="barangay"
              className="block mb-2 text-green-900 font-semibold"
            >
              Barangay
            </label>
            <select
              id="barangay"
              className="w-full px-4 py-2 border border-green-200 rounded-md focus:outline-none focus:ring focus:ring-green-300 text-black"
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
              className="block mb-2 text-green-900 font-semibold"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              className="w-full px-4 py-2 border border-green-200 rounded-md focus:outline-none focus:ring focus:ring-green-300 text-black"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
            />
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block mb-2 text-green-900 font-semibold"
            >
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              className="w-full px-4 py-2 border border-green-200 rounded-md focus:outline-none focus:ring focus:ring-green-300 text-black"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              placeholder="Confirm your password"
            />
          </div>
        </div>

        <button
          type="submit"
          className="mt-8 w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3 rounded-md transition duration-200"
        >
          Register
        </button>
        <p className="mt-6 text-center text-green-700">
          Already have an account?{" "}
          <a
            href="/login"
            className="underline font-semibold hover:text-green-900"
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
