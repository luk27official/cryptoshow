import { createPluginUI } from "molstar/lib/mol-plugin-ui";
import { renderReact18 } from "molstar/lib/mol-plugin-ui/react18";
import { DefaultPluginUISpec } from "molstar/lib/mol-plugin-ui/spec";
import { Asset } from "molstar/lib/mol-util/assets";
import { StateObjectSelector } from "molstar/lib/mol-state";
import { StateTransforms } from "molstar/lib/mol-plugin-state/transforms";
import { MolScriptBuilder as MS } from "molstar/lib/mol-script/language/builder";
import { createStructureRepresentationParams } from "molstar/lib/mol-plugin-state/helpers/structure-representation-params";
import { Color } from "molstar/lib/mol-util/color";
import { StructureSelection, StructureElement, StructureProperties, Bond } from "molstar/lib/mol-model/structure";
import { Loci } from "molstar/lib/mol-model/loci";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { Script } from "molstar/lib/mol-script/script";
import { setSubtreeVisibility } from "molstar/lib/mol-plugin/behavior/static/state";
import "molstar/lib/mol-plugin-ui/skin/light.scss";

import { CryptoBenchResult, Pocket, Point3D, MolstarResidue, RepresentationWithRef, PolymerRepresentationType, LoadedStructure, PocketRepresentationType } from "../types";
import { getColor, getWindowWidth } from "../utils";

export const initializePlugin = async () => {
    const wrapper = document.getElementById("molstar-component")!;
    const windowWidth = getWindowWidth();
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
                            left: (windowWidth > 768) ? "collapsed" : "hidden",
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
    const representations: RepresentationWithRef<PolymerRepresentationType>[] = [];

    if (polymer) {
        const cartoon = await plugin.builders.structure.representation.addRepresentation(polymer, {
            type: "cartoon",
            color: "uniform",
        });

        representations.push({ type: "cartoon", object: cartoon });

        const surface = await plugin.builders.structure.representation.addRepresentation(polymer, {
            type: "molecular-surface",
            color: "uniform",
        });

        representations.push({ type: "molecular-surface", object: surface });

        const ballAndStick = await plugin.builders.structure.representation.addRepresentation(polymer, {
            type: "ball-and-stick",
            color: "uniform",
        });

        representations.push({ type: "ball-and-stick", object: ballAndStick });
    }

    const loadedStucture: LoadedStructure = {
        structure: structure,
        polymerRepresentations: representations,
        pocketRepresentations: []
    };

    return loadedStucture;
};

export const showOneRepresentation = async <T extends PolymerRepresentationType | PocketRepresentationType>(
    plugin: PluginUIContext,
    representations: RepresentationWithRef<T>[],
    representationType: T | null
) => {
    for (const representation of representations) {
        const isVisible = representation.type !== representationType;
        setSubtreeVisibility(plugin.state.data, representation.object.ref, isVisible);
    }
};

export const showOnePolymerRepresentation = async (
    plugin: PluginUIContext,
    loadedStructure: LoadedStructure,
    representationType: PolymerRepresentationType | null
) => {
    return showOneRepresentation(plugin, loadedStructure.polymerRepresentations, representationType);
};

export const showOnePocketRepresentation = async (
    plugin: PluginUIContext,
    loadedStructure: LoadedStructure,
    representationType: PocketRepresentationType | null
) => {
    return showOneRepresentation(plugin, loadedStructure.pocketRepresentations, representationType);
};


