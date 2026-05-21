const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

function base64urlEncode(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}

async function generateLicense() {
    const args = process.argv.slice(2);
    if (args.length < 2) {
        console.log("Usage: node generate.js <email> <plan: monthly|yearly|lifetime> [days_valid: 30|365|9999]");
        process.exit(1);
    }

    const email = args[0];
    const plan = args[1];
    const daysValid = parseInt(args[2] || (plan === 'monthly' ? '30' : plan === 'yearly' ? '365' : '9999'));

    const privateKeyPath = path.join(__dirname, '.keys', 'private.jwk.json');
    if (!fs.existsSync(privateKeyPath)) {
        console.error("Private key not found! Please run 'npm run keygen' first.");
        process.exit(1);
    }

    const privateKeyJwk = JSON.parse(fs.readFileSync(privateKeyPath, 'utf8'));

    const privateKey = await webcrypto.subtle.importKey(
        "jwk",
        privateKeyJwk,
        { name: "Ed25519" },
        false,
        ["sign"]
    );

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + daysValid);

    const payload = {
        email: email,
        plan: plan,
        expires: expiryDate.toISOString(),
        trial: false
    };

    const payloadStr = JSON.stringify(payload);
    const encoder = new TextEncoder();
    const payloadBytes = encoder.encode(payloadStr);

    const signature = await webcrypto.subtle.sign(
        { name: "Ed25519" },
        privateKey,
        payloadBytes
    );

    const payloadB64 = base64urlEncode(payloadBytes);
    const signatureB64 = base64urlEncode(signature);

    const licenseKey = `TMPT-PRO.${payloadB64}.${signatureB64}`;
    
    console.log("\n================ TMPT LICENSE KEY ================");
    console.log(`Email:      ${email}`);
    console.log(`Plan:       ${plan}`);
    console.log(`Expires:    ${expiryDate.toLocaleDateString()} (${daysValid} days)`);
    console.log(`License:    ${licenseKey}`);
    console.log("==================================================\n");
}

generateLicense().catch(console.error);
