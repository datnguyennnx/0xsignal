import { createContext } from "react";

// `true` while a DashboardGrid is rendering, so a DashboardPanel can reject standalone use.
export const DashboardGridContext = createContext(false);
