import { Layer } from "effect";
import * as auth from "@0xsignal/auth";
import { OrderIntentService } from "../../modules/exchange";

export const TestRouteEnvLayer = Layer.mergeAll(
  Layer.mock(auth.AuthService, {}),
  Layer.mock(auth.ExchangeAccountRepo, {}),
  Layer.mock(auth.AgentRegistrationRepo, {}),
  Layer.mock(auth.WalletChallengeRepo, {}),
  Layer.mock(OrderIntentService, {}),
);
