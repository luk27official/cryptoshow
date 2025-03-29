import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import { getAHoJJobConfiguration, submitAHoJJob, pollAHoJJobStatus } from "../services/AHoJservice";
import { AHoJResponse, Pocket } from "../types";
import { getApiUrl, getColorString } from "../utils";
import { useState } from "react";

interface ResultTableProps {
    taskId: string;
    pockets: Pocket[];
    plugin: PluginUIContext;
    structureId: string;
    taskHash: string;
}

function ResultTable({ taskId, pockets, plugin, structureId, taskHash }: ResultTableProps) {
    const [ahoJJobIds, setAHoJJobIds] = useState<(string | null)[]>(new Array(pockets.length).fill(null));
    const [ahojJobResults, setAhoJJobResults] = useState<(AHoJResponse | null)[]>(new Array(pockets.length).fill(null));

    const handleClick = async (pocket: Pocket, idx: number) => {
        const config = getAHoJJobConfiguration(pocket, plugin, structureId);

        const postData = await submitAHoJJob(config);

        if (postData) {
            ahoJJobIds[idx] = postData["job_id"];
            setAHoJJobIds([...ahoJJobIds]);
            console.log(postData);

            const jobResult = await pollAHoJJobStatus(taskHash, postData["job_id"]);
            ahojJobResults[idx] = jobResult;
            setAhoJJobResults([...ahojJobResults]);
            console.log("AHoJ Job Result:", jobResult);
        }
    };

    return (
        <div className="results-table">
            <p>Task ID: {taskId}</p>
            <div>
                {pockets.map((pocket: Pocket, index: number) => {
                    const predictionString = pocket.prediction.map((e) => e.toFixed(3)).join(",");
                    const residueIds = pocket.residue_ids.join(",");
                    const displayString = `${pocket.pocket_id} - ${predictionString} - ${pocket.average_prediction.toFixed(3)} | IDs: ${residueIds}`;

                    return (
                        <div key={index}>
                            <span className="pocket-item">
                                <span className="pocket-text" style={{
                                    wordBreak: "break-word",
                                    overflowWrap: "break-word",
                                    display: "inline-block",
                                    maxWidth: "100%",
                                    color: getColorString(pocket.pocket_id)
                                }}>{displayString}</span>
                            </span>

                            {/* AHoJ should be available only for public structures */}
                            {structureId !== "custom" && (
                                <>
                                    <button onClick={() => handleClick(pocket, index)}>AHoJ</button>
                                    <br />
                                    <span>{ahoJJobIds[index] ?? ""}</span>
                                    <br />
                                    {ahojJobResults[index] && (
                                        <>
                                            APO: {ahojJobResults[index].queries[0]?.found_apo.map((v) => (
                                                <a key={v.pdb_id} href={getApiUrl(`/proxy/ahoj/${taskHash}/${v.structure_file_url}`)} target="_blank" rel="noopener noreferrer">
                                                    {v.pdb_id}{" "}
                                                </a>
                                            ))} <br />
                                            HOLO: {ahojJobResults[index].queries[0]?.found_holo.map((v) => (
                                                <a key={v.pdb_id} href={getApiUrl(`/proxy/ahoj/${taskHash}/${v.structure_file_url}`)} target="_blank" rel="noopener noreferrer">
                                                    {v.pdb_id}{" "}
                                                </a>
                                            ))} <br />
                                        </>
                                    )}
                                </>
                            )}
                            <hr />
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ResultTable;
