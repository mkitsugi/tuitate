import React from "react";

export default function WaitingOverlay() {
  return (
    <div className="absolute inset-0 bg-black rounded-sm bg-opacity-50 flex items-center justify-center z-10">
      <div className="bg-white/80 backdrop-blur-sm p-4 rounded-lg shadow-lg">
        <p className="text-sm font-semibold">相手のアクションを待っています</p>
      </div>
    </div>
  );
}
