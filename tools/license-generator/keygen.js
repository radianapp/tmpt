const fs = require('fs');
const path = require('path');
const { webcrypto } = require('crypto');

async function generateKeyPair() {
    const keysDir = path.join(__dirname, '.keys');
    if (!fs.existsSync(keysDir)) {
        fs.mkdirSync(keysDir, { recursive: true });
    }

    console.log("Generating Ed25519 key pair...");
    const keyPair = await webcrypto.subtle.generateKey(
        {
            name: "Ed25519"
        },
        true,
        ["sign", "verify"]
    );

    const publicKeyJwk = await webcrypto.subtle.exportKey("jwk", keyPair.publicKey);
    const privateKeyJwk = await webcrypto.subtle.exportKey("jwk", keyPair.privateKey);

    fs.writeFileSync(path.join(keysDir, 'public.jwk.json'), JSON.stringify(publicKeyJwk, null, 2));
    fs.writeFileSync(path.join(keysDir, 'private.jwk.json'), JSON.stringify(privateKeyJwk, null, 2));

    console.log("Keys successfully generated and saved to tools/license-generator/.keys/");
    console.log("\nCopy this public key JSON to embed in client-side license.js:");
    console.log(JSON.stringify(publicKeyJwk));
}

generateKeyPair().catch(console.error);
