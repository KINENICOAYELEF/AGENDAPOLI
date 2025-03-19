import { auth } from './firebase-config.js';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail,
  onAuthStateChanged
} from 'firebase/auth';

// Verificar si el usuario ya está autenticado
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Si ya hay un usuario autenticado, redirigir a la página principal
    window.location.href = 'index.html';
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Referencias a elementos del DOM
  const loginForm = document.getElementById('login-form');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const togglePasswordBtn = document.getElementById('toggle-password');
  const forgotPasswordBtn = document.getElementById('forgot-password');
  const recoveryModal = document.getElementById('recovery-modal');
  const closeModalBtn = document.querySelector('.close-modal');
  const recoveryForm = document.getElementById('recovery-form');
  const recoveryEmailInput = document.getElementById('recovery-email');
  const loginAlert = document.getElementById('login-alert');
  
  // Evento para iniciar sesión
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = emailInput.value.trim();
    const password = passwordInput.value;
    
    if (!email || !password) {
      showAlert('Por favor, complete todos los campos', 'error');
      return;
    }
    
    try {
      // Mostrar indicador de carga
      const loginBtn = loginForm.querySelector('.login-btn');
      loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Iniciando sesión...';
      loginBtn.disabled = true;
      
      // Iniciar sesión con Firebase
      await signInWithEmailAndPassword(auth, email, password);
      
      // Redirigir a la página principal
      window.location.href = 'index.html';
    } catch (error) {
      console.error('Error de inicio de sesión:', error);
      
      let errorMessage = 'Error al iniciar sesión. Intente nuevamente.';
      
      // Mensajes de error personalizados según el código
      if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') {
        errorMessage = 'Correo electrónico o contraseña incorrectos.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Demasiados intentos fallidos. Intente más tarde.';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'Esta cuenta ha sido deshabilitada. Contacte al administrador.';
      }
      
      showAlert(errorMessage, 'error');
      
      // Restaurar botón
      const loginBtn = loginForm.querySelector('.login-btn');
      loginBtn.innerHTML = 'Iniciar Sesión';
      loginBtn.disabled = false;
    }
  });
  
  // Mostrar/ocultar contraseña
  togglePasswordBtn.addEventListener('click', () => {
    const type = passwordInput.type === 'password' ? 'text' : 'password';
    passwordInput.type = type;
    
    // Cambiar ícono
    const icon = togglePasswordBtn.querySelector('i');
    icon.className = type === 'password' ? 'fas fa-eye' : 'fas fa-eye-slash';
  });
  
  // Abrir modal de recuperación de contraseña
  forgotPasswordBtn.addEventListener('click', (e) => {
    e.preventDefault();
    recoveryModal.style.display = 'block';
    
    // Poner el email actual en el formulario de recuperación
    recoveryEmailInput.value = emailInput.value;
  });
  
  // Cerrar modal
  closeModalBtn.addEventListener('click', () => {
    recoveryModal.style.display = 'none';
  });
  
  // Cerrar modal al hacer clic fuera del contenido
  window.addEventListener('click', (e) => {
    if (e.target === recoveryModal) {
      recoveryModal.style.display = 'none';
    }
  });
  
  // Enviar correo de recuperación
  recoveryForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = recoveryEmailInput.value.trim();
    
    if (!email) {
      showAlert('Por favor, ingrese su correo electrónico', 'error');
      return;
    }
    
    try {
      // Mostrar indicador de carga
      const submitBtn = recoveryForm.querySelector('.submit-btn');
      submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
      submitBtn.disabled = true;
      
      // Enviar correo de recuperación
      await sendPasswordResetEmail(auth, email);
      
      // Mostrar mensaje de éxito
      showAlert(`Se ha enviado un correo de recuperación a ${email}`, 'success');
      
      // Cerrar modal
      recoveryModal.style.display = 'none';
      
      // Restaurar botón
      submitBtn.innerHTML = 'Enviar';
      submitBtn.disabled = false;
    } catch (error) {
      console.error('Error al enviar correo de recuperación:', error);
      
      let errorMessage = 'Error al enviar correo de recuperación. Intente nuevamente.';
      
      // Mensajes de error personalizados según el código
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'No existe una cuenta con este correo electrónico.';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'El correo electrónico no es válido.';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'Demasiados intentos. Intente más tarde.';
      }
      
      showAlert(errorMessage, 'error');
      
      // Restaurar botón
      const submitBtn = recoveryForm.querySelector('.submit-btn');
      submitBtn.innerHTML = 'Enviar';
      submitBtn.disabled = false;
    }
  });
  
  // Mostrar alerta
  function showAlert(message, type) {
    loginAlert.textContent = message;
    loginAlert.className = `alert ${type}`;
    loginAlert.style.display = 'block';
    
    // Ocultar después de 5 segundos
    setTimeout(() => {
      loginAlert.style.display = 'none';
    }, 5000);
  }
});
