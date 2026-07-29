const apiv2 = require('firebase-tools/lib/apiv2');
const https = require('https');

apiv2.getAccessToken().then(accessToken => {
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
                
                response.documents.forEach(doc => {
                    const fields = doc.fields;
                    const email = fields.email ? fields.email.stringValue : 'N/A';
                    if (['rodrigo.meza@mayor.cl', 'diego.guzman.lagos12@gmail.com', 'caro.belen.cerda@gmail.com'].includes(email)) {
                        console.log(`\nEmail: ${email}`);
                        console.log(JSON.stringify(fields, null, 2));
                    }
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
