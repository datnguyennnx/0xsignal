import { Schema } from "effect";

// Informational row only: the key itself lives in the user's wallet, never here.
const AgentRegistrationSchema = Schema.Struct({
  id: Schema.String,
  userId: Schema.String,
  agentAddress: Schema.String,
  label: Schema.optionalKey(Schema.String),
  expiresAt: Schema.optionalKey(Schema.String),
  isVerified: Schema.Boolean,
  createdAt: Schema.String,
});

export type AgentRegistration = Schema.Schema.Type<typeof AgentRegistrationSchema>;
