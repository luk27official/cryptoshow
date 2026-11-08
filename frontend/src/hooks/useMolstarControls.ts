import { useCallback } from "react";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import {
    resetCamera,
    showOneComponentRepresentation,
    setComponentColor,
    removeFromStateTree,
    setStructureTransparency
} from "../components/MolstarComponent";
import {
    LoadedStructure,
    RepresentationChange
} from "../types";

export const useMolstarControls = () => {
    const updateRepresentation = useCallback((
        plugin: PluginUIContext,
        loadedStructures: LoadedStructure[],
        change: RepresentationChange
    ) => {
        loadedStructures.forEach(loadedStructure => {
            if (change.representationChanged) {
                showOneComponentRepresentation(plugin, loadedStructure, change.structureComponentType, change.representation);
            }
            if (change.colorChanged) {
                setComponentColor(plugin, loadedStructure, change.structureComponentType, change.color);
            }
        });
    }, []);

    const resetCameraView = useCallback((plugin: PluginUIContext) => {
        resetCamera(plugin);
    }, []);

    const removeSuperposition = useCallback(async (
        plugin: PluginUIContext,
        loadedStructures: LoadedStructure[],
        setLoadedStructures: (structures: LoadedStructure[]) => void
    ) => {
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
    }, []);

    return {
        updateRepresentation,
        resetCameraView,
        removeSuperposition
    };
};
