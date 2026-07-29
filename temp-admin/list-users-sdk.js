const apiv2 = require('firebase-tools/lib/apiv2');
const https = require('https');

apiv2.getAccessToken().then(accessToken => {
    console.log("Got access token!");
    queryFirestore(accessToken);
}).catch(err => {
    console.error("Error getting access token:", err);
});

function queryFirestore(accessToken) {
    const projectId = 'sistemakine-premium-2026';
    const path = `/v1/projects/${projectId}/databases/(default)/documents/users?pageSize=100`;
    
    const req = https.request({
        hostname: 'firestore.googleapis.com',
        path: path,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`
        }
    }, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
            try {
                const response = JSON.parse(data);
                if (!response.documents) {
                    console.log("No documents found or error:", data);
                    return;
                }
                
                console.log("--- USER LIST ---");
                response.documents.forEach(doc => {
                    const fields = doc.fields;
                    const email = fields.email ? fields.email.stringValue : 'N/A';
                    const role = fields.role ? fields.role.stringValue : 'N/A';
                    const name = fields.name ? fields.name.stringValue : (fields.displayName ? fields.displayName.stringValue : 'N/A');
                    const createdAt = doc.createTime;
                    console.log(`Email: ${email.padEnd(35)} | Role: ${role.padEnd(10)} | Name: ${name.padEnd(25)} | Created: ${createdAt}`);
                });
            } catch (e) {
                console.error("Failed to parse firestore response:", e);
            }
        });
    });
    
    req.on('error', (e) => {
        console.error(e);
    });
    req.end();
}
