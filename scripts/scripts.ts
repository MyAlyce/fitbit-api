import browserSync from "browser-sync";
import chokidar from 'chokidar';
import historyApiFallback = require('connect-history-api-fallback');
import { copy, writeFile, existsSync, ensureDirSync } from 'fs-extra';
import path, { join, resolve } from 'path';
import { debounceTimeOut, isType, wait } from '@giveback007/util-lib';
import { browserFiles, BuilderUtil, buildLogStart, CopyAction, network, nodejsFiles, ProcessManager, transpileBrowser } from './build.util';
import chalk from 'chalk';

const { log } = console;

export async function browserPlayground(opts: {
    fromDir?: string;
    entryFile?: string;
    toDir?: string;
    watchOtherDirs?: string[];
    cssExts?: string[];
    jsExts?: string[];
    projectRoot?: string;
    copyFiles?: string[];
    port?: number;
    debounceMs?: number;
} = { }) {
    log('STARTING BUILDER...');

    const port = opts.port || 3333;
    const fromDir = resolve(opts.fromDir || 'playground/browser');
    const entryFile = join(fromDir, 'index.tsx');
    const toDir = resolve(opts.toDir || '.temp/browser');
    const watchOtherDirs = (opts.watchOtherDirs || ['src']).map((dir) => path.resolve(dir));
    const jsExts = ['tsx', 'ts', 'js', 'jsx'];
    const cssExts = ['sass', 'scss', 'css'];
    const projectRoot = path.resolve(opts.projectRoot || './');
    const copyFiles = (opts.copyFiles || ['fav.ico', 'index.html']);
    const debounceMs = isType(opts.debounceMs, 'number') ? opts.debounceMs : 200;

    // Prepare the playground folders with files //
    [fromDir, toDir].forEach(async dir => ensureDirSync(dir));
    await copy(join('assets/fav.ico'), join(fromDir, 'fav.ico'));

    Object.entries(browserFiles()).forEach(([fileName, txt]) => {
        if (!existsSync(join(fromDir, fileName)))
            writeFile(join(fromDir, fileName), txt);
    });

    // clearing and canceling on exit //
    [`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`]
    .forEach((eventType) => process.on(eventType, () => {
        bs.pause();
        bs.cleanup();
        bs.exit();
        process.exit();
    }));

    // initialized builder //
    const builder = new BuilderUtil({
        fromDir, toDir, projectRoot, copyFiles,
        buildFct: () => transpileBrowser(entryFile, toDir, { changeBuildOpts: { incremental: true } })
    });

    // Create browserSync //
    const bs = browserSync.create('Browser-Playground');

    // Setup watchers //
    const allWatchDirs = [fromDir, ...watchOtherDirs.map(dir => resolve(dir))];
    const jsWatch: string[] = [];
    const cssWatch: string[] = [];

    allWatchDirs.forEach((dir) => {
        jsExts.forEach(ext =>
            jsWatch.push(path.join(dir, '**', '*.' + ext)));

        cssExts.forEach(ext =>
            cssWatch.push(path.join(dir, '**', '*.' + ext)));
    });

    let cssChanged = false;
    let jsChanged = false;
    const debounce = debounceTimeOut();
    
    const watchHandler = (type: 'css' | 'js') => {
        type === 'js' ? (jsChanged = true) : (cssChanged = true);

        debounce(async () => {
            await builder.build();

            if (jsChanged) {
                cssChanged = jsChanged = false;
                bs.reload("*.html");
            } else if (cssChanged) {
                cssChanged = false;
                bs.reload("*.css");
            } else {
                log(chalk`Failed to Reload...`);
            }
        }, debounceMs);
    };

    bs.watch(
        jsWatch as never as string,
        { ignoreInitial: true },
        () => watchHandler('js')
    );
    
    bs.watch(
        cssWatch as never as string,
        { ignoreInitial: true },
        () => watchHandler('css')
    );

    if (builder.info().copyFiles.length)
        builder.watchCopyFiles(() => bs.reload("*.html"));
        
    // Start //
    try {
        await builder.build();
    } catch {
        log(chalk.red`FAILED FIRST BUILD`);
    }


    bs.init({
        server: toDir,
        middleware: [ historyApiFallback() ],
        reloadDelay: 0,
        reloadDebounce: 100,
        reloadOnRestart: true,
        port,
        ghostMode: false,
        host: network(),
    });
}

