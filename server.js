const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = Number(process.env.PORT) || 10000;

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

app.get('/', (req, res) => {
  res.type('text').send('SubtitleCat Serbian Latin Addon with Cinemeta Search is running.');
});

app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'org.subtitlecat.serbianlatin.ai',
    version: '3.1.0',
    name: 'SubtitleCat Serbian (Gemini AI)',
    description: 'Automatic SubtitleCat to Serbian Latin translation via Gemini AI',
    resources: ['subtitles'],
    types: ['movie', 'series'],
    idPrefixes: ['tt']
  });
});

// Функција за строг превод на српска латиница
async function translateToSerbian(subtitleText) {
  try {
    const prompt = `Ти си професионален преведувач на титлови. Преведи го или прилагоди го следниов текст (SRT/VTT формат) исклучиво на СРПСКА ЛАТИНИЦА (со користење на карактерите č, ć, ž, š, đ).
ПРАВИЛА:
1. Задолжително задржи ги сите временски ознаки (timestamps како 00:01:20,123 --> 00:01:25,456) и броевите на редовите апсолутно непроменети.
2. Не додавај воведни зборови, коментари или објаснувања, врати само чист преведен титл.

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

// Главна рута за пребарување преку Cinemeta име и SubtitleCat
app.get('/subtitles/:type/:id.json', async (req, res) => {
  try {
    const { type, id } = req.params;
    console.log(`STREMIO REQUEST: ${type} ${id}`);

    // 1. Земи ги метаподатоците од Cinemeta (наслов и година) за да знаеме што точно пребаруваме
    const metaUrl = `https://v3-cinemeta.strem.io/meta/${type}/${id}.json`;
    const metaRes = await fetch(metaUrl);
    const metaData = await metaRes.json();
    
    let searchQueries = [];
    if (metaData && metaData.meta) {
      const title = metaData.meta.name;
      const year = metaData.meta.year ? metaData.meta.year.toString().substring(0, 4) : '';
      if (title && year) searchQueries.push(`${title} ${year}`);
      if (title) searchQueries.push(title);
    }
    // Резервна опција ако Cinemeta нема податоци
    if (searchQueries.length === 0) {
      searchQueries.push(id);
    }

    console.log('SEARCH QUERIES:', searchQueries);

    let links = [];
    for (const q of searchQueries) {
      const searchUrl = `${SUBTITLECAT}/index.php?search=${encodeURIComponent(q)}&show=1000`;
      const subRes = await fetch(searchUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      const html = await subRes.text();

      // Извлекување на линковите кон титловите од HTML одговорот
      const regex = /href=["']([^"']*\/subs\/[^"']+\.html)["']/gi;
      let match;
      while ((match = regex.exec(html)) !== null) {
        const fullUrl = new URL(match[1], SUBTITLECAT).href;
        if (!links.includes(fullUrl)) links.push(fullUrl);
        if (links.length >= 5) break;
      }
      if (links.length > 0) break;
    }

    console.log('SUBTITLES FOUND:', links.length);

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
    console.error('SUBTITLES ERROR:', error);
    res.json({ subtitles: [] });
  }
});

// Рута за симнување и преведување на конкретниот фајл
app.get('/translate-sub', async (req, res) => {
  const detailUrl = req.query.detailUrl;
  if (!detailUrl) return res.status(400).send('Missing detailUrl');

  try {
    const response = await fetch(detailUrl, { headers: { 'User-Agent': 'Mozilla/5.0' }, redirect: 'follow' });
    if (!response.ok) throw new Error('Failed to fetch subtitle page');
    
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
  console.log(`SubtitleCat Serbian Latin addon running on port ${PORT}`);
});
