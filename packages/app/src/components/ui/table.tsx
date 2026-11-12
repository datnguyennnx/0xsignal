"use client";

import * as React from "react";
import { cn } from "cn";

interface TableProps extends React.ComponentProps<"table"> {
  /** `fill` stretches the table across its container; `fit` sizes it to its content. */
  layout?: "fill" | "fit";
}

function Table({ className, layout = "fill", ...props }: TableProps) {
  return (
    <div
      data-slot="table-container"
      className="container-query w-full flex-1 min-h-0 overflow-auto rounded-panel"
    >
      <table
        data-slot="table"
        className={cn(
          layout === "fill" ? "w-full" : "w-auto",
          "caption-bottom type-control",
          className,
        )}
        {...props}
      />
    </div>
  );
}

function TableHeader({ ...props }: React.ComponentProps<"thead">) {
  return <thead data-slot="table-header" {...props} />;
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn(
        "[&_tr:last-child]:border-0 [&_tr:last-child>*:first-child]:rounded-bl-panel [&_tr:last-child>*:last-child]:rounded-br-panel",
        className,
      )}
      {...props}
    />
  );
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "min-h-(--row-table) border-b transition-colors hover:bg-(--control-hover-bg) has-aria-expanded:bg-(--control-active-bg)",
        className,
      )}
      {...props}
    />
  );
}

function TableHead({ className, scope = "col", ...props }: React.ComponentProps<"th">) {
  return (
    <th
      scope={scope}
      data-slot="table-head"
      className={cn(
        "table-head h-(--table-head-h) shadow-[inset_0_-1px_0_var(--border-subtle)] px-2 text-left align-middle font-medium whitespace-normal first:rounded-tl-(--radius-panel) last:rounded-tr-(--radius-panel)",
        className,
      )}
      {...props}
    />
  );
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "px-2 py-1 align-middle type-data whitespace-nowrap [&:has([role=checkbox])]:pr-0 [&>[role=checkbox]]:translate-y-[2px]",
        className,
      )}
      {...props}
    />
  );
}

export { Table, TableHeader, TableBody, TableHead, TableRow, TableCell };
