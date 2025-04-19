
import { useContext } from "react";

import AppContext from "../contexts/AppContext";
import { AppContextType } from "../contexts/AppContext";

export const useAppContext = (): AppContextType => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error("useAppContext must be used within an AppProvider");
    }
    return context;
};