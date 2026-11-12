import { TabsList, TabsTrigger } from "@/components/ui/tabs";

import { SETTINGS_NAV_ITEMS } from "./settings-nav-model";

/*
 * One box for every rail item: the rail width, the horizontal padding and the
 * active/hover surface all live on the tab itself, so the pill and the label's
 * left edge are the same for one-word and two-word labels alike.
 */
const TAB_BOX_CLASS =
  "group w-full max-w-full flex-none justify-start gap-inline border-0 px-(--control-px) text-left [border-radius:var(--radius-control)]! hover:bg-(--control-hover-bg) data-active:bg-(--control-active-bg) data-active:text-info data-active:shadow-none!";

export function SettingsNav() {
  return (
    <div className="col-span-1 w-full min-w-0 py-2 md:border-r md:pr-2">
      <TabsList
        aria-label="Settings sections"
        className="tier-identity w-full flex-col gap-1 [padding:0]!"
      >
        {SETTINGS_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <TabsTrigger key={item.value} value={item.value} className={TAB_BOX_CLASS}>
              <span className="flex w-(--icon) shrink-0 items-center justify-center text-muted-foreground group-data-[active]:text-info">
                <Icon aria-hidden className="size-(--icon-sm)" />
              </span>
              <span className="flex h-(--action-h) min-w-0 flex-1 items-center truncate type-control">
                {item.label}
              </span>
            </TabsTrigger>
          );
        })}
      </TabsList>
    </div>
  );
}
