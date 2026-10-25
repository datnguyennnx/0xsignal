-- The encrypted agent/eoa keys are gone: the backend holds no key material.
-- The informational record now lives in agent_registrations. Agent approvals
-- remain valid on-chain until the user re-approves or the validity expires.
DROP TABLE IF EXISTS api_credentials;
