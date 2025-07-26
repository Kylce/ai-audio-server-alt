
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(fileUpload());

app.post('/analyze', async (req, res) => {
  try {
    if (!req.files || !req.files.audio) {
      return res.status(400).json({ error: 'لم يتم رفع ملف صوتي.' });
    }

    const audio = req.files.audio;
    const buffer = audio.data;

    // تحويل الصوت إلى نص عبر HuggingFace (Whisper)
    const transcriptionResponse = await fetch("https://api-inference.huggingface.co/models/openai/whisper-large", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "audio/wav"
      },
      body: buffer
    });

    const transcriptionData = await transcriptionResponse.json();
    const transcript = typeof transcriptionData === 'string' ? transcriptionData : transcriptionData.text;

    if (!transcript) {
      return res.status(500).json({ error: 'لم يتم استخراج النص من الصوت.' });
    }

    // إرسال النص إلى Mistral عبر OpenRouter
    const analysisResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "mistralai/mistral-7b-instruct",
        messages: [
          { role: "system", content: "أنت مساعد طبي تحلل الأصوات وتستنتج الحالة الصحية الصوتية." },
          { role: "user", content: `النص المستخرج من التسجيل هو:
${transcript}

قم بتحليل الحالة بناءً على هذا النص من حيث النطق وجودة الصوت والتوصيات الممكنة.` }
        ]
      })
    });

    const analysisData = await analysisResponse.json();
    const analysis = analysisData.choices?.[0]?.message?.content || "لم يتم إرجاع تحليل.";

    res.json({ text: transcript, analysis });

  } catch (err) {
    console.error("❌ خطأ في التحليل:", err);
    res.status(500).json({ error: "حدث خطأ أثناء تحليل الصوت." });
  }
});

app.listen(PORT, () => {
  console.log(`✅ الخادم يعمل على http://localhost:${PORT}`);
});
