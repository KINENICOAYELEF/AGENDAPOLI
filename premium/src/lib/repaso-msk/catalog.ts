export const catalog = {
  'knee-v1': { title: 'Rodilla', zone: 'Rodilla', conditions: ['Dolor patelofemoral', 'Tendinopatía patelar', 'Artrosis', 'Menisco', 'Ligamentos', 'Inestabilidad patelar', 'Artroplastia'] },
  'hip-v1': { title: 'Cadera e ingle', zone: 'Cadera e ingle', conditions: ['Artrosis de cadera', 'Dolor no artrósico y FAI', 'Dolor lateral de cadera', 'Dolor inguinal', 'Artroplastia de cadera', 'Seguridad y derivación', 'Evaluación y razonamiento'] },
} as const;
export type BankVersion = keyof typeof catalog;
export function validVersion(value: unknown): value is BankVersion {
  return value === 'knee-v1' || value === 'hip-v1';
}
