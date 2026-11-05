// Render the theme locally with mock Shopify data so it can be screenshotted.
import { Liquid, Tag } from 'liquidjs';
import fs from 'fs'; import path from 'path';
const T = process.argv[2], OUT = process.argv[3], OLD = process.argv[4];
fs.mkdirSync(OUT, { recursive: true });
const engine = new Liquid({ root: [path.join(T,'sections'), path.join(T,'snippets')], extname: '.liquid', jsTruthy: false });
const kw = (args) => Object.fromEntries(args.filter(Array.isArray));
engine.registerFilter('asset_url', (n) => `file://${T}/assets/${n}`);
engine.registerFilter('image_url', (img, ...a) => typeof img === 'string' ? img : img?.src);
engine.registerFilter('image_tag', (src, ...a) => { const o = kw(a); return `<img src="${src}"${Object.entries(o).map(([k,v])=>` ${k}="${v}"`).join('')}>`; });
engine.registerFilter('stylesheet_tag', (u) => `<link rel="stylesheet" href="${u}">`);
const money = (c) => '$' + (c/100).toFixed(2);
engine.registerFilter('money', money);
engine.registerFilter('money_without_trailing_zeros', (c) => money(c).replace(/\.00$/,''));
engine.registerFilter('json', (v) => JSON.stringify(v));
engine.registerFilter('default_errors', () => '');
class Schema extends Tag { constructor(t, r, l){ super(t,r,l); this.tpls=[]; const s=l.parser.parseStream(r); s.on('tag:endschema',()=>s.stop()).on('template',()=>{}).on('end',()=>{}); s.start(); } *render(){ return ''; } }
engine.registerTag('schema', Schema);
class Form extends Tag { constructor(t,r,l){ super(t,r,l); this.tpls=[]; const s=l.parser.parseStream(r); s.on('tag:endform',()=>s.stop()).on('template',x=>this.tpls.push(x)).on('end',()=>{throw new Error('form')}); s.start(); this.args=t.args; this.cls=(t.args.match(/class: '([^']+)'/)||[])[1]||''; }
  *render(ctx, emitter){ emitter.write(`<form method="post" class="${this.cls}"${/data-product-form/.test(this.args) ? " data-product-form" : ""}>`); yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter); emitter.write('</form>'); } }
engine.registerTag('form', Form);
class Paginate extends Tag { constructor(t,r,l){ super(t,r,l); this.tpls=[]; const s=l.parser.parseStream(r); s.on('tag:endpaginate',()=>s.stop()).on('template',x=>this.tpls.push(x)).on('end',()=>{throw new Error('pag')}); s.start(); }
  *render(ctx, emitter){ ctx.push({ paginate: ctx.getSync(['mock_paginate']) }); yield this.liquid.renderer.renderTemplates(this.tpls, ctx, emitter); ctx.pop(); } }
