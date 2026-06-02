import React from 'react';

// -----------------------------------------------------------------------------
// CAROUSEL SLIDE DATA STRUCTURE
// DEfines the data structure for a carousel slide.
// -----------------------------------------------------------------------------
export interface ChartSlide {
  title: string;
  subtitle: string;
  headerActions: React.ReactNode;
  content: React.ReactNode;
}

// -----------------------------------------------------------------------------
// COMPONENT PROPERTIES
// Defines the data passed into the ChartCarousel component.
// -----------------------------------------------------------------------------
interface ChartCarouselProps {
  slides: ChartSlide[];
  activeSlide: number;
  onSlideChange: (index: number) => void;
  isLoading?: boolean;
  error?: string | null;
  className?: string;
}

// -----------------------------------------------------------------------------
// CHART CAROUSEL COMPONENT
// Displays one chart at a time with navigation controls.
// -----------------------------------------------------------------------------
export function ChartCarousel({
  slides,
  activeSlide,
  onSlideChange,
  isLoading = false,
  error,
  className = '',
}: ChartCarouselProps) {

  // ---------------------------------------------------------------------------
  // CURRENT SLIDE
  // Fallback to first slide if activeSlide is invalid.
  // ---------------------------------------------------------------------------
  const slide = slides[activeSlide] ?? slides[0];

  // ---------------------------------------------------------------------------
  // CAROUSEL NAVIGATION
  // Handles moving between slides.
  // ---------------------------------------------------------------------------
  const prev = () => onSlideChange(activeSlide === 0 ? slides.length - 1 : activeSlide - 1);
  const next = () => onSlideChange(activeSlide === slides.length - 1 ? 0 : activeSlide + 1);

  // ---------------------------------------------------------------------------
  // LOADING STATE
  // ---------------------------------------------------------------------------
  if (isLoading) {
    return (
      <div className={`flex min-h-[420px] items-center justify-center ${className}`}>
        Loading…
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------------------------
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>

      {/* ------------------------------------------------------------------- */}
      {/* TITLE AND SUBTITLE */}
      {/* ------------------------------------------------------------------- */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-lg font-bold leading-tight text-[#003c6c]">{slide.title}</h3>
          <p className="text-sm text-slate-500">{slide.subtitle}</p>
        </div>

        {/* Optional filters/actions */}
        {slide.headerActions}
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* ERROR MESSAGE */}
      {/* ------------------------------------------------------------------- */}
      {error && activeSlide === 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {error}
        </div>
      )}

      {/* ------------------------------------------------------------------- */}
      {/* CURRENT SLIDE AND NEXT/PREVIOUS ARROW BUTTONS */}
      {/* ------------------------------------------------------------------- */}
      <div className="relative flex min-h-[470px] w-full items-center justify-center">

        {/* Previous Slide and Left Arrow */}
        <button
          type="button"
          onClick={prev}
          aria-label="Previous chart"
          className="absolute left-0 z-10 ml-2 rounded-full border border-[#2d66ae] bg-[#2d66ae] px-3 py-2 text-lg font-normal text-white shadow-md hover:bg-slate-100"
        >
          ‹
        </button>

        {/* Active Slide */}
        <div className="w-full max-w-4xl px-10">
          {slide.content}
        </div>

        {/* Next Slide and Right Arrow */}
        <button
          type="button"
          onClick={next}
          aria-label="Next chart"
          className="absolute right-0 z-10 mr-2 rounded-full border border-[#2d66ae] bg-[#2d66ae] px-3 py-2 text-lg font-normal text-white shadow-md hover:bg-slate-100"
        >
          ›
        </button>
      </div>

      {/* ------------------------------------------------------------------- */}
      {/* DOT NAVIGATION */}
      {/* The navigation dots at the bottom of the carousel. */}
      {/* ------------------------------------------------------------------- */}
      <div className="mt-4 flex justify-center gap-2">
        {slides.map((s, i) => (
          <button
            key={s.title}
            type="button"
            onClick={() => onSlideChange(i)}
            aria-label={`Show ${s.title}`}
            className={`h-2.5 rounded-full transition-all ${
              i === activeSlide ? 'w-8 bg-[#003c6c]' : 'w-2.5 bg-slate-200'
            }`}
          />
        ))}
      </div>
    </div>
  );
}