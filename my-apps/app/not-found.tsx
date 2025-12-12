export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-700 font-mono">
      <h1 className="text-5xl font-bold bg-gradient-to-r from-purple-600 via-pink-500 to-red-400 bg-clip-text text-transparent tracking-wide">
        User Not Found
      </h1>
      <p className="mt-4 text-lg text-gray-300">
        The user you are looking for does not exist.
      </p>
      <a
        href="/"
        className="mt-8 px-8 py-3 rounded-lg bg-gradient-to-r from-teal-400 to-green-400 text-white font-semibold shadow hover:scale-105 transition"
      >
        Go back home
      </a>
    </main>
  );
}
