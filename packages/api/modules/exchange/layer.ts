import { Layer } from "effect";
import { OrderIntentService } from "./index";
import { makeOrderIntentService } from "./intent-service";
import { OrderIntentRepoLayer } from "./intent-repo.pg";
import { OrderIntentRetentionLayer } from "./retention";

export const orderIntentServiceLayer = Layer.effect(OrderIntentService, makeOrderIntentService());

export const orderIntentLayer = Layer.mergeAll(
  orderIntentServiceLayer,
  OrderIntentRetentionLayer,
).pipe(Layer.provide(OrderIntentRepoLayer));
