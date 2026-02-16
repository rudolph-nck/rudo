// AI provider client initialization
// Centralized so every module uses the same configured instances.

import OpenAI from "openai";
import { fal } from "@fal-ai/client";
import RunwayML from "@runwayml/sdk";

export const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

fal.config({ credentials: process.env.FAL_KEY || "" });

export const runway = new RunwayML({ apiKey: process.env.RUNWAY_API_KEY || "" });

export { fal };
