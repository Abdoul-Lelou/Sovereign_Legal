
async function test() {
    try {
        const res = await fetch('https://www.google.com');
        console.log('Status:', res.status);
    } catch (e) {
        console.error('Fetch failed:', e);
    }
}
test();
