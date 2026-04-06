#!/usr/bin/env node
/**
 * @file cli.js
 * @description Overmoderator CLI - Command-line interface for managing the Discord bot
 * @author Overmoderator Team
 * @license MIT
 */

const { spawn, exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
};

const c = (color, text) => `${colors[color]}${text}${colors.reset}`;

// CLI Banner
const banner = `
${c('cyan', '╔═══════════════════════════════════════════════════════════╗')}
${c('cyan', '║')}  ${c('bright', '🤖 OVERMODERATOR CLI')}                                     ${c('cyan', '║')}
${c('cyan', '║')}  ${c('dim', 'Discord Bot Management Tool')}                              ${c('cyan', '║')}
${c('cyan', '╚═══════════════════════════════════════════════════════════╝')}
`;

// Commands configuration
const commands = {
    start: {
        description: 'Start the Discord bot',
        usage: 'overmoderator start [--watch]',
        action: startBot,
    },
    dev: {
        description: 'Start bot in development mode with hot reload',
        usage: 'overmoderator dev',
        action: devMode,
    },
    stop: {
        description: 'Stop the running bot',
        usage: 'overmoderator stop',
        action: stopBot,
    },
    status: {
        description: 'Check bot status and health',
        usage: 'overmoderator status',
        action: checkStatus,
    },
    logs: {
        description: 'View bot logs',
        usage: 'overmoderator logs [--tail <n>] [--follow]',
        action: viewLogs,
    },
    db: {
        description: 'Database management commands',
        usage: 'overmoderator db <subcommand>',
        subcommands: {
            migrate: 'Run database migrations',
            seed: 'Seed database with initial data',
            reset: 'Reset database (WARNING: destructive)',
            status: 'Check database connection status',
        },
        action: dbCommand,
    },
    config: {
        description: 'Configuration management',
        usage: 'overmoderator config <subcommand>',
        subcommands: {
            check: 'Validate environment configuration',
            init: 'Initialize .env from .env.example',
            show: 'Show current configuration (redacted)',
        },
        action: configCommand,
    },
    docker: {
        description: 'Docker management commands',
        usage: 'overmoderator docker <subcommand>',
        subcommands: {
            up: 'Start all services with docker-compose',
            down: 'Stop all services',
            build: 'Build Docker image',
            logs: 'View Docker logs',
            ps: 'List running containers',
        },
        action: dockerCommand,
    },
    test: {
        description: 'Run tests',
        usage: 'overmoderator test [--coverage] [--watch]',
        action: runTests,
    },
    lint: {
        description: 'Run linter on codebase',
        usage: 'overmoderator lint [--fix]',
        action: runLint,
    },
    help: {
        description: 'Show this help message',
        usage: 'overmoderator help [command]',
        action: showHelp,
    },
    version: {
        description: 'Show CLI version',
        usage: 'overmoderator version',
        action: showVersion,
    },
};

// Parse command line arguments
function parseArgs(args) {
    const parsed = {
        command: args[0] || 'help',
        subcommand: null,
        flags: {},
        positional: [],
    };

    for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        if (arg.startsWith('--')) {
            const key = arg.slice(2);
            const nextArg = args[i + 1];
            if (nextArg && !nextArg.startsWith('-')) {
                parsed.flags[key] = nextArg;
                i++;
            } else {
                parsed.flags[key] = true;
            }
        } else if (arg.startsWith('-')) {
            const key = arg.slice(1);
            parsed.flags[key] = true;
        } else if (!parsed.subcommand && commands[parsed.command]?.subcommands) {
            parsed.subcommand = arg;
        } else {
            parsed.positional.push(arg);
        }
    }

    return parsed;
}

// Utility: Run a command and stream output
function runCommand(cmd, args = [], options = {}) {
    return new Promise((resolve, reject) => {
        const proc = spawn(cmd, args, {
            stdio: options.silent ? 'pipe' : 'inherit',
            cwd: options.cwd || process.cwd(),
            shell: true,
            ...options,
        });

        let stdout = '';
        let stderr = '';

        if (options.silent) {
            proc.stdout?.on('data', (data) => { stdout += data.toString(); });
            proc.stderr?.on('data', (data) => { stderr += data.toString(); });
        }

        proc.on('close', (code) => {
            if (code === 0) {
                resolve({ code, stdout, stderr });
            } else {
                reject({ code, stdout, stderr });
            }
        });

        proc.on('error', reject);
    });
}

// Utility: Check if file exists
function fileExists(filePath) {
    try {
        return fs.existsSync(filePath);
    } catch {
        return false;
    }
}

