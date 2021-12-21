import type { BuildOptions, BuildResult } from 'esbuild';
import { build as esbuild } from 'esbuild';
import { Dict, isType } from '@giveback007/util-lib';
import { copy, lstat, mkdir, remove } from 'fs-extra';
import path from 'path';
import chokidar from 'chokidar';
import chalk from 'chalk';

const { log } = console;

export type NodeTranspiler = (files: string[], toDir: string, opts?: {changeBuildOpts?: BuildOptions}) => Promise<BuildResult>;
export type BrowserTranspiler = (entryFile: string, toDir: string, opts?: {changeBuildOpts?: BuildOptions, envVars?: Dict<string>}) => Promise<BuildResult>;

export type BuilderOpt = {
    projectRoot: string;
    fromDir: string;
    toDir: string;
    buildFct: () => Promise<BuildResult>;
    copyFiles?: string[];
}

export class BuilderUtil {
    private readonly projectRoot: string;
    private readonly fromDir: string;
    private readonly toDir: string;
    private readonly buildFct: () => Promise<BuildResult>;

    public readonly copyUtil?: CopyFilesUtil;

    constructor(opts: BuilderOpt) {
        this.projectRoot = path.resolve(opts.projectRoot);
        this.fromDir = path.resolve(opts.toDir);
        this.toDir = path.resolve(opts.toDir);
        this.buildFct = opts.buildFct;

        if (opts.copyFiles?.length) this.copyUtil = new CopyFilesUtil({
            copyFiles: opts.copyFiles,
            projectRoot: this.projectRoot,
            fromDir: this.fromDir,
            toDir: this.toDir,
            simulateRoot: true,
        });
    }

    private resolver: (val: 'bounce' | 'built') => void = (_) => void(_);
    private buildTimeoutId: NodeJS.Timeout | undefined;
    buildDebounce(logTime = true) {
        clearTimeout(this.buildTimeoutId as (number | undefined));
        this.resolver('bounce');

        this.buildTimeoutId = setTimeout(async () => {
            const res = this.resolver;
            await this.build(logTime);

            res('built');
        }, 500);

        return new Promise<'bounce' | 'built'>((res) => this.resolver = res);
    }

    async build(logTime = true) {
        if (logTime) log(`Building to: ${this.toDir.replace(this.projectRoot, '')} ...`);
        const timeStart = Date.now();
        await this.buildFct();
        
        if (logTime) {
            const t = Date.now() - timeStart;
            log(`⚡ Built in ${t > 500 ? (t / 1000).toFixed(2) + 's' : t + 'ms'}`);
        }
    }

    /** cleans "toDir" */
    async cleanToDir() {
        await remove(this.toDir);
        await mkdir(this.toDir, { recursive: true });
    }

    startLogger() {
        const f = (dir: string) => dir.replace(this.projectRoot, '');
        log(`🏗️ Building '${f(this.fromDir)}'... 🔨 to '${f(this.toDir)}'`);
    }

    doneLogger(timeStart: number) {
        log(`✔️ Done in ${((Date.now() - timeStart) / 1000).toFixed(2)}s`);
    }
}

export type CopyFilesUtilOpts = {
    copyFiles: string | string[];
    projectRoot: string;
    fromDir: string; // eg: backend
    toDir: string; // .temp
    simulateRoot: boolean;// true: "./temp/backend", false: "./temp"
}

export class CopyFilesUtil {
    private readonly projectRoot: string;
    private readonly fromDir: string; // eg: backend
    private readonly toDir: string; // .temp
    private readonly copyFiles: {
        from: string;
        to: string;
    }[] = [];

    constructor(opts: CopyFilesUtilOpts) {
        this.projectRoot = path.resolve(opts.projectRoot);
        this.fromDir = path.resolve(opts.fromDir);
        this.toDir = path.resolve(opts.toDir);

        if (opts.simulateRoot) // eg: './.temp/frontend'
            this.toDir = path.join(this.toDir, this.fromDir.replace(this.projectRoot, ''));
        
        const fls = isType(opts.copyFiles, 'string') ? [opts.copyFiles] : opts.copyFiles;
            
        fls.forEach((fl) => this.copyFiles
            .push({ from: path.join(this.fromDir, fl), to: path.join(this.toDir, fl) }));
    }

    private copyIsReady = false;
    private copyTimeoutId: NodeJS.Timeout | undefined;
    async watchCopyFiles(afterCopy?: () => unknown) {
        const files = this.copyFiles.map(({ from }) => from);
        const f = async () => {
            await this.copy();
            if (afterCopy) afterCopy();
        };

        // TODO: make this more performant by only copying changed files
        const watcher = chokidar.watch(files).on('all', () => {
            clearTimeout(this.copyTimeoutId as (number | undefined));
    
            this.copyTimeoutId = setTimeout(async () => {
                if (this.copyIsReady) f();
            }, 500);
        }).on('ready', async () => f().then(() => this.copyIsReady = true));

        [`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`]
        .forEach((eventType) => process.on(eventType, () => {
            watcher.close();
            process.exit();
        }));

        return watcher;
    }

    async copy() {
        const files = this.copyFiles;
        if (!files.length) return;

        const copyPromises = files.map(async (fl) => {
            try {
                if ((await lstat(fl.from)).isDirectory()) {
                    await mkdir(fl.to, { recursive: true });
                }

                await copy(fl.from, fl.to);
                return { fail: false, file: fl };
            } catch (e) {
                return { fail: true, file: fl };
            }
        });
        
        await Promise.all(copyPromises).then((arr) => {
            arr.forEach((result) => {
                if (result.fail) {
                    log(chalk.red`FAILED TO COPY:\nFrom: ${result.file.from}\nTo: ${result.file.to}`);
                    throw new Error("Failed To Copy");
                }
            });
        });
    }
}

export const transpileBrowser: BrowserTranspiler = async (entryFile, toDir, opts = {}) => {
    
    const buildOpts: BuildOptions = {
        target: "es2018",
        platform: 'browser',
        entryPoints: [entryFile],
        outdir: toDir,
        define: (() => {
            // global && window -> globalThis
            const v: Dict<string> = {"global": "globalThis", "window": "globalThis"};
            Object.entries(opts?.envVars || {}).forEach(([k, v]) => v[k] = `"${v}"`);
            return v;
        })(),
        bundle: true,
        minify: true,
        // plugins: [postCssPlugin({ plugins: [ (x: any) => x ] }),],
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