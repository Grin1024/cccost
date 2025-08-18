#!/usr/bin/env node

import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

function resolveToJsFile(filePath: string): string {
	try {
		const realPath = fs.realpathSync(filePath);

		if (realPath.endsWith(".js")) {
			return realPath;
		}

		if (fs.existsSync(realPath)) {
			const content = fs.readFileSync(realPath, "utf-8");
			if (
				content.startsWith("#!/usr/bin/env node") ||
				content.match(/^#!.*\/node$/m) ||
				content.includes("require(") ||
				content.includes("import ")
			) {
				return realPath;
			}
		}

		const possibleJsPaths = [
			realPath + ".js",
			realPath.replace(/\/bin\//, "/lib/") + ".js",
			realPath.replace(/\/\.bin\//, "/lib/bin/") + ".js",
		];

		for (const jsPath of possibleJsPaths) {
			if (fs.existsSync(jsPath)) {
				return jsPath;
			}
		}

		return realPath;
	} catch (error) {
		return filePath;
	}
}

function getClaudePath(): string {
	try {
		let claudePath = require("child_process")
			.execSync("which claude", {
				encoding: "utf-8",
			})
			.trim();

		const aliasMatch = claudePath.match(/:\s*aliased to\s+(.+)$/);
		if (aliasMatch && aliasMatch[1]) {
			claudePath = aliasMatch[1];
		}

		if (fs.existsSync(claudePath)) {
			const content = fs.readFileSync(claudePath, "utf-8");
			if (content.startsWith("#!/bin/bash")) {
				const execMatch = content.match(/exec\s+"([^"]+)"/);
				if (execMatch && execMatch[1]) {
					const actualPath = execMatch[1];
					return resolveToJsFile(actualPath);
				}
			}
		}

		return resolveToJsFile(claudePath);
	} catch (error) {
		const os = require("os");
		const localClaudeWrapper = path.join(os.homedir(), ".claude", "local", "claude");

		if (fs.existsSync(localClaudeWrapper)) {
			const content = fs.readFileSync(localClaudeWrapper, "utf-8");
			if (content.startsWith("#!/bin/bash")) {
				const execMatch = content.match(/exec\s+"([^"]+)"/);
				if (execMatch && execMatch[1]) {
					return resolveToJsFile(execMatch[1]);
				}
			}
		}

		const localClaudePath = path.join(os.homedir(), ".claude", "local", "node_modules", ".bin", "claude");
		if (fs.existsSync(localClaudePath)) {
			return resolveToJsFile(localClaudePath);
		}

		console.error("Claude Code not found. Please install it first.");
		process.exit(1);
	}
}

async function main() {
	const claudePath = getClaudePath();
	const loaderPath = path.join(__dirname, "interceptor-loader.js");

	// Check for --ccc-verbose flag
	const args = process.argv.slice(2);
	const verbose = args.includes("--ccc-verbose");
	const claudeArgs = args.filter((arg) => arg !== "--ccc-verbose");

	if (verbose) {
		console.log("cccost: Starting Claude with token tracking...\n");
	}

	const child = spawn("node", ["--require", loaderPath, claudePath, ...claudeArgs], {
		stdio: "inherit",
		env: {
			...process.env,
			CCCOST_VERBOSE: verbose ? "true" : "false",
		},
	});

	child.on("exit", (code) => {
		process.exit(code || 0);
	});
}

main().catch((err) => {
	console.error("Error:", err.message);
	process.exit(1);
});
