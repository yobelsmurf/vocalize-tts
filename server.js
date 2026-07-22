const express = require('express');
const { EdgeTTS } = require('node-edge-tts');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = 3000;

app.use(express.static('.'));

app.get('/tts', async (req, res) => {
    const text = req.query.text;
    const voice = req.query.voice || 'id-ID-GadisNeural';
    const rate = req.query.rate || '+0%';
    const pitch = req.query.pitch || '+0%';
    
    if (!text) {
        return res.status(400).send('Missing text parameter');
    }
    
    try {
        const tts = new EdgeTTS({
            voice: voice,
            lang: voice.substring(0, 5),
            rate: rate,
            pitch: pitch
        });
        
        // Write to temporary file
        const tempPath = path.join(os.tmpdir(), `tts-${Date.now()}-${Math.random().toString(36).substring(7)}.mp3`);
        await tts.ttsPromise(text, tempPath);
        
        // Stream the file back
        res.setHeader('Content-Type', 'audio/mpeg');
        res.setHeader('Access-Control-Allow-Origin', '*');
        const readStream = fs.createReadStream(tempPath);
        readStream.pipe(res);
        
        readStream.on('close', () => {
            // Cleanup temp file
            fs.unlink(tempPath, () => {});
        });
    } catch (err) {
        console.error('Edge TTS Error:', err);
        res.status(500).send(err.message);
    }
});

app.listen(PORT, () => {
    console.log(`Express server with Edge TTS running at http://localhost:${PORT}/`);
});
