import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import type { TokenUsage } from "./types";

// Simple console colors
const colors = {
	reset: "\x1b[0m",
	cyan: "\x1b[36m",
	yellow: "\x1b[33m",
	blue: "\x1b[34m",
	green: "\x1b[32m",
	gray: "\x1b[90m",
	white: "\x1b[37m",
	magenta: "\x1b[35m",
	red: "\x1b[31m",
};

// Pricing per million tokens
const pricing: Record<string, { input: number; output: number; cacheWrite: number; cacheRead: number }> = {
	"claude-opus-4-1": {
		input: 15,
		output: 75,
		cacheWrite: 18.75,
		cacheRead: 1.5,
	},
	"claude-sonnet-4": {
		input: 3,
		output: 15,
		cacheWrite: 3.75,
		cacheRead: 0.3,
	},
	"claude-haiku-3-5": {
		input: 0.8,
		output: 4,
		cacheWrite: 1,
		cacheRead: 0.08,
	},
};

function getPricingForModel(model: string) {
	// Match model names to pricing keys
	if (model.includes("opus")) return pricing["claude-opus-4-1"];
	if (model.includes("sonnet")) return pricing["claude-sonnet-4"];
	if (model.includes("haiku")) return pricing["claude-haiku-3-5"];
	return null;
}

function calculateCost(usage: any, modelPricing: any) {
	if (!modelPricing) return 0;

	const inputCost = (usage.input_tokens / 1000000) * modelPricing.input;
	const outputCost = (usage.output_tokens / 1000000) * modelPricing.output;
	const cacheWriteCost = (usage.cache_creation_input_tokens / 1000000) * modelPricing.cacheWrite;
	const cacheReadCost = (usage.cache_read_input_tokens / 1000000) * modelPricing.cacheRead;

	return inputCost + outputCost + cacheWriteCost + cacheReadCost;
}

// Global stats
let totalRequests = 0;
const startTime = Date.now();
let usageInitialized = false;
let verboseLogging = false;
let currentSessionId = "";

// Accumulated usage per model
const modelUsage: Record<string, any> = {};

