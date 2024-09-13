"use client";
import React, { useEffect } from "react";
import Image from "next/image";
import ImprovedFogOfWarShogi from "@/components/FogOfWarShogi";
import { initializePushNotifications, getFCMToken } from "@/utils/notification";
import { SplashScreen } from '@capacitor/splash-screen';

export default function Page() {
  useEffect(() => {
    SplashScreen.hide();
    const setup = async () => {
      try {
        await initializePushNotifications();
        const token = await getFCMToken();
        console.log('FCMトークン:', token);
      } catch (error) {
        console.error('プッシュ通知の初期化エラー:', error);
      }
    };

    setup();
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
