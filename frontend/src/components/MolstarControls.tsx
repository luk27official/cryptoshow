import "./MolstarControls.css";
import { RepresentationChange } from "../types";
import { usePlugin, useAppContext, useMolstarControls } from "../hooks";
import RepresentationSelect from "./molstar/RepresentationSelect";

function MolstarControls() {
    const plugin = usePlugin();
    const {
        loadedStructures,
        setLoadedStructures,
        selectedRepresentations,
        setSelectedRepresentations,
        selectedColors,
        setSelectedColors,
    } = useAppContext();

    const {
        updateRepresentation,
        resetCameraView,
        removeSuperposition
    } = useMolstarControls();

    const handleRepresentationChange = (change: RepresentationChange) => {
        if (change.representationChanged) {
            setSelectedRepresentations(current => ({
                ...current,
                [change.structureComponentType]: change.representation,
            }));
        }

        if (change.colorChanged) {
            setSelectedColors(current => ({
                ...current,
                [change.structureComponentType]: change.color,
            }));
        }

        updateRepresentation(plugin, loadedStructures, change);
    };

    const handleResetCamera = () => {
        resetCameraView(plugin);
    };

    const handleRemoveSuperposition = () => {
        removeSuperposition(plugin, loadedStructures, setLoadedStructures);
    };

    const multipleStructuresLoaded = loadedStructures.length > 1;

    return (
        <div className="molstar-controls-container">
            <div className="molstar-controls-row">
                <RepresentationSelect
                    componentType="chain"
                    representation={selectedRepresentations.chain}
                    color={selectedColors.chain}
                    onChange={handleRepresentationChange}
                />
                <RepresentationSelect
                    componentType="pocket"
                    representation={selectedRepresentations.pocket}
                    color={selectedColors.pocket}
                    onChange={handleRepresentationChange}
                />
                <RepresentationSelect
                    componentType="ligand"
                    representation={selectedRepresentations.ligand}
                    color={selectedColors.ligand}
                    onChange={handleRepresentationChange}
                />

                <div className="molstar-control-button-container">
                    <button className="molstar-control-button" onClick={handleResetCamera}>Reset camera</button>
                </div>

                {multipleStructuresLoaded && (
                    <div className="molstar-control-button-container">
                        <button className="molstar-control-button" onClick={handleRemoveSuperposition}>Remove superposition</button>
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
