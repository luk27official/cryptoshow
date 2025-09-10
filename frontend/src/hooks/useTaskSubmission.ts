import { useState, useCallback } from "react";
import { TaskStatus, CryptoBenchResult } from "../types";
import { getApiUrl } from "../utils";

export const useTaskSubmission = () => {
    const [isLoading, setIsLoading] = useState(false);
    const [resultStatus, setResultStatus] = useState("");
    const [taskId, setTaskId] = useState("");

    const submitPDBTask = useCallback(async (pdbCode: string): Promise<TaskStatus> => {
        const response = await fetch(getApiUrl("/calculate"), {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ pdb: pdbCode }),
        });

        if (response.status === 400 || response.status === 404 || response.status === 500 || response.ok) {
            return response.json();
        }
        throw new Error(`HTTP error! Status: ${response.status}`);
    }, []);

    const submitFileTask = useCallback(async (file: File): Promise<TaskStatus> => {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch(getApiUrl("/calculate-custom"), {
            method: "POST",
            body: formData,
        });

        if (response.status === 400 || response.status === 404 || response.status === 500 || response.ok) {
            return response.json();
        }
        throw new Error(`HTTP error! Status: ${response.status}`);
    }, []);

    const fetchTaskStatus = useCallback(async (taskId: string): Promise<CryptoBenchResult | null> => {
        try {
            const response = await fetch(getApiUrl(`/task-status/${taskId}`));
            const data = await response.json();
            return data["result"] || null;
        } catch (error) {
            console.error("Error fetching task status:", error);
            return null;
        }
    }, []);

    const submitTask = useCallback(async (pdbCode: string, fileData: File | null) => {
        setIsLoading(true);
        try {
            setResultStatus("Submitted. Validating the structure...");

            let data: TaskStatus;
            if (fileData) {
                data = await submitFileTask(fileData);
            } else if (pdbCode) {
                data = await submitPDBTask(pdbCode);
            } else {
                return;
            }

            if (data.error) {
                setResultStatus(data.error);
                return;
            }

            setTaskId(data.task_id!);
            return data.task_id!;
        } catch (error) {
            setResultStatus("Error submitting request, " + error);
        } finally {
            setIsLoading(false);
        }
    }, [submitFileTask, submitPDBTask]);

    return {
        isLoading,
        resultStatus,
        taskId,
        submitTask,
        fetchTaskStatus,
        setResultStatus,
        setTaskId
    };
};
