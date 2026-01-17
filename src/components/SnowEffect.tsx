"use client";

import type React from "react";
import { useComputedColorScheme } from "@mantine/core";
import { useEffect, useRef } from "react";
import { useSnowStore } from "../stores/snowStore";

interface Snowflake {
  x: number;
  y: number;
  radius: number;
  speed: number;
  opacity: number;
  drift: number;
}

export const SnowEffect: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isSnowEnabled = useSnowStore((state) => state.isSnowEnabled);
  const computedColorScheme = useComputedColorScheme("light");
  const isDark = computedColorScheme === "dark";

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.style.position = "fixed";
    canvas.style.top = "0";
    canvas.style.right = "0";
    canvas.style.bottom = "0";
    canvas.style.left = "0";
    canvas.style.width = "100vw";
    canvas.style.height = "100vh";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "999";

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animationFrameId: number;
    let snowflakes: Snowflake[] = [];

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const createSnowflakes = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      const count = Math.floor((w * h) / 15000);
      snowflakes = [];

      for (let i = 0; i < count; i++) {
        snowflakes.push({
          x: Math.random() * w,
          y: Math.random() * h,
          radius: Math.random() * 2 + 1,
          speed: Math.random() * 0.5 + 0.2,
          opacity: Math.random() * 0.3 + 0.1,
          drift: Math.random() * 0.5 - 0.25,
        });
      }
    };

    const animate = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;

      ctx.clearRect(0, 0, w, h);

      if (isSnowEnabled) {
        for (const flake of snowflakes) {
          ctx.beginPath();
          ctx.arc(flake.x, flake.y, flake.radius, 0, Math.PI * 2);
          ctx.fillStyle = isDark
            ? `rgba(255, 255, 255, ${flake.opacity})`
            : `rgba(0, 0, 0, ${flake.opacity * 0.4})`;
          ctx.fill();

          flake.y += flake.speed;
          flake.x += flake.drift + Math.sin(flake.y * 0.01) * 0.3;

          if (flake.y > h) {
            flake.y = -flake.radius;
            flake.x = Math.random() * w;
          }

          if (flake.x > w) {
            flake.x = 0;
          } else if (flake.x < 0) {
            flake.x = w;
          }
        }
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    if (isSnowEnabled) {
      resizeCanvas();
      createSnowflakes();
      animate();
    } else {
      ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    }

    const handleResize = () => {
      resizeCanvas();
      if (isSnowEnabled) {
        createSnowflakes();
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, [isSnowEnabled, isDark]);

  return <canvas ref={canvasRef} />;
};
