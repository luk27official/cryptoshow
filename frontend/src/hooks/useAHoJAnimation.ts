import { useState, useCallback } from "react";
import {
    AHoJStructure,
    LoadedStructure,
    TrajectoryTaskResult,
    PolymerRepresentationType,
    CryptoBenchResult
} from "../types";
import { useAHoJService } from "./useAHoJService";
import {
    loadStructure,
    playAnimation,
    showOnePolymerRepresentation,
    resetCamera,
    setStructureTransparency,
    removeFromStateTree
} from "../components/MolstarComponent";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { getApiUrl } from "../utils";

export const useAHoJAnimation = () => {
    const [loadingStructure, setLoadingStructure] = useState<AHoJStructure | undefined>(undefined);
    const { createTrajectoryWebSocket } = useAHoJService();

    const checkStructureEquivalence = useCallback((struct1: AHoJStructure | undefined, struct2: AHoJStructure): boolean => {
        if (!struct1) return false;
        return struct1.pdb_id === struct2.pdb_id &&
            struct1.structure_file === struct2.structure_file &&
            JSON.stringify(struct1.chains) === JSON.stringify(struct2.chains) &&
            JSON.stringify(struct1.target_chains) === JSON.stringify(struct2.target_chains);
    }, []);

    const checkStructureInLoadedStructures = useCallback((
        structure: AHoJStructure,
        loadedStructures: LoadedStructure[]
    ): boolean => {
        return loadedStructures.some(loaded =>
            loaded.ahojStructure &&
            checkStructureEquivalence(loaded.ahojStructure, structure)
        );
    }, [checkStructureEquivalence]);

    const startAnimationTask = useCallback(async (
        structure: AHoJStructure,
        cryptoBenchResult: CryptoBenchResult
    ): Promise<string | null> => {
        try {
            await fetch(getApiUrl(`/proxy/ahoj/${cryptoBenchResult.file_hash}/${structure.structure_file_url}`));

            const res = await fetch(getApiUrl(`/animate/${cryptoBenchResult.file_hash}/${structure.structure_file}/${structure.target_chains.join(",")}`));
            if (!res.ok) throw new Error(`Failed to start animation task: ${res.statusText}`);

            const animationTask = await res.json();
            return animationTask.task_id;
        } catch (error) {
            console.error("Error starting animation task:", error);
            return null;
        }
    }, []);

    const handlePlayAnimation = useCallback(async (
        structure: AHoJStructure & { type: string; },
        plugin: PluginUIContext,
        cryptoBenchResult: CryptoBenchResult,
        selectedPolymerRepresentation: PolymerRepresentationType,
        loadedStructures: LoadedStructure[],
        setLoadedStructures: (structures: LoadedStructure[]) => void
    ) => {
        if (loadingStructure) return;
        setLoadingStructure(structure);

        try {
            const animationTaskId = await startAnimationTask(structure, cryptoBenchResult);

            if (!animationTaskId) {
                setLoadingStructure(undefined);
                return;
            }

            const ws = createTrajectoryWebSocket(animationTaskId);

            ws.onerror = (err) => {
                console.error("WebSocket error:", err);
                setLoadingStructure(undefined);
                ws.close();
            };

            ws.onmessage = async (event) => {
                const data = event.data ? JSON.parse(event.data) : { status: "unknown" };

                if (data.status === "SUCCESS") {
                    ws.close();
                    const result: TrajectoryTaskResult = data.result;

                    const loadedStructure = await loadStructure(
                        plugin,
                        getApiUrl(`/file/${cryptoBenchResult.file_hash}/${result.trimmed_pdb}`),
                        getApiUrl(`/file/${cryptoBenchResult.file_hash}/${result.trajectory}`),
                        structure,
                        undefined
                    );

                    showOnePolymerRepresentation(plugin, loadedStructure, selectedPolymerRepresentation);

                    const updatedStructures = await Promise.all(
                        loadedStructures.map(async (s) => {
                            if (s.structureName.includes("structure")) {
                                await setStructureTransparency(plugin, 0.25, s.polymerRepresentations, s.structure);
                                await setStructureTransparency(plugin, 0.4, s.pocketRepresentations, s.structure);
                                return s;
                            } else {
                                removeFromStateTree(plugin, s.data.ref);
                                return null;
                            }
                        })
                    );

                    const filtered: LoadedStructure[] = updatedStructures.filter((s): s is LoadedStructure => s !== null);
                    setLoadedStructures([...filtered, loadedStructure]);

                    playAnimation(plugin, 10);
                    resetCamera(plugin);
                    setLoadingStructure(undefined);
                } else if (data.status === "FAILURE") {
                    console.error("Animation task failed:", data.result || "Unknown error");
                    ws.close();
                    setLoadingStructure(undefined);
                }
            };
        } catch (error) {
            console.error("Error in animation:", error);
            setLoadingStructure(undefined);
        }
    }, [loadingStructure, createTrajectoryWebSocket, startAnimationTask]);

    return {
        loadingStructure,
        handlePlayAnimation,
        checkStructureEquivalence,
        checkStructureInLoadedStructures
    };
};
