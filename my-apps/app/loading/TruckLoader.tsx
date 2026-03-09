"use client";

const TruckLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-[300px] p-8 bg-gradient-to-br from-slate-900/80 to-gray-900/80 rounded-2xl border border-green-800/50 backdrop-blur-xl shadow-2xl shadow-green-900/30">
    <div className="truck-running mb-6">
      <img
        src="/recycling-truck.png"
        alt="Truck loading icon"
        width={140}
        height={80}
        className="drop-shadow-2xl shadow-emerald-500/40"
      />
    </div>
    <div className="space-y-2 text-center">
      <p className="text-lg font-black bg-gradient-to-r from-slate-100 to-emerald-400 bg-clip-text text-transparent drop-shadow-xl tracking-tight">
        Loading Trucks...
      </p>
      <div className="flex gap-1 justify-center">
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping [animation-delay:0.1s]"></div>
        <div className="w-2 h-2 bg-emerald-400 rounded-full animate-ping [animation-delay:0.2s]"></div>
        <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping [animation-delay:0.3s]"></div>
      </div>
    </div>

    <style jsx>{`
      @keyframes truck-run {
        0%,
        100% {
          transform: translateX(0) rotate(0deg);
        }
        50% {
          transform: translateX(20px) rotate(2deg);
        }
      }
      .truck-running {
        animation: truck-run 1.2s infinite alternate
          cubic-bezier(0.45, 0.05, 0.55, 0.95);
      }
      .truck-running img {
        filter: drop-shadow(0 10px 8px rgba(6, 78, 59, 0.3));
      }
    `}</style>
  </div>
);

export default TruckLoader;
