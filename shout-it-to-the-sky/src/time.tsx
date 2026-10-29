import React, { createContext, useContext } from "react";
import { useCurrentFrame } from "remotion";
import { FPS } from "./data";

/** Song-time offset (s) for the current <Film>; lets the preview cut play any song range. */
const Offset = createContext(0);
export const TimeOffset: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => (
  <Offset.Provider value={at}>{children}</Offset.Provider>
);
/** Current song time in seconds. */
export const useT = () => useCurrentFrame() / FPS + useContext(Offset);
export const useOffset = () => useContext(Offset);
