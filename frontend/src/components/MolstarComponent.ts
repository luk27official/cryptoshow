import { createPluginUI } from "molstar/lib/mol-plugin-ui";
import { renderReact18 } from "molstar/lib/mol-plugin-ui/react18";
import { DefaultPluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import { Asset } from "molstar/lib/mol-util/assets";
import { StateObjectSelector } from "molstar/lib/mol-state";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import { createStructureRepresentationParams } from "molstar/lib/mol-plugin-state/helpers/structure-representation-params";
import { Color } from "molstar/lib/mol-util/color";
import { StructureElement, StructureProperties } from "molstar/lib/mol-model/structure";

import "molstar/lib/mol-plugin-ui/skin/light.scss";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { CryptoBenchResult, Pocket } from "../types";
import { getColor } from "../utils";

export const initializePlugin = async () => {
    const wrapper = document.getElementById("molstar-component")!;
    const MolstarPlugin = await createPluginUI(
        {
            target: wrapper,
            render: renderReact18,
            spec: {
                ...DefaultPluginUISpec(),
                layout: {
                    initial: {
                        isExpanded: false,
                        showControls: true,
                        controlsDisplay: "reactive",
                        regionState: {
                            top: "hidden",
                            left: "collapsed",
                            bottom: "hidden",
                            right: "hidden"
                        }
                    }
                },
                components: {
                    remoteState: "none"
                }
            }
        });
    return MolstarPlugin;
};

export const loadStructure = async (plugin: PluginUIContext, structureUrl: string) => {
    const data = await plugin.builders.data.download({
        url: Asset.Url(structureUrl),
        isBinary: false
    }, { state: { isGhost: true } });

    let trajectory;
    if (structureUrl.endsWith("cif")) trajectory = await plugin.builders.structure.parseTrajectory(data, "mmcif");
    else trajectory = await plugin.builders.structure.parseTrajectory(data, "pdb");

    //create the initial model
    const model = await plugin.builders.structure.createModel(trajectory);
    const structure: StateObjectSelector = await plugin.builders.structure.createStructure(model, { name: "model", params: {} });

    const polymer = await plugin.builders.structure.tryCreateComponentStatic(structure, "polymer");
    if (polymer) {
        await plugin.builders.structure.representation.addRepresentation(polymer, {
            type: "cartoon",
            color: "uniform",
        });
    }

    return structure;
};


export const loadPockets = async (plugin: PluginUIContext, structure: StateObjectSelector, result: CryptoBenchResult) => {
    const builder = plugin.state.data.build();
    const group = builder.to(structure).apply(StateTransforms.Misc.CreateGroup, { label: "Pockets" }, { ref: "pockets" });

    // TODO: here we should save the pocket representations to the state (for toggling etc.)
    result.pockets.map((pocket, i) => {
        createPocketFromJson(plugin, structure, pocket, `Pocket ${i + 1}`, group, getColor(pocket.pocket_id));
    });
    await builder.commit();

    const PocketLabelProvider = {
        label: (loci: any) => {
            if (StructureElement.Loci.is(loci)) {
                const loc = StructureElement.Loci.getFirstLocation(loci);
                if (!loc) return;

                const chainId = StructureProperties.chain.auth_asym_id(loc);
                const resId = StructureProperties.residue.auth_seq_id(loc);

                const idx = result.residue_ids.findIndex((e) => e === `${chainId}_${resId}`);
                if (idx === -1) return "";

                return `${result.clusters[idx] === -1 ? "No pocket" : `Pocket: ${result.clusters[idx]}`}, predicted score: ${result.prediction[idx].toFixed(3)}`;
            }
            return "";
        },
    };

    plugin.managers.lociLabels.addProvider(PocketLabelProvider);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createPocketFromJson(plugin: PluginUIContext, structure: StateObjectSelector, pocket: Pocket, groupName: string, group: any, color: number) {
    const group2 = group.apply(StateTransforms.Misc.CreateGroup, { label: groupName }, { ref: groupName }, { selectionTags: groupName });

    const query = MS.struct.generator.atomGroups({
        "chain-test": MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), pocket.residue_ids[0].split("_")[0]]), // TODO: fix multiple chains
        "residue-test": MS.core.set.has([MS.set(...pocket.residue_ids.map((e) => Number(e.split("_")[1]))), MS.struct.atomProperty.macromolecular.auth_seq_id()]),
        "group-by": MS.struct.atomProperty.macromolecular.residueKey()
    });

    const resSelection = group2.apply(StateTransforms.Model.StructureSelectionFromExpression, { expression: query });

    resSelection.apply(StateTransforms.Representation.StructureRepresentation3D, createStructureRepresentationParams(plugin, structure.data, {
        type: "gaussian-surface",
        color: "uniform",
        colorParams: { value: Color(color) }, // TODO: change the color
        size: "uniform",
        sizeParams: { value: 1.05 },
    }));
}
