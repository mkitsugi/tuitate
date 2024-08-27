import React from "react";

export default function WaitingOverlay() {
  return (
    <div className="absolute inset-0 m-1 bg-black rounded-md bg-opacity-50 flex items-center justify-center z-10">
      <div className="bg-slate-50/50 p-4 rounded-lg shadow-lg">
        <p className="text-sm font-semibold text-white/70">
          相手のアクションを待っています
        </p>
      </div>
    </div>
  );
}
