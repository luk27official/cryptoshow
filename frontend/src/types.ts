import { StateObjectSelector } from "molstar/lib/mol-state";

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
    rmsd: number;
    sasa: number;
    structure_file: string;
    structure_file_url: string;
    uniprot_ids: string[];
};

// TODO: we might add more fields here if needed
export type AHoJResponse = {
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

export type PolymerRepresentationType = "cartoon" | "ball-and-stick" | "molecular-surface";

export type PocketRepresentationType = "cartoon" | "ball-and-stick" | "molecular-surface";

export type RepresentationWithRef<T extends PolymerRepresentationType | PocketRepresentationType> = {
    type: T;
    object: StateObjectSelector;
};

export type LoadedStructure = {
    structure: StateObjectSelector;
    polymerRepresentations: RepresentationWithRef<PolymerRepresentationType>[];
    pocketRepresentations: RepresentationWithRef<PocketRepresentationType>[];
};
