import { useState } from "react";
import "./MolstarControls.css";
import { PolymerRepresentation, PocketRepresentation } from "../types";


function MolstarControls() {
    const PolymerRepresentationValues: Record<string, PolymerRepresentation> = {
        Cartoon: "cartoon",
        BallAndStick: "ball-and-stick",
        MolecularSurface: "molecular-surface"
    } as const;

    const PocketRepresentationValues: Record<string, PocketRepresentation> = {
        Cartoon: "cartoon",
        BallAndStick: "ball-and-stick",
        MolecularSurface: "molecular-surface"
    } as const;

    const [selectedPolymerRepresentation, setSelectedPolymerRepresentation] = useState<PolymerRepresentation>(PolymerRepresentationValues.Cartoon);
    const [selectedPocketRepresentation, setSelectedPocketRepresentation] = useState<PocketRepresentation>(PocketRepresentationValues.Cartoon);

    const handlePolymerRepresentationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedPolymerRepresentation(e.target.value as PolymerRepresentation);
        console.log("Selected Polymer Representation:", e.target.value);
    };

    const handlePocketRepresentationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedPocketRepresentation(e.target.value as PocketRepresentation);
        console.log("Selected Pocket Representation:", e.target.value);
    };

    const handleResetCamera = () => {
        console.log("Reset camera clicked");
    };

    return (
        <div className="molstar-controls-container">
            <div className="molstar-controls-row">
                <div className="molstar-control-group">
                    <label className="molstar-control-label" htmlFor="polymer-representation-select">Polymer Representation</label>
                    <select
                        id="polymer-representation-select"
                        value={selectedPolymerRepresentation}
                        onChange={handlePolymerRepresentationChange}
                        className="molstar-control-select"
                    >
                        <option value={PolymerRepresentationValues.Cartoon}>Cartoon</option>
                        <option value={PolymerRepresentationValues.BallAndStick}>Ball and Stick</option>
                        <option value={PolymerRepresentationValues.MolecularSurface}>Surface</option>
                    </select>
                </div>

                <div className="molstar-control-group">
                    <label className="molstar-control-label" htmlFor="pocket-representation-select">Pocket Representation</label>
                    <select
                        id="pocket-representation-select"
                        value={selectedPocketRepresentation}
                        onChange={handlePocketRepresentationChange}
                        className="molstar-control-select"
                    >
                        <option value={PocketRepresentationValues.Cartoon}>Cartoon</option>
                        <option value={PocketRepresentationValues.BallAndStick}>Ball and Stick</option>
                        <option value={PocketRepresentationValues.MolecularSurface}>Surface</option>
                    </select>
                </div>

                <div className="molstar-control-button-container">
                    <button className="molstar-control-button" onClick={handleResetCamera}>Reset camera</button>
                </div>
            </div>
        </div>
    );
}

export default MolstarControls;