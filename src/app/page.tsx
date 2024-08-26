"use client";
import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import ImprovedFogOfWarShogi from "@/components/FogOfWarShogi";

export default function Page() {
  return (
    <div className="min-h-screen  bg-gray-100 py-12 px-1 sm:px-1 lg:px-8 flex items-center justify-center">
      <Card className="mx-auto bg-white shadow-xl w-full max-w-[450px] py-8">
        <CardContent className="p-2">
          <h1 className="text-3xl font-bold mt-4 mb-2 text-center text-gray-800">
            霧将棋
          </h1>
          <ImprovedFogOfWarShogi />
        </CardContent>
      </Card>
    </div>
  );
}