function logUsage(sessionId: string, model: string, usage: any) {
	// Store session ID for cleanup
	if (sessionId) {
		currentSessionId = sessionId;
	}

	// On first call, try to load existing usage data
	if (!usageInitialized && sessionId) {
		usageInitialized = true;
		try {
			const cwd = process.cwd().replace(/\//g, "-");
			const projectDir = path.join(os.homedir(), ".claude", "projects", cwd);
			const usageFile = path.join(projectDir, `${sessionId}.usage.json`);

			if (fs.existsSync(usageFile)) {
				const existingData = JSON.parse(fs.readFileSync(usageFile, "utf-8"));
				totalRequests = existingData.requests || 0;
				if (existingData.models) {
					Object.assign(modelUsage, existingData.models);
				}
				if (verboseLogging) {
					console.log(`${colors.cyan}[cccost] Loaded existing usage: ${totalRequests} requests${colors.reset}`);
				}
			}
		} catch (error) {
			// Silently ignore errors
		}
	}

	totalRequests += 1;

	// Initialize model usage if not exists
	if (!modelUsage[model]) {
		modelUsage[model] = {
			requests: 0,
			input_tokens: 0,
			output_tokens: 0,
			cache_creation_input_tokens: 0,
			cache_read_input_tokens: 0,
			cost: 0,
			last: null,
		};
	}

	// Calculate cost for this request
	const modelPricing = getPricingForModel(model);
	const requestCost = calculateCost(usage, modelPricing);

	// Store last request details
	modelUsage[model].last = {
		utcTimestamp: Date.now(),
		input_tokens: usage.input_tokens || 0,
		output_tokens: usage.output_tokens || 0,
		cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
		cache_read_input_tokens: usage.cache_read_input_tokens || 0,
		cost: requestCost,
	};

	// Accumulate model-specific usage
	modelUsage[model].requests += 1;
	modelUsage[model].input_tokens += usage.input_tokens || 0;
	modelUsage[model].output_tokens += usage.output_tokens || 0;
	modelUsage[model].cache_creation_input_tokens += usage.cache_creation_input_tokens || 0;
	modelUsage[model].cache_read_input_tokens += usage.cache_read_input_tokens || 0;
	modelUsage[model].cost += requestCost;

	// Log model usage
	let cacheInfo = "";
	if (usage.cache_creation_input_tokens > 0 || usage.cache_read_input_tokens > 0) {
		cacheInfo = ` ${colors.gray}(${colors.yellow}`;
		if (usage.cache_creation_input_tokens > 0) {
			cacheInfo += `+${usage.cache_creation_input_tokens} create`;
		}
		if (usage.cache_read_input_tokens > 0) {
			if (usage.cache_creation_input_tokens > 0) cacheInfo += ", ";
			cacheInfo += `+${usage.cache_read_input_tokens} read`;
		}
		cacheInfo += `${colors.gray})`;
	}

	let totalCacheInfo = "";
	if (modelUsage[model].cache_creation_input_tokens > 0 || modelUsage[model].cache_read_input_tokens > 0) {
		totalCacheInfo = ` ${colors.gray}(${colors.yellow}`;
		if (modelUsage[model].cache_creation_input_tokens > 0) {
			totalCacheInfo += `${modelUsage[model].cache_creation_input_tokens} create`;
		}
		if (modelUsage[model].cache_read_input_tokens > 0) {
			if (modelUsage[model].cache_creation_input_tokens > 0) totalCacheInfo += ", ";
			totalCacheInfo += `${modelUsage[model].cache_read_input_tokens} read`;
		}
		totalCacheInfo += `${colors.gray})`;
	}

	if (verboseLogging) {
		const costDisplay = requestCost > 0 ? ` ${colors.magenta}$${requestCost.toFixed(6)}${colors.gray}` : "";
		const totalCostDisplay =
			modelUsage[model].cost > 0 ? ` ${colors.magenta}$${modelUsage[model].cost.toFixed(4)}${colors.gray}` : "";
		console.log(
			`${colors.gray}[cccost] ${model}: ${colors.blue}+${usage.input_tokens}${colors.gray}/${colors.green}+${usage.output_tokens}${cacheInfo}${costDisplay}` +
				`${colors.gray} → Model Total: ${colors.blue}${modelUsage[model].input_tokens}${colors.gray}/${colors.green}${modelUsage[model].output_tokens}${totalCacheInfo}${totalCostDisplay}` +
				`${colors.gray} | Requests: ${modelUsage[model].requests}${colors.reset}`,
		);
	}

	// Write usage file
	if (sessionId) {
		try {
			// Convert cwd to Claude projects directory format
			const cwd = process.cwd().replace(/\//g, "-");
			const projectDir = path.join(os.homedir(), ".claude", "projects", cwd);

			// Check if session JSONL exists
			const sessionFile = path.join(projectDir, `${sessionId}.jsonl`);
			if (fs.existsSync(sessionFile)) {
				// Write usage file
				const usageFile = path.join(projectDir, `${sessionId}.usage.json`);

				// Calculate total cost across all models
				let totalCost = 0;
				for (const model of Object.values(modelUsage)) {
					totalCost += (model as any).cost || 0;
				}

				const usageData = {
					requests: totalRequests,
					totalCost: totalCost,
					models: modelUsage,
				};
				fs.writeFileSync(usageFile, JSON.stringify(usageData, null, 2));
			}
		} catch (error) {
			// Silently ignore errors
		}
	}
}

export function initializeInterceptor(verbose: boolean = false) {
	verboseLogging = verbose;
	if (verbose) {
		console.log(`${colors.cyan}cccost: Token usage tracking enabled${colors.reset}`);
	}

	// Intercept fetch
	const originalFetch = global.fetch;

	global.fetch = async (input: string | URL | Request, init?: RequestInit): Promise<Response> => {
		const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : (input as Request).url;

		// Check if it's an Anthropic API call
		const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com";
		const isAnthropicAPI = url.includes(new URL(anthropicBaseUrl).hostname) && url.includes("/v1/messages");

		if (!isAnthropicAPI) {
			return originalFetch(input, init);
		}

		let sessionId = "";
		try {
			const body = JSON.parse((init?.body as string) || "{}");
			sessionId = body.metadata?.user_id?.split("session_")[1];
		} catch (error) {
			console.error(`${colors.red}Error reading request body: ${error}${colors.reset}`);
			return originalFetch(input, init);
		}

		// Make the request
		const response = await originalFetch(input, init);

		// Clone response to read it without consuming
		const clonedResponse = response.clone();

		// Process the clone asynchronously without blocking the response
		(async () => {
			try {
				// Try to parse response body
				const contentType = response.headers.get("content-type") || "";

				if (contentType.includes("application/json")) {
					const body: any = await clonedResponse.json();

					// Extract token usage if present
					if (body?.usage) {
						const model = body.model || "unknown";
						logUsage(sessionId, model, body.usage);
					}
				} else if (contentType.includes("text/event-stream")) {
					// For streaming responses, process incrementally
					const reader = clonedResponse.body?.getReader();
					if (!reader) return;

					const decoder = new TextDecoder();
					let buffer = "";
					let model = "unknown";
					let usage: TokenUsage = {
						input_tokens: 0,
						output_tokens: 0,
						cache_creation_input_tokens: 0,
						cache_read_input_tokens: 0,
					};

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split("\n");

						// Keep the last incomplete line in the buffer
						buffer = lines.pop() || "";

						for (const line of lines) {
							if (line.startsWith("data: ")) {
								const data = line.slice(6);
								try {
									const event = JSON.parse(data);
									if (event.message?.model) model = event.message.model;
									if (event?.usage) usage = event.usage;
								} catch {
									// Ignore parse errors
								}
							}
						}
					}

					// Process any remaining buffer
					if (buffer && buffer.startsWith("data: ")) {
						const data = buffer.slice(6);
						try {
							const event = JSON.parse(data);
							if (event.message?.model) model = event.message.model;
							if (event?.usage) usage = event.usage;
						} catch {
							// Ignore parse errors
						}
					}

					logUsage(sessionId, model, usage);
				}
			} catch {
				// Ignore any errors in parsing
			}
		})();

		// Return response immediately without waiting for processing
		return response;
	};

	// Set up cleanup handler
	const cleanup = () => {
		const duration = Math.floor((Date.now() - startTime) / 1000);
		const minutes = Math.floor(duration / 60);
		const seconds = duration % 60;

		console.log(`\n${colors.cyan}Session Summary${colors.reset}`);
		console.log(`${colors.gray}${"─".repeat(40)}${colors.reset}`);
		console.log(`${colors.gray}Duration: ${minutes}m ${seconds}s${colors.reset}`);

		// Calculate total cost
		let totalCost = 0;
		for (const model of Object.values(modelUsage)) {
			totalCost += (model as any).cost || 0;
		}
		if (totalCost > 0) {
			console.log(`${colors.magenta}Total Cost: $${totalCost.toFixed(4)}${colors.reset}`);
		}

		// Show usage file path
		if (currentSessionId) {
			const cwd = process.cwd().replace(/\//g, "-");
			const usageFile = path.join(os.homedir(), ".claude", "projects", cwd, `${currentSessionId}.usage.json`);
			console.log(`${colors.gray}Usage file: ${usageFile}${colors.reset}`);
		}
		console.log();

		// Show per-model breakdown
		for (const [modelName, usage] of Object.entries(modelUsage)) {
			console.log(`${colors.white}${modelName}:${colors.reset}`);
			console.log(`  Requests: ${usage.requests}`);
			console.log(`  ${colors.blue}Input:${colors.reset} ${usage.input_tokens.toLocaleString()}`);
			console.log(`  ${colors.green}Output:${colors.reset} ${usage.output_tokens.toLocaleString()}`);
			if (usage.cache_creation_input_tokens > 0) {
				console.log(
					`  ${colors.yellow}Cache Creation:${colors.reset} ${usage.cache_creation_input_tokens.toLocaleString()}`,
				);
			}
			if (usage.cache_read_input_tokens > 0) {
				console.log(
					`  ${colors.yellow}Cache Read:${colors.reset} ${usage.cache_read_input_tokens.toLocaleString()}`,
				);
			}
			if (usage.cost > 0) {
				console.log(`  ${colors.magenta}Cost:${colors.reset} $${usage.cost.toFixed(4)}`);
			}
			console.log();
		}
	};

	process.on("exit", cleanup);
	process.on("SIGINT", cleanup);
	process.on("SIGTERM", cleanup);
}
