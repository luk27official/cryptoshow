import React, { useState, ReactNode } from "react";
import { LoadedStructure, CryptoBenchResult, defaultComponentColors, defaultComponentRepresentations } from "../types";
import AppContext from "../contexts/AppContext";

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [loadedStructures, setLoadedStructures] = useState<LoadedStructure[]>([]);
    const [selectedRepresentations, setSelectedRepresentations] = useState(defaultComponentRepresentations);
    const [selectedColors, setSelectedColors] = useState(defaultComponentColors);
    const [cryptoBenchResult, setCryptoBenchResult] = useState<CryptoBenchResult | null>(null);

    const value = {
        loadedStructures,
        setLoadedStructures,
        selectedRepresentations,
        setSelectedRepresentations,
        selectedColors,
        setSelectedColors,
        cryptoBenchResult,
        setCryptoBenchResult,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};


