/**
 * Promptions Control Renderer
 *
 * React component example for rendering Promptions controls using Fluent UI v9.
 * Adapt this pattern to your UI framework of choice.
 */

import React from "react";
import {
    Checkbox,
    Dropdown,
    Input,
    Label,
    Option,
    Radio,
    RadioGroup,
    Slider,
    Switch,
    makeStyles,
    tokens,
} from "@fluentui/react-components";

import type { Control } from "./control-schema";

const useStyles = makeStyles({
    controlGroup: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalS,
        marginBottom: tokens.spacingVerticalM,
    },
    multiSelectColumn: {
        display: "flex",
        flexDirection: "column",
        gap: tokens.spacingVerticalXS,
    },
});

export interface ControlRendererProps {
    controls: Control[];
    onControlChange: (index: number, value: Control["value"]) => void;
}

/**
 * Renders an array of Promptions controls as Fluent UI components.
 *
 * @example
 * ```tsx
 * const [controls, setControls] = useState<Control[]>([]);
 *
 * const handleControlChange = (index: number, value: Control["value"]) => {
 *   setControls((prev) => prev.map((ctrl, i) =>
 *     i === index ? { ...ctrl, value } : ctrl
 *   ));
 * };
 *
 * return <ControlRenderer controls={controls} onControlChange={handleControlChange} />;
 * ```
 */
export function ControlRenderer({ controls, onControlChange }: ControlRendererProps) {
    const styles = useStyles();

    return (
        <>
            {controls.map((control, index) => (
                <div key={index} className={styles.controlGroup}>
                    <Label weight="semibold">{control.label}</Label>

                    {control.kind === "slider" && (
                        <Slider
                            min={control.min}
                            max={control.max}
                            step={control.step}
                            value={control.value}
                            onChange={(_, data) => onControlChange(index, data.value)}
                        />
                    )}

                    {control.kind === "single-select" && (
                        <RadioGroup
                            value={control.value}
                            onChange={(_, data) => onControlChange(index, data.value)}
                        >
                            {Object.entries(control.options).map(([key, label]) => (
                                <Radio key={key} value={key} label={label} />
                            ))}
                        </RadioGroup>
                    )}

                    {control.kind === "dropdown" && (
                        <Dropdown
                            selectedOptions={[control.value]}
                            onOptionSelect={(_, data) =>
                                onControlChange(index, data.optionValue as string)
                            }
                        >
                            {Object.entries(control.options).map(([key, label]) => (
                                <Option key={key} value={key}>
                                    {label}
                                </Option>
                            ))}
                        </Dropdown>
                    )}

                    {control.kind === "multi-select" && (
                        <div className={styles.multiSelectColumn}>
                            {Object.entries(control.options).map(([key, label]) => (
                                <Checkbox
                                    key={key}
                                    label={label}
                                    checked={control.value.includes(key)}
                                    onChange={(_, data) => {
                                        const next = data.checked
                                            ? [...control.value, key]
                                            : control.value.filter((v) => v !== key);
                                        onControlChange(index, next);
                                    }}
                                />
                            ))}
                        </div>
                    )}

                    {control.kind === "text-input" && (
                        <Input
                            value={control.value}
                            placeholder={control.placeholder}
                            onChange={(_, data) => onControlChange(index, data.value)}
                        />
                    )}

                    {control.kind === "binary" && (
                        <Switch
                            checked={control.value}
                            onChange={(_, data) => onControlChange(index, data.checked)}
                        />
                    )}
                </div>
            ))}
        </>
    );
}
