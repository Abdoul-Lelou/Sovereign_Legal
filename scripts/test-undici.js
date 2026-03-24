
const { fetch, Agent } = require('undici');

async function test() {
    console.log('Testing undici fetch with Agent family: 4...');
    try {
        const res = await fetch('https://www.google.com', {
            dispatcher: new Agent({ connect: { family: 4 } })
        });
        console.log('Status:', res.status);
        if (res.status === 200) {
            console.log('Success: undici fetch with family: 4 works!');
        }
    } catch (e) {
        console.error('undici fetch failed:', e);
    }
}
test();
