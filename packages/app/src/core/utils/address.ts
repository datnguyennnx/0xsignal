export const ADDRESS_PATTERN = /^0x[a-fA-F0-9]{40}$/;

export const truncateAddress = (address: string): string =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

export const isValidAddress = (value: string): boolean => ADDRESS_PATTERN.test(value);
