/**
 * Promptions Control Validation
 *
 * Runtime validation for control payloads before rendering in UI.
 * Use these functions to guard against malformed LLM responses.
 */

import type { Control } from "./control-schema";
import { VALID_CONTROL_KINDS } from "./control-schema";

export interface ValidationResult {
    valid: boolean;
    errors: string[];
    controlCount: number;
}

/**
 * Validates a single control object against the schema.
 *
 * @param control - Control object to validate
 * @param index - Index for error messages
 * @returns Array of error messages (empty if valid)
 */
export function validateControl(control: unknown, index: number): string[] {
    const errors: string[] = [];
    const prefix = `Control[${index}]`;

    if (!control || typeof control !== "object") {
        return [`${prefix}: Must be an object`];
    }

    const ctrl = control as Record<string, unknown>;

    if (!ctrl.kind || !VALID_CONTROL_KINDS.has(ctrl.kind as Control["kind"])) {
        errors.push(
            `${prefix}: Invalid kind "${ctrl.kind}". Must be one of: ${[...VALID_CONTROL_KINDS].join(", ")}`,
        );
    }

    if (typeof ctrl.label !== "string" || !(ctrl.label as string).trim()) {
        errors.push(`${prefix}: Label must be a non-empty string`);
    }

    switch (ctrl.kind) {
        case "slider":
            if (typeof ctrl.min !== "number") errors.push(`${prefix}: Slider must have numeric "min"`);
            if (typeof ctrl.max !== "number") errors.push(`${prefix}: Slider must have numeric "max"`);
            if (typeof ctrl.step !== "number") errors.push(`${prefix}: Slider must have numeric "step"`);
            if (typeof ctrl.value !== "number") errors.push(`${prefix}: Slider must have numeric "value"`);
            break;

        case "single-select":
        case "dropdown":
            if (!ctrl.options || typeof ctrl.options !== "object") {
                errors.push(`${prefix}: Must have "options" object`);
            }
            if (typeof ctrl.value !== "string") {
                errors.push(`${prefix}: Value must be a string`);
            } else if (ctrl.options && !(ctrl.value in (ctrl.options as object))) {
                errors.push(`${prefix}: Value "${ctrl.value}" not in options`);
            }
            break;

        case "multi-select":
            if (!ctrl.options || typeof ctrl.options !== "object") {
                errors.push(`${prefix}: Must have "options" object`);
            }
            if (!Array.isArray(ctrl.value)) {
                errors.push(`${prefix}: Value must be an array`);
            } else if (ctrl.options) {
                for (const v of ctrl.value as string[]) {
                    if (!(v in (ctrl.options as object))) {
                        errors.push(`${prefix}: Value "${v}" not in options`);
                    }
                }
            }
            break;

        case "text-input":
            if (typeof ctrl.value !== "string") {
                errors.push(`${prefix}: Value must be a string`);
            }
            break;

        case "binary":
            if (typeof ctrl.value !== "boolean") {
                errors.push(`${prefix}: Value must be a boolean`);
            }
            break;
    }

    return errors;
}

/**
 * Validates an array of controls.
 *
 * @param controls - Array of controls to validate
 * @returns Validation result with errors (if any)
 */
export function validateControls(controls: unknown): ValidationResult {
    if (!Array.isArray(controls)) {
        return {
            valid: false,
            errors: ["Input must be a JSON array of controls"],
            controlCount: 0,
        };
    }

    const allErrors = controls.flatMap((control, index) => validateControl(control, index));

    return {
        valid: allErrors.length === 0,
        errors: allErrors,
        controlCount: controls.length,
    };
}

/**
 * Quick validation check for use in conditionals.
 * Use validateControls() for detailed error information.
 *
 * @param controls - Controls to check
 * @returns true if valid
 */
export function isValidControls(controls: unknown): controls is Control[] {
    return validateControls(controls).valid;
}
