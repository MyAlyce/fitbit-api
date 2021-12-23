import type { BuildOptions, BuildResult } from 'esbuild';
import { networkInterfaces } from 'os';
import postCssPlugin from "esbuild-plugin-postcss2";
import { build as esbuild } from 'esbuild';
import { debounceTimeOut, Dict, isType } from '@giveback007/util-lib';
import { copy, lstat, mkdir, remove } from 'fs-extra';
import path, { join } from 'path';
import chokidar from 'chokidar';
import chalk from 'chalk';
import { ChildProcessWithoutNullStreams, spawn } from 'child_process';

const { log } = console;

type CopyFromTo = { from: string; to: string; }
export type CopyAction = 'add'|'addDir'|'change'|'unlink'|'unlinkDir'|'copy';
export type NodeTranspiler = (files: string[], toDir: string, opts?: {changeBuildOpts?: BuildOptions}) => Promise<BuildResult>;
export type BrowserTranspiler = (entryFile: string, toDir: string, opts?: {changeBuildOpts?: BuildOptions, envVars?: Dict<string>}) => Promise<BuildResult>;

export type BuilderOpt = {
    projectRoot: string;
    fromDir: string;
    toDir: string;
    buildFct: () => Promise<BuildResult | void>;
    copyFiles?: string[];
}

export class BuilderUtil {
    private readonly projectRoot: string;
    private readonly fromDir: string;
    private readonly toDir: string;
    private readonly buildFct: () => Promise<BuildResult | void>;

    private readonly copyFiles: CopyFromTo[] = [];

    constructor(opts: BuilderOpt) {
        this.projectRoot = path.resolve(opts.projectRoot);
        this.fromDir = path.resolve(opts.fromDir);
        this.toDir = path.resolve(opts.toDir);
        this.buildFct = opts.buildFct;

        const fls = isType(opts.copyFiles, 'string') ? [opts.copyFiles] : opts.copyFiles || [];

        fls.forEach((fl) =>
            this.copyFiles.push({ from: join(this.fromDir, fl), to: join(this.toDir, fl) }));
    }

    private resolver: (val: 'bounce' | 'built') => void = (_) => void(0);
    private buildTimeoutId: NodeJS.Timeout | undefined;
    buildDebounce(logTime = true) {
        clearTimeout(this.buildTimeoutId);
        this.resolver('bounce');

        this.buildTimeoutId = setTimeout(async () => {
            const res = this.resolver;
            await this.build({ logTime });

            res('built');
        }, 500);

        return new Promise<'bounce' | 'built'>((res) => this.resolver = res);
    }

    async build(opts: { logTime?: boolean } = {}) {
        const { logTime = true } = opts;

        const logger = logTime && buildLogStart({ from: this.fromDir, to: this.toDir, root: this.projectRoot });
        await this.buildFct();
        
        if (logger) logger.end();
    }

    /** cleans "toDir" */
    cleanToDir = async () => {
        await remove(this.toDir);
        await mkdir(this.toDir, { recursive: true });
    };

    copy = async () => BuilderUtil.copyFileHandler(this.copyFiles);

    info = () => ({
        projectRoot: this.projectRoot,
        fromDir: this.fromDir,
        toDir: this.toDir,
        copyFiles: this.copyFiles,
    });

    watchCopyFiles = (afterCopy?: () => unknown) => {
        const files = this.copyFiles.map(({ from }) => from);
        const f = async () => {
            await this.copy();
            if (afterCopy) afterCopy();
        };

        // TODO: make this more performant by only copying changed files
        const watcher = chokidar.watch(files);
        
        const debounce = debounceTimeOut();
        watcher.once('ready', async () =>
            f().then(() => watcher.on('all', () => debounce(f, 500))));

        [`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`]
        .forEach((eventType) => process.on(eventType, () => {
            watcher.close();
            process.exit();
        }));
    };

    fileCopyAction = <O extends { file: string; action: CopyAction; }>(actions: O | O[]) => {
        const arr = (isType(actions, 'array') ? actions : [actions]).map(({ file, action }) => ({
            from: file, action, to: file.replace(this.fromDir, this.toDir)
        }));

        return BuilderUtil.copyFileHandler(arr);
    };

    static async copyFileHandler<O extends (CopyFromTo & { action?: CopyAction; })>(handle: O | O[]) {
        const arr = isType(handle, 'array') ? handle : [handle];
        if (!arr.length) return;

        const promises = arr.map(async (fl) => {
            const { from, to, action = 'copy' } = fl;
            try {
                switch (action) {
                    case 'addDir':
                        await mkdir(to, { recursive: true });
                        break;
                    case 'change':
                    case 'add':
                        await copy(from, to);
                        break;
                    case 'unlinkDir':
                    case 'unlink':
                        await remove(to);
                        break;
                    case 'copy':
                        if ((await lstat(from)).isDirectory())
                            await mkdir(fl.to, { recursive: true });

                        await copy(fl.from, fl.to);
                        break;
                    default:
                        throw new Error(`Unhandled: "${action}"`);
                }
                
                return { fail: false, file: fl };
            } catch (e) {
                return { fail: true, file: fl };
            }
        });

        (await Promise.all(promises)).forEach((x) => x.fail &&
            log(chalk.red`FAILED TO [${x.file.action || 'copy'}]:\nFrom: ${x.file.from}\nTo: ${x.file.to}`));
    }
}

