import { createContext } from "react";
import { PluginUIContext } from "molstar/lib/mol-plugin-ui/context";

interface PluginContextType {
    plugin: PluginUIContext;
}

// We need to use a trick here since we can't create a context without an initial value
// but we can't provide a real PluginUIContext initially
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PluginContext = createContext<PluginContextType>(undefined as any);

export default PluginContext;
