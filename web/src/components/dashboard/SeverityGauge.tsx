"use client";

import React from "react";
import { ShieldCheck, AlertTriangle, AlertOctagon, CheckCircle2 } from "lucide-react";

interface SeverityGaugeProps {
  score: number; // 0 to 100
  label?: string;
  severity?: "normal" | "mild" | "moderate" | "severe" | string;
  size?: number;
}

export function SeverityGauge({ score, label, severity = "normal", size = 200 }: SeverityGaugeProps) {
  const normalizedScore = Math.min(Math.max(score, 0), 100);
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  // Semi-circle or 270 degree arc
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (arcLength * normalizedScore) / 100;

  // Determine color and status
  let strokeColor = "#10B981"; // Emerald
  let badgeBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let statusText = "Normal";
  let Icon = CheckCircle2;

  if (severity.toLowerCase() === "severe" || normalizedScore >= 75) {
    strokeColor = "#EF4444"; // Crimson
    badgeBg = "bg-red-50 text-red-700 border-red-200";
    statusText = "Severe";
    Icon = AlertOctagon;
  } else if (severity.toLowerCase() === "moderate" || normalizedScore >= 50) {
    strokeColor = "#F97316"; // Orange
    badgeBg = "bg-orange-50 text-orange-700 border-orange-200";
    statusText = "Moderate";
    Icon = AlertTriangle;
  } else if (severity.toLowerCase() === "mild" || normalizedScore >= 25) {
    strokeColor = "#F59E0B"; // Amber
    badgeBg = "bg-amber-50 text-amber-700 border-amber-200";
    statusText = "Mild";
    Icon = ShieldCheck;
  }

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-white rounded-3xl border border-slate-100 shadow-soft-sm">
      <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          className="rotate-[135deg] transform transition-all duration-1000 ease-out"
        >
          {/* Background Track Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke="#E2E8F0"
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeLinecap="round"
          />
          {/* Active Score Arc */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="transparent"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeDasharray={`${arcLength} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out"
          />
        </svg>

        {/* Center Content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-4xl font-extrabold tracking-tight text-slate-900">
            {Math.round(normalizedScore)}
            <span className="text-xl font-medium text-slate-400">/100</span>
          </span>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mt-0.5">
            {label || "Dysarthria Index"}
          </span>
        </div>
      </div>

      {/* Pill Badge */}
      <div className={`mt-3 inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-bold border ${badgeBg}`}>
        <Icon className="h-3.5 w-3.5" />
        <span>{statusText.toUpperCase()} PRESENTATION</span>
      </div>
    </div>
  );
}
