/**
 * Promptions Control Schema
 *
 * Canonical TypeScript type definitions and schema string for Promptions controls.
 * Import these types in your application rather than duplicating the definitions.
 */

export interface SliderControl {
    kind: "slider";
    label: string;
    min: number;
    max: number;
    step: number;
    value: number;
}

export interface SingleSelectControl {
    kind: "single-select";
    label: string;
    options: Record<string, string>;
    value: string;
}

export interface MultiSelectControl {
    kind: "multi-select";
    label: string;
    options: Record<string, string>;
    value: string[];
}

export interface DropdownControl {
    kind: "dropdown";
    label: string;
    options: Record<string, string>;
    value: string;
}

export interface TextInputControl {
    kind: "text-input";
    label: string;
    placeholder?: string;
    value: string;
}

export interface BinaryControl {
    kind: "binary";
    label: string;
    value: boolean;
}

export type Control =
    | SliderControl
    | SingleSelectControl
    | MultiSelectControl
    | DropdownControl
    | TextInputControl
    | BinaryControl;

/**
 * Schema string for prompting LLMs to generate valid controls.
 * Include this in your system prompt when asking the model to generate controls.
 */
export const CONTROL_SCHEMA = `interface SliderControl {
  kind: "slider";
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
}

interface SingleSelectControl {
  kind: "single-select";
  label: string;
  options: Record<string, string>;
  value: string;
}

interface MultiSelectControl {
  kind: "multi-select";
  label: string;
  options: Record<string, string>;
  value: string[];
}

interface DropdownControl {
  kind: "dropdown";
  label: string;
  options: Record<string, string>;
  value: string;
}

interface TextInputControl {
  kind: "text-input";
  label: string;
  placeholder?: string;
  value: string;
}

interface BinaryControl {
  kind: "binary";
  label: string;
  value: boolean;
}

type Control = SliderControl | SingleSelectControl | MultiSelectControl | DropdownControl | TextInputControl | BinaryControl;`;

export const VALID_CONTROL_KINDS = new Set<Control["kind"]>([
    "slider",
    "single-select",
    "dropdown",
    "multi-select",
    "text-input",
    "binary",
]);
