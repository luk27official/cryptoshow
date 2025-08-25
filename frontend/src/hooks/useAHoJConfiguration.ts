import { useCallback } from "react";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { Pocket } from "../types";
import { getResidueCoordinates, getResidueInformation } from "../components/MolstarComponent";
import { calculatePocketQuery, createAHoJJobConfiguration } from "../services/AHoJConfigService";

export const useAHoJConfiguration = () => {
    const getAHoJJobConfiguration = useCallback((pocket: Pocket, plugin: PluginUIContext, structureId: string) => {
        const coords = getResidueCoordinates(plugin, pocket.residue_ids);
        const query = calculatePocketQuery(pocket, coords, structureId, (residueId) => {
            const result = getResidueInformation(plugin, residueId);
            return result ?? undefined;
        });
        return createAHoJJobConfiguration(query);
    }, []);

    return {
        getAHoJJobConfiguration
    };
};
