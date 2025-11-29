import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function QueryLoading({ message = "Loading", context }) {
  return _jsx("div", {
    className: "flex items-center justify-center min-h-[60vh]",
    children: _jsxs("div", {
      className: "text-center space-y-3",
      children: [
        _jsx("div", {
          className:
            "animate-spin rounded-full h-8 w-8 border-2 border-foreground/20 border-t-foreground mx-auto",
        }),
        _jsxs("div", {
          children: [
            _jsx("p", { className: "text-sm text-foreground", children: message }),
            context &&
              _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: context }),
          ],
        }),
      ],
    }),
  });
}
export function QueryError({
  title,
  message = "Connection failed. Check your network and try again.",
  onRetry,
}) {
  return _jsxs("div", {
    className: "max-w-4xl mx-auto px-4 py-6 space-y-4",
    children: [
      _jsx("h1", { className: "text-lg sm:text-xl font-semibold", children: title }),
      _jsxs("div", {
        className: "rounded-lg border border-border bg-muted/30 p-6",
        children: [
          _jsx("p", { className: "text-sm text-muted-foreground mb-4", children: message }),
          onRetry &&
            _jsx("button", {
              onClick: onRetry,
              className:
                "px-4 py-2 text-sm font-medium bg-foreground text-background rounded hover:bg-foreground/90 transition-colors",
              children: "Retry",
            }),
          !onRetry &&
            _jsx("button", {
              onClick: () => window.location.reload(),
              className:
                "px-4 py-2 text-sm font-medium bg-foreground text-background rounded hover:bg-foreground/90 transition-colors",
              children: "Reload Page",
            }),
        ],
      }),
    ],
  });
}
export function QueryEmpty({ title, message, action }) {
  return _jsxs("div", {
    className: "py-12 text-center",
    children: [
      title && _jsx("p", { className: "text-sm font-medium mb-1", children: title }),
      _jsx("p", { className: "text-xs text-muted-foreground", children: message }),
      action &&
        _jsx("button", {
          onClick: action.onClick,
          className:
            "mt-4 px-3 py-1.5 text-xs font-medium border border-border rounded hover:bg-muted transition-colors",
          children: action.label,
        }),
    ],
  });
}
//# sourceMappingURL=query-state.js.map
