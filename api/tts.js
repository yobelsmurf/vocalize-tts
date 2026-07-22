const { EdgeTTS } = require('node-edge-tts');
const path = require('path');
const fs = require('fs');

module.exports = async (req, res) => {
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
        
        // Vercel Serverless Functions can only write to /tmp
        const tempPath = path.join('/tmp', `tts_${Date.now()}.mp3`);
        
        await tts.ttsPromise(text, tempPath);
        
        // Read file and send as response
        const audioData = fs.readFileSync(tempPath);
        res.setHeader('Content-Type', 'audio/mpeg');
        res.send(audioData);
        
        // Clean up
        fs.unlinkSync(tempPath);
    } catch (error) {
        console.error('TTS Error:', error);
        res.status(500).send('Error generating TTS');
    }
};
