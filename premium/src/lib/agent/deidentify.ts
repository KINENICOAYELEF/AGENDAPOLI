export function deidentifyText(text: string): string {
  if (!text) return text;
  
  // Remover correos
  let result = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[CORREO_REMOVIDO]');
  
  // Remover RUT chileno (formatos comunes)
  result = result.replace(/\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/g, '[RUT_REMOVIDO]');
  result = result.replace(/\b\d{7,8}-[\dkK]\b/g, '[RUT_REMOVIDO]');
  
  // Simplistic approach for names (real implementation would use NER or dictionary)
  // Reemplazar nombres específicos si se pasan como diccionario o usar placeholders
  
  return result;
}

export function deidentifyObject<T extends object>(obj: T): T {
  try {
    const str = JSON.stringify(obj);
    const cleanedStr = deidentifyText(str);
    return JSON.parse(cleanedStr);
  } catch (e) {
    return obj;
  }
}
