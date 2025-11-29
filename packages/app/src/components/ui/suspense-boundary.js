import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Suspense } from "react";
const DefaultFallback = () =>
  _jsx("div", {
    className: "flex items-center justify-center min-h-[60vh]",
    children: _jsxs("div", {
      className: "text-center space-y-3",
      children: [
        _jsx("div", {
          className:
            "animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent mx-auto",
        }),
        _jsx("p", { className: "text-sm text-muted-foreground", children: "Loading..." }),
      ],
    }),
  });
export const SuspenseBoundary = ({ children, fallback }) => {
  return _jsx(Suspense, { fallback: fallback || _jsx(DefaultFallback, {}), children: children });
};
//# sourceMappingURL=suspense-boundary.js.map
