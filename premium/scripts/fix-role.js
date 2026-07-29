const { initializeApp } = require('firebase/app');
const { getFirestore, collection, query, where, getDocs, updateDoc, doc } = require('firebase/firestore');
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

const app = initializeApp(config);
const db = getFirestore(app);

async function fixRole() {
    const q = query(collection(db, 'users'), where('email', '==', 'nicolas.ayelef@gmail.com'));
    const snap = await getDocs(q);
    if (snap.empty) {
        console.log("No user found with email nicolas.ayelef@gmail.com");
        return;
    }
    
    for (const d of snap.docs) {
        console.log(`Found user: ${d.id}, current role: ${d.data().role}`);
        await updateDoc(doc(db, 'users', d.id), { role: 'DOCENTE' });
        console.log(`Updated user ${d.id} to DOCENTE`);
    }
}

fixRole().catch(console.error).then(() => process.exit(0));
