// Wraps the generated paths into the artifact page.
const fs = require('fs');
const { out, grat, outline, front, pts } = JSON.parse(fs.readFileSync('paths.json', 'utf8'));

const MINORS = ['skeld', 'jutland', 'crown', 'terra', 'alps', 'hesperia', 'austra', 'illyria', 'raska', 'dacia', 'moesia'];
const order = ['other', 'castaliaCol', 'solmereCol', 'wiranCol', ...MINORS, 'castalia', 'tisa', 'steppe', 'solmere', 'strait', 'wiran', 'walde'];
const cls = k => (MINORS.includes(k) ? 'minor' : k);
const shapes = order.filter(k => out[k]).map(k => `<path class="land st-${cls(k)}" d="${out[k]}"/>`).join('\n');

const t = (k, text, c, dy = 0) => `<text class="${c}" x="${pts[k][0]}" y="${pts[k][1] + dy}" text-anchor="middle">${text}</text>`;
const dot = (k, text, anchor, dx, dy) =>
  `<circle class="city" cx="${pts[k][0]}" cy="${pts[k][1]}" r="3.2"/><text class="city-l" x="${pts[k][0] + dx}" y="${pts[k][1] + dy}" text-anchor="${anchor}">${text}</text>`;

const labels = [
  t('walde', '霍恩瓦尔德帝国', 'lb big'), t('strait', '米克拉加德帝国', 'lb big'), t('strait2', '米克拉加德', 'lb sm'),
  t('wiran', '维兰共和国', 'lb big'), t('solmere', '索尔梅尔', 'lb big'), t('steppe', '斯捷普帝国', 'lb big'),
  t('castalia', '卡斯塔利亚', 'lb mid'), t('castalia', '中立', 'tag', 14), t('tisa', '蒂萨利亚', 'lb mid'), t('tisa', '中立', 'tag', 14),
  t('skeld', '斯凯尔德', 'lb sm'), t('jutland', '约特', 'lb sm'), t('crown', '北冠联合王国', 'lb sm'),
  t('terra', '泰拉', 'lb sm'), t('alps', '高阿尔卑', 'lb sm'), t('hesperia', '埃斯佩里亚', 'lb sm'), t('austra', '奥斯特拉', 'lb sm'),
  t('illyria', '伊利里亚', 'lb sm'), t('raska', '拉斯卡', 'lb sm'), t('dacia', '达基亚', 'lb sm'), t('moesia', '默西亚', 'lb sm'),
  t('wiranColA', '维兰殖民地', 'col'), t('wiranColC', '维兰殖民地', 'col'), t('wiranColB', '维兰殖民地', 'col'), t('solmereColA', '索尔梅尔殖民地', 'col'),
  t('solmereColB', '索尔梅尔殖民地', 'col'), t('castaliaCol', '卡斯塔利亚殖民地', 'col'),
  dot('lutece', '吕泰斯', 'end', -7, 4), dot('hennlet', '亨莱特', 'start', 7, 12), dot('capital', '帝都', 'start', 7, 4),
  `<circle class="ring" cx="${pts.strait_m[0]}" cy="${pts.strait_m[1]}" r="9"/><text class="mark-l" x="${pts.strait_m[0] + 12}" y="${pts.strait_m[1] - 9}">海峡</text>`,
  `<path class="x" d="M${pts.front_m[0] - 7} ${pts.front_m[1] - 7} L${pts.front_m[0] + 7} ${pts.front_m[1] + 7} M${pts.front_m[0] + 7} ${pts.front_m[1] - 7} L${pts.front_m[0] - 7} ${pts.front_m[1] + 7}"/>`,
  `<text class="mark-l" x="${pts.front_m[0] - 11}" y="${pts.front_m[1] + 4}" text-anchor="end">本卷战场</text>`,
].join('\n');

const svg = `<svg viewBox="0 0 1000 860" role="img" aria-label="虚构的 1915 年春欧洲列国图：霍恩瓦尔德帝国居中，米克拉加德帝国据守海峡与希腊，维兰、索尔梅尔、斯捷普分列西、北、东，卡斯塔利亚与蒂萨利亚中立">
<defs><clipPath id="frame"><path d="${outline}"/></clipPath></defs>
<path class="sea" d="${outline}"/>
<g clip-path="url(#frame)">
<path class="grat" d="${grat}"/>
${shapes}
<path class="front" d="${front}"/>
</g>
${labels}
</svg>`;

const page = fs.readFileSync('template.html', 'utf8').replace('<!--SVG-->', svg);
fs.writeFileSync('map.html', page);
console.log('bytes', page.length);
