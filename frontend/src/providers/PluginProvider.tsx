import { ReactNode } from "react";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";
import PluginContext from "../contexts/PluginContext";

export const PluginProvider = ({ children, plugin }: { children: ReactNode; plugin: PluginUIContext; }) => {
    return (
        <PluginContext.Provider value={{ plugin }}>
            {children}
        </PluginContext.Provider>
    );
};
