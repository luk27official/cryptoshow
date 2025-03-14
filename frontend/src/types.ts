export type CryptoBenchResult = {
    status: string;
    prediction: number[];
    pockets: number[];
    sequence: string[];
    residue_ids: string[];
    input_structure: string;
    task_id: string;
};