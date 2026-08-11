const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = Number(process.env.PORT) || 10000;

// Иницијализација на Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const SUBTITLECAT = 'https://subtitlecat.com';

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// Почетна страна
app.get('/', (req, res) => {
  res.type('text').send('SubtitleCat Serbian Latin Addon with Gemini is running successfully!');
});

// Stremio Manifest
app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'org.subtitlecat.serbianlatin.ai',
    version: '1.0.0',
    name: 'SubtitleCat Serbian (Gemini AI)',
    description: 'SubtitleCat subtitles automatically translated to Serbian Latin via Gemini AI',
    resources: ['subtitles'],
    types: ['movie', 'series'],
    idPrefixes: ['tt']
  });
});

// Функция за преведување со Gemini
// Подобрена функција за превод и принудна латиница со Gemini
async function translateToSerbian(subtitleText) {
  try {
    const prompt = `Ти си професионален преведувач на филмски титлови. 
Твоја задача е да го земеш следниов текст (SRT или VTT формат на титлови) и целосно да го преведеш или прилагодиш на СРПСКИ ЈАЗИК, со задолжителна СРПСКА ЛАТИНИЦА (експлицитно користи ги буквите č, ć, ž, š, đ).
ПРАВИЛА:
1. Задолжително задржи ги сите временски ознаки (timestamps како 00:01:20,123 --> 00:01:25,456), броевите на редовите и целокупното VTT/SRT форматирање апсолутно непроменето.
2. Преведувај или корегирај го само текстот на дијалозите.
3. Не додавај никакви воведни зборови или коментари од тебе, врати го само чистиот преведен титл.

Еве го текстот:
${subtitleText}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || subtitleText;
  } catch (error) {
    console.error('GEMINI ERROR:', error.message);
    return subtitleText;
  }
}

// Пребарување и враќање на линкови до Stremio (Оваа рута решава Cannot GET)
app.get('/subtitles/:type/:id.json', async (req, res) => {
  try {
    const id = req.params.id;
    const searchUrl = `${SUBTITLECAT}/index.php?search=${encodeURIComponent(id)}&show=1000`;
    
    const response = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const html = await response.text();

    const regex = /href=["']([^"']*\/subs\/[^"']+\.html)["']/gi;
    let match;
    const links = [];
    while ((match = regex.exec(html)) !== null) {
      const fullUrl = new URL(match[1], SUBTITLECAT).href;
      if (!links.includes(fullUrl)) links.push(fullUrl);
      if (links.length >= 5) break;
    }

    const host = req.get('host');
    const protocol = req.protocol;

    const subtitles = links.map((detailUrl, index) => ({
      id: `sub-srp-${index}`,
      url: `${protocol}://${host}/translate-sub?detailUrl=${encodeURIComponent(detailUrl)}`,
      lang: 'srp',
      label: '🇷🇸 Serbian Latin (Gemini AI)'
    }));

    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json({ subtitles });
  } catch (error) {
    console.error('ERROR:', error);
    res.json({ subtitles: [] });
  }
});

// Симнување, преведување со Gemini и праќање кон Stremio
app.get('/translate-sub', async (req, res) => {
  const detailUrl = req.query.detailUrl;
  if (!detailUrl) return res.status(400).send('Missing detailUrl');

  try {
    const response = await fetch(detailUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    if (!response.ok) throw new Error('Failed to fetch subtitle from source');
    
    let subtitleText = await response.text();
    const translatedText = await translateToSerbian(subtitleText);

    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(translatedText);
  } catch (error) {
    console.error('TRANSLATE ERROR:', error);
    res.status(500).send('Error translating subtitle');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running on port ${PORT}`);
});
