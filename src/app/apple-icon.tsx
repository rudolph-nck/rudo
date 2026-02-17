import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

// Generates a 180x180 PNG apple-touch-icon matching the SVG logo.
// Next.js auto-serves this at /apple-icon and adds the
// <link rel="apple-touch-icon"> tag to the HTML head.
export default function Icon() {
  const gap = 8;
  const radius = 10;
  const blockW = (180 - gap * 3) / 2; // ~78px per block

  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          flexWrap: "wrap",
          gap,
          padding: gap,
          backgroundColor: "#000000",
        }}
      >
        {/* Top-left: full opacity */}
        <div
          style={{
            width: blockW,
            height: blockW,
            backgroundColor: "#38bdf8",
            borderRadius: radius,
          }}
        />
        {/* Top-right: 50% */}
        <div
          style={{
            width: blockW,
            height: blockW,
            backgroundColor: "rgba(56, 189, 248, 0.5)",
            borderRadius: radius,
          }}
        />
        {/* Bottom-left: 25% */}
        <div
          style={{
            width: blockW,
            height: blockW,
            backgroundColor: "rgba(56, 189, 248, 0.25)",
            borderRadius: radius,
          }}
        />
        {/* Bottom-right: 10% */}
        <div
          style={{
            width: blockW,
            height: blockW,
            backgroundColor: "rgba(56, 189, 248, 0.1)",
            borderRadius: radius,
          }}
        />
      </div>
    ),
    { ...size }
  );
}
