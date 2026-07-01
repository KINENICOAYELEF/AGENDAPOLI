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
        const accessToken = config.tokens?.access_token;
        if (!accessToken) {
            console.error('Access token not found.');
            return;
        }

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
                console.log(`Current role for ${email} is ${role}.`);
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
