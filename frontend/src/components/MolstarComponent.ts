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
import { TrajectoryFromModelAndCoordinates } from "molstar/lib/mol-plugin-state/transforms/model";
import { Download } from "molstar/lib/mol-plugin-state/transforms/data";
import { AnimateModelIndex } from "molstar/lib/mol-plugin-state/animation/built-in/model-index";
import { Bundle } from "molstar/lib/mol-model/structure/structure/element/bundle";
import "molstar/lib/mol-plugin-ui/skin/light.scss";


import { CryptoBenchResult, Pocket, Point3D, MolstarResidue, RepresentationWithRef, PolymerRepresentationType, LoadedStructure, PocketRepresentationType, AHoJStructure } from "../types";
import { getColor, getWindowWidth } from "../utils";

/**
 * Initializes the Mol* plugin and sets up the layout.
 * @returns Mol* plugin instance
 */
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

    // Handle fullscreen mode
    MolstarPlugin.layout.events.updated.subscribe(() => {
        const header = document.getElementById("header")!;
        header.style.display = MolstarPlugin.layout.state.isExpanded ? "none" : "flex";
    });

    return MolstarPlugin;
};

/**
 * Loads a structure and its trajectory (if present) into the Mol* plugin.
 * @param plugin Mol* plugin instance
 * @param structureUrl Structure URL
 * @param trajectoryUrl Trajectory URL (optional)
 * @param ahojStructure AHoJ structure object (optional)
 * @returns Loaded structure object containing the structure, data, and representations
 */
export const loadStructure = async (plugin: PluginUIContext, structureUrl: string, trajectoryUrl: string | undefined, ahojStructure: AHoJStructure | undefined): Promise<LoadedStructure> => {
    let structureNameShort;

    // for aligned structures, we want to prettify the name if possible
    if (structureUrl.includes("/")) {
        const structureName = structureUrl.split("/").pop()!;
        const structureNameSplit = structureName.split("_");

        if (structureNameSplit.length >= 6) {
            structureNameShort = structureNameSplit[2] + "_" + structureNameSplit[5];
        }
    }

    const pdbData = await plugin.builders.data.download({
        url: Asset.Url(structureUrl),
        isBinary: false,
        label: structureNameShort ?? undefined
    }, { state: { isGhost: true } });

    let trajectory;
    let structure: StateObjectSelector;
    let polymer;

    const representations: RepresentationWithRef<PolymerRepresentationType>[] = [];

    if (structureUrl.endsWith("cif")) trajectory = await plugin.builders.structure.parseTrajectory(pdbData, "mmcif");
    else trajectory = await plugin.builders.structure.parseTrajectory(pdbData, "pdb");
    const model = await plugin.builders.structure.createModel(trajectory, { modelIndex: 0 });

    // we are loading the xtc file as well here
    if (trajectoryUrl) {
        const data = plugin.state.data.build().to(trajectory.ref).apply(Download, {
            url: Asset.Url(trajectoryUrl),
            isBinary: true,
            label: (structureNameShort ?? "") + "_traj"
        });
        const trajectoryData = await data.commit({ revertOnError: true });

        const provider = plugin.dataFormats.get("xtc");
        const coords = await provider!.parse(plugin, trajectoryData);

        trajectory = await plugin.build().to(trajectory.ref).apply(TrajectoryFromModelAndCoordinates, {
            modelRef: model.ref,
            coordinatesRef: coords.ref,
        }, { dependsOn: [model.ref, coords.ref] }).commit();

        const trajectoryModel = await plugin.builders.structure.createModel(trajectory);
        structure = await plugin.builders.structure.createStructure(trajectoryModel, { name: "model", params: {} });
        polymer = await plugin.builders.structure.tryCreateComponentStatic(structure, "polymer");
    }

    else {
        structure = await plugin.builders.structure.createStructure(model, { name: "model", params: {} });
        polymer = await plugin.builders.structure.tryCreateComponentStatic(structure, "polymer");
    }

    if (polymer) {
        const cartoon = await plugin.builders.structure.representation.addRepresentation(polymer, {
            type: "cartoon",
            color: "uniform",
        });
        await plugin.build().commit();

        representations.push({ type: "cartoon", object: cartoon });

        if (!structureNameShort) {
            // only create molecular surface if not aligning, this one is really heavy
            const surface = await plugin.builders.structure.representation.addRepresentation(polymer, {
                type: "molecular-surface",
                color: "uniform",
            });
            await plugin.build().commit();

            representations.push({ type: "molecular-surface", object: surface });
        }

        const ballAndStick = await plugin.builders.structure.representation.addRepresentation(polymer, {
            type: "ball-and-stick",
            color: "uniform",
        });
        await plugin.build().commit();

        representations.push({ type: "ball-and-stick", object: ballAndStick });

        const backbone = await plugin.builders.structure.representation.addRepresentation(polymer, {
            type: "backbone",
            color: "uniform",
        });
        await plugin.build().commit();

        representations.push({ type: "backbone", object: backbone });
    }

    await createLigandRepresentations(plugin, structure);

    const loadedStucture: LoadedStructure = {
        structure: structure,
        data: pdbData,
        polymerRepresentations: representations,
        pocketRepresentations: [],
        structureUrl: structureUrl,
        structureName: structureUrl.split("/").pop()!,
        ahojStructure: ahojStructure
    };

    return loadedStucture;
};

