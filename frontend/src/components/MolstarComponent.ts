import { createPluginUI } from "molstar/lib/mol-plugin-ui";
import { renderReact18 } from "molstar/lib/mol-plugin-ui/react18";
import { DefaultPluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import { Asset } from "molstar/lib/mol-util/assets";
import { StateObjectSelector } from "molstar/lib/mol-state";

import "molstar/lib/mol-plugin-ui/skin/light.scss";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";

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
};