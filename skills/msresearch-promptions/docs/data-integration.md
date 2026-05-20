# Data Integration

Patterns for ingesting transcripts, telemetry, and configuration into Promptions.

## Supported Formats

| Format | Description | Source |
|--------|-------------|--------|
| JSONL transcripts | Batch export of chat messages with `{role, content, timestamp}` per line | Internal copilots |
| Event telemetry (CSV) | Logged option IDs, selections, and dwell times from UI surfaces | Application Insights, Kusto |
| Design seeds (YAML) | Product teams' predefined tone/style palettes | Manual configuration |

## Type Definitions

Import the canonical types from `lib/`:

```typescript
import type { Control } from "../lib/control-schema";
import { validateControls } from "../lib/validate-controls";
```

## Loading JSONL Conversations

```typescript
import fs from "node:fs";

interface ChatMessage {
    role: "system" | "user" | "assistant";
    content: string;
    timestamp?: string;
}

function loadConversation(path: string): ChatMessage[] {
    const lines = fs.readFileSync(path, "utf8").trim().split("\n");
    return lines.map((line) => JSON.parse(line) as ChatMessage);
}

const history = loadConversation("./data/conversation.jsonl");
console.assert(history.at(-1)?.role === "user", "Chat history must end with a user turn");
```

## Loading CSV Option Logs

```typescript
import { parse } from "csv-parse/sync";
import fs from "node:fs";
import type { Control } from "../lib/control-schema";

function csvToControls(path: string): Control[] {
    const content = fs.readFileSync(path, "utf8");
    const records = parse(content, { columns: true });

    return records.map((row: Record<string, string>) => ({
        kind: row.kind as Control["kind"],
        label: row.label,
        options: row.options_json ? JSON.parse(row.options_json) : undefined,
        value: JSON.parse(row.selected_values_json),
        min: row.min ? parseFloat(row.min) : undefined,
        max: row.max ? parseFloat(row.max) : undefined,
        step: row.step ? parseFloat(row.step) : undefined,
        placeholder: row.placeholder || undefined,
    }));
}

const controls = csvToControls("./data/options.csv");
```

## Validation

Always validate imported data before use. See [reference.md](./reference.md#validation-rules) for the full ruleset.

```typescript
import { validateControls, isValidControls } from "../lib/validate-controls";

const result = validateControls(controls);
if (!result.valid) {
    console.error("Validation errors:", result.errors);
    throw new Error("Invalid control data");
}

// Or use the type guard
if (isValidControls(controls)) {
    // TypeScript knows controls is Control[]
    processControls(controls);
}
```

## Common Issues

| Issue | Solution |
|-------|----------|
| Mismatched timestamps | Normalize to ISO-8601 before merging telemetry streams |
| Overlapping control IDs | Prefix IDs by surface (`chat`, `sidebar`, etc.) to prevent collisions |
| Missing options field | Some control types require options; validate before processing |

## Data Sources

| Source | Format | Export Method |
|--------|--------|---------------|
| Copilot transcripts | JSONL | Microsoft Copilot Studio or Dynamics Conversation Intelligence |
| UI analytics | CSV/Parquet | Application Insights or Kusto tables |
| Design seeds | YAML | Manual configuration files |

## Next Steps

- [Quick start](./quick-start.md) — launch the bundled chatbot or image generator
- [Application patterns](./application-patterns.md) — integration code and domain workflows
- [Schema reference](./reference.md) — complete control type documentation
- [Troubleshooting](./troubleshooting.md) — error fixes and diagnostics
