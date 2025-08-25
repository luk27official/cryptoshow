import { useState } from "react";
import { useTaskSubmission, useWebSocketTask, useLocalStorage } from "../hooks";
import { TaskStatus, CryptoBenchResult } from "../types";

import "./HomePage.css";
import InputTable from "../components/InputTable";

function HomePage() {
    const [pdbCode, setPdbCode] = useState("");
    const [fileData, setFileData] = useState<File | null>(null);

    const { isLoading, resultStatus, taskId, submitTask, setResultStatus } = useTaskSubmission();
    const { createWebSocket } = useWebSocketTask();
    const { addCompletedTask, getLastFiveCompletedTasks } = useLocalStorage();

    const handleWebSocketMessages = (taskId: string) => {
        const ws = createWebSocket(taskId);

        ws.onmessage = (event: MessageEvent) => {
            const data: TaskStatus = event.data ? JSON.parse(event.data) : { "status": "unknown" };

            if (data.status === "SUCCESS") {
                setResultStatus("Success.");
                const { task_id, structure_name } = data.result as CryptoBenchResult;
                addCompletedTask(task_id, structure_name);
                ws.close();
            } else if (data.status === "FAILURE") {
                let error = data.error ?? data.result as string ?? "Unknown error.";
                error += "\nAn error occured. Please, consider reporting this issue via GitHub.";
                setResultStatus(error);
                ws.close();
            } else if (data.status === "PROGRESS" || data.status === "PENDING") {
                setResultStatus(data.error ?? (data.result as CryptoBenchResult)?.status ?? data.result as string ?? "Processing structure...");
            } else {
                setResultStatus("Unknown status: " + data.status);
            }
        };
    };

    const handleSubmit = async () => {
        const submittedTaskId = await submitTask(pdbCode, fileData);
        if (submittedTaskId) {
            handleWebSocketMessages(submittedTaskId);
        }
    };

    const lastCompletedTasks = getLastFiveCompletedTasks();

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
                    <h3>Task Status</h3>
                    <pre>{resultStatus}</pre>
                </div>
            }
            {taskId && resultStatus &&
                <div className="card">
                    <h3>Task Status</h3>
                    <pre>Task ID: {taskId}</pre>
                    <p>{resultStatus}</p>
                    {resultStatus === "Success." && <a href={`./viewer?id=${taskId}`}>View 3D Structure</a>}
                </div>
            }
            {lastCompletedTasks.length > 0 && <div className="card">
                <h3>Your Last Completed Tasks</h3>
                <ul>
                    {lastCompletedTasks.map((task: string, index: number) => (
                        // the .split() here considers the string to be ("<task-id> (<structure-name>)")
                        <li key={index}><a href={`./viewer?id=${task.split(" ")[0]}`}>{task}</a></li>
                    ))}
                </ul>
            </div>
            }
        </div>
    );
}

export default HomePage;