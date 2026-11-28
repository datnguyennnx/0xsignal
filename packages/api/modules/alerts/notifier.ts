import { Context, Effect, Layer } from "effect";
import type { Notice } from "@0xsignal/shared/alerts";
import { subjectKey, type Subject } from "./table";

type AlertsListener = (notice: Notice) => void;

export interface AlertsNotifierPort {
  readonly publish: (subject: Subject, notice: Notice) => void;
  readonly subscribe: (subjectKey: string, listener: AlertsListener) => () => void;
}

export class AlertsNotifier extends Context.Service<AlertsNotifier, AlertsNotifierPort>()(
  "AlertsNotifier",
) {}

const makeAlertsNotifier = (): AlertsNotifierPort => {
  const channels = new Map<string, Set<AlertsListener>>();

  return {
    publish: (subject, notice) => {
      const listeners = channels.get(subjectKey(subject));
      if (listeners === undefined) return;
      // A listener owns its socket; one broken connection must not starve the rest.
      for (const listener of Array.from(listeners)) {
        try {
          listener(notice);
        } catch {
          // Intentionally ignored: the notifier is in-process delivery, not a retry queue.
        }
      }
    },

    subscribe: (key, listener) => {
      const listeners = channels.get(key) ?? new Set<AlertsListener>();
      listeners.add(listener);
      channels.set(key, listeners);

      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && channels.get(key) === listeners) channels.delete(key);
      };
    },
  };
};

export const AlertsNotifierLayer: Layer.Layer<AlertsNotifier> = Layer.effect(
  AlertsNotifier,
  Effect.sync(() => AlertsNotifier.of(makeAlertsNotifier())),
);
