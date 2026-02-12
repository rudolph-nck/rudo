"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type VideoPlayerProps = {
  src: string;
  thumbnail?: string | null;
  duration?: number | null;
  aspectRatio?: "portrait" | "landscape" | "square";
};

export function VideoPlayer({
  src,
  thumbnail,
  duration,
  aspectRatio = "portrait",
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(true);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout>(null);

  const aspectClass =
    aspectRatio === "portrait"
      ? "aspect-[9/16] max-h-[600px]"
      : aspectRatio === "square"
        ? "aspect-square max-h-[500px]"
        : "aspect-video max-h-[400px]";

  // Autoplay when visible, pause when not
  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries[0].isIntersecting;
        setIsVisible(visible);
        if (videoRef.current) {
          if (visible) {
            videoRef.current.play().catch(() => {});
            setPlaying(true);
          } else {
            videoRef.current.pause();
            setPlaying(false);
          }
        }
      },
      { threshold: 0.6 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Update progress bar
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    function onTimeUpdate() {
      if (!video) return;
      const pct = video.duration ? (video.currentTime / video.duration) * 100 : 0;
      setProgress(pct);
      setCurrentTime(video.currentTime);
    }

    video.addEventListener("timeupdate", onTimeUpdate);
    return () => video.removeEventListener("timeupdate", onTimeUpdate);
  }, []);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play().catch(() => {});
      setPlaying(true);
    } else {
      video.pause();
      setPlaying(false);
    }
    flashControls();
  }, []);

  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }, []);

  function flashControls() {
    setShowControls(true);
    if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
    controlsTimeout.current = setTimeout(() => setShowControls(false), 2500);
  }

  function handleProgressClick(e: React.MouseEvent) {
    e.stopPropagation();
    const bar = progressRef.current;
    const video = videoRef.current;
    if (!bar || !video) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    video.currentTime = pct * video.duration;
  }

  function formatTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-black ${aspectClass} w-full cursor-pointer group overflow-hidden`}
      onClick={togglePlay}
      onMouseMove={flashControls}
    >
      <video
        ref={videoRef}
        src={src}
        poster={thumbnail || undefined}
        muted={muted}
        loop
        playsInline
        preload="metadata"
        className="w-full h-full object-cover"
      />

      {/* Play/pause overlay */}
      {(!playing || showControls) && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10 transition-opacity">
          {!playing && (
            <div className="w-14 h-14 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm">
              <svg
                width="20"
                height="24"
                viewBox="0 0 20 24"
                fill="white"
                className="ml-1"
              >
                <polygon points="0,0 20,12 0,24" />
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Bottom controls bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent pt-8 pb-2 px-3 transition-opacity ${
          showControls || !playing ? "opacity-100" : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="w-full h-1 bg-white/20 rounded-full cursor-pointer mb-2 group/progress"
          onClick={handleProgressClick}
        >
          <div
            className="h-full bg-rudo-blue rounded-full relative transition-all"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-white rounded-full opacity-0 group-hover/progress:opacity-100 transition-opacity" />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Time */}
            <span className="text-[10px] text-white/70 font-orbitron tracking-wider tabular-nums">
              {formatTime(currentTime)}
              {duration ? ` / ${formatTime(duration)}` : ""}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Duration badge */}
            {duration && (
              <span className="text-[9px] font-orbitron tracking-wider text-white/60 bg-white/10 px-1.5 py-0.5 rounded">
                {duration}s
              </span>
            )}

            {/* Mute toggle */}
            <button
              onClick={toggleMute}
              className="w-7 h-7 flex items-center justify-center text-white/80 hover:text-white bg-transparent border-none cursor-pointer transition-colors"
            >
              {muted ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <line x1="23" y1="9" x2="17" y2="15" />
                  <line x1="17" y1="9" x2="23" y2="15" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* VIDEO type badge (top-left) */}
      <div className="absolute top-3 left-3">
        <span className="text-[9px] font-orbitron tracking-[2px] uppercase text-white bg-black/40 backdrop-blur-sm px-2 py-1 rounded">
          Video
        </span>
      </div>
    </div>
  );
}

/**
 * Placeholder for posts that don't have a video URL yet (demo/preview)
 */
export function VideoPlaceholder({
  duration,
  botName,
}: {
  duration?: number | null;
  botName: string;
}) {
  return (
    <div className="relative aspect-[9/16] max-h-[500px] w-full bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center overflow-hidden">
      {/* Animated background pattern */}
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(56,189,248,0.1)_50%,transparent_75%)] bg-[length:60px_60px] animate-pulse" />
      </div>

      <div className="text-center z-10">
        <div className="w-16 h-16 rounded-full bg-white/10 flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
          <svg
            width="24"
            height="28"
            viewBox="0 0 20 24"
            fill="white"
            opacity="0.6"
            className="ml-1"
          >
            <polygon points="0,0 20,12 0,24" />
          </svg>
        </div>
        <p className="text-white/40 text-xs font-orbitron tracking-[2px] uppercase">
          {botName}
        </p>
        {duration && (
          <p className="text-white/30 text-[10px] font-orbitron tracking-wider mt-1">
            {duration}s video
          </p>
        )}
      </div>

      {/* Badge */}
      <div className="absolute top-3 left-3">
        <span className="text-[9px] font-orbitron tracking-[2px] uppercase text-white/70 bg-black/40 backdrop-blur-sm px-2 py-1 rounded">
          Video
        </span>
      </div>
    </div>
  );
}
