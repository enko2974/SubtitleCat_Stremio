const express = require('express');
const { GoogleGenAI } = require('@google/genai');

const app = express();
const PORT = Number(process.env.PORT) || 10000;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

app.disable('x-powered-by');

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.get('/', (req, res) => {
  res.type('text').send('SubtitleCat Serbian AI Addon is active.');
});

app.get('/manifest.json', (req, res) => {
  res.json({
    id: 'org.subtitlecat.serbianlatin.ai',
    version: '2.0.0',
    name: 'SubtitleCat Serbian (Gemini AI)',
    description: 'Direct SubtitleCat subtitles translated to Serbian Latin via Gemini AI',
    resources: ['subtitles'],
    types: ['movie', 'series'],
    idPrefixes: ['tt']
  });
});

async function translateToSerbian(subtitleText) {
  try {
    const prompt = `Ти си професионален преведувач. Преведи или прилагоди го следниов текстуален титл (VTT/SRT формат) на СРПСКИ ЈАЗИK, исклучиво на СРПСКА ЛАТИНИЦА (со карактерите č, ć, ž, š, đ).
ПРАВИЛА:
1. Задолжително задржи ги сите временски ознаки (timestamps како 00:01:20,123 --> 00:01:25,456) и броевите на редовите апсолутно непроменети.
2. Не додавај воведни зборови или коментари, врати само чист преведен титл.

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

app.get('/subtitles/:type/:id.json', async (req, res) => {
  const id = req.params.id; // на пример tt0133093
  const host = req.get('host');
  const protocol = req.protocol;

  // Директно креираме линк кон англискиот превод на SubtitleCat кој сигурно постои за IMDb ID-то
  const subSourceUrl = `https://subtitle-cat.com/subs/${id}/en.vtt`;

  const subtitles = [
    {
      id: `sub-gemini-${id}`,
      url: `${protocol}://${host}/translate-sub?url=${encodeURIComponent(subSourceUrl)}`,
      lang: 'srp',
      label: '🇷🇸 Serbian Latin (Gemini AI)'
    }
  ];

  res.setHeader('Cache-Control', 'public, max-age=300');
  res.json({ subtitles });
});

app.get('/translate-sub', async (req, res) => {
  const subUrl = req.query.url;
  if (!subUrl) return res.status(400).send('Missing url');

  try {
    const response = await fetch(subUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    
    if (!response.ok) {
      // Ако англискиот го нема под en.vtt, враќаме празен фајл за да не закочи Stremio
      return res.status(404).send('Subtitle not found on source');
    }

    let subtitleText = await response.text();
    const translatedText = await translateToSerbian(subtitleText);

    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.send(translatedText);
  } catch (error) {
    console.error('TRANSLATE ERROR:', error);
    res.status(500).send('Error processing subtitle');
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