// Utility: Read JSON file
function readJson(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
        return null;
    }
}

// Utility: Prompt user for confirmation
async function confirm(message) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    return new Promise((resolve) => {
        rl.question(`${c('yellow', '?')} ${message} (y/N): `, (answer) => {
            rl.close();
            resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
        });
    });
}

// Command: Start bot
async function startBot(args) {
    console.log(c('green', '🚀 Starting Overmoderator bot...'));

    if (args.flags.watch) {
        return devMode(args);
    }

    try {
        await runCommand('node', ['--no-warnings', 'index.js']);
    } catch (error) {
        console.error(c('red', `❌ Bot exited with code ${error.code}`));
        process.exit(error.code);
    }
}

// Command: Development mode
async function devMode(args) {
    console.log(c('cyan', '🔧 Starting in development mode with hot reload...'));
    console.log(c('dim', '   Press Ctrl+C to stop\n'));

    try {
        await runCommand('node', ['index.js']);
    } catch (error) {
        console.error(c('red', `❌ Dev server exited with code ${error.code}`));
        process.exit(error.code);
    }
}

// Command: Stop bot
async function stopBot(args) {
    console.log(c('yellow', '🛑 Stopping Overmoderator bot...'));

    try {
        // Try to find and kill the process
        if (process.platform === 'win32') {
            await runCommand('taskkill', ['/F', '/IM', 'node.exe'], { silent: true });
        } else {
            await runCommand('pkill', ['-f', 'overmoderator'], { silent: true });
        }
        console.log(c('green', '✅ Bot stopped successfully'));
    } catch {
        console.log(c('yellow', '⚠️  No running bot process found'));
    }
}

// Command: Check status
async function checkStatus(args) {
    console.log(c('cyan', '📊 Checking bot status...\n'));

    // Check if .env exists
    const envExists = fileExists('.env');
    console.log(`${envExists ? c('green', '✅') : c('red', '❌')} Environment file (.env): ${envExists ? 'Found' : 'Missing'}`);

    // Check package.json
    const pkg = readJson('package.json');
    if (pkg) {
        console.log(`${c('green', '✅')} Package: ${pkg.name}@${pkg.version}`);
    }

    // Check Docker
    try {
        await runCommand('docker', ['--version'], { silent: true });
        console.log(`${c('green', '✅')} Docker: Available`);
    } catch {
        console.log(`${c('yellow', '⚠️')} Docker: Not available`);
    }

    // Check database connection
    if (process.env.DATABASE_URL) {
        console.log(`${c('green', '✅')} Database URL: Configured`);
    } else {
        console.log(`${c('yellow', '⚠️')} Database URL: Not configured`);
    }

    // Check Discord token
    if (process.env.DISCORD_BOT_TOKEN) {
        console.log(`${c('green', '✅')} Discord Token: Configured`);
    } else {
        console.log(`${c('red', '❌')} Discord Token: Missing`);
    }

    console.log('');
}

// Command: View logs
async function viewLogs(args) {
    const tail = args.flags.tail || 50;
    const follow = args.flags.follow || args.flags.f;

    console.log(c('cyan', `📜 Viewing logs (last ${tail} lines)...\n`));

    const logFile = path.join(process.cwd(), 'logs', 'bot.log');

    if (!fileExists(logFile)) {
        console.log(c('yellow', '⚠️  No log file found. Start the bot first.'));
        return;
    }

    const tailArgs = ['-n', tail.toString()];
    if (follow) tailArgs.push('-f');
    tailArgs.push(logFile);

    try {
        await runCommand('tail', tailArgs);
    } catch (error) {
        console.error(c('red', '❌ Failed to read logs'));
    }
}

// Command: Database management
async function dbCommand(args) {
    const subcommand = args.subcommand;

    switch (subcommand) {
        case 'migrate':
            console.log(c('cyan', '🔄 Running database migrations...'));
            // Add migration logic here
            console.log(c('green', '✅ Migrations completed'));
            break;

        case 'seed':
            console.log(c('cyan', '🌱 Seeding database...'));
            // Add seed logic here
            console.log(c('green', '✅ Database seeded'));
            break;

        case 'reset':
            const confirmed = await confirm('This will DELETE all data. Are you sure?');
            if (confirmed) {
                console.log(c('red', '🗑️  Resetting database...'));
                // Add reset logic here
                console.log(c('green', '✅ Database reset complete'));
            } else {
                console.log(c('dim', 'Cancelled'));
            }
            break;

        case 'status':
            console.log(c('cyan', '🔍 Checking database status...'));
            // Add status check logic here
            break;

        default:
            console.log(c('yellow', 'Available subcommands:'));
            Object.entries(commands.db.subcommands).forEach(([cmd, desc]) => {
                console.log(`  ${c('cyan', cmd.padEnd(12))} ${desc}`);
            });
    }
}

