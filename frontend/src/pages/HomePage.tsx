import { useState } from "react";
import { COMPLETED_TASKS_KEY, getApiUrl } from "../utils";

import "./HomePage.css";

function HomePage() {
    const [pdbCode, setPdbCode] = useState("");
    const [taskId, setTaskId] = useState("");
    const [resultData, setResultData] = useState<{ status: string; }>({ status: "Uninitialized" });
    const [isLoading, setIsLoading] = useState(false);
    const [fileData, setFileData] = useState<File | null>(null);

    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            let data;
            if (fileData) {
                const formData = new FormData();
                formData.append("file", fileData);

                data = await fetch(getApiUrl("/calculate-custom"), {
                    method: "POST",
                    body: formData,
                }).then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                });
            } else if (pdbCode) {
                data = await fetch(getApiUrl("/calculate"), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ pdb: pdbCode }),
                }).then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                });
            } else return;

            console.log("submitting...", data);
            setResultData({ status: "Submitted" });
            setTaskId(data["task_id"]);
            webSocketCheck(data["task_id"]);
        } catch (error) {
            console.error("Error submitting request:", error);
            setResultData({ status: "Error submitting request" });
        } finally {
            setIsLoading(false);
        }
    };

    const webSocketCheck = (taskId: string) => {
        const ws = new WebSocket(`ws://localhost/ws/task-status/${taskId}`);
        ws.onopen = () => {
            console.log("WebSocket connected");
        };

        ws.onmessage = (event) => {
            const data = event.data ? JSON.parse(event.data) : { "status": "unknown" };

            if (data["status"] === "SUCCESS") {
                setResultData(data["result"]);
                const completedTasks = localStorage.getItem(COMPLETED_TASKS_KEY);
                if (completedTasks) {
                    localStorage.setItem(COMPLETED_TASKS_KEY, JSON.stringify([...JSON.parse(completedTasks), data["result"]["task_id"]]));
                } else {
                    localStorage.setItem(COMPLETED_TASKS_KEY, JSON.stringify([data["result"]["task_id"]]));
                }
                ws.close();
            } else if (data["status"] === "PENDING" || data["status"] === "PROGRESS") {
                setResultData(data["result"] || { status: data["status"] });
            } else {
                setResultData(data["status"]);
            }
        };

        ws.onclose = () => {
            console.log("WebSocket closed");
        };
    };

    return (
        <>
            <div>
                <h2>CryptoShow {window.location.port === "3000" && "(Dev Mode)"}</h2>
            </div>
            <div>
                <table className="input-table">
                    <tbody>
                        <tr>
                            <td>PDB Code:</td>
                            <td>
                                <input
                                    type="text"
                                    value={pdbCode}
                                    onChange={(e) => setPdbCode(e.target.value)}
                                    disabled={isLoading}
                                    placeholder="Enter PDB code"
                                />
                            </td>
                            <td rowSpan={2}>
                                <button
                                    onClick={() => handleSubmit()}
                                    disabled={isLoading || (!pdbCode && !fileData)}
                                >
                                    {isLoading ? "Processing..." : "Submit"}
                                </button>
                            </td>
                        </tr>
                        <tr>
                            <td>Or:</td>
                            <td>
                                <input
                                    type="file"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            setPdbCode(""); // Clear PDB code when file is selected
                                            setFileData(file);
                                            console.log(file);
                                        }
                                    }}
                                    disabled={isLoading}
                                    accept=".pdb,.cif,.pdb1"
                                />
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
            {taskId &&
                <div>
                    <h3>Task ID:</h3>
                    <p>{taskId}</p>
                </div>
            }
            {resultData["status"] &&
                <div>
                    <h3>Result:</h3>
                    <p>{resultData["status"]}</p>
                    {resultData["status"] === "SUCCESS" && <a href={`./viewer?id=${taskId}`}>View 3D Structure</a>}
                </div>
            }
            <div>
                <h3>Last 5 completed tasks:</h3>
                <ul>
                    {JSON.parse(localStorage.getItem(COMPLETED_TASKS_KEY) || "[]")
                        .slice(-5)
                        .map((task: string, index: number) => (
                            <li key={index}><a href={`./viewer?id=${task}`}>{task}</a></li>
                        ))}
                </ul>
            </div>
        </>
    );
}

export default HomePage;