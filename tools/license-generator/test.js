const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

// Polyfill window/crypto/atob/btoa for Node environment to test LicenseModule code
global.crypto = webcrypto;
global.window = {};
global.atob = (str) => Buffer.from(str, 'base64').toString('binary');
global.btoa = (str) => Buffer.from(str, 'binary').toString('base64');

// Load license.js
const licenseJsPath = path.join(__dirname, '..', '..', 'assets', 'js', 'license.js');
const licenseJsCode = fs.readFileSync(licenseJsPath, 'utf8');

// Evaluate the license module in global scope
eval(licenseJsCode);

async function runTest() {
    console.log("Running Cryptographic License Key Unit Test...");

    // 1. Generate keys
    const privateKeyJwk = JSON.parse(fs.readFileSync(path.join(__dirname, '.keys', 'private.jwk.json'), 'utf8'));
    const privateKey = await crypto.subtle.importKey(
        "jwk",
        privateKeyJwk,
        { name: "Ed25519" },
        false,
        ["sign"]
    );

    // 2. Generate a valid license key
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + 30); // 30 days
    const payload = {
        email: "test_user@tmpt.my.id",
        plan: "monthly",
        expires: expiryDate.toISOString(),
        trial: false
    };

    function base64urlEncode(buffer) {
        return btoa(String.fromCharCode(...new Uint8Array(buffer)))
            .replace(/\+/g, '-')
            .replace(/\//g, '_')
            .replace(/=/g, '');
    }

    const payloadStr = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(payloadStr);

    const signature = await crypto.subtle.sign(
        { name: "Ed25519" },
        privateKey,
        payloadBytes
    );

    const payloadB64 = base64urlEncode(payloadBytes);
    const signatureB64 = base64urlEncode(signature);
    const licenseKey = `TMPT-PRO.${payloadB64}.${signatureB64}`;

    console.log("Generated test key:", licenseKey);

    // 3. Test verification via LicenseModule
    console.log("Verifying license key via LicenseModule...");
    const result = await window.TMPT_License.verifyLicenseKey(licenseKey);
    console.log("Verification result:", result);

    if (result.valid && result.email === payload.email && result.plan === payload.plan) {
        console.log("SUCCESS: License verification works correctly!");
    } else {
        throw new Error("FAIL: License verification returned invalid data.");
    }

    // 4. Test expired license handling
    console.log("Testing expired license handling...");
    const expiredPayload = { ...payload, expires: new Date(Date.now() - 1000).toISOString() };
    const expiredPayloadBytes = encoder.encode(JSON.stringify(expiredPayload));
    const expiredSig = await crypto.subtle.sign({ name: "Ed25519" }, privateKey, expiredPayloadBytes);
    const expiredKey = `TMPT-PRO.${base64urlEncode(expiredPayloadBytes)}.${base64urlEncode(expiredSig)}`;

    try {
        await window.TMPT_License.verifyLicenseKey(expiredKey);
        throw new Error("FAIL: Expired license key was accepted.");
    } catch (err) {
        console.log("SUCCESS: Expired license correctly rejected with message:", err.message);
    }
}

runTest().catch(err => {
    console.error("Test failed:", err);
    process.exit(1);
});