export async function nodejsPlayGround(opts: {
    fromDir?: string;
    entryFile?: string;
    toDir?: string;
    watchOtherDirs?: string[];
    cssExts?: string[];
    jsExts?: string[];
    projectRoot?: string;
    copyFiles?: string[];
    debounceMs?: number;
    // port?: number;
} = { }) {
    const fromDir = resolve(opts.fromDir || 'playground/nodejs');
    const entryFile = join(fromDir, 'server.ts');
    const toDir = resolve(opts.toDir || '.temp/nodejs');
    const outFile = entryFile.replace(fromDir, toDir).replace('.ts', '.js');
    const watchOtherDirs = (opts.watchOtherDirs || ['src']).map((dir) => path.resolve(dir));
    const copyFiles = (opts.copyFiles || []);
    const jsExts = ['ts', 'js'];
    const projectRoot = path.resolve(opts.projectRoot || './');
    const debounceMs = isType(opts.debounceMs, 'number') ? opts.debounceMs : 200;
    
    // Prepare the playground folders with files //
    [fromDir, toDir].forEach(async dir => ensureDirSync(dir));

    Object.entries(nodejsFiles()).forEach(([fileName, txt]) => {
        if (!existsSync(join(fromDir, fileName)))
            writeFile(join(fromDir, fileName), txt);
    });

    // clearing and canceling on exit //
    [`exit`, `SIGINT`, `SIGUSR1`, `SIGUSR2`, `uncaughtException`, `SIGTERM`]
    .forEach((eventType) => process.on(eventType, () => {
        copyWatcher && copyWatcher.close();
        jsWatcher.close();
        process.exit();
    }));

    // initialized builder //
    const builder = new BuilderUtil({
        fromDir, toDir, projectRoot, copyFiles,
        buildFct: () => transpileBrowser(entryFile, toDir, { changeBuildOpts: { incremental: true } })
    });

    // Setup watchers //
    const allWatchDirs = [fromDir, ...watchOtherDirs.map(dir => resolve(dir))];
    const copyWatch = !!copyFiles.length && builder.info().copyFiles.map(x => x.from);
    const jsWatch: string[] = [];

    allWatchDirs.forEach((dir) => {
        jsExts.forEach(ext =>
            jsWatch.push(path.join(dir, '**', '*.' + ext)));
    });

    const jsWatcher = chokidar.watch(jsWatch);
    const copyWatcher = copyWatch && chokidar.watch(copyWatch);

    let copyChanged: { file: string; action: CopyAction; }[] = [];
    let jsChanged = false;
    const debounce = debounceTimeOut();
    const watchHandler = (opts: { type: 'js' } | { type: 'copy', file: { file: string; action: CopyAction; } }) => {
        switch (opts.type) {
            case 'js':
                jsChanged = true;
                break;
            case 'copy':
                copyChanged.push(opts.file);
                break;
            default:
                break;
        }
        
        debounce(async () => {
            const { fromDir: from, toDir: to, projectRoot: root } = builder.info();
            const logger = buildLogStart({ from, to, root });

            const copyFl = copyChanged;
            copyChanged = [];

            if (jsChanged) {
                await builder.build({ logTime: false });
            }
            
            if (copyFl.length) {
                await builder.fileCopyAction(copyFl);
            }
            
            logger.end();
            log(`> Restarting ${chalk.green('Nodejs')} App...`);
            app.reload();
        }, debounceMs);
    };

    await (new Promise((res) => {
        let i = copyWatcher ? 0 : 1;
        
        if (copyWatcher)
            copyWatcher.once('ready', (_) => (++i >= 2) && res(_));

        jsWatcher.once('ready', (_) => (++i >= 2) && res(_));
    }));

    await builder.cleanToDir();
    await builder.build();
    await builder.copy();
    
    const app = new ProcessManager('node', [outFile]);
    
    jsWatcher.on('all', () => {
        watchHandler({ type: 'js' });
    });

    if (copyWatcher) copyWatcher.on('all', async (action, file) => {
        watchHandler({ type: 'copy', file: { file, action } });
    });
}
