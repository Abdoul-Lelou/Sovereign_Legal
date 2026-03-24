
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

async function test() {
    console.log('Testing fetch with ipv4first DNS order...');
    try {
        const res = await fetch('https://www.google.com');
        console.log('Status:', res.status);
        if (res.status === 200) {
            console.log('Success: fetch is working!');
        }
    } catch (e) {
        console.error('Fetch failed despite fix:', e);
        process.exit(1);
    }
}
test();
