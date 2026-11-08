import { StateObjectSelector } from "molstar/lib/mol-state";
import { Color } from "molstar/lib/mol-util/color";
import { Bundle } from "molstar/lib/mol-model/structure/structure/element/bundle";

export type CryptoBenchResult = {
    status: string;
    prediction: number[];
    clusters: number[];
    pockets: Pocket[];
    sequence: string[];
    residue_ids: string[];
    input_structure: string;
    task_id: string;
    file_hash: string;
    structure_name: string;
};

export type Pocket = {
    pocket_id: number;
    residue_ids: string[];
    prediction: number[];
    average_prediction: number;
};

export type TaskStatus = {
    status?: string;
    task_id?: string;
    result?: string | CryptoBenchResult;
    error?: string;
};

export type Point3D = {
    x: number;
    y: number;
    z: number;
};

/**
 * cc: https://github.com/scheuerv/molart/
 * This type is used to simplify work with current residue focused in Mol*.
 */
export type MolstarResidue = {
    authName: string;
    authSeqNumber: number;
    chain: {
        asymId: string;
        authAsymId: string;
        entity: {
            entityId: string;
            index: number;
        };
        index: number;
    };
    index: number;
    insCode: string;
    isHet: boolean;
    name: string;
    seqNumber: number;
};

export type AHoJStructure = {
    pdb_id: string;
    chains: string[];
    ligands: string[];
    rmsd: number;
    pocket_rmsd: number;
    sasa: number;
    structure_file: string;
    structure_file_url: string;
    target_chains: string[];
    uniprot_ids: string[];
};

export type AHoJResponse = {
    // if needed, more fields can be added here based on the AHoJ response
    job_id: string;
    done: boolean;
    queries: {
        found_apo: AHoJStructure[];
        found_holo: AHoJStructure[];
        found_alphafold: AHoJStructure[];
        [key: string]: unknown;
    }[];
    result_zip_url: string;
    [key: string]: unknown;
};

export type StructureComponentType = "pocket" | "chain" | "ligand";

export type Representation = "cartoon" | "ball-and-stick" | "molecular-surface" | "backbone" | "none";

export interface RepresentationChange {
    structureComponentType: StructureComponentType;
    representationChanged: boolean;
    colorChanged: boolean;
    color: string;
    representation: Representation;
}

export const defaultComponentRepresentations: Record<StructureComponentType, Representation> = {
    chain: "cartoon",
    pocket: "backbone",
    ligand: "ball-and-stick",
};

export const defaultComponentColors: Record<StructureComponentType, string> = {
    chain: "#ffffff",
    pocket: "#1abc9c",
    ligand: "#e74c3c",
};

export const representationOptions: { value: Representation; label: string; }[] = [
    { value: "cartoon", label: "Cartoon" },
    { value: "ball-and-stick", label: "Ball and Stick" },
    { value: "molecular-surface", label: "Surface" },
    { value: "backbone", label: "Backbone" },
    { value: "none", label: "None" },
];

export type RepresentationWithRef = {
    type: Representation;
    object: StateObjectSelector;
    transparentObjectRef?: string;
    overPaintRef?: string;
    id?: number;
};

export type LoadedStructure = {
    structure: StateObjectSelector;
    data: StateObjectSelector;
    polymerRepresentations: RepresentationWithRef[];
    pocketRepresentations: RepresentationWithRef[];
    ligandRepresentations: RepresentationWithRef[];
    structureUrl: string;
    structureName: string;
    ahojStructure?: AHoJStructure;
};

export type TrajectoryTaskResult = {
    status: string;
    trajectory: string;
    trimmed_pdb: string;
};

export type OverPaintParams = {
    bundle: Bundle,
    color: Color,
    clear: boolean;
};

export type ChainData = {
    threshold: number;
    chainId: string;
    residueNums: number[];
};