// OpenAI provider — wraps the OpenAI SDK for chat completions and vision.
// All OpenAI calls flow through here. No other module should import the SDK directly.

import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatCompletionParams = {
  model: string;
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[];
  max_tokens?: number;
  temperature?: number;
  response_format?: { type: "json_object" | "text" };
};

// ---------------------------------------------------------------------------
// Chat completion
// ---------------------------------------------------------------------------

export async function chatCompletion(
  params: ChatCompletionParams
): Promise<string> {
  const response = await client.chat.completions.create({
    model: params.model,
    messages: params.messages,
    max_tokens: params.max_tokens,
    temperature: params.temperature,
    ...(params.response_format ? { response_format: params.response_format } : {}),
  });

  return response.choices[0]?.message?.content?.trim() || "";
}
