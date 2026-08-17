import { font, type } from '@/theme/theme';

/**
 * Interlineados de la escala tipográfica.
 *
 * Android recorta lo que sobresalga de la caja de línea, así que un interlineado
 * apretado se come la cola de la «g» o la tilde de la «ó». No se ve en el
 * simulador con textos cortos y sin acentos: aparece cuando alguien juega en
 * español y ve «Elige tu reto» sin la cola de la g.
 */
describe('escala tipográfica', () => {
  const OUTFIT = [font.display, font.displayBlack, font.displayMedium];

  it('deja aire suficiente en los titulares', () => {
    for (const [name, style] of Object.entries(type)) {
      if (!OUTFIT.includes(style.fontFamily as never)) continue;
      const ratio = style.lineHeight / style.fontSize;
      // El nombre va en el mensaje para saber cuál falló sin ir a mirar.
      expect([name, ratio >= 1.2]).toEqual([name, true]);
    }
  });

  it('no aprieta tampoco el texto corrido', () => {
    for (const style of Object.values(type)) {
      if (OUTFIT.includes(style.fontFamily as never)) continue;
      expect(style.lineHeight / style.fontSize).toBeGreaterThanOrEqual(1.2);
    }
  });

  it('todos los tamaños declaran interlineado', () => {
    // Sin `lineHeight` cada plataforma pone el suyo y el diseño baila.
    for (const style of Object.values(type)) {
      expect(style.lineHeight).toBeGreaterThan(0);
      expect(style.fontSize).toBeGreaterThan(0);
    }
  });
});
