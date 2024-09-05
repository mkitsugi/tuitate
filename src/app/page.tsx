"use client";
import React from "react";
import Image from "next/image";
import ImprovedFogOfWarShogi from "@/components/FogOfWarShogi";

export default function Page() {
  return (
    <div className="h-dvh py-12 px-1 sm:px-1 lg:px-8 flex items-center justify-center overflow-hidden">
      <Image
        src="/bg/night.png"
        alt="Background"
        fill
        objectFit="cover"
        sizes="300vw"
        priority
        quality={100}
        className="-z-50"
      />
      <div className="cloud absolute inset-0 pointer-events-none z-10"></div>
      <ImprovedFogOfWarShogi />
    </div>
  );
}
