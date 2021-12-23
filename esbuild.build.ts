import { browserPlayground, nodejsPlayGround } from './scripts/scripts';

// const { log } = console;

(async function run([type]: string[]) {
    switch (type) {
        case 'playground:browser':
            browserPlayground();
            break;
        case 'playground:nodejs':
            nodejsPlayGround();
            break;
        default:
            throw new Error(`"${type}" not implemented`);
    }
})(process.argv.slice(2));

// setup a type of playground that runs from a 'higher' root & replace node modules version when in playground mode