const fs = require('fs');
const { createCanvas } = require('@napi-rs/canvas');
const d3 = require('d3-geo');
const topojson = require('topojson-client');

const W = 4096, H = 2048;
const land = require('world-atlas/land-50m.json');
const countries = require('world-atlas/countries-50m.json');

const landGeo = topojson.feature(land, land.objects.land);
const borderGeo = topojson.mesh(countries, countries.objects.countries, (a, b) => a !== b);

const projection = d3.geoEquirectangular()
  .scale(W / (2 * Math.PI))
  .translate([W / 2, H / 2]);

function render(draw) {
  const canvas = createCanvas(W, H);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);
  const path = d3.geoPath(projection, ctx);
  draw(ctx, path);
  return canvas;
}

const landCanvas = render((ctx, path) => {
  ctx.beginPath();
  path(landGeo);
  ctx.fillStyle = '#fff';
  ctx.fill();
});
fs.writeFileSync('mask_land.png', landCanvas.toBuffer('image/png'));

const borderCanvas = render((ctx, path) => {
  ctx.beginPath();
  path(borderGeo);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2.6;
  ctx.lineJoin = 'round';
  ctx.stroke();
});
fs.writeFileSync('mask_borders.png', borderCanvas.toBuffer('image/png'));

console.log('masks listos', W, H);
