const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

// Polyfill global environment
global.crypto = webcrypto;
global.window = {};
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');

// Load TMPT_Crypto mock/code
const cryptoJsPath = path.join(__dirname, '..', '..', 'assets', 'js', 'crypto.js');
eval(fs.readFileSync(cryptoJsPath, 'utf8'));

// Load recovery-code.js
const recoveryJsPath = path.join(__dirname, '..', '..', 'assets', 'js', 'recovery-code.js');
eval(fs.readFileSync(recoveryJsPath, 'utf8'));

async function runRecoveryTest() {
    console.log("Running Cryptographic Recovery Code Unit Test...");

    // 1. Generate active master key (AES-256-GCM)
    const masterKeyRaw = crypto.getRandomValues(new Uint8Array(32));
    const activeKey = await crypto.subtle.importKey(
        "raw",
        masterKeyRaw,
        { name: "AES-GCM" },
        true, // must be extractable to generate recovery keys
        ["encrypt", "decrypt"]
    );

    // 2. Generate recovery codes
    const result = await window.TMPT_Recovery.generateRecoveryCodes(activeKey);
    console.log(`Generated ${result.codes.length} recovery codes.`);
    console.log("Example code:", result.codes[0]);
    console.log("Example hash mapping:", result.recoveryHashes[0].hash);

    if (result.codes.length !== 8 || result.recoveryHashes.length !== 8) {
        throw new Error("FAIL: Did not generate 8 codes/hashes.");
    }

    // 3. Verify recovery with correct code
    console.log("Testing recovery with CORRECT code...");
    const correctCode = result.codes[2];
    const recoverResult = await window.TMPT_Recovery.recoverMasterKey(correctCode, result.recoveryHashes);
    
    // Check if recovered key matches master key
    const recoveredRaw = await crypto.subtle.exportKey("raw", recoverResult.key);
    const keysMatch = Buffer.from(recoveredRaw).toString('hex') === Buffer.from(masterKeyRaw).toString('hex');
    
    if (recoverResult.success && keysMatch) {
        console.log("SUCCESS: Key successfully recovered and verified!");
    } else {
        throw new Error("FAIL: Recovered key did not match the original master key.");
    }

    // 4. Verify recovery with INCORRECT code
    console.log("Testing recovery with INCORRECT code...");
    try {
        await window.TMPT_Recovery.recoverMasterKey("AAAA-BBBB-CCCC", result.recoveryHashes);
        throw new Error("FAIL: Accepted incorrect recovery code.");
    } catch (err) {
        console.log("SUCCESS: Incorrect code rejected with message:", err.message);
    }
}

runRecoveryTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
