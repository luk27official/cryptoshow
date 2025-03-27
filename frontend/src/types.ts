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
