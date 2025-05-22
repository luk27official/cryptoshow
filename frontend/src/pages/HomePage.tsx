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

            setTaskId(data.task_id!);
            webSocketCheck(data.task_id!);
        } catch (error) {
            setResultStatus("Error submitting request, " + error);
        } finally {
            setIsLoading(false);
        }
    };

    const webSocketCheck = (taskId: string) => {
        const ws = new WebSocket(
            `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/task-status/${taskId}`
        );

        ws.onmessage = (event) => {
            const data: TaskStatus = event.data ? JSON.parse(event.data) : { "status": "unknown" };

            if (data.status === "SUCCESS") {
                setResultStatus("Success.");
                const completedTasks = localStorage.getItem(COMPLETED_TASKS_KEY);
                const { task_id, structure_name } = data.result as CryptoBenchResult;
                const stringToSave = `${task_id} (${structure_name})`;
                if (completedTasks) {
                    const tasksArray = JSON.parse(completedTasks);
                    const lastFiveTasks = tasksArray.slice(-5);
                    // only add if it's not already in the last 5 tasks
                    if (!lastFiveTasks.includes(stringToSave)) {
                        localStorage.setItem(COMPLETED_TASKS_KEY, JSON.stringify([...tasksArray, stringToSave]));
                    }
                } else {
                    localStorage.setItem(COMPLETED_TASKS_KEY, JSON.stringify([stringToSave]));
                }
                ws.close();
            } else if (data.status === "FAILURE") {
                let error = data.error ?? data.result as string ?? "Unknown error.";
                error += " An error occured. Please, consider reporting this issue via GitHub.";
                setResultStatus(error);
                ws.close();
            } else if (data.status === "PROGRESS" || data.status === "PENDING") {
                setResultStatus(data.error ?? (data.result as CryptoBenchResult)?.status ?? data.result as string ?? "Processing structure...");
            } else {
                setResultStatus("Unknown status: " + data.status);
            }
        };
    };

    return (
        <div className="homepage-container">
            <div>
                <h2>CryptoShow {window.location.port === "3000" && "(Dev Mode)"}</h2>
            </div>
            <div>
                <p>CryptoShow is an application for detection of protein binding sites utilizing the CryptoBench model and ESM-2 embeddings.</p>
            </div>
            <div className="card">
                <div className="card-row">
                    <InputTable
                        pdbCode={pdbCode}
                        fileData={fileData}
                        isLoading={isLoading}
                        setPdbCode={setPdbCode}
                        setFileData={setFileData}
                        handleSubmit={handleSubmit}
                    />
                </div>
            </div>
            {!taskId && resultStatus &&
                <div className="card">
                    <h3>Task Status:</h3>
                    <pre>{resultStatus}</pre>
                </div>
            }
            {taskId && resultStatus &&
                <div className="card">
                    <h3>Task Status:</h3>
                    <pre>Task ID: {taskId}</pre>
                    <p>{resultStatus}</p>
                    {resultStatus === "Success." && <a href={`./viewer?id=${taskId}`}>View 3D Structure</a>}
                </div>
            }
            <div className="card">
                <h3>Last 5 Completed Tasks:</h3>
                <ul>
                    {JSON.parse(localStorage.getItem(COMPLETED_TASKS_KEY) || "[]")
                        .slice(-5)
                        .map((task: string, index: number) => (
                            // the .split() here considers the string to be ("<task-id> (<structure-name>)")
                            <li key={index}><a href={`./viewer?id=${task.split(" ")[0]}`}>{task}</a></li>
                        ))}
                </ul>
            </div>
        </div>
    );
}

export default HomePage;