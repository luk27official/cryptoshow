import { useEffect, useRef, useState } from "react";
import "./RepresentationSelect.css";
import { Representation, RepresentationChange, StructureComponentType, representationOptions } from "../../types";

const componentLabels: Record<StructureComponentType, { representation: string; color: string; }> = {
    chain: { representation: "Chain representation", color: "Chain color" },
    pocket: { representation: "Pocket representation", color: "Pocket color" },
    ligand: { representation: "Ligand representation", color: "Ligand color" },
};

const colorOptions = [
    { value: "#e74c3c", label: "Red" },
    { value: "#e67e22", label: "Orange" },
    { value: "#f1c40f", label: "Yellow" },
    { value: "#2ecc71", label: "Green" },
    { value: "#1abc9c", label: "Teal" },
    { value: "#3498db", label: "Blue" },
    { value: "#5c6bc0", label: "Indigo" },
    { value: "#9b59b6", label: "Purple" },
    { value: "#e91e63", label: "Pink" },
    { value: "#95a5a6", label: "Gray" },
    { value: "#ffffff", label: "White" },
];

interface RepresentationSelectProps {
    componentType: StructureComponentType;
    representation: Representation;
    color: string;
    onChange: (change: RepresentationChange) => void;
}

function RepresentationSelect({ componentType, representation, color, onChange }: RepresentationSelectProps) {
    const [open, setOpen] = useState(false);
    const colorPickerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const closeOnOutsideClick = (event: MouseEvent) => {
            if (colorPickerRef.current && !colorPickerRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", closeOnOutsideClick);
        return () => document.removeEventListener("mousedown", closeOnOutsideClick);
    }, []);

    const selectedColorLabel = colorOptions.find(option => option.value === color)?.label ?? color;

    return (
        <div className="molstar-control-group">
            <label className="molstar-control-label" htmlFor={`${componentType}-representation-select`}>
                {componentLabels[componentType].representation}
            </label>
            <select
                id={`${componentType}-representation-select`}
                value={representation}
                onChange={(e) => onChange({
                    structureComponentType: componentType,
                    representationChanged: true,
                    colorChanged: false,
                    color: color,
                    representation: e.target.value as Representation,
                })}
                className="molstar-control-select"
            >
                {representationOptions.map(option => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                ))}
            </select>
            <label className="molstar-control-label" htmlFor={`${componentType}-color-picker`}>
                {componentLabels[componentType].color}
            </label>
            <div className="color-picker" ref={colorPickerRef}>
                <div
                    id={`${componentType}-color-picker`}
                    className="color-picker-button"
                    role="button"
                    tabIndex={0}
                    onClick={() => setOpen(current => !current)}
                    onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setOpen(current => !current);
                        }
                    }}
                >
                    <span className="color-swatch-preview" style={{ background: color }} />
                    <span>{selectedColorLabel}</span>
                </div>
                {open && (
                    <div className="color-swatch-grid">
                        {colorOptions.map(option => (
                            <button
                                key={option.value}
                                type="button"
                                className={`color-swatch-item${option.value === color ? " active" : ""}`}
                                title={option.label}
                                style={{ background: option.value }}
                                onClick={() => {
                                    onChange({
                                        structureComponentType: componentType,
                                        representationChanged: false,
                                        colorChanged: true,
                                        color: option.value,
                                        representation: representation,
                                    });
                                    setOpen(false);
                                }}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default RepresentationSelect;
