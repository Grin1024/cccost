# cccost - Claude Code Cost Tracker

Track token usage and costs for your Claude Code sessions in real-time.

## Problem
Claude Code does not show cost for users of the Pro and Max plan when using the `/cost` command. API users enjoy that privilege. Except that [`/cost` has a bug (CC 1.0.83)](https://x.com/badlogicgames/status/1957221028603535617). And if you wrote a fancy [statusline](https://docs.anthropic.com/en/docs/claude-code/statusline) script and think you can just parse the session transcript to get token usage and cost, think again. The transcript does not contain all requests Claude Code issues to the Anthropic servers.

## What Claude Code Cost Tracker does
Claude Code cost track is a minimally invasive tool. Instead of running Claude Code directly, run your session via cccost. All arguments you pass will be forwarded to Claude Code verbatim:

```bash
cccost --dangerously-skip-permissions
```

cccost spawns Claude Code and injects [this code](./src/interceptor.ts). It hooks the NodeJS `fetch()` function and intercepts all API requests to Anthropic's servers. It then writes a file ~/.claude/projects/mangled-current-working-dir/sessionid.usage.json and keeps updating it with every new request. As opoosed to Claude Code's `/cost` slash command, this also accurately tracks cost and token usage when resuming sessions.

The file contains total input/output/cache read/cache write statistics per model, the usage stats for the last request made with each model, and the total cost. E.g.:

```json
{
  "requests": 7,
  "totalCost": 0.10331005,
  "models": {
    "claude-3-5-haiku-20241022": {
      "requests": 6,
      "input_tokens": 731,
      "output_tokens": 99,
      "cache_creation_input_tokens": 0,
      "cache_read_input_tokens": 0,
      "cost": 0.0009808,
      "last": {
        "utcTimestamp": 1755475841151,
        "input_tokens": 335,
        "output_tokens": 9,
        "cache_creation_input_tokens": 0,
        "cache_read_input_tokens": 0,
        "cost": 0.000304
      }
    },
    "claude-opus-4-1-20250805": {
      "requests": 1,
      "input_tokens": 3,
      "output_tokens": 12,
      "cache_creation_input_tokens": 4761,
      "cache_read_input_tokens": 8077,
      "cost": 0.10232925,
      "last": {
        "utcTimestamp": 1755475842778,
        "input_tokens": 3,
        "output_tokens": 12,
        "cache_creation_input_tokens": 4761,
        "cache_read_input_tokens": 8077,
        "cost": 0.10232925
      }
    }
  }
}
```

You can use that to write accurate statusline scripts that display e.g. context usage or cost for the current session. Simply read the <sessionid>.usage.json file for the current session to get the statistics.

The GitHub repository includes an example [statusline.js](./statusline.js).

## Installation

```bash
npm install -g @mariozechner/cccost
```

## Usage

Simply start Claude Code via `cccost` instead of `claude`:

```bash
# Track a Claude Code session
cccost --dangerously-skip-permissions --model sonnet
```

## Options
- `--ccc-verbose`: cccost will output debug logging during the session

## Development

```bash
# Clone the repository
git clone https://github.com/badlogic/cccost.git
cd cccost

# Install dependencies
npm install

# Debugging, e.g. via VS Code JavaScript Debug Terminal
# Do this once to disable anti-debug in your Claude Code
# install, otherwise you won't be able to debug cccost
npx @mariozechner/cc-antidebug patch

npx tsx src/cli.ts

# Build
npm run build
```

## License

MIT

## Author

Mario Zechner
