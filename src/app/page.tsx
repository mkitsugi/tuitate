"use client";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import ImprovedFogOfWarShogi from "@/components/FogOfWarShogi";

export default function Page() {
  return (
    <div className="h-dvh bg-slate-900 py-12 px-1 sm:px-1 lg:px-8 flex items-center justify-center overflow-hidden">
      <div className="cloud absolute inset-0 pointer-events-none"></div>
      {/* <Card className="mx-auto bg-white border-none shadow-sm w-full max-w-[450px] py-8 overflow-auto"> */}
      <Card className="mx-auto bg-white/10 backdrop-blur-md border border-white/20 shadow-lg w-full max-w-[450px] py-8 overflow-hidden">
        <CardContent className="p-2">
          <ImprovedFogOfWarShogi />
        </CardContent>
      </Card>
    </div>
  );
}
