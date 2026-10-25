import { Layer } from "effect";
import { OrderIntentService } from "./index";
import { makeOrderIntentService } from "./intent-service";
import { OrderIntentRepoLayer } from "./intent-repo.pg";

export const orderIntentServiceLayer = Layer.effect(OrderIntentService, makeOrderIntentService());

export const orderIntentLayer = orderIntentServiceLayer.pipe(Layer.provide(OrderIntentRepoLayer));
