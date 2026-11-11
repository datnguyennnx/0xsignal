import type { EvmContractDescriptor } from "@0xsignal/shared";

type ContractAddressValue = string | EvmContractDescriptor | null | undefined;

const isEvmContractDescriptor = (value: ContractAddressValue): value is EvmContractDescriptor =>
  typeof value === "object" &&
  value !== null &&
  typeof value.address === "string" &&
  value.address !== "";

export function contractAddressText(value: ContractAddressValue): string | undefined {
  if (typeof value === "string") return value === "" ? undefined : value;
  if (isEvmContractDescriptor(value)) return value.address;
  return undefined;
}
