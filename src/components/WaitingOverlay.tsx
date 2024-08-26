import React from "react";

export default function WaitingOverlay() {
  return (
    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10">
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <p className="text-lg font-semibold">相手のアクションを待っています</p>
      </div>
    </div>
  );
}
