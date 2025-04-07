// auth.js - Autenticación para ImageKit.io

// Esta función genera los tokens necesarios para ImageKit
function generateAuthenticationParameters() {
  // Generamos un timestamp para la expiración (1 hora desde ahora)
  const expire = Math.floor(Date.now() / 1000) + 3600;
  
  // Valor de token aleatorio para cada solicitud
  const token = Math.random().toString(36).substring(2, 15);
  
  // En un entorno real, la firma debería generarse en el servidor
  // Esta es una implementación temporal para pruebas
  const signature = btoa(`${token}_${expire}_vbxofs9fw`);
  
  return {
    token,
    expire,
    signature
  };
}

// Exponemos la función para que esté disponible globalmente
window.getImageKitAuthParams = generateAuthenticationParameters;
