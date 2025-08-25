import { useCallback } from "react";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import {
    resetCamera,
    showOnePolymerRepresentation,
    showOnePocketRepresentation,
    removeFromStateTree,
    setStructureTransparency
} from "../components/MolstarComponent";
import {
    LoadedStructure,
    PolymerRepresentationType,
    PocketRepresentationType
} from "../types";

export const useMolstarControls = () => {
    const updatePolymerRepresentation = useCallback((
        plugin: PluginUIContext,
        loadedStructures: LoadedStructure[],
        newRepresentation: PolymerRepresentationType
    ) => {
        loadedStructures.forEach(loadedStructure => {
            showOnePolymerRepresentation(plugin, loadedStructure, newRepresentation);
        });
    }, []);

    const updatePocketRepresentation = useCallback((
        plugin: PluginUIContext,
        loadedStructures: LoadedStructure[],
        newRepresentation: PocketRepresentationType
    ) => {
        loadedStructures.forEach(loadedStructure => {
            showOnePocketRepresentation(plugin, loadedStructure, newRepresentation);
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
        updatePolymerRepresentation,
        updatePocketRepresentation,
        resetCameraView,
        removeSuperposition
    };
};
