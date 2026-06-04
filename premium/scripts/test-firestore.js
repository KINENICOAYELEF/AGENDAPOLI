const { initializeApp } = require('firebase/app');
const { getFirestore, collection, getDocs } = require('firebase/firestore');
const fs = require('fs');

const envFile = fs.readFileSync('.env.local', 'utf8');
const config = {
    apiKey: envFile.match(/NEXT_PUBLIC_FIREBASE_API_KEY=["']?([^"'\n\r]+)["']?/)?.[1],
    authDomain: envFile.match(/NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=["']?([^"'\n\r]+)["']?/)?.[1],
    projectId: envFile.match(/NEXT_PUBLIC_FIREBASE_PROJECT_ID=["']?([^"'\n\r]+)["']?/)?.[1],
    storageBucket: envFile.match(/NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=["']?([^"'\n\r]+)["']?/)?.[1],
    messagingSenderId: envFile.match(/NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=["']?([^"'\n\r]+)["']?/)?.[1],
    appId: envFile.match(/NEXT_PUBLIC_FIREBASE_APP_ID=["']?([^"'\n\r]+)["']?/)?.[1],
};

console.log('Firebase Config loaded:', {
    projectId: config.projectId,
    apiKey: config.apiKey ? 'PRESENT' : 'MISSING'
});

const app = initializeApp(config);
const db = getFirestore(app);

async function checkIntentos() {
    try {
        const snap = await getDocs(collection(db, 'simulador_intentos'));
        console.log(`Total documents found in 'simulador_intentos': ${snap.size}`);
        snap.forEach(doc => {
            const data = doc.data();
            console.log(`- ID: ${doc.id}, userId: ${data.userId}, email: ${data.userEmail}, userName: ${data.userName}, practiceMode: ${data.practiceMode}, notaChilena: ${data.notaChilena}, fecha: ${data.fecha ? data.fecha.toDate().toISOString() : 'N/A'}`);
        });
    } catch (e) {
        console.error('Error fetching from firestore:', e);
    }
}

checkIntentos();
