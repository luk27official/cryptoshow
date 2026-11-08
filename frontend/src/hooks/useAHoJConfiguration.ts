import { useCallback } from "react";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { Pocket } from "../types";
import { getResidueCoordinates, getResidueInformation, residueNumberingFor } from "../components/MolstarComponent";
import { calculatePocketQuery, createAHoJJobConfiguration } from "../services/AHoJConfigService";

export const useAHoJConfiguration = () => {
    const getAHoJJobConfiguration = useCallback((pocket: Pocket, plugin: PluginUIContext, structureId: string, inputStructure: string) => {
        const numbering = residueNumberingFor(inputStructure);
        const coords = getResidueCoordinates(plugin, pocket.residue_ids, numbering);
        if (coords.length !== pocket.residue_ids.length) {
            throw new Error("Could not locate every pocket residue in the loaded structure.");
        }
        const query = calculatePocketQuery(pocket, coords, structureId, (residueId) => {
            const result = getResidueInformation(plugin, residueId, numbering);
            return result ?? undefined;
        });
        return createAHoJJobConfiguration(query);
    }, []);

    return {
        getAHoJJobConfiguration
    };
};
