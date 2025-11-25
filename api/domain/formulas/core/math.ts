// Re-export all math utilities from shared package
// This ensures consistent calculations between frontend and backend
export {
  sum,
  mean,
  variance,
  standardDeviation,
  covariance,
  correlation,
  min,
  max,
  median,
  percentile,
  logReturns,
  simpleReturns,
  rollingWindow,
  clamp,
  emaAlpha,
  normalize,
  zScore,
} from "@0xsignal/shared";
