import { createContext } from "react";

import { LoadedStructure, PocketRepresentationType, PolymerRepresentationType, CryptoBenchResult } from "../types";

export interface AppContextType {
    loadedStructures: LoadedStructure[];
    setLoadedStructures: React.Dispatch<React.SetStateAction<LoadedStructure[]>>;
    selectedPolymerRepresentation: PolymerRepresentationType;
    setSelectedPolymerRepresentation: React.Dispatch<React.SetStateAction<PolymerRepresentationType>>;
    selectedPocketRepresentation: PocketRepresentationType;
    setSelectedPocketRepresentation: React.Dispatch<React.SetStateAction<PocketRepresentationType>>;
    cryptoBenchResult: CryptoBenchResult | null; // Allow null for initial state
    setCryptoBenchResult: React.Dispatch<React.SetStateAction<CryptoBenchResult | null>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export default AppContext;
