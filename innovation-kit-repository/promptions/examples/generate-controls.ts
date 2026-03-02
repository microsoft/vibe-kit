/**
 * Promptions Control Generation
 *
 * Functions for generating dynamic controls from user prompts via LLM.
 * Use these in your API routes or service layer.
 */

import type { Control } from "./control-schema";
import { CONTROL_SCHEMA } from "./control-schema";

/**
 * Builds a system prompt that instructs the LLM to generate controls matching the schema.
 *
 * @param userPrompt - The user's original prompt to parameterize
 * @param schema - Optional custom schema (defaults to CONTROL_SCHEMA)
 * @returns System prompt string for the LLM
 */
export function buildControlPrompt(
    userPrompt: string,
    schema: string = CONTROL_SCHEMA,
): string {
    return `You are an AI assistant that generates interactive controls for customizing prompts.

User prompt: "${userPrompt}"

Return a JSON array of 2-4 controls that would let users customize this prompt. Match this schema:
${schema}

Rules:
- Use sliders for numeric parameters (temperature, length, creativity)
- Use single-select (radio) for 2-4 categorical choices (tone, style)
- Use dropdown for 5+ options (many categories, languages)
- Use multi-select (checkboxes) for selecting multiple items (features, topics)
- Use text-input for specific values (company name, keyword, URL)
- Use binary for yes/no toggles
- Make option keys simple (warm/formal/casual, not long descriptions)
- Wrap JSON in \`\`\`json code fence`;
}

/**
 * Extracts and parses control JSON from LLM response text.
 * Handles both fenced code blocks and raw JSON.
 *
 * @param raw - Raw LLM response text
 * @returns Parsed array of controls
 * @throws Error if response is not a valid JSON array
 */
export function extractControls(raw: string): Control[] {
    const match = raw.match(/```json\s*([\s\S]*?)\s*```/i);
    const json = match ? match[1] : raw.trim();
    const parsed = JSON.parse(json);

    if (!Array.isArray(parsed)) {
        throw new Error("Model response did not return an array of controls");
    }

    return parsed as Control[];
}

/**
 * Example: Express.js API route for control generation
 *
 * @example
 * ```typescript
 * import OpenAI from "openai";
 * import { buildControlPrompt, extractControls } from "./generate-controls";
 *
 * const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 *
 * app.post("/api/generate-controls", async (req, res) => {
 *   const { userPrompt } = req.body;
 *   const completion = await client.chat.completions.create({
 *     model: process.env.OPENAI_MODEL || "gpt-5-mini",
 *     temperature: 0.4,
 *     max_tokens: 800,
 *     messages: [{ role: "system", content: buildControlPrompt(userPrompt) }],
 *   });
 *   const controls = extractControls(completion.choices[0]?.message?.content ?? "");
 *   res.json({ controls });
 * });
 * ```
 */
