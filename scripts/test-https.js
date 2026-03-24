
const https = require('https');

console.log('Testing https.get...');
https.get('https://www.google.com', (res) => {
    console.log('Status:', res.statusCode);
    res.on('data', () => { });
    res.on('end', () => {
        console.log('Success: https.get is working!');
    });
}).on('error', (e) => {
    console.error('https.get failed:', e);
});
