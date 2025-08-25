import { useCallback } from "react";
import { AHoJResponse } from "../types";
import { getApiUrl } from "../utils";

export const useAHoJService = () => {
    const submitJob = useCallback(async (config: string): Promise<{ job_id: string; } | null> => {
        try {
            const response = await fetch(getApiUrl("/proxy/ahoj/job"), {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: config
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error("Error submitting AHoJ job:", error);
            return null;
        }
    }, []);

    const getJobStatus = useCallback(async (taskHash: string, ahojJobId: string): Promise<AHoJResponse | null> => {
        try {
            const response = await fetch(getApiUrl(`/proxy/ahoj/${taskHash}/api/job/${ahojJobId}`));

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error("Error fetching AHoJ job status:", error);
            return null;
        }
    }, []);

    const pollJobStatus = useCallback(async (taskHash: string, jobId: string, interval: number = 5000): Promise<AHoJResponse> => {
        return new Promise((resolve) => {
            const intervalId = setInterval(async () => {
                const status = await getJobStatus(taskHash, jobId);
                if (status) {
                    if (status.done) {
                        clearInterval(intervalId);
                        resolve(status);
                    }
                } else {
                    console.error("Failed to fetch AHoJ job status, jobId:", jobId);
                }
            }, interval);
        });
    }, [getJobStatus]);

    const createTrajectoryWebSocket = useCallback((animationTaskId: string): WebSocket => {
        return new WebSocket(
            `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/ws/task-status/${animationTaskId}`
        );
    }, []);

    return {
        submitJob,
        getJobStatus,
        pollJobStatus,
        createTrajectoryWebSocket
    };
};
