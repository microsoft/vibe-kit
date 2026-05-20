# Control Schema Reference

Complete technical reference for the Promptions control schema.

## Contents

- [Control Types](#control-types)
  - [SliderControl](#slidercontrol)
  - [SingleSelectControl](#singleselectcontrol)
  - [DropdownControl](#dropdowncontrol)
  - [MultiSelectControl](#multiselectcontrol)
  - [TextInputControl](#textinputcontrol)
  - [BinaryControl](#binarycontrol)
- [Schema Selection Guidelines](#schema-selection-guidelines)
- [Validation Rules](#validation-rules)
- [UI Component Mapping](#ui-component-mapping)

## Control Types

### SliderControl

Numeric parameters with bounded ranges.

```typescript
interface SliderControl {
  kind: "slider";
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}
```

**Use for**: Temperature, length, creativity scores, percentages, ratings.

**Example**:

```json
{
  "kind": "slider",
  "label": "Response Length",
  "min": 50,
  "max": 500,
  "step": 50,
  "value": 200
}
```

### SingleSelectControl

Radio-button style selection for 2-4 mutually exclusive options.

```typescript
interface SingleSelectControl {
  kind: "single-select";
  label: string;
  options: Record<string, string>;
  value: string;
}
```

**Use for**: Tone, style, format when there are few choices.

**Example**:

```json
{
  "kind": "single-select",
  "label": "Tone",
  "options": {
    "formal": "Professional & Formal",
    "casual": "Friendly & Casual",
    "neutral": "Neutral & Balanced"
  },
  "value": "casual"
}
```

### DropdownControl

Selection from 5+ options in a compact dropdown.

```typescript
interface DropdownControl {
  kind: "dropdown";
  label: string;
  options: Record<string, string>;
  value: string;
}
```

**Use for**: Languages, categories, departments, regions.

**Example**:

```json
{
  "kind": "dropdown",
  "label": "Target Language",
  "options": {
    "en": "English",
    "es": "Spanish",
    "fr": "French",
    "de": "German",
    "ja": "Japanese",
    "zh": "Chinese"
  },
  "value": "en"
}
```

### MultiSelectControl

Checkbox-style selection for multiple items.

```typescript
interface MultiSelectControl {
  kind: "multi-select";
  label: string;
  options: Record<string, string>;
  value: string[];
}
```

**Use for**: Features to include, topics to cover, audiences to target.

**Example**:

```json
{
  "kind": "multi-select",
  "label": "Include Sections",
  "options": {
    "intro": "Introduction",
    "benefits": "Key Benefits",
    "pricing": "Pricing Info",
    "cta": "Call to Action"
  },
  "value": ["intro", "benefits", "cta"]
}
```

### TextInputControl

Free-form text entry for specific values.

```typescript
interface TextInputControl {
  kind: "text-input";
  label: string;
  placeholder?: string;
  value: string;
}
```

**Use for**: Company names, keywords, URLs, custom values.

**Example**:

```json
{
  "kind": "text-input",
  "label": "Company Name",
  "placeholder": "Enter your company name",
  "value": "Acme Corp"
}
```

### BinaryControl

Yes/no toggle switches.

```typescript
interface BinaryControl {
  kind: "binary";
  label: string;
  value: boolean;
}
```

**Use for**: Include/exclude flags, enable/disable features.

**Example**:

```json
{
  "kind": "binary",
  "label": "Include Disclaimer",
  "value": true
}
```

## Schema Selection Guidelines

| Scenario                     | Recommended Control |
| ---------------------------- | ------------------- |
| Numeric range (1-10, 0-100%) | `slider`            |
| 2-4 categorical choices      | `single-select`     |
| 5+ categorical choices       | `dropdown`          |
| Select multiple from list    | `multi-select`      |
| User-provided text value     | `text-input`        |
| On/off toggle                | `binary`            |

## Validation Rules

1. **All controls** must have a non-empty `label` string
2. **Sliders** require numeric `min`, `max`, `step`, and `value`
3. **Select controls** require `options` object and `value` matching a key
4. **Multi-select** requires `value` to be an array of valid option keys
5. **Text-input** requires `value` to be a string
6. **Binary** requires `value` to be a boolean

## UI Component Mapping

| Control Kind  | Fluent UI v9            | HTML                      |
| ------------- | ----------------------- | ------------------------- |
| slider        | `<Slider>`              | `<input type="range">`    |
| single-select | `<RadioGroup>`          | `<input type="radio">`    |
| dropdown      | `<Dropdown>`            | `<select>`                |
| multi-select  | `<Checkbox>` (multiple) | `<input type="checkbox">` |
| text-input    | `<Input>`               | `<input type="text">`     |
| binary        | `<Switch>`              | `<input type="checkbox">` |
