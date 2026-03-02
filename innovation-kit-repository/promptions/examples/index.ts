/**
 * Promptions Examples
 *
 * Canonical TypeScript modules for Promptions control generation, validation, and rendering.
 * Import from this barrel file or individual modules as needed.
 *
 * @example
 * ```typescript
 * import {
 *   CONTROL_SCHEMA,
 *   buildControlPrompt,
 *   extractControls,
 *   validateControls,
 *   buildParameterizedPrompt,
 * } from "@promptions/examples";
 * ```
 */

// Schema and types
export {
    CONTROL_SCHEMA,
    VALID_CONTROL_KINDS,
    type BinaryControl,
    type Control,
    type DropdownControl,
    type MultiSelectControl,
    type SingleSelectControl,
    type SliderControl,
    type TextInputControl,
} from "./control-schema";

// Control generation
export { buildControlPrompt, extractControls } from "./generate-controls";

// Validation
export {
    isValidControls,
    validateControl,
    validateControls,
    type ValidationResult,
} from "./validate-controls";

// Selection replay
export { buildParameterizedPrompt } from "./replay-selections";

// React component (separate import recommended to avoid bundling React in non-React projects)
// export { ControlRenderer, type ControlRendererProps } from "./render-controls";
