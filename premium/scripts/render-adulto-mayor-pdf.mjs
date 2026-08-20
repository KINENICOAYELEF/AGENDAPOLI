import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');
const outputPath = resolve(process.argv[2] || `${projectRoot}/.artifacts/adulto-mayor/informe-funcional-verificacion.pdf`);
const sourcePath = resolve(projectRoot, 'src/lib/adultoMayor/pdf.ts');
const compiledPath = resolve(projectRoot, '.artifacts/adulto-mayor/pdf-generator.mjs');

await mkdir(dirname(outputPath), { recursive: true });
const source = await readFile(sourcePath, 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ES2022,
  },
}).outputText;
await writeFile(compiledPath, compiled, 'utf8');

const { createOlderAdultEvaluationPdf } = await import(`${pathToFileURL(compiledPath).href}?v=${Date.now()}`);
const evaluation = {
  id: 'verificacion-pdf',
  participantId: 'persona-verificacion',
  evaluatorId: 'evaluador-verificacion',
  evaluatorName: 'Interna de Kinesiología',
  participantSnapshot: {
    fullName: 'María González Soto',
    birthDate: '1948-05-15',
    age: 78,
    sex: 'MUJER',
    commune: 'Santiago',
  },
  status: 'SUBMITTED',
  step: 5,
  data: {
    tests: {
      tugSeconds: 12.8,
      tugUnable: false,
      sts30Repetitions: 11,
      grip: { right: [18, 19, 18], left: [17, 18, 17], dominantHand: 'DERECHA', unit: 'KG' },
      sppb: {
        balance: { feetTogetherSeconds: 10, semiTandemSeconds: 10, tandemSeconds: 7, unable: false },
        gait4m: { attempt1Seconds: 5.2, attempt2Seconds: 5.0, unable: false },
        chair5: { seconds: 14.1, unableWithoutArms: false },
      },
    },
    clinicalObservations: 'Participa activamente y comprende las indicaciones. Presenta un desempeño funcional intermedio, con oportunidad de mejorar potencia de extremidades inferiores y seguridad durante cambios de dirección.',
  },
  results: {
    frailScore: 1,
    frailtyLabel: 'PREFRAGIL',
    gripRightMax: 19,
    gripLeftMax: 18,
    gripBest: 19,
    lowGripStrength: false,
    probableSarcopenia: false,
    sarcopeniaLabel: 'Sin criterio de fuerza reducida',
    balanceScore: 3,
    gaitScore: 3,
    chairScore: 2,
    sppbTotal: 8,
    sppbLabel: 'Desempeño físico intermedio',
    gaitBestSeconds: 5,
    gaitSpeedMps: 0.8,
    fallRiskLevel: 'ALTERADO',
    fallRiskLabel: 'Cribado con riesgo de caída aumentado',
    cognitiveFlag: false,
    cognitiveLabel: 'Sin señales en el cribado breve',
    sts30Classification: 'Dentro del rango de referencia',
    estimatedPowerWatts: 294,
    estimatedRelativePower: 3.01,
    powerClassification: 'Rango esperado',
    radar: { grip: 71, lowerLimbPower: 64, mobility: 78, gait: 60, balance: 75 },
    warnings: [
      'El TUG y el antecedente de inestabilidad sugieren reforzar estrategias de prevención de caídas.',
      'Reevaluar en 4–6 semanas para comparar cambios con las mismas condiciones de medición.',
    ],
  },
  createdAt: '2026-08-19T14:30:00.000Z',
  updatedAt: '2026-08-19T15:20:00.000Z',
  submittedAt: '2026-08-19T15:20:00.000Z',
};

const { doc } = await createOlderAdultEvaluationPdf(evaluation);
await writeFile(outputPath, Buffer.from(doc.output('arraybuffer')));
process.stdout.write(`${outputPath}\n`);
