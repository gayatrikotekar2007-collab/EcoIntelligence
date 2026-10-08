'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';

interface BeforeAfterSplitSliderProps {
  beforeUrl: string | null;
  afterUrl: string | null;
  beforeTitle?: string;
  afterTitle?: string;
  heightClass?: string;
}

export function BeforeAfterSplitSlider({
  beforeUrl,
  afterUrl,
  beforeTitle = 'Before Evidence',
  afterTitle = 'After Evidence',
  heightClass = 'h-80 sm:h-96 md:h-[420px]',
}: BeforeAfterSplitSliderProps) {
  const [sliderPos, setSliderPos] = useState<number>(50);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [fitMode, setFitMode] = useState<'contain' | 'cover'>('contain');
  const containerRef = useRef<HTMLDivElement>(null);

  const updatePosition = useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width <= 0) return;
    const offsetX = Math.max(0, Math.min(clientX - rect.left, rect.width));
    const percentage = Math.round((offsetX / rect.width) * 100);
    setSliderPos(percentage);
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    updatePosition(e.clientX);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handlePointerMove = (e: PointerEvent) => {
      updatePosition(e.clientX);
    };

    const handlePointerUp = () => {
      setIsDragging(false);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [isDragging, updatePosition]);

  // Keyboard navigation for accessible slider control
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      setSliderPos((p) => Math.max(0, p - 2));
    } else if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      setSliderPos((p) => Math.min(100, p + 2));
    } else if (e.key === 'PageDown') {
      e.preventDefault();
      setSliderPos((p) => Math.max(0, p - 10));
    } else if (e.key === 'PageUp') {
      e.preventDefault();
      setSliderPos((p) => Math.min(100, p + 10));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setSliderPos(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setSliderPos(100);
    }
  };

  const objectFitCls = fitMode === 'contain' ? 'object-contain' : 'object-cover';

  return (
    <div className="flex flex-col space-y-2">
      {/* Slider Viewport Container */}
      <div
        ref={containerRef}
        onPointerDown={handlePointerDown}
        className={`relative w-full ${heightClass} select-none overflow-hidden rounded-xl bg-slate-950 border border-slate-800 cursor-ew-resize group`}
        role="region"
        aria-label="Interactive Before/After Image Comparison Slider"
      >
        {/* AFTER Image (Underneath) */}
        <div className="absolute inset-0 flex items-center justify-center">
          {afterUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={afterUrl}
              alt={afterTitle}
              className={`h-full w-full pointer-events-none transition-all ${objectFitCls}`}
              draggable={false}
            />
          ) : (
            <div className="text-slate-400 text-xs flex flex-col items-center gap-1">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              <span>Loading after image...</span>
            </div>
          )}
        </div>

        {/* BEFORE Image (Clipped on Top) */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{
            clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
          }}
        >
          {beforeUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={beforeUrl}
              alt={beforeTitle}
              className={`h-full w-full pointer-events-none transition-all ${objectFitCls}`}
              draggable={false}
            />
          ) : (
            <div className="text-slate-400 text-xs flex flex-col items-center gap-1">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
              <span>Loading before image...</span>
            </div>
          )}
        </div>

        {/* Draggable Divider Line & Handle */}
        <div
          className="absolute top-0 bottom-0 z-20 pointer-events-none"
          style={{ left: `${sliderPos}%` }}
        >
          {/* Vertical Divider Line */}
          <div className="absolute top-0 bottom-0 -left-[1px] w-[2px] bg-white shadow-[0_0_10px_rgba(0,0,0,0.8)]" />

          {/* Grabber Handle */}
          <div
            tabIndex={0}
            role="slider"
            aria-label="Comparison split slider position"
            aria-valuenow={sliderPos}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuetext={`${sliderPos}% Before, ${100 - sliderPos}% After`}
            onKeyDown={handleKeyDown}
            className={`pointer-events-auto absolute top-1/2 -left-4 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-white shadow-xl transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-indigo-400 ${
              isDragging ? 'scale-110 ring-2 ring-indigo-400 bg-indigo-950' : ''
            }`}
          >
            <svg
              className="h-4 w-4 text-slate-200"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="8 7 3 12 8 17" />
              <polyline points="16 7 21 12 16 17" />
            </svg>
          </div>
        </div>

        {/* Labels / Badges Overlay */}
        <div className="absolute top-3 left-3 z-10 pointer-events-none">
          <span className="inline-flex items-center gap-1 rounded-md bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-slate-200 backdrop-blur-xs border border-white/10 shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
            BEFORE ({sliderPos}%)
          </span>
        </div>

        <div className="absolute top-3 right-3 z-10 pointer-events-none">
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-950/80 px-2.5 py-1 text-[11px] font-bold text-emerald-300 backdrop-blur-xs border border-emerald-500/20 shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            AFTER ({100 - sliderPos}%)
          </span>
        </div>

        {/* Bottom Helper Hint */}
        <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 z-10 pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity">
          <span className="rounded-full bg-black/60 px-3 py-0.5 text-[10px] text-slate-300 backdrop-blur-xs">
            Drag divider or use Left / Right arrow keys
          </span>
        </div>
      </div>

      {/* Slider Controls Toolbar */}
      <div className="flex flex-wrap items-center justify-between text-xs text-slate-600 px-1 pt-1 gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-medium">Quick position:</span>
          <button
            type="button"
            onClick={() => setSliderPos(25)}
            className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
              sliderPos === 25 ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            25%
          </button>
          <button
            type="button"
            onClick={() => setSliderPos(50)}
            className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
              sliderPos === 50 ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            50% (Center)
          </button>
          <button
            type="button"
            onClick={() => setSliderPos(75)}
            className={`rounded px-2 py-0.5 text-[11px] font-semibold transition ${
              sliderPos === 75 ? 'bg-indigo-600 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
            }`}
          >
            75%
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-medium">Fit mode:</span>
          <button
            type="button"
            onClick={() => setFitMode(fitMode === 'contain' ? 'cover' : 'contain')}
            className="rounded border border-slate-200 bg-white px-2 py-0.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50 transition"
          >
            {fitMode === 'contain' ? 'Contain (Full Image)' : 'Cover (Fill Frame)'}
          </button>
        </div>
      </div>
    </div>
  );
}
