import { findBrowser } from './modules/projection/launcher.js';

// Requisitos del equipo servidor. Si falta alguno, Manna no arranca y se abre instalacion/requisitos.html.
export function checkRequirements() {
  const problems = [];
  const needsBrowser = process.platform === 'darwin' || process.platform === 'win32';
  if (needsBrowser && !findBrowser()) {
    problems.push({
      id: 'navegador',
      message: 'No se encontró Google Chrome (ni Microsoft Edge). Se necesita para la pantalla de proyección.',
      link: 'https://www.google.com/chrome/',
    });
  }
  return problems;
}
