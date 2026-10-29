import { useContext } from "react";

import { DashboardGridContext } from "./dashboard-grid-context";

export interface DashboardPanelProps {
  id: string;
  children: React.ReactNode;
}

export function DashboardPanel({ children }: DashboardPanelProps) {
  // Check if rendered inside DashboardGrid
  // This component is a data-descriptor — its children are extracted and rendered
  // by DashboardGrid. It should never be mounted as a standalone component.
  if (!useContext(DashboardGridContext)) {
    throw new Error(
      "DashboardPanel is a data-descriptor that must be a direct child of DashboardGrid. " +
        'It cannot be rendered standalone. Use <DashboardGrid><DashboardPanel id="...">...</DashboardPanel></DashboardGrid>.',
    );
  }
  return children;
}

DashboardPanel.displayName = "DashboardPanel";
