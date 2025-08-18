export interface TokenUsage {
	input_tokens: number;
	output_tokens: number;
	cache_creation_input_tokens?: number;
	cache_read_input_tokens?: number;
}

export interface ModelUsage {
	model: string;
	input_tokens: number;
	output_tokens: number;
	cache_creation_tokens: number;
	cache_read_tokens: number;
	requests: number;
}

export interface SessionStats {
	startTime: number;
	models: Map<string, ModelUsage>;
	totalInputTokens: number;
	totalOutputTokens: number;
	totalCacheCreationTokens: number;
	totalCacheReadTokens: number;
	totalRequests: number;
}

export interface ModelPricing {
	input: number; // $ per 1M tokens
	output: number; // $ per 1M tokens
	cacheCreation?: number; // $ per 1M tokens
	cacheRead?: number; // $ per 1M tokens
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
	"claude-3-5-sonnet-20241022": {
		input: 3.0,
		output: 15.0,
		cacheCreation: 3.75,
		cacheRead: 0.3,
	},
	"claude-3-5-haiku-20241022": {
		input: 1.0,
		output: 5.0,
		cacheCreation: 1.25,
		cacheRead: 0.1,
	},
	"claude-3-opus-20240229": {
		input: 15.0,
		output: 75.0,
		cacheCreation: 18.75,
		cacheRead: 1.5,
	},
	// Fallback for unknown models
	default: {
		input: 3.0,
		output: 15.0,
		cacheCreation: 3.75,
		cacheRead: 0.3,
	},
};