export const loadPockets = async (plugin: PluginUIContext, structure: StateObjectSelector, result: CryptoBenchResult) => {
    const builder = plugin.state.data.build();
    const group = builder.to(structure).apply(StateTransforms.Misc.CreateGroup, { label: "Pockets" }, { ref: "pockets" });

    const representations: RepresentationWithRef<PocketRepresentationType>[] = [];
    result.pockets.map((pocket, i) => {
        createPocketFromJson(plugin, structure, pocket, `Pocket ${i + 1}`, group, getColor(pocket.pocket_id), representations);
    });
    await builder.commit();

    const PocketLabelProvider = {
        label: (loci: Loci) => {
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

    return representations;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createPocketFromJson(plugin: PluginUIContext, structure: StateObjectSelector, pocket: Pocket, groupName: string, group: any, color: number, representations: RepresentationWithRef<PocketRepresentationType>[]) {
    const group2 = group.apply(StateTransforms.Misc.CreateGroup, { label: groupName }, { ref: groupName }, { selectionTags: groupName });

    const query = MS.struct.generator.atomGroups({
        "chain-test": MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), pocket.residue_ids[0].split("_")[0]]), // TODO: fix multiple chains
        "residue-test": MS.core.set.has([MS.set(...pocket.residue_ids.map((e) => Number(e.split("_")[1]))), MS.struct.atomProperty.macromolecular.auth_seq_id()]),
        "group-by": MS.struct.atomProperty.macromolecular.residueKey()
    });

    const resSelection = group2.apply(StateTransforms.Model.StructureSelectionFromExpression, { expression: query });

    // TODO: here, we should think about saving the pocket number as well
    const surface = resSelection.apply(StateTransforms.Representation.StructureRepresentation3D, createStructureRepresentationParams(plugin, structure.data, {
        type: "molecular-surface",
        color: "uniform",
        colorParams: { value: Color(color) }, // TODO: change the color
        size: "uniform",
        sizeParams: { value: 1.05 },
    }));

    representations.push({ type: "molecular-surface", object: surface });

    const ballAndStick = resSelection.apply(StateTransforms.Representation.StructureRepresentation3D, createStructureRepresentationParams(plugin, structure.data, {
        type: "ball-and-stick",
        color: "uniform",
        colorParams: { value: Color(color) }, // TODO: change the color
        size: "uniform",
        sizeParams: { value: 1.75 },
    }));

    representations.push({ type: "ball-and-stick", object: ballAndStick });

    const cartoon = resSelection.apply(StateTransforms.Representation.StructureRepresentation3D, createStructureRepresentationParams(plugin, structure.data, {
        type: "cartoon",
        color: "uniform",
        colorParams: { value: Color(color) }, // TODO: change the color
        size: "uniform",
        sizeParams: { value: 1.05 },
    }));

    representations.push({ type: "cartoon", object: cartoon });
}

function getSelectionFromChainAuthId(plugin: PluginUIContext, chainId: string, positions: number[]) {
    const query = MS.struct.generator.atomGroups({
        "chain-test": MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId]), // TODO: fix multiple chains
        "residue-test": MS.core.set.has([MS.set(...positions), MS.struct.atomProperty.macromolecular.auth_seq_id()]),
        "group-by": MS.struct.atomProperty.macromolecular.residueKey()
    });
    return Script.getStructureSelection(query, plugin.managers.structure.hierarchy.current.structures[0].cell.obj!.data);
}

//cc: https://github.com/scheuerv/molart/
function getStructureElementLoci(loci: Loci): StructureElement.Loci | undefined {
    if (loci.kind == "bond-loci") {
        return Bond.toStructureElementLoci(loci);
    } else if (loci.kind == "element-loci") {
        return loci;
    }
    return undefined;
}

export function getResidueCoordinates(plugin: PluginUIContext, residues: string[]) {
    const coordinates: Point3D[] = [];

    //TODO: could this be potentially improved? not sure whether we can do it just with one selection
    for (const res of residues) {
        const sel = getSelectionFromChainAuthId(plugin, res.split("_")[0], [Number(res.split("_")[1])]);
        const loci = getStructureElementLoci(StructureSelection.toLociWithSourceUnits(sel));

        if (loci) {
            const structureElement = StructureElement.Stats.ofLoci(loci);
            const location = structureElement.firstElementLoc;
            coordinates.push({ x: StructureProperties.atom.x(location), y: StructureProperties.atom.y(location), z: StructureProperties.atom.z(location) });
        }
    }

    return coordinates;
}

export function getResidueInformation(plugin: PluginUIContext, residue: string) {
    const sel = getSelectionFromChainAuthId(plugin, residue.split("_")[0], [Number(residue.split("_")[1])]);
    const loci = getStructureElementLoci(StructureSelection.toLociWithSourceUnits(sel));
    if (!loci) return null;

    const structureElement = StructureElement.Stats.ofLoci(loci);
    const location = structureElement.firstElementLoc;
    const r: MolstarResidue = {
        authName: StructureProperties.atom.auth_comp_id(location),
        name: StructureProperties.atom.label_comp_id(location),
        isHet: StructureProperties.residue.hasMicroheterogeneity(location),
        insCode: StructureProperties.residue.pdbx_PDB_ins_code(location),
        index: StructureProperties.residue.key(location),
        seqNumber: StructureProperties.residue.label_seq_id(location),
        authSeqNumber: StructureProperties.residue.auth_seq_id(location),
        chain: {
            asymId: StructureProperties.chain.label_asym_id(location),
            authAsymId: StructureProperties.chain.auth_asym_id(location),
            entity: {
                entityId: StructureProperties.entity.id(location),
                index: StructureProperties.entity.key(location)
            },
            index: StructureProperties.chain.key(location)
        }
    };

    return r;
}