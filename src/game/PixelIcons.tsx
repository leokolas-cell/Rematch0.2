import React from 'react';

/**
 * Bespoke 16-Bit Pixel Art SVG Icons for Modern Glassmorphism UI Integration.
 * Uses crispEdges shape-rendering so every icon has razor-sharp pixel steps.
 */

export function PixelSoccerBallIcon({ className = 'w-6 h-6' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} shapeRendering="crispEdges" fill="none">
      {/* Outer 16-bit pixel outline */}
      <rect x="5" y="1" width="6" height="1" fill="#09121e" />
      <rect x="3" y="2" width="2" height="1" fill="#09121e" />
      <rect x="11" y="2" width="2" height="1" fill="#09121e" />
      <rect x="2" y="3" width="1" height="2" fill="#09121e" />
      <rect x="13" y="3" width="1" height="2" fill="#09121e" />
      <rect x="1" y="5" width="1" height="6" fill="#09121e" />
      <rect x="14" y="5" width="1" height="6" fill="#09121e" />
      <rect x="2" y="11" width="1" height="2" fill="#09121e" />
      <rect x="13" y="11" width="1" height="2" fill="#09121e" />
      <rect x="3" y="13" width="2" height="1" fill="#09121e" />
      <rect x="11" y="13" width="2" height="1" fill="#09121e" />
      <rect x="5" y="14" width="6" height="1" fill="#09121e" />
      {/* White & shaded core */}
      <rect x="5" y="2" width="6" height="12" fill="#ffffff" />
      <rect x="3" y="3" width="10" height="10" fill="#ffffff" />
      <rect x="2" y="5" width="12" height="6" fill="#ffffff" />
      {/* Lower-right pixel shading */}
      <rect x="8" y="11" width="5" height="2" fill="#cbd5e1" />
      <rect x="11" y="8" width="3" height="3" fill="#cbd5e1" />
      <rect x="5" y="13" width="6" height="1" fill="#cbd5e1" />
      {/* Pentagon patches */}
      <rect x="6" y="6" width="4" height="4" fill="#1e293b" />
      <rect x="7" y="2" width="2" height="2" fill="#1e293b" />
      <rect x="2" y="7" width="2" height="2" fill="#1e293b" />
      <rect x="12" y="7" width="2" height="2" fill="#1e293b" />
      <rect x="5" y="12" width="2" height="2" fill="#1e293b" />
      <rect x="9" y="12" width="2" height="2" fill="#1e293b" />
      {/* Specular highlight */}
      <rect x="4" y="4" width="2" height="2" fill="#38bdf8" />
    </svg>
  );
}

export function PixelFlameIcon({ className = 'w-5 h-5', active = false }: { className?: string; active?: boolean }) {
  const outer = active ? '#f97316' : '#38bdf8';
  const inner = active ? '#fde047' : '#bae6fd';
  return (
    <svg viewBox="0 0 16 16" className={className} shapeRendering="crispEdges" fill="none">
      <rect x="7" y="1" width="2" height="2" fill={outer} />
      <rect x="6" y="3" width="4" height="2" fill={outer} />
      <rect x="4" y="5" width="8" height="3" fill={outer} />
      <rect x="3" y="8" width="10" height="4" fill={outer} />
      <rect x="4" y="12" width="8" height="2" fill={outer} />
      <rect x="6" y="14" width="4" height="1" fill={outer} />
      {/* Inner core */}
      <rect x="7" y="6" width="2" height="2" fill={inner} />
      <rect x="5" y="8" width="6" height="4" fill={inner} />
      <rect x="6" y="12" width="4" height="2" fill="#ffffff" />
    </svg>
  );
}

export function PixelCrownIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} shapeRendering="crispEdges" fill="none">
      <rect x="1" y="4" width="2" height="8" fill="#fde047" />
      <rect x="7" y="2" width="2" height="10" fill="#fde047" />
      <rect x="13" y="4" width="2" height="8" fill="#fde047" />
      <rect x="3" y="7" width="4" height="5" fill="#facc15" />
      <rect x="9" y="7" width="4" height="5" fill="#facc15" />
      <rect x="1" y="12" width="14" height="2" fill="#d97706" />
      <rect x="3" y="9" width="2" height="2" fill="#38bdf8" />
      <rect x="7" y="8" width="2" height="2" fill="#fb7185" />
      <rect x="11" y="9" width="2" height="2" fill="#38bdf8" />
    </svg>
  );
}

export function PixelMouseLeftIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} shapeRendering="crispEdges" fill="none">
      <rect x="4" y="1" width="8" height="1" fill="#0f172a" />
      <rect x="3" y="2" width="1" height="11" fill="#0f172a" />
      <rect x="12" y="2" width="1" height="11" fill="#0f172a" />
      <rect x="4" y="13" width="8" height="1" fill="#0f172a" />
      <rect x="4" y="2" width="8" height="11" fill="#f8fafc" />
      {/* Active Left Button Highlight */}
      <rect x="4" y="2" width="4" height="5" fill="#38bdf8" />
      <rect x="8" y="2" width="1" height="5" fill="#0f172a" />
      <rect x="4" y="7" width="8" height="1" fill="#0f172a" />
    </svg>
  );
}

export function PixelMouseRightIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} shapeRendering="crispEdges" fill="none">
      <rect x="4" y="1" width="8" height="1" fill="#0f172a" />
      <rect x="3" y="2" width="1" height="11" fill="#0f172a" />
      <rect x="12" y="2" width="1" height="11" fill="#0f172a" />
      <rect x="4" y="13" width="8" height="1" fill="#0f172a" />
      <rect x="4" y="2" width="8" height="11" fill="#f8fafc" />
      {/* Active Right Button Highlight */}
      <rect x="8" y="2" width="4" height="5" fill="#facc15" />
      <rect x="7" y="2" width="1" height="5" fill="#0f172a" />
      <rect x="4" y="7" width="8" height="1" fill="#0f172a" />
    </svg>
  );
}

export function PixelSoundOnIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} shapeRendering="crispEdges" fill="none">
      <rect x="2" y="6" width="3" height="4" fill="#0f172a" />
      <rect x="5" y="4" width="2" height="8" fill="#0f172a" />
      <rect x="7" y="2" width="2" height="12" fill="#0f172a" />
      <rect x="11" y="5" width="1" height="2" fill="#0284c7" />
      <rect x="11" y="9" width="1" height="2" fill="#0284c7" />
      <rect x="13" y="3" width="1" height="10" fill="#10b981" />
    </svg>
  );
}

export function PixelSoundIcon({ muted, className = 'w-5 h-5' }: { muted: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} shapeRendering="crispEdges" fill="none">
      <rect x="2" y="6" width="3" height="4" fill="currentColor" />
      <rect x="5" y="4" width="2" height="8" fill="currentColor" />
      <rect x="7" y="2" width="2" height="12" fill="currentColor" />
      {muted ? (
        <>
          <rect x="11" y="5" width="2" height="2" fill="#fb7185" />
          <rect x="13" y="7" width="2" height="2" fill="#fb7185" />
          <rect x="11" y="9" width="2" height="2" fill="#fb7185" />
          <rect x="13" y="5" width="2" height="2" fill="#fb7185" />
          <rect x="11" y="7" width="2" height="2" fill="#fb7185" />
          <rect x="13" y="9" width="2" height="2" fill="#fb7185" />
        </>
      ) : (
        <>
          <rect x="11" y="5" width="1" height="2" fill="#38bdf8" />
          <rect x="11" y="9" width="1" height="2" fill="#38bdf8" />
          <rect x="13" y="3" width="1" height="10" fill="#fde047" />
        </>
      )}
    </svg>
  );
}

export function PixelPauseIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={className} shapeRendering="crispEdges" fill="none">
      <rect x="3" y="3" width="4" height="10" fill="currentColor" />
      <rect x="9" y="3" width="4" height="10" fill="currentColor" />
    </svg>
  );
}
