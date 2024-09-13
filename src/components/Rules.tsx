import React from "react";
import Image from "next/image";
import FigmaButton from "./ui/figma/button";
import RulesContent from "./RulesContent";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";

export default function RulesDialog() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <FigmaButton
          variant="button_rectangle_02"
          className="w-full max-w-[160px] sm:max-w-[160px]"
          textClassName="text-[13px] sm:text-[15px]"
        >
          ルールについて
        </FigmaButton>
      </DialogTrigger>
      <DialogContent className="max-w-md bg-transparent border-none">
        <div
          className="absolute inset-0 bg-contain bg-center bg-no-repeat"
          style={{
            backgroundImage: `url('/ui/window/scalable_window_02_01${
              window.innerWidth <= 500 ? "_sp" : ""
            }.png')`,
          }}
        />
        <div className="relative z-10 p-6">
          <RulesContent />
        </div>
        <DialogClose className="absolute right-4 top-4 ring-offset-background transition-opacity hover:opacity-100 disabled:pointer-events-none">
          <Image
            src="/ui/button/button_close.png"
            alt="Close"
            width={28}
            height={28}
          />
          <span className="sr-only">Close</span>
        </DialogClose>
      </DialogContent>
    </Dialog>
  );
}
