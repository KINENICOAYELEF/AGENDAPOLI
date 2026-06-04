const req = {
  action: 'interview_feedback',
  payload: {
    perfil_secreto: {
      personalidad: "ansioso",
      historia_completa: "duele el hombro",
      datos_ocultos: [],
      bps_oculto: { sueno: "mal", estres: "alto", miedos: "no", expectativa_real: "sanar" }
    },
    preguntas_estudiante: "Hola, ¿cómo estás?"
  },
  userId: 'test1234'
};
fetch('http://localhost:3000/api/ai/simulador', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(req)
}).then(r => r.json()).then(console.log).catch(console.error);
