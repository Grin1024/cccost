#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const os = require('os');

// Context limits for models
const contextLimits = {
    'claude-opus-4-1': 200000,
    'claude-sonnet-4': 200000,
};

// Read JSON from stdin
let input = '';
process.stdin.on('data', chunk => input += chunk);
process.stdin.on('end', () => {
    try {
        const data = JSON.parse(input);

        // Extract values
        const processCwd = data.workspace?.project_dir || data.cwd || process.cwd();
        const currentCwd = data.workspace?.current_dir || data.cwd || process.cwd();
        const sessionId = data.session_id;
        const modelId = data.model?.id || 'unknown';

        // Calculate relative path of current dir to process dir
        let relativePath = '';
        if (currentCwd !== processCwd) {
            relativePath = path.relative(processCwd, currentCwd);
            if (relativePath) {
                relativePath = relativePath.startsWith('..') ? relativePath : './' + relativePath;
            }
        }

        // Try to read usage file
        let contextUsage = '';
        let totalCost = '';

        if (sessionId) {
            const cwdForFile = processCwd.replace(/\//g, '-');
            const usageFile = path.join(os.homedir(), '.claude', 'projects', cwdForFile, `${sessionId}.usage.json`);

            try {
                if (fs.existsSync(usageFile)) {
                    const usageData = JSON.parse(fs.readFileSync(usageFile, 'utf-8'));

                    // Get total cost
                    if (usageData.totalCost && usageData.totalCost > 0) {
                        const dim = '\x1b[2m'; // dim
                        const reset = '\x1b[0m';
                        totalCost = ` ${dim}| $${usageData.totalCost.toFixed(4)}${reset}`;
                    }

                    // Find the most recently used model (excluding haiku)
                    let lastModel = null;
                    let lastTimestamp = 0;

                    for (const [model, stats] of Object.entries(usageData.models || {})) {
                        // Skip haiku models
                        if (model.includes('haiku')) continue;

                        if (stats.last && stats.last.utcTimestamp > lastTimestamp) {
                            lastTimestamp = stats.last.utcTimestamp;
                            lastModel = { name: model, stats: stats };
                        }
                    }

                    if (lastModel && lastModel.stats.last) {
                        const last = lastModel.stats.last;
                        const modelKey = Object.keys(contextLimits).find(key => lastModel.name.includes(key.split('-').slice(1, -1).join('-')));
                        const limit = contextLimits[modelKey] || 200000;

                        // Calculate context usage from last request (input + cache read)
                        const contextTokens = last.input_tokens + last.cache_read_input_tokens;
                        const percentage = Math.round((contextTokens / limit) * 100);

                        // Format with color based on usage
                        let color = '\x1b[32m'; // green
                        if (percentage > 80) color = '\x1b[31m'; // red
                        else if (percentage > 60) color = '\x1b[33m'; // yellow

                        const dim = '\x1b[2m'; // dim
                        const reset = '\x1b[0m';
                        const contextK = (contextTokens / 1000).toFixed(2);
                        const limitK = (limit / 1000).toFixed(0);
                        contextUsage = ` ${dim}|${reset} ${color}${percentage}%${reset} ${dim}(${contextK}k/${limitK}k)${reset}`;
                    }
                }
            } catch (e) {
                // Silently ignore errors reading usage file
            }
        }

        // Format the status line
        const processName = path.basename(processCwd);
        const relativeDisplay = relativePath ? ` > ${relativePath}` : '';

        console.log(`${processName}${relativeDisplay}${contextUsage}${totalCost}`);

    } catch (e) {
        // On error, show minimal status
        console.log(process.cwd());
    }
});