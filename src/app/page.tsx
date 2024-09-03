"use client";
import React from "react";
import ImprovedFogOfWarShogi from "@/components/FogOfWarShogi";

export default function Page() {
  return (
    <div className="h-dvh bg-slate-900 py-12 px-1 sm:px-1 lg:px-8 flex items-center justify-center overflow-hidden">
      <div className="cloud absolute inset-0 pointer-events-none"></div>
      <ImprovedFogOfWarShogi />
    </div>
  );
}