engine.registerTag('paginate', Paginate);
// Section settings fall back to the schema defaults, as on Shopify.
function schemaDefaults(type){ const src=fs.readFileSync(path.join(T,'sections',type+'.liquid'),'utf8'); const m=src.match(/{%\s*schema\s*%}([\s\S]*?){%\s*endschema\s*%}/); if(!m) return {}; const out={}; for (const s of JSON.parse(m[1]).settings||[]) if ('default' in s) out[s.id]=s.default; return out; }
async function renderSection(type, settings, ctx){ return engine.renderFile(type, { ...ctx, section: { id: type, settings: { ...schemaDefaults(type), ...settings } } }); }
class Sections extends Tag { constructor(t,r,l){ super(t,r,l); this.name=t.args.trim().replace(/'/g,''); }
  *render(ctx, emitter){ const g=JSON.parse(fs.readFileSync(path.join(T,'sections',this.name+'.json'))); for (const k of g.order){ const s=g.sections[k]; emitter.write(yield renderSection(s.type, s.settings||{}, ctx.getAll())); } } }
engine.registerTag('sections', Sections);

const thumbs = fs.readdirSync(path.join(T,'reference/original-thumbnails')).filter(f=>!f.includes('photo'));
const titles = {'mlr_square.gif':'Major League Reading','DarnItFeelsGoodToBeAnIowan-square.jpg':'Darn It Feels Good','RiverCityIowaMarchingBand_square.gif':'River City Marching Band','IowaYouLikeThis_square_1.gif':'You Like This','IowaTransplant_small.gif':'Iowa Transplant','howiroll_square.gif':'This Is How I Roll','MidWest_square.gif':'Midwest Heck Yes','Oh-The-Humanities_small.gif':'Oh, The Humanities!','redwheelbarrow_square.gif':'The Red Wheelbarrow'};
const order = Object.keys(titles);
let mediaId = 1;
const img = (f) => { const o = { id: mediaId++, src: `file://${T}/reference/original-thumbnails/${f}`, alt: '', media_type: 'image' }; o.preview_image = o; return o; };
const sizes = ['S','M','L','XL','XXL','Womens S','Womens M','Womens L','Womens XL'];
const mkProduct = (f, i) => { const variants = sizes.map((s,j)=>({ id: 1000+j, title:`Heather Blue / ${s}`, options:['Heather Blue', s], price: 2200, available: true }));
  return { title: titles[f], url: '#', featured_image: img(f), metafields: { custom: { thumbnail: { value: img(f) } } },
  ...(() => { const photo = img('majorleaguereading_photo.jpg'); return { featured_media: photo, media: [photo, img(f)] }; })(), has_only_default_variant: false,
  options_with_values: [{ name:'Color', values:['Heather Blue'], selected_value:'Heather Blue' }, { name:'Size', values:sizes, selected_value:'L' }],
  variants, selected_or_first_available_variant: { ...variants[2] },
  description: "<p>Because reading doesn't get rained out. Or require a wad of chaw.</p><p>Click here for the <a href=\"#\">Major League Reading sticker</a></p><p>-Royal Blue is in Men's and Women's<br>-Navy is in Kids</p>" }; };
const products = order.map(mkProduct);
const base = { shop: { name: 'Tshirt Booyah' }, routes: { root_url: '/', cart_url: '/cart', search_url: '/search' }, request: { locale: { iso_code: 'en' } }, settings: {}, content_for_header: '', canonical_url: '#', page_title: '', page_description: '',
  collections: { all: { products } }, mock_paginate: { pages: 2, current_page: 1, next: { url: '#' }, previous: null, parts: [{ title: 1, is_link: false }, { title: 2, is_link: true, url: '#' }] } };
const layout = fs.readFileSync(path.join(T,'layout/theme.liquid'),'utf8');
async function page(name, tplName, ctxExtra){
  const ctx = { ...base, ...ctxExtra, template: { name: tplName } };
  const t = JSON.parse(fs.readFileSync(path.join(T,'templates',name+'.json')));
  let body=''; for (const k of t.order){ const s=t.sections[k]; body += await renderSection(s.type, s.settings||{}, ctx); }
  const html = await engine.parseAndRender(layout, { ...ctx, content_for_layout: body });
  fs.writeFileSync(path.join(OUT, name+'.html'), html);
}
await page('index','index',{});
// A two-color product so the color/design pairs under the photo can be checked.
const twoColor = (() => {
  const p = products[0];
  const photo = { ...img('majorleaguereading_photo.jpg'), alt: 'Major League Reading t-shirt in Heather Blue' };
  const blackShirt = { ...img('howiroll_square.gif'), alt: 'Major League Reading t-shirt in Black' };
  const blackDesign = { ...img('MidWest_square.gif'), alt: 'Major League Reading design, Black' };
  [photo, blackShirt, blackDesign].forEach(m => { m.preview_image = m; });
  const colors = ['Heather Blue', 'Black', 'True Royal', 'Heather Dust', 'White', 'Athletic Heather'];
  const variants = colors.flatMap((c, ci) => ['S','M','L','XL','2XL','3XL'].map((s, j) => ({ id: 2000 + ci * 10 + j, title: `${c} / ${s}`, options: [c, s], price: 2200, available: true, featured_media: ci === 1 ? blackShirt : photo })));
  return { ...p, featured_media: photo, media: [photo, blackShirt, blackDesign], variants, selected_or_first_available_variant: variants[2],
    options_with_values: [{ name: 'Color', values: colors, selected_value: 'Heather Blue' }, { name: 'Size', values: ['S','M','L','XL','2XL','3XL'], selected_value: 'L' }], description: '<p>For the all-star reader. Printed on a soft Bella+Canvas 3001 unisex tee.</p>' };
})();
await page('product','product',{ product: twoColor });
await page('cart','cart',{ cart: { item_count: 2, total_price: 4400, items: [0,1].map(i=>({ url:'#', url_to_remove:'#', quantity:1, final_line_price:2200, product: products[i], options_with_values:[{name:'Color',value:'Heather Blue'},{name:'Size',value:'L'}] })) } });
console.log('ok');
