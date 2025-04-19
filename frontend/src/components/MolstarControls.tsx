import "./MolstarControls.css";
import { PolymerRepresentationValues, PocketRepresentationValues, PolymerRepresentationType, PocketRepresentationType } from "../types";
import { usePlugin } from "../hooks/usePlugin";
import { resetCamera, showOnePocketRepresentation, showOnePolymerRepresentation } from "./MolstarComponent";
import { useAppContext } from "../hooks/useApp";

function MolstarControls() {
    const plugin = usePlugin();
    const {
        loadedStructures,
        selectedPolymerRepresentation,
        setSelectedPolymerRepresentation,
        selectedPocketRepresentation,
        setSelectedPocketRepresentation
    } = useAppContext();

    const handlePolymerRepresentationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRepresentation = e.target.value as PolymerRepresentationType;
        setSelectedPolymerRepresentation(newRepresentation);
        loadedStructures.forEach(loadedStructure => {
            showOnePolymerRepresentation(plugin, loadedStructure, newRepresentation);
        });
    };

    const handlePocketRepresentationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newRepresentation = e.target.value as PocketRepresentationType;
        setSelectedPocketRepresentation(newRepresentation);
        loadedStructures.forEach(loadedStructure => {
            showOnePocketRepresentation(plugin, loadedStructure, newRepresentation);
        });
    };

    const handleResetCamera = () => {
        resetCamera(plugin);
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
                        <option value={PolymerRepresentationValues.Backbone}>Backbone</option>
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