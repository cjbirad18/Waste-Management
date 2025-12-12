import React from "react";

const TruckLoader = () => (
  <div className="flex flex-col items-center justify-center min-h-screen bg-white">
    <div className="truck-running">
      <img
        src="/recycling-truck.png"
        alt="Truck loading icon"
        width={140}
        height={80}
      />
    </div>
    <p className="mt-6 text-gray-700 text-lg font-semibold text-center">
      Loading Please Wait...
    </p>

    <style jsx>{`
      @keyframes truck-run {
        0%,
        100% {
          transform: translateX(0);
        }
        50% {
          transform: translateX(40px);
        }
      }
      .truck-running {
        animation: truck-run 1s infinite alternate
          cubic-bezier(0.45, 0.05, 0.55, 0.95);
      }
    `}</style>
  </div>
);

export default TruckLoader;