/**
 * Creates ligand representations in the Mol* plugin for a given structure.
 * @param plugin Mol* plugin instance
 * @param structure Structure object
 */
const createLigandRepresentations = async (plugin: PluginUIContext, structure: StateObjectSelector) => {
    // do not show "nucleic" (DNA) as ligands
    const shownGroups = ["ion", "ligand", "lipid", "branched", "non-standard", "coarse"] as const;

    for (const group of shownGroups) {
        const component = await plugin.builders.structure.tryCreateComponentStatic(structure, group);
        if (component) {
            await plugin.builders.structure.representation.addRepresentation(component, {
                type: "ball-and-stick"
            });
        }
    }

    await plugin.build().commit();
};

/**
 * Sets the visibility of a subtree in the Mol* plugin.
 * @param plugin Mol* plugin instance
 * @param representations Array of representations
 * @param representationType Type of representation to show 
 */
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

/**
 * Shows a specific polymer representation in the Mol* plugin.
 * @param plugin Mol* plugin instance
 * @param loadedStructure Loaded structure object
 * @param representationType Type of representation to show
 * @returns Promise that resolves when the representation is shown
 */
export const showOnePolymerRepresentation = async (
    plugin: PluginUIContext,
    loadedStructure: LoadedStructure,
    representationType: PolymerRepresentationType | null
) => {
    return showOneRepresentation(plugin, loadedStructure.polymerRepresentations, representationType);
};

/**
 * Shows a specific pocket representation in the Mol* plugin.
 * @param plugin Mol* plugin instance
 * @param loadedStructure Loaded structure object
 * @param representationType Type of representation to show
 * @returns Promise that resolves when the representation is shown
 */
export const showOnePocketRepresentation = async (
    plugin: PluginUIContext,
    loadedStructure: LoadedStructure,
    representationType: PocketRepresentationType | null
) => {
    return showOneRepresentation(plugin, loadedStructure.pocketRepresentations, representationType);
};

/**
 * Loads pockets into the Mol* plugin.
 * @param plugin Mol* plugin instance
 * @param structure Structure object (Mol*)
 * @param result CryptoBench result object
 * @param pocketId Pocket ID to load (null for all pockets)
 * @returns Promise containing Mol* representations that resolves when the pockets are loaded
 */