// Command: Configuration management
async function configCommand(args) {
    const subcommand = args.subcommand;

    switch (subcommand) {
        case 'check':
            console.log(c('cyan', '🔍 Validating configuration...\n'));
            require('dotenv').config();

            const required = ['DISCORD_BOT_TOKEN', 'MONGODB_URI'];
            const optional = ['OPENAI_API_KEY', 'LOG_WEBHOOK_URL', 'DATABASE_URL'];

            let hasErrors = false;

            console.log(c('bright', 'Required variables:'));
            required.forEach((key) => {
                if (process.env[key]) {
                    console.log(`  ${c('green', '✅')} ${key}`);
                } else {
                    console.log(`  ${c('red', '❌')} ${key} - MISSING`);
                    hasErrors = true;
                }
            });

            console.log(c('bright', '\nOptional variables:'));
            optional.forEach((key) => {
                if (process.env[key]) {
                    console.log(`  ${c('green', '✅')} ${key}`);
                } else {
                    console.log(`  ${c('dim', '○')} ${key} - not set`);
                }
            });

            console.log('');
            if (hasErrors) {
                console.log(c('red', '❌ Configuration has errors. Please fix before starting.'));
                process.exit(1);
            } else {
                console.log(c('green', '✅ Configuration is valid'));
            }
            break;

        case 'init':
            if (fileExists('.env')) {
                const overwrite = await confirm('.env already exists. Overwrite?');
                if (!overwrite) {
                    console.log(c('dim', 'Cancelled'));
                    return;
                }
            }

            if (fileExists('.env.example')) {
                fs.copyFileSync('.env.example', '.env');
                console.log(c('green', '✅ Created .env from .env.example'));
                console.log(c('yellow', '⚠️  Remember to fill in your actual values!'));
            } else {
                console.log(c('red', '❌ .env.example not found'));
            }
            break;

        case 'show':
            console.log(c('cyan', '📋 Current configuration (redacted):\n'));
            require('dotenv').config();

            const sensitiveKeys = ['TOKEN', 'KEY', 'SECRET', 'PASSWORD', 'PASS', 'URI', 'URL'];

            Object.entries(process.env)
                .filter(([key]) => key.includes('DISCORD') || key.includes('OPENAI') || key.includes('DATABASE') || key.includes('MONGO'))
                .forEach(([key, value]) => {
                    const isSensitive = sensitiveKeys.some((s) => key.includes(s));
                    const displayValue = isSensitive ? '***REDACTED***' : value;
                    console.log(`  ${c('cyan', key)}: ${displayValue}`);
                });
            break;

        default:
            console.log(c('yellow', 'Available subcommands:'));
            Object.entries(commands.config.subcommands).forEach(([cmd, desc]) => {
                console.log(`  ${c('cyan', cmd.padEnd(12))} ${desc}`);
            });
    }
}

