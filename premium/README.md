This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

1. La aplicación web construida en Next.js App Router (Fase 1 y siguientes).
2. Conexión limpia y modular con este nuevo proyecto Firebase evitando duplicación de DBs.
3. Se migrarán los 120 perfiles históricos mediante el JSON estandarizado generado aquí.

---

### Gestión de Roles y Accesos (Sistemakine Premium)

El nuevo sistema opera estrictamente bajo el "Plan Spark" de coste $0. Para evitar la dependencia de Cloud Functions y Custom Claims de backend, los roles se controlan vía base de datos usando el documento del usuario:

*   **Mecanismo**: Todos los usuarios nacen con el rol `"INTERNO"` al iniciar sesión por primera vez con Google (`users/{uid}`).
*   **Restricciones**: Los usuarios con rol "INTERNO" no ven ni pueden forzar la entrada a paneles administrativos (ej. `/app/admin`).
*   **Bootstrap Manual (Asignar Docente)**: Para ascender la cuenta principal a administrador docente, debes:
    1. Iniciar sesión en la web de Premium con tu Google Auth.
    2. Entrar a [Firebase Console](https://console.firebase.google.com/) -> `sistemakine-premium-2026` -> **Firestore Database**.
    3. Buscar en la colección `users` tu documento (busca por el campo `email`).
    4. Editar el campo `role` borrando "INTERNO" y escribiendo exactamente `"DOCENTE"` (en mayúsculas).
    5. Recargar la página web. Tu interfaz cambiará automáticamente desbloqueando el menú rojo "Admin Docente".

### IMPORTANTÍSIMO: Reglas de Seguridad de Firestore
Para que este ecosistema funcione y proteja los datos en el plan de $0, es **obligatorio** configurar las reglas de seguridad dentro de tu servidor. 
En este repositorio encontrarás el archivo `firestore.rules`. 
Debes hacer lo siguiente:
1. Ve a Firebase Console -> Firestore Database.
2. Abre la pestaña **Rules** (Reglas).
3. Borra todo el texto que haya allí.
4. Pega el contenido íntegro del archivo `premium/firestore.rules`.
5. Dale a **Publicar**.

> Con esas reglas, Firebase bloqueará mágicamente a cualquier intento malicioso de declararse "DOCENTE" creando una cuenta falsa, verificando la base de datos usando `get()` sin necesidad de usar Servidores Cloud (Functions).

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
