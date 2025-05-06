import "./MolstarControls.css";
import { PolymerRepresentationValues, PocketRepresentationValues, PolymerRepresentationType, PocketRepresentationType, LoadedStructure } from "../types";
import { usePlugin } from "../hooks/usePlugin";
import { resetCamera, showOnePocketRepresentation, showOnePolymerRepresentation, removeFromStateTree, setStructureTransparency } from "./MolstarComponent";
import { useAppContext } from "../hooks/useApp";

function MolstarControls() {
    const plugin = usePlugin();
    const {
        loadedStructures,
        setLoadedStructures,
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

    const removeSuperposition = async () => {
        const structurePromises = loadedStructures.map(async (s) => {
            if (s.structureName.includes("structure")) {
                await setStructureTransparency(plugin, 1, s.polymerRepresentations, s.structure);
                await setStructureTransparency(plugin, 1, s.pocketRepresentations, s.structure);
                return s;
            } else {
                removeFromStateTree(plugin, s.data.ref);
                return null;
            }
        });

        const resolvedStructures = await Promise.all(structurePromises);
        const filteredStructures = resolvedStructures.filter((s): s is LoadedStructure => s !== null);
        setLoadedStructures(filteredStructures);
    };

    const multipleStructuresLoaded = loadedStructures.length > 1;

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

                {multipleStructuresLoaded && (
                    <div className="molstar-control-button-container">
                        <button className="molstar-control-button" onClick={removeSuperposition}>Remove superposition</button>
                    </div>
                )}
            </div>
            {multipleStructuresLoaded && (
                <div className="molstar-controls-row">
                    <p>
                        To control the animation, use the button next to the "Model" label in the 3D viewer.
                    </p>
                    <p>
                        The animation shows the transformation of the AHoJ structure (shown in white) to the query structure (shown with transparency).
                        Both the pockets and the ligands are kept for clarity.
                    </p>
                </div>
            )}
        </div>
    );
}

export default MolstarControls;