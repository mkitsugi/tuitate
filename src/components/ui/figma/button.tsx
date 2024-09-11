"use client";
import React, { useState, forwardRef } from "react";
import { cn } from "@/lib/utils";

interface FigmaButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: string;
  textClassName?: string;
  hasHoverState?: boolean;
  customHoverPath?: string;
}

const FigmaButton = forwardRef<HTMLButtonElement, FigmaButtonProps>(
  (
    {
      children,
      variant = "primary",
      className,
      textClassName = "",
      hasHoverState = true,
      customHoverPath,
      ...props
    },
    ref
  ) => {
    const [isPressed, setIsPressed] = useState(false);
    const [isHovered, setIsHovered] = useState(false);

    const buttonDefaultPath = `/ui/button/${variant}.png`;
    const buttonHoverPath = customHoverPath || `/ui/button/${variant}_hover.png`;
    const buttonPressedPath = `/ui/button/${variant}_click.png`;

    const currentImagePath =
      hasHoverState && isHovered ? buttonHoverPath : buttonDefaultPath;

    return (
      <button
        {...props}
        ref={ref}
        className={`relative inline-block ${className}`}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          transition: "transform 0.1s ease-in-out",
          transform: isPressed ? "scale(0.95)" : "scale(1)",
        }}
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseEnter={() => hasHoverState && setIsHovered(true)}
        onMouseLeave={() => {
          setIsPressed(false);
          hasHoverState && setIsHovered(false);
        }}
      >
        <div style={{ paddingTop: "33.33%", overflow: "hidden" }}>
          <img
            src={currentImagePath}
            alt={`${variant} button`}
            className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-full h-full object-cover"
            style={{
              width: "auto",
              maxWidth: "none",
            }}
          />
        </div>
        <span
          className={cn(
            "absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-black text-sm tracking-wide font-bold whitespace-nowrap",
            hasHoverState && isHovered ? "text-white" : "",
            textClassName
          )}
        >
          {children}
        </span>
      </button>
    );
  }
);

FigmaButton.displayName = "FigmaButton";

export default FigmaButton;
