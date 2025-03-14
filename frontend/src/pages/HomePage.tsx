import { useState } from "react";
import { getApiUrl } from "../utils";

import "./HomePage.css";

function HomePage() {
    const [pdbCode, setPdbCode] = useState("");
    const [taskId, setTaskId] = useState("");
    const [resultData, setResultData] = useState<{ status: string; }>({ status: "Uninitialized" });
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
            const data = event.data ? JSON.parse(event.data) : {};

            if (data["status"] === "SUCCESS") {
                setResultData(data["result"]);
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
                    {resultData["status"] === "SUCCESS" && <a href={`./viewer?id=${taskId}`}>View 3D Structure</a>}
                </div>
            }
        </>
    );
}

export default HomePage;