-- whale_wallets had a writer and a pruner but no reader: discovery already
-- tracks nominated wallets in memory, so the table was pure write amplification.
DROP TABLE IF EXISTS whale_wallets;
