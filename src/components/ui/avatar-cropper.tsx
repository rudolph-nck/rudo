"use client";

import { useState, useRef, useEffect, useCallback } from "react";

type Props = {
  file: File;
  onCrop: (blob: Blob) => void;
  onCancel: () => void;
};

const CONTAINER = 260;
const OUTPUT = 512;

export function AvatarCropper({ file, onCrop, onCancel }: Props) {
  const [imageUrl, setImageUrl] = useState("");
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [drag, setDrag] = useState<{ x: number; y: number; px: number; py: number } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setImageUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Base scale: shorter side fills container
  const baseScale = nat.w && nat.h ? CONTAINER / Math.min(nat.w, nat.h) : 1;
  const scale = baseScale * zoom;
  const imgW = nat.w * scale;
  const imgH = nat.h * scale;
  const imgLeft = (CONTAINER - imgW) / 2 + pan.x;
  const imgTop = (CONTAINER - imgH) / 2 + pan.y;

  // Clamp pan so image always covers the crop circle
  const clampPan = useCallback(
    (x: number, y: number, z: number) => {
      if (!nat.w || !nat.h) return { x, y };
      const s = baseScale * z;
      const w = nat.w * s;
      const h = nat.h * s;
      const maxX = Math.max(0, (w - CONTAINER) / 2);
      const maxY = Math.max(0, (h - CONTAINER) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, x)),
        y: Math.min(maxY, Math.max(-maxY, y)),
      };
    },
    [nat, baseScale]
  );

  function handlePointerDown(e: React.PointerEvent) {
    setDrag({ x: e.clientX, y: e.clientY, px: pan.x, py: pan.y });
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent) {
    if (!drag) return;
    const next = clampPan(
      drag.px + (e.clientX - drag.x),
      drag.py + (e.clientY - drag.y),
      zoom
    );
    setPan(next);
  }

  function handlePointerUp() {
    setDrag(null);
  }

  function handleZoom(z: number) {
    setZoom(z);
    setPan((p) => clampPan(p.x, p.y, z));
  }

  function handleSave() {
    if (!nat.w || !nat.h) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = OUTPUT;
    canvas.height = OUTPUT;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      // Map container viewport back to source image coords
      const srcX = -imgLeft / scale;
      const srcY = -imgTop / scale;
      const srcSize = CONTAINER / scale;

      ctx.drawImage(img, srcX, srcY, srcSize, srcSize, 0, 0, OUTPUT, OUTPUT);

      canvas.toBlob(
        (blob) => {
          if (blob) onCrop(blob);
        },
        "image/jpeg",
        0.92
      );
    };
    img.src = imageUrl;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-rudo-card-bg border border-rudo-card-border p-6 w-full max-w-[340px]">
        <h3 className="font-orbitron text-xs tracking-[2px] uppercase text-rudo-dark-text mb-4 text-center">
          Adjust Photo
        </h3>

        {/* Crop viewport */}
        <div
          className="relative mx-auto overflow-hidden rounded-full cursor-grab active:cursor-grabbing touch-none"
          style={{ width: CONTAINER, height: CONTAINER }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Guide ring */}
          <div className="absolute inset-0 rounded-full border-2 border-white/30 z-10 pointer-events-none" />

          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              onLoad={(e) => {
                const el = e.currentTarget;
                setNat({ w: el.naturalWidth, h: el.naturalHeight });
              }}
              draggable={false}
              className="absolute select-none pointer-events-none"
              style={{
                width: imgW || "auto",
                height: imgH || "auto",
                left: imgLeft,
                top: imgTop,
              }}
            />
          )}
        </div>

        {/* Zoom */}
        <div className="flex items-center gap-3 mt-4 px-2">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rudo-dark-muted flex-shrink-0">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" />
          </svg>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => handleZoom(parseFloat(e.target.value))}
            className="flex-1 accent-rudo-blue h-1"
          />
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rudo-dark-muted flex-shrink-0">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /><line x1="8" y1="11" x2="14" y2="11" /><line x1="11" y1="8" x2="11" y2="14" />
          </svg>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-center gap-3 mt-5">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-rudo-blue text-white text-xs font-orbitron tracking-wider border-none cursor-pointer hover:bg-rudo-blue/90 transition-colors"
          >
            Save
          </button>
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-transparent text-rudo-dark-text-sec text-xs font-orbitron tracking-wider border border-rudo-card-border cursor-pointer hover:border-rudo-card-border-hover transition-colors"
          >
            Cancel
          </button>
        </div>

        <canvas ref={canvasRef} className="hidden" />
      </div>
    </div>
  );
}
