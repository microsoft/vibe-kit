/**
 * Promptions Selection Replay
 *
 * Functions for serializing user control selections back into prompts
 * for the final LLM completion call.
 */

import type { Control } from "./control-schema";

/**
 * Builds a parameterized prompt that includes user control selections.
 * Use this to construct the final prompt for LLM completion.
 *
 * @param basePrompt - The original user prompt
 * @param controls - Array of controls with user-selected values
 * @returns Parameterized prompt string
 */
export function buildParameterizedPrompt(basePrompt: string, controls: Control[]): string {
    let result = `${basePrompt}\n\nApply these parameters:\n`;

    for (const control of controls) {
        switch (control.kind) {
            case "slider":
                result += `- ${control.label}: ${control.value}\n`;
                break;

            case "multi-select": {
                const labels = control.value
                    .map((key) => control.options[key] ?? key)
                    .join(", ");
                result += `- ${control.label}: ${labels}\n`;
                break;
            }

            case "binary":
                result += `- ${control.label}: ${control.value ? "yes" : "no"}\n`;
                break;

            case "text-input":
                result += `- ${control.label}: ${control.value}\n`;
                break;

            case "single-select":
            case "dropdown": {
                const label = control.options[control.value] ?? control.value;
                result += `- ${control.label}: ${label}\n`;
                break;
            }
        }
    }

    return result;
}

/**
 * Example: Express.js API route for generating completions with selections
 *
 * @example
 * ```typescript
 * import OpenAI from "openai";
 * import { buildParameterizedPrompt } from "./replay-selections";
 *
 * const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *
 * app.post("/api/generate", async (req, res) => {
 *   const { basePrompt, controls } = req.body;
 *   const startTime = Date.now();
 *
 *   const completion = await client.chat.completions.create({
 *     model: process.env.OPENAI_MODEL || "gpt-5-mini",
 *     temperature: 0.7,
 *     max_tokens: 1200,
 *     messages: [
 *       { role: "system", content: "You are a helpful assistant. Follow the user prompt and apply all specified parameters." },
 *       { role: "user", content: buildParameterizedPrompt(basePrompt, controls) },
 *     ],
 *   });
 *
 *   res.json({
 *     output: completion.choices[0]?.message?.content ?? "",
 *     tokens: completion.usage?.total_tokens ?? 0,
 *     latency: Date.now() - startTime,
 *   });
 * });
 * ```
 */
