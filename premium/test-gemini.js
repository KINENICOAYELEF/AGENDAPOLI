const { GoogleGenAI } = require('@google/genai');
try {
  const ai = new GoogleGenAI({ apiKey: "AIzaSyD6xkhRfmgGxR6eN6wdvtN2Ucuhr6U93Eg" });
  ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: 'hello',
  }).then(console.log).catch(e => console.error("GenContent Error:", e.stack || e.message));
} catch (e) {
  console.error("Init Error:", e.stack || e.message);
}
