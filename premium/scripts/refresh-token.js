const fs = require('fs');
const path = require('path');
const os = require('os');

const home = os.homedir();
const configPath = path.join(home, '.config', 'configstore', 'firebase-tools.json');

async function run() {
    try {
        if (!fs.existsSync(configPath)) {
            console.error('Config store not found.');
            return;
        }

        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        const refreshToken = config.tokens?.refresh_token;
        if (!refreshToken) {
            console.error('Refresh token not found.');
            return;
        }

        console.log('Refreshing access token...');
        const params = new URLSearchParams({
            client_id: '563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com',
            grant_type: 'refresh_token',
            refresh_token: refreshToken
        });

        const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params
        });

        if (!tokenRes.ok) {
            throw new Error(`Failed to refresh token: ${tokenRes.status} ${await tokenRes.text()}`);
        }

        const tokenData = await tokenRes.json();
        const accessToken = tokenData.access_token;
        console.log('Access token refreshed successfully.');

        // Update the access token in config file so firebase tools can use it too!
        config.tokens.access_token = accessToken;
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('Updated local firebase-tools config store with new access token.');

        const projectId = 'sistemakine-premium-2026';
        const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/users`;

        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Failed to fetch users: ${response.status} ${response.statusText}\n${errText}`);
        }

        const data = await response.json();
        const documents = data.documents || [];
        for (const doc of documents) {
            const fields = doc.fields || {};
            const email = fields.email?.stringValue;
            const role = fields.role?.stringValue;

            if (email === 'nicolas.ayelef@gmail.com') {
                console.log(`Current role for ${email} in DB is: ${role}.`);
                if (role === 'PENDING') {
                    console.log('Restoring to DOCENTE...');
                    const patchUrl = `https://firestore.googleapis.com/v1/${doc.name}?updateMask.fieldPaths=role`;
                    const patchResponse = await fetch(patchUrl, {
                        method: 'PATCH',
                        headers: {
                            'Authorization': `Bearer ${accessToken}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            fields: {
                                role: { stringValue: 'DOCENTE' }
                            }
                        })
                    });
                    if (patchResponse.ok) {
                        console.log('Successfully restored role to DOCENTE.');
                    } else {
                        console.error('Failed to restore:', await patchResponse.text());
                    }
                }
            }
        }
    } catch (e) {
        console.error(e);
    }
}

run();
