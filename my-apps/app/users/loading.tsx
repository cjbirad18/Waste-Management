export default function Loading() {
  return (
    <main className="min-h-screen flex flex-col justify-center items-center bg-gradient-to-r from-gray-900 via-gray-800 to-gray-700 font-mono text-white">
      <h1 className="text-4xl font-extrabold tracking-wider bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 bg-clip-text text-transparent animate-pulse">
        Loading...
      </h1>
      <div className="mt-6 w-12 h-12 border-4 border-t-transparent border-purple-500 rounded-full animate-spin"></div>
    </main>
  );
}
