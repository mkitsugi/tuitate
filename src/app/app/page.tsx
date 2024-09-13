"use client";
import React, { useEffect } from "react";
import Image from "next/image";
import ImprovedFogOfWarShogi from "@/components/FogOfWarShogi";
import { SplashScreen } from '@capacitor/splash-screen';

export default function Page() {
  useEffect(() => {
    SplashScreen.hide();
  }, []);
  return (
    <div className="h-dvh py-12 px-1 sm:px-1 lg:px-8 flex items-center justify-center overflow-hidden relative">
      <Image
        src="/bg/night.png"
        alt="Background"
        fill
        sizes="300vw"
        priority
        quality={100}
        className="-z-50 object-cover"
      />
      <div className="cloud absolute inset-0 pointer-events-none z-10"></div>
      <ImprovedFogOfWarShogi />
    </div>
  );
}
