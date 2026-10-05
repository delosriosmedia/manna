// Pestañas del celular: en la barra de abajo caben cinco. Con más módulos se ven los cuatro
// primeros y "Más" abre el resto. Devuelve { tabs, overflow }.
export const MAX_TABS = 5;

export function splitTabs(modules, max = MAX_TABS) {
  const tabs = modules.length > max ? modules.slice(0, max - 1) : modules;
  return { tabs, overflow: modules.slice(tabs.length) };
}
