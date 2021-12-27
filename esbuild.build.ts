import { BuilderUtil } from './scripts/build.util';
import { browserPlayground, nodejsPlayGround } from './scripts/scripts';

(async function run([type]: string[]) {
    switch (type) {
        case 'playground:browser':
            return browserPlayground();
        case 'playground:nodejs':
            return nodejsPlayGround();
        case 'build': {
            const builder = new BuilderUtil({
                buildFct: () => void(0),
                fromDir: './src',
                toDir: './dist',
                projectRoot: '.',
            });

            builder.cleanToDir();
            return;
        } default:
            throw new Error(`"${type}" not implemented`);
    }
})(process.argv.slice(2));
// < / ▶
// setup a type of playground that runs from a 'higher' root & replace node modules version when in playground mode