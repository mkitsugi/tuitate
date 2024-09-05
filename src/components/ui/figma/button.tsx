"use client";
import React, { useState } from "react";

interface FigmaButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger" | "red" | "blue" | "green";
}

const FigmaButton: React.FC<FigmaButtonProps> = ({
  children,
  variant = "primary",
  className,
  ...props
}) => {
  const [isPressed, setIsPressed] = useState(false);
  const buttonSvgPath = `/ui/button/${variant}.svg`;

  return (
    <button
      {...props}
      className={`relative inline-block w-full ${className}`}
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
      onMouseLeave={() => setIsPressed(false)}
    >
      <div style={{ paddingTop: "33.33%" }}>
        <img
          src={buttonSvgPath}
          alt={`${variant} button`}
          className="absolute top-0 left-0 w-full h-full object-cover"
          style={{
            opacity: isPressed ? 0.8 : 1,
          }}
        />
      </div>
      <span className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-white text-sm font-bold pb-1 whitespace-nowrap">
        {children}
      </span>
    </button>
  );
};

export default FigmaButton;
