import React from "react";
import { SignalWorld } from "./SignalWorld";
import { VerseWorld } from "./VerseWorld";
import { ChorusWorld } from "./ChorusWorld";
import { MapWorld } from "./MapWorld";
import { RailWorld } from "./RailWorld";
import { MosaicWorld } from "./MosaicWorld";
import { BridgeWorld } from "./BridgeWorld";
import { BuildWorld } from "./BuildWorld";
import { FinaleWorld } from "./FinaleWorld";
import { ClimaxWorld } from "./ClimaxWorld";
import { OutroWorld } from "./OutroWorld";

/** world name (as used in data/scenes.json) → component */
export const WORLDS: Record<string, React.FC | undefined> = {
  SignalWorld,
  VerseWorld,
  ChorusWorld,
  MapWorld,
  RailWorld,
  MosaicWorld,
  BridgeWorld,
  BuildWorld,
  FinaleWorld,
  ClimaxWorld,
  OutroWorld,
};