export const loadPockets = async (plugin: PluginUIContext, structure: StateObjectSelector, result: CryptoBenchResult, pocketId: number | null) => {
    const builder = plugin.state.data.build();
    const group = builder.to(structure).apply(StateTransforms.Misc.CreateGroup, { label: "Pockets" });

    const representations: RepresentationWithRef<PocketRepresentationType>[] = [];

    if (pocketId !== null) {
        const pocket = result.pockets[pocketId];
        createPocketFromJson(plugin, structure, pocket, `Pocket ${pocketId + 1}`, group, getColor(pocket.pocket_id), representations);
    }

    else {
        result.pockets.map((pocket, i) => {
            createPocketFromJson(plugin, structure, pocket, `Pocket ${i + 1}`, group, getColor(pocket.pocket_id), representations);
        });
    }

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

/**
 * Creates a pocket representation in the Mol* plugin from a JSON object.
 * @param plugin Mol* plugin instance
 * @param structure Structure object (Mol*)
 * @param pocket Pocket object (CryptoBench result object)
 * @param groupName Group name for the state tree
 * @param group State object reference for the group
 * @param color Color for the representation
 * @param representations Array of pocket representations (mutable)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createPocketFromJson = async (plugin: PluginUIContext, structure: StateObjectSelector, pocket: Pocket, groupName: string, group: any, color: number, representations: RepresentationWithRef<PocketRepresentationType>[]) => {
    const group2 = group.apply(StateTransforms.Misc.CreateGroup, { label: groupName });

    const queries = [];

    const chains = pocket.residue_ids.map((e) => e.split("_")[0]);
    const uniqueChains = [...new Set(chains)];

    for (const chain of uniqueChains) {
        const query = MS.struct.generator.atomGroups({
            "chain-test": MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chain]),
            "residue-test": MS.core.set.has([MS.set(...pocket.residue_ids.map((e) => Number(e.split("_")[1]))), MS.struct.atomProperty.macromolecular.auth_seq_id()]),
            "group-by": MS.struct.atomProperty.macromolecular.residueKey()
        });
        queries.push(query);
    }

    const union = MS.struct.modifier.union(queries);

    const resSelection = group2.apply(StateTransforms.Model.StructureSelectionFromExpression, { expression: union });

    const surface = resSelection.apply(StateTransforms.Representation.StructureRepresentation3D, createStructureRepresentationParams(plugin, structure.data, {
        type: "molecular-surface",
        color: "uniform",
        colorParams: { value: Color(color) },
        size: "physical",
        sizeParams: { scale: 1.05 },
    }));

    representations.push({ type: "molecular-surface", object: surface, id: pocket.pocket_id });

    const ballAndStick = resSelection.apply(StateTransforms.Representation.StructureRepresentation3D, createStructureRepresentationParams(plugin, structure.data, {
        type: "ball-and-stick",
        color: "uniform",
        colorParams: { value: Color(color) },
        size: "physical",
        sizeParams: { scale: 1.5 },
    }));

    representations.push({ type: "ball-and-stick", object: ballAndStick, id: pocket.pocket_id });

    const cartoon = resSelection.apply(StateTransforms.Representation.StructureRepresentation3D, createStructureRepresentationParams(plugin, structure.data, {
        type: "cartoon",
        color: "uniform",
        colorParams: { value: Color(color) },
        size: "uniform",
        sizeParams: { value: 1.05 },
    }));

    representations.push({ type: "cartoon", object: cartoon, id: pocket.pocket_id });
};

/**
 * Gets the selection from the chain ID and auth IDs for specified residues.
 * @param plugin Mol* plugin instance
 * @param chainId Chain ID
 * @param positions Array of residue positions
 * @returns Selection object
 */
const getSelectionFromChainAuthId = (plugin: PluginUIContext, chainId: string, positions: number[]) => {
    const query = MS.struct.generator.atomGroups({
        "chain-test": MS.core.rel.eq([MS.struct.atomProperty.macromolecular.auth_asym_id(), chainId]),
        "residue-test": MS.core.set.has([MS.set(...positions), MS.struct.atomProperty.macromolecular.auth_seq_id()]),
        "group-by": MS.struct.atomProperty.macromolecular.residueKey()
    });
    return Script.getStructureSelection(query, plugin.managers.structure.hierarchy.current.structures[0].cell.obj!.data);
};

//cc: https://github.com/scheuerv/molart/
/**
 * Gets the structure element loci from the given loci.
 * @param loci Loci object
 * @returns Element loci or undefined
 */
const getStructureElementLoci = (loci: Loci): StructureElement.Loci | undefined => {
    if (loci.kind == "bond-loci") {
        return Bond.toStructureElementLoci(loci);
    } else if (loci.kind == "element-loci") {
        return loci;
    }
    return undefined;
};

/**
 * Gets the coordinates of residues in the Mol* plugin.
 * @param plugin Mol* plugin instance
 * @param residues Array of residue strings (e.g., "A_1")
 * @returns Array of coordinates
 */
export const getResidueCoordinates = (plugin: PluginUIContext, residues: string[]) => {
    const coordinates: Point3D[] = [];

    // could this be potentially improved? not sure whether we can do it just with one selection
    // but it is still pretty fast
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
};

/**
 * Gets the residue information from the Mol* plugin.
 * @param plugin Mol* plugin instance
 * @param residue Residue string (e.g., "A_1")
 * @returns Residue object containing information about the residue
 */
export const getResidueInformation = (plugin: PluginUIContext, residue: string) => {
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
};

/**
 * Removes a structure from the Mol* plugin state tree.
 * @param plugin Mol* plugin instance
 * @param ref Reference to the object to remove
 */
export const removeFromStateTree = async (plugin: PluginUIContext, ref: string) => {
    await plugin.state.data.build().delete(ref).commit();
};

/**
 * Plays an animation in the Mol* plugin.
 * @param plugin Mol* plugin instance
 * @param fps Frames per second for the animation
 */
export const playAnimation = (plugin: PluginUIContext, fps: number) => {
    plugin.managers.animation.play(AnimateModelIndex, {
        duration: { name: "computed", params: { targetFps: fps } },
        mode: { name: "loop", params: { direction: "forward" } }
    });
};

/**
 * Resets the camera in the Mol* plugin.
 * @param plugin Mol* plugin instance
 */
export const resetCamera = (plugin: PluginUIContext) => {
    plugin.canvas3d?.requestCameraReset();
};

/**
 * Sets the transparency of a structure in the Mol* plugin.
 * @param plugin Mol* plugin instance
 * @param alpha Transparency value (0-1)
 * @param representations Array of representations
 * @param structure Structure object (Mol*)
 */
export const setStructureTransparency = async (plugin: PluginUIContext, alpha: number, representations: RepresentationWithRef<PocketRepresentationType | PolymerRepresentationType>[], structure: StateObjectSelector) => {
    type TransparencyParams = {
        bundle: Bundle;
        value: number;
    };

    const params: TransparencyParams[] = [];

    const query = MS.struct.generator.all;
    const sel = Script.getStructureSelection(query, structure.cell!.obj!.data);
    const bundle = Bundle.fromSelection(sel);

    params.push({
        bundle: bundle,
        value: 1 - alpha
    });

    for (const element of representations) {
        const builder = plugin.state.data.build();
        if (element.transparentObjectRef) {
            builder.to(element.object.ref).delete(element.transparentObjectRef);
        }
        await builder.commit();

        const r = await plugin.state.data.build().to(element.object.ref).apply(StateTransforms.Representation.TransparencyStructureRepresentation3DFromBundle, { layers: params }).commit();
        element.transparentObjectRef = r.ref;
    }
};