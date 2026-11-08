import { createContext } from "react";

import { LoadedStructure, Representation, StructureComponentType, CryptoBenchResult } from "../types";

export interface AppContextType {
    loadedStructures: LoadedStructure[];
    setLoadedStructures: React.Dispatch<React.SetStateAction<LoadedStructure[]>>;
    selectedRepresentations: Record<StructureComponentType, Representation>;
    setSelectedRepresentations: React.Dispatch<React.SetStateAction<Record<StructureComponentType, Representation>>>;
    selectedColors: Record<StructureComponentType, string>;
    setSelectedColors: React.Dispatch<React.SetStateAction<Record<StructureComponentType, string>>>;
    cryptoBenchResult: CryptoBenchResult | null;
    setCryptoBenchResult: React.Dispatch<React.SetStateAction<CryptoBenchResult | null>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export default AppContext;
