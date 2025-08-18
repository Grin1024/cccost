// CommonJS loader for interceptor
try {
	const path = require("path");
	const fs = require("fs");

	const jsPath = path.join(__dirname, "interceptor.js");
	const tsPath = path.join(__dirname, "interceptor.ts");

	const verbose = process.env.CCCOST_VERBOSE === "true";

	if (fs.existsSync(jsPath)) {
		// Use compiled JavaScript
		const { initializeInterceptor } = require("./interceptor.js");
		initializeInterceptor(verbose);
	} else if (fs.existsSync(tsPath)) {
		// Use TypeScript via tsx
		require("tsx/cjs/api").register();
		const { initializeInterceptor } = require("./interceptor.ts");
		initializeInterceptor(verbose);
	} else {
		console.error("Could not find interceptor file");
		process.exit(1);
	}
} catch (error) {
	console.error("Error loading cccost interceptor:", error.message);
	process.exit(1);
}