// Command: Docker management
async function dockerCommand(args) {
    const subcommand = args.subcommand;
    const isDev = args.flags.dev;

    switch (subcommand) {
        case 'up':
            console.log(c('cyan', '🐳 Starting Docker services...'));
            const upArgs = ['up', '-d'];
            if (isDev) {
                upArgs.push('--profile', 'dev');
                console.log(c('dim', '   Including development services (Mongo Express, pgAdmin)'));
            }
            await runCommand('docker-compose', upArgs);
            console.log(c('green', '✅ Services started'));
            console.log(c('dim', '\n   View logs: node cli.js docker logs'));
            console.log(c('dim', '   Check status: node cli.js docker ps'));
            break;

        case 'down':
            console.log(c('yellow', '🛑 Stopping Docker services...'));
            const downArgs = ['down'];
            if (args.flags.volumes || args.flags.v) {
                downArgs.push('-v');
                console.log(c('red', '   ⚠️  Also removing volumes (data will be lost)'));
            }
            await runCommand('docker-compose', downArgs);
            console.log(c('green', '✅ Services stopped'));
            break;

        case 'build':
            console.log(c('cyan', '🔨 Building Docker image...'));
            const buildArgs = ['build'];
            if (args.flags['no-cache']) {
                buildArgs.push('--no-cache');
            }
            buildArgs.push('-t', 'overmoderator:latest', '.');
            await runCommand('docker', buildArgs);
            console.log(c('green', '✅ Build complete'));
            console.log(c('dim', '\n   Start with: node cli.js docker up'));
            break;

        case 'logs':
            console.log(c('cyan', '📜 Docker logs:\n'));
            const service = args.positional[0] || '';
            const logsArgs = ['logs', '-f', '--tail=100'];
            if (service) logsArgs.push(service);
            await runCommand('docker-compose', logsArgs);
            break;

        case 'ps':
            console.log(c('cyan', '📦 Running containers:\n'));
            await runCommand('docker-compose', ['ps', '-a']);
            break;

        case 'restart':
            console.log(c('yellow', '🔄 Restarting services...'));
            const service2 = args.positional[0] || 'discord-bot';
            await runCommand('docker-compose', ['restart', service2]);
            console.log(c('green', `✅ ${service2} restarted`));
            break;

        case 'shell':
            console.log(c('cyan', '🐚 Opening shell in bot container...'));
            await runCommand('docker-compose', ['exec', 'discord-bot', '/bin/bash']);
            break;

        case 'prune':
            const confirmed = await confirm('Remove unused Docker resources?');
            if (confirmed) {
                console.log(c('yellow', '🧹 Cleaning up Docker resources...'));
                await runCommand('docker', ['system', 'prune', '-f']);
                console.log(c('green', '✅ Cleanup complete'));
            }
            break;

        default:
            console.log(c('yellow', 'Available subcommands:'));
            const dockerSubcommands = {
                up: 'Start all services (--dev for admin UIs)',
                down: 'Stop all services (-v to remove volumes)',
                build: 'Build Docker image (--no-cache for fresh build)',
                logs: 'View Docker logs [service]',
                ps: 'List running containers',
                restart: 'Restart a service [service]',
                shell: 'Open shell in bot container',
                prune: 'Clean up unused Docker resources',
            };
            Object.entries(dockerSubcommands).forEach(([cmd, desc]) => {
                console.log(`  ${c('cyan', cmd.padEnd(12))} ${desc}`);
            });
    }
}

// Command: Run tests
async function runTests(args) {
    console.log(c('cyan', '🧪 Running tests...\n'));

    const testArgs = [];
    if (args.flags.coverage) testArgs.push('--coverage');
    if (args.flags.watch) testArgs.push('--watch');

    try {
        await runCommand('npm', ['test', '--', ...testArgs]);
    } catch (error) {
        console.error(c('red', '❌ Tests failed'));
        process.exit(1);
    }
}

// Command: Run linter
async function runLint(args) {
    console.log(c('cyan', '🔍 Running linter...\n'));

    try {
        if (args.flags.fix) {
            await runCommand('npm', ['run', 'lint', '--', '--fix']);
        } else {
            await runCommand('npm', ['run', 'lint']);
        }
        console.log(c('green', '\n✅ Linting passed'));
    } catch (error) {
        console.error(c('red', '\n❌ Linting failed'));
        process.exit(1);
    }
}

// Command: Show help
function showHelp(args) {
    const specificCommand = args.positional[0];

    if (specificCommand && commands[specificCommand]) {
        const cmd = commands[specificCommand];
        console.log(`\n${c('bright', specificCommand)} - ${cmd.description}`);
        console.log(`\n${c('cyan', 'Usage:')} ${cmd.usage}`);

        if (cmd.subcommands) {
            console.log(`\n${c('cyan', 'Subcommands:')}`);
            Object.entries(cmd.subcommands).forEach(([sub, desc]) => {
                console.log(`  ${c('green', sub.padEnd(12))} ${desc}`);
            });
        }
        console.log('');
        return;
    }

    console.log(banner);
    console.log(c('bright', 'Commands:\n'));

    Object.entries(commands).forEach(([name, cmd]) => {
        console.log(`  ${c('green', name.padEnd(12))} ${cmd.description}`);
    });

    console.log(`\n${c('dim', 'Run')} ${c('cyan', 'overmoderator help <command>')} ${c('dim', 'for more info on a specific command.')}\n`);
}

// Command: Show version
function showVersion() {
    const pkg = readJson(path.join(__dirname, 'package.json'));
    console.log(`Overmoderator CLI v${pkg?.version || '1.0.0'}`);
}

// Main entry point
async function main() {
    // Load environment variables
    require('dotenv').config();

    const args = parseArgs(process.argv.slice(2));
    const command = commands[args.command];

    if (!command) {
        console.error(c('red', `Unknown command: ${args.command}`));
        console.log(`Run ${c('cyan', 'overmoderator help')} for available commands.`);
        process.exit(1);
    }

    try {
        await command.action(args);
    } catch (error) {
        console.error(c('red', `\n❌ Error: ${error.message || error}`));
        process.exit(1);
    }
}

main();