export function buildLogStart(opts: {
    from: string;
    to: string;
    root: string;
}) {
    const { from, to, root } = opts;
    const timeStart = Date.now();
    log(`> 🔨 ${chalk.blueBright`Building`}: [${chalk.green(from).replace(root, '')}] ${chalk.yellow`-→`} [${chalk.green(to).replace(root, '')}]`);

    return {
        end: () => {
            const t = Date.now() - timeStart;
            const isMs = t < 500;
            const timeStr = (isMs ? t : (t / 1000).toFixed(2)) + (isMs ? 'ms' : 's');

            log(`> ⚡ ${chalk.blueBright`Built in`}: ${timeStr}`);
        }
    };
}

export const transpileBrowser: BrowserTranspiler = async (entryFile, toDir, opts = {}) => {
    
    const buildOpts: BuildOptions = {
        target: "es2018",
        platform: 'browser',
        entryPoints: [entryFile],
        outdir: toDir,
        define: (() => {
            /** global && window -> globalThis */
            const v: Dict<string> = {"global": "globalThis", "window": "globalThis"};
            Object.entries(opts?.envVars || {}).forEach(([k, v]) => v[k] = `"${v}"`);
            return v;
        })(),
        bundle: true,
        minify: true,
        plugins: [postCssPlugin({ plugins: [ (x: unknown) => x ] }),],
        loader: {
            '.png': 'file',
            '.svg': 'file',
            '.woff': 'file',
            '.woff2': 'file',
            '.ttf': 'file',
            '.eot': 'file',
            '.mp3': 'file',
        }
    };

    return await esbuild({
        ...buildOpts,
        ...opts.changeBuildOpts,
    });
};

export const browserFiles = () => ({
    'package.json': /* json */
`{
    "name": "playground",
    "version": "0.0.1",
    "description": "",
    "main": "index.js",
    "author": "",
    "dependencies": {}
}`,

    'index.html': /* html */
`<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="minimum-scale=1, initial-scale=1, width=device-width">
        <meta http-equiv="X-UA-Compatible" content="ie=edge">
        <link rel="icon" type="image/png" sizes="256x256" href="fav.ico">
        <link rel="stylesheet" href="./index.css">
        <title>Browser Playground</title>
    </head>
    <body>
        <div id='root'></div>
        <script src='index.js'></script>

        <script>
            setTimeout(() => {
                const src = '/browser-sync/browser-sync-client.js';

                const hasBS = Array.from(document.querySelectorAll('script'))
                .find((x) => x.src.search(src) > -1)

                if (!hasBS) {
                const browserSyncScript = document.createElement('script');
                browserSyncScript.src = src;
                document.body.appendChild(browserSyncScript);
                }
            }, 1000)
        </script>
    </body>
</html>`,

    'index.tsx': /* tsx */
`import { FitbitApi } from '../../src/fitbit.api';

import './index.scss';
const { log } = console;

const fb = {
    "token": "",
    "id": "",
};

const api = new FitbitApi(fb.token, fb.id);
api.user.getProfile().then(x => log(x));`,

    'index.scss': /* scss */ '',
});

export const nodejsFiles = () => ({
    'server.ts': /* ts */
`import { FitbitApi } from '../../src/fitbit.api';
const { log } = console;

const fb = {
    "token": "",
    "id": "",
};

const api = new FitbitApi(fb.token, fb.id);
api.user.getProfile().then(x => log(x));`
});

export function network() {
    let ip: string | undefined;
    const ifaces = networkInterfaces();
    const wifiKey = Object.keys(ifaces).find((k) => k.search('Wi-Fi') > -1);
    if (wifiKey) {
        const x = ifaces[wifiKey] || [];
        const y = x.find((x) => x.family === 'IPv4');
        ip = y?.address;
    }

    return ip;
}

export class ProcessManager {
    private app: ChildProcessWithoutNullStreams;
    constructor(
        private readonly command: string,
        private readonly args?: string[],
    ) {
        log(command);
        // TODO source maps
        this.app = this.spawnChild();
        this.init();
    }

    reload = async () => {
        await this.kill();
        this.app = this.spawnChild();
        this.init();
    };

    kill = () => new Promise<void>(res => {
        const isRunning = isType(this.app.exitCode, 'null');
        
        const finalize = () => {
            this.app.removeAllListeners();
            this.app.unref();
            res(void(0));
        };

        if (isRunning) {
            this.app.once('exit', finalize);
            this.app.kill();
        } else {
            finalize();
        }
    });

    private init = () => {
        this.app.stdout.pipe(process.stdout);
        this.app.stderr.pipe(process.stderr);

        this.app.on('exit', (_: number, signal: NodeJS.Signals) => log(
            `> ${chalk.green('Nodejs')} App exited with signal: ${chalk.blue(signal)}`,
        ));
    };

    private spawnChild = () => spawn(this.command, this.args || []);
}