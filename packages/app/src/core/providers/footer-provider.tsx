import { createContext, useContext, useState, type ReactNode } from "react";

interface FooterContextType {
  metadata: ReactNode;
  setMetadata: (content: ReactNode) => void;
  warning: ReactNode;
  setWarning: (content: ReactNode) => void;
}

const FooterContext = createContext<FooterContextType | undefined>(undefined);

export function FooterProvider({ children }: { children: ReactNode }) {
  const [metadata, setMetadata] = useState<ReactNode>(null);
  const [warning, setWarning] = useState<ReactNode>("Not financial advice");

  return (
    <FooterContext.Provider value={{ metadata, setMetadata, warning, setWarning }}>
      {children}
    </FooterContext.Provider>
  );
}

export function useFooter() {
  const context = useContext(FooterContext);
  if (!context) {
    throw new Error("useFooter must be used within a FooterProvider");
  }
  return context;
}
