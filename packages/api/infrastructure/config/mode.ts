import { Config } from "effect";

export const isDevMode: Config.Config<boolean> = Config.string("MODE").pipe(
  Config.map((mode) => mode === "dev"),
);
