import { useState } from "react";
import { CryptoBenchResult } from "../types";
import { getApiUrl } from "../utils";

import "./HomePage.css";

function HomePage() {
    const [pdbCode, setPdbCode] = useState("");
    const [taskId, setTaskId] = useState("");
    const [resultData, setResultData] = useState<CryptoBenchResult>({ status: "Uninitialized" });
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async () => {
        if (!pdbCode) return;

        setIsLoading(true);
        try {
            const data = await fetch(getApiUrl(`/calculate/${pdbCode}`))
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                });

            console.log("submitting...", data);
            setTaskId(data["task_id"]);
            poll(data["task_id"]);
            webSocketCheck(data["task_id"]);
        } catch (error) {
            console.error("Error submitting request:", error);
            setResultData({ status: "Error submitting request" });
        } finally {
            setIsLoading(false);
        }
    };

    const poll = async (tId: string) => {
        try {
            const data = await fetch(getApiUrl(`/task-status/${tId}`))
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! Status: ${response.status}`);
                    }
                    return response.json();
                });

            console.log("polling...", data);

            if (data["status"] === "SUCCESS") {
                setResultData(data["result"]);
            } else if (data["status"] === "PENDING" || data["status"] === "PROGRESS") {
                setTimeout(() => poll(tId), 1000);
                setResultData(data["result"] || { status: data["status"] });
            } else {
                setResultData(data["status"]);
            }
        } catch (error) {
            console.error("Error polling task status:", error);
            setResultData({ status: "Error checking task status" });
        }
    };

    const webSocketCheck = (taskId: string) => {
        const ws1 = new WebSocket(`ws://localhost/ws/task-status/${taskId}`);
        ws1.onopen = () => {
            console.log("WebSocket1 connected");
        };

        ws1.onmessage = (event) => {
            console.log("WebSocket1 message received:", event.data);
        };

        ws1.onclose = () => {
            console.log("WebSocket1 closed");
        };
    };

    return (
        <>
            <div>
                <h2>CryptoShow {window.location.port === "3000" && "(Dev Mode)"}</h2>
            </div>
            <div>
                <span>Input a PDB code: </span>
                <input
                    type="text"
                    value={pdbCode}
                    onChange={(e) => setPdbCode(e.target.value)}
                    disabled={isLoading}
                />
                &nbsp;
                <button
                    onClick={() => handleSubmit()}
                    disabled={isLoading || !pdbCode}
                >
                    {isLoading ? "Processing..." : "Submit"}
                </button>
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
                    {resultData["prediction"] && resultData["pockets"] &&
                        <ul>
                            {resultData["prediction"].map((value: number, index: number) => (
                                <li key={index}>
                                    {resultData["residue_ids"]?.[index]}, {value.toFixed(5)}, {resultData["pockets"]?.[index]}
                                </li>
                            ))}
                        </ul>
                    }
                </div>
            }
        </>
    );
}

export default HomePage;