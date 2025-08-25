import { useState, useCallback, useEffect } from "react";
import { COMPLETED_TASKS_KEY } from "../utils";

export const useWebSocketTask = () => {
    const [webSocket, setWebSocket] = useState<WebSocket | null>(null);

    const createWebSocket = useCallback((taskId: string) => {
        const ws = new WebSocket(
            `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws/task-status/${taskId}`
        );
        setWebSocket(ws);
        return ws;
    }, []);

    const closeWebSocket = useCallback(() => {
        if (webSocket) {
            webSocket.close();
            setWebSocket(null);
        }
    }, [webSocket]);

    useEffect(() => {
        return () => {
            closeWebSocket();
        };
    }, [closeWebSocket]);

    return { createWebSocket, closeWebSocket };
};

export const useLocalStorage = () => {
    const getCompletedTasks = useCallback((): string[] => {
        try {
            return JSON.parse(localStorage.getItem(COMPLETED_TASKS_KEY) || "[]");
        } catch {
            return [];
        }
    }, []);

    const addCompletedTask = useCallback((taskId: string, structureName: string): void => {
        const completedTasks = getCompletedTasks();
        const stringToSave = `${taskId} (${structureName})`;
        const lastFiveTasks = completedTasks.slice(-5);

        // Only add if it's not already in the last 5 tasks
        if (!lastFiveTasks.includes(stringToSave)) {
            const updatedTasks = [...completedTasks, stringToSave];
            localStorage.setItem(COMPLETED_TASKS_KEY, JSON.stringify(updatedTasks));
        }
    }, [getCompletedTasks]);

    const getLastFiveCompletedTasks = useCallback((): string[] => {
        return getCompletedTasks().slice(-5);
    }, [getCompletedTasks]);

    return {
        getCompletedTasks,
        addCompletedTask,
        getLastFiveCompletedTasks
    };
};
