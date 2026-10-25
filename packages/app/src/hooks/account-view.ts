import { isValidAddress } from "@/core/utils/address";

export interface AccountView {
  /** The connected wallet. The only address an authenticated `user/*` call may carry. */
  ownAddress: string | undefined;
  /** The wallet being inspected, read from the route and never stored. */
  whaleAddress: string | undefined;
  signingDisabled: boolean;
}

/**
 * Single decision point for "whose account is this". The two addresses never fall
 * back into one another: the route can only produce a read-only whale view.
 */
export function selectAccountView({
  routeAddress,
  connectionAddress,
}: {
  routeAddress: string | undefined;
  connectionAddress: string | undefined;
}): AccountView {
  const whaleAddress =
    routeAddress !== undefined && isValidAddress(routeAddress) ? routeAddress : undefined;
  return {
    ownAddress: connectionAddress,
    whaleAddress,
    signingDisabled: whaleAddress !== undefined,
  };
}
