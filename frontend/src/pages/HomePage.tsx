import { useState } from "react";
import { COMPLETED_TASKS_KEY, getApiUrl } from "../utils";

import "./HomePage.css";
import InputTable from "../components/InputTable";
import { CryptoBenchResult, TaskStatus } from "../types";

function HomePage() {
    const [pdbCode, setPdbCode] = useState("");
    const [taskId, setTaskId] = useState("");
    const [resultStatus, setResultStatus] = useState<string>("");
    const [isLoading, setIsLoading] = useState(false);
    const [fileData, setFileData] = useState<File | null>(null);

    const handleSubmit = async () => {
        setIsLoading(true);
        try {
            setResultStatus("Submitted. Validating the structure...");

            let data: TaskStatus;
            if (fileData) {
                const formData = new FormData();
                formData.append("file", fileData);

                data = await fetch(getApiUrl("/calculate-custom"), {
                    method: "POST",
                    body: formData,
                }).then(response => {
                    if (response.status === 400 || response.status === 404 || response.status === 500 || response.ok) {
                        return response.json();
                    }
                    throw new Error(`HTTP error! Status: ${response.status}`);
                });
            } else if (pdbCode) {
                data = await fetch(getApiUrl("/calculate"), {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ pdb: pdbCode }),
                }).then(response => {
                    if (response.status === 400 || response.status === 404 || response.status === 500 || response.ok) {
                        return response.json();
                    }
                    throw new Error(`HTTP error! Status: ${response.status}`);
                });
            } else return;

            if (data.error) {
                setResultStatus(data.error);
                return;
            }

            console.log(data);
            setTaskId(data.task_id!);
            webSocketCheck(data.task_id!);
        } catch (error) {
            setResultStatus("Error submitting request, " + error);
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
            const data: TaskStatus = event.data ? JSON.parse(event.data) : { "status": "unknown" };

            if (data.status === "SUCCESS") {
                setResultStatus("Success.");
                const completedTasks = localStorage.getItem(COMPLETED_TASKS_KEY);
                if (completedTasks) {
                    localStorage.setItem(COMPLETED_TASKS_KEY, JSON.stringify([...JSON.parse(completedTasks), (data.result as CryptoBenchResult).task_id]));
                } else {
                    localStorage.setItem(COMPLETED_TASKS_KEY, JSON.stringify([(data.result as CryptoBenchResult).task_id]));
                }
                ws.close();
            } else if (data.status === "FAILURE") {
                setResultStatus(data.error ?? data.result as string ?? "Unknown error.");
                ws.close();
            } else if (data.status === "PROGRESS" || data.status === "PENDING") {
                setResultStatus(data.error ?? (data.result as CryptoBenchResult)?.status ?? data.result as string ?? "Processing structure...");
            } else {
                setResultStatus("Unknown status: " + data.status);
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
                <InputTable
                    pdbCode={pdbCode}
                    fileData={fileData}
                    isLoading={isLoading}
                    setPdbCode={setPdbCode}
                    setFileData={setFileData}
                    handleSubmit={handleSubmit}
                />
            </div>
            {taskId &&
                <div>
                    <h3>Task ID:</h3>
                    <p>{taskId}</p>
                </div>
            }
            {resultStatus &&
                <div>
                    <h3>Result:</h3>
                    <p>{resultStatus}</p>
                    {resultStatus === "Success." && <a href={`./viewer?id=${taskId}`}>View 3D Structure</a>}
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