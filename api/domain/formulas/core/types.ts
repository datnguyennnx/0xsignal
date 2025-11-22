// ============================================================================
// FORMULA TYPES AND METADATA
// ============================================================================
// Standardized types for formula inputs, outputs, and metadata
// Enables AI agent discovery and invocation
// ============================================================================

/**
 * Formula difficulty levels
 */
export type FormulaDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

/**
 * Formula categories
 */
export type FormulaCategory =
  | 'momentum'
  | 'volatility'
  | 'trend'
  | 'volume'
  | 'oscillators'
  | 'statistical'
  | 'microstructure'
  | 'mean-reversion'
  | 'factors'
  | 'risk'
  | 'regime'
  | 'ml-features'
  | 'orderbook'
  | 'cross-asset'
  | 'composite'
  | 'attribution'
  | 'timeseries';

/**
 * Formula metadata for AI agent discovery
 */
export interface FormulaMetadata {
  readonly name: string;
  readonly category: FormulaCategory;
  readonly difficulty: FormulaDifficulty;
  readonly description: string;
  readonly requiredInputs: readonly string[];
  readonly optionalInputs: readonly string[];
  readonly minimumDataPoints: number;
  readonly outputType: string;
  readonly useCases: readonly string[];
  readonly timeComplexity: string;
  readonly dependencies: readonly string[];
}

/**
 * Standard input for price-based formulas
 */
export interface PriceInput {
  readonly prices: number[];
  readonly period?: number;
}

/**
 * Standard input for OHLC-based formulas
 */
export interface OHLCInput {
  readonly opens: number[];
  readonly highs: number[];
  readonly lows: number[];
  readonly closes: number[];
  readonly period?: number;
}

/**
 * Standard input for volume-based formulas
 */
export interface VolumeInput {
  readonly prices: number[];
  readonly volumes: number[];
  readonly period?: number;
}

/**
 * Standard input for two-series formulas (correlation, cointegration, etc.)
 */
export interface TwoSeriesInput {
  readonly series1: number[];
  readonly series2: number[];
  readonly period?: number;
}

/**
 * Standard result metadata
 */
export interface ResultMetadata {
  readonly inputsValid: boolean;
  readonly calculationMethod: string;
  readonly timestamp: Date;
  readonly warnings?: string[];
  readonly dataPoints?: number;
}

/**
 * Formula registry entry
 */
export interface FormulaRegistryEntry {
  readonly metadata: FormulaMetadata;
  readonly compute: (...args: any[]) => any;
}

/**
 * Formula registry - functional approach using Map
 */
const formulaRegistry = new Map<string, FormulaRegistryEntry>();

/**
 * Register a formula in the registry
 */
export const registerFormula = (entry: FormulaRegistryEntry): void => {
  formulaRegistry.set(entry.metadata.name, entry);
};

/**
 * Get a formula by name
 */
export const getFormula = (name: string): FormulaRegistryEntry | undefined => {
  return formulaRegistry.get(name);
};

/**
 * Get all registered formulas
 */
export const getAllFormulas = (): ReadonlyArray<FormulaRegistryEntry> => {
  return Array.from(formulaRegistry.values());
};

/**
 * Get formulas by category
 */
export const getFormulasByCategory = (
  category: FormulaCategory
): ReadonlyArray<FormulaRegistryEntry> => {
  return getAllFormulas().filter((entry) => entry.metadata.category === category);
};

/**
 * Get formulas by difficulty
 */
export const getFormulasByDifficulty = (
  difficulty: FormulaDifficulty
): ReadonlyArray<FormulaRegistryEntry> => {
  return getAllFormulas().filter((entry) => entry.metadata.difficulty === difficulty);
};

/**
 * Search formulas by query string
 */
export const searchFormulas = (query: string): ReadonlyArray<FormulaRegistryEntry> => {
  const lowerQuery = query.toLowerCase();
  return getAllFormulas().filter(
    (entry) =>
      entry.metadata.name.toLowerCase().includes(lowerQuery) ||
      entry.metadata.description.toLowerCase().includes(lowerQuery) ||
      entry.metadata.useCases.some((useCase) =>
        useCase.toLowerCase().includes(lowerQuery)
      )
  );
};
