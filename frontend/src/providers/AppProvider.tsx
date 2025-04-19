import React, { useState, ReactNode } from "react";
import { LoadedStructure, PolymerRepresentationType, PocketRepresentationType, CryptoBenchResult } from "../types";
import AppContext from "../contexts/AppContext";

interface AppProviderProps {
    children: ReactNode;
}

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
    const [loadedStructures, setLoadedStructures] = useState<LoadedStructure[]>([]);
    const [selectedPolymerRepresentation, setSelectedPolymerRepresentation] = useState<PolymerRepresentationType>("cartoon");
    const [selectedPocketRepresentation, setSelectedPocketRepresentation] = useState<PocketRepresentationType>("cartoon");
    const [cryptoBenchResult, setCryptoBenchResult] = useState<CryptoBenchResult | null>(null);

    const value = {
        loadedStructures,
        setLoadedStructures,
        selectedPolymerRepresentation,
        setSelectedPolymerRepresentation,
        selectedPocketRepresentation,
        setSelectedPocketRepresentation,
        cryptoBenchResult,
        setCryptoBenchResult,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};


