export interface AIProviderConfig {
  id: string;
  name: string;
  isEnabled: boolean;
  apiKey: string;
  baseUrl: string;
  customModels: string[];
}

export interface ProviderModelMap {
  [providerId: string]: string[];
}

export interface GlobalModelsConfig {
  defaultProviderId: string;
  defaultModelId: string;
  reasoningProviderId: string;
  reasoningModelId: string;
}

export interface FeatureSettingsConfig {
  ragEnabled: boolean;
  ragSimilarityThreshold: number;
  searchMaxResults: number;
  searchIncludeDiary: boolean;
  summaryAutoGenerate: boolean;
  devModeEnabled: boolean;
}
