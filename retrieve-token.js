import puppeteer from "puppeteer";
import {sha256} from "js-sha256";
import base64Url from "base64-url";
import { ask } from 'stdio';

function createChallengeCode() {
    const charset = 'abcdefghijklmnopqrstuvwxyz01234567890';

    let code = '';
    for (let i = 0; i < 100; i++) {
        code += charset[Math.floor(Math.random() * charset.length)];
    }

    return code;
}

function createChallengeHash(code) {
    const hash = sha256.create();

    hash.update(code);

    return base64Url.encode(hash.digest());
}

const challengeCode = createChallengeCode();

const authUrl = "https://login.ford.com/4566605f-43a7-400a-946e-89cc9fdb0bd7/B2C_1A_SignInSignUp_en-US"
    + "/oauth2/v2.0/authorize"
    + "?redirect_uri=fordapp://userauthorized"
    + "&response_type=code"
    + "&max_age=3600"
    + "&scope=%2009852200-05fd-41f6-8c21-d36d3497dc64%20openid"
    + "&client_id=09852200-05fd-41f6-8c21-d36d3497dc64"
    + "&code_challenge=" + createChallengeHash(challengeCode)
    + "&code_challenge_method=S256"
    + "&ui_locales=en-US"
    + "&language_code=en-US"
    + "&country_code=US"
    + "&ford_application_id=5C80A6BB-CF0D-4A30-BDBF-FC804B5C1A98"

const browser = await puppeteer.launch({
    headless: "new",
    executablePath: '/usr/bin/google-chrome',
    args: [
        '--no-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--disable-web-security',
        '--allow-running-insecure-content'
    ]
});

let authorizedCodeResolve;
const authorizedCodePromise = new Promise(r => (authorizedCodeResolve = r));

const page = await browser.newPage();

page.on('response', async response => {
    if (!response.url().includes('/api/CombinedSigninAndSignup/confirmed?')) {
        return;
    }

    if ((response.status() < 300) || (response.status() > 399)) {
        return;
    }

    const location = response.headers().location ?? null;

    if (!location) {
        return;
    }

    if (!location.startsWith('fordapp://userauthorized/')) {
        return;
    }

    const urlDecoded = new URL(location);
    const code = urlDecoded.searchParams.get('code') ?? null;

    if (!code?.length) {
        return;
    }

    authorizedCodeResolve(code);
});

await page.goto(authUrl);

await page.setViewport({width: 1200, height: 720});

await page.waitForNetworkIdle({
    idleTime: 1000
});

const usernameField = await page.$('input#signInName');
const passwordField = await page.$('input#password');

const username = await ask('Enter fordpass username');

await usernameField.type(username, {
    delay: Math.random() * 100
});

await new Promise(r => setTimeout(r, Math.random() * 1000));

const password = await ask('Enter fordpass password');

await passwordField.type(password, {
    delay: Math.random() * 100
});

await new Promise(r => setTimeout(r, Math.random() * 1000));

const submitButton = await page.$('form#localAccountForm [type=submit]');

submitButton.type("\n");

const resolvedCode = await authorizedCodePromise;

await browser.close();

const requestTokenData = {
    "client_id" : "09852200-05fd-41f6-8c21-d36d3497dc64",
    "code_verifier": challengeCode,
    "code": resolvedCode,
    "grant_type": "authorization_code",
    "redirect_uri": "fordapp://userauthorized"
};

const response = await fetch('https://login.ford.com/4566605f-43a7-400a-946e-89cc9fdb0bd7/B2C_1A_SignInSignUp_en-US/oauth2/v2.0/token', {
    method: 'POST',
    headers: {
        'content-type': 'application/x-www-form-urlencoded'
    },
    body: (new URLSearchParams(requestTokenData)).toString()
});

if (!response.ok) {
    console.error("Failed getting token (1)");
    process.exit(1);
}

const tokenResponse = await response.json();
if (!tokenResponse?.['access_token'] ?? null) {
    console.log("Failed getting token (2)");
    process.exit(1);
}

console.log("\n\nAccess token received:\n");
console.log(tokenResponse['access_token'] + "\n\n");
process.exit(0);
