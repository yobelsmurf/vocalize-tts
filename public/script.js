const textInput = document.getElementById('text-input');
const countSpan = document.getElementById('count');
const languageSelect = document.getElementById('language-select');
const voiceSelect = document.getElementById('voice-select');
const rateSlider = document.getElementById('rate-slider');
const rateValue = document.getElementById('rate-value');
const pitchSlider = document.getElementById('pitch-slider');
const pitchValue = document.getElementById('pitch-value');
const playBtn = document.getElementById('play-btn');
const stopBtn = document.getElementById('stop-btn');
const downloadMp3Btn = document.getElementById('download-mp3-btn');
const downloadWavBtn = document.getElementById('download-wav-btn');
const statusMessage = document.getElementById('status-message');

let audioObj = null;

// Update char count
textInput.addEventListener('input', () => {
    countSpan.textContent = textInput.value.length;
});

// Update slider values
rateSlider.addEventListener('input', () => {
    rateValue.textContent = rateSlider.value + 'x';
});

pitchSlider.addEventListener('input', () => {
    pitchValue.textContent = pitchSlider.value;
});

const premiumVoiceSelect = document.getElementById('premium-voice-select');

// Play functionality (via Premium TTS Backend)
playBtn.addEventListener('click', () => {
    const text = textInput.value.trim();
    if (text === '') {
        showStatus('Please enter some text to read.', 'error');
        return;
    }

    showStatus('Loading voice...', 'success');
    if (audioObj) {
        audioObj.pause();
    }
    
    const voice = premiumVoiceSelect.value;
    const rateVal = parseFloat(rateSlider.value);
    const pitchVal = parseFloat(pitchSlider.value);
    const ratePercent = Math.round((rateVal - 1) * 100);
    const pitchPercent = Math.round((pitchVal - 1) * 50); // Scale pitch change slightly less extreme
    const rateStr = (ratePercent >= 0 ? '+' : '') + ratePercent + '%';
    const pitchStr = (pitchPercent >= 0 ? '+' : '') + pitchPercent + '%';
    const url = `/tts?voice=${voice}&text=${encodeURIComponent(text)}&rate=${encodeURIComponent(rateStr)}&pitch=${encodeURIComponent(pitchStr)}`;
    
    audioObj = new Audio(url);
    
    audioObj.onplay = () => {
        showStatus('Playing...', 'success');
        saveHistory(text, voice);
    };
    audioObj.onended = () => showStatus('');
    audioObj.onerror = () => showStatus('Error playing audio.', 'error');
    
    audioObj.play().catch(e => {
        console.error('Audio Play Error:', e);
        showStatus('Failed to play audio. Error: ' + e.message, 'error');
    });
});

// Stop functionality
stopBtn.addEventListener('click', () => {
    if (audioObj) {
        audioObj.pause();
        audioObj.currentTime = 0;
    }
    showStatus('Stopped.');
});

// Download functionality
downloadMp3Btn.addEventListener('click', () => downloadAudio('mp3'));
downloadWavBtn.addEventListener('click', () => downloadAudio('wav'));

async function downloadAudio(format) {
    const text = textInput.value.trim();
    if (text === '') {
        showStatus('Please enter some text to download.', 'error');
        return;
    }

    showStatus(`Preparing ${format.toUpperCase()} download using Premium Voice...`, 'success');
    
    const voice = premiumVoiceSelect.value;
    const rateVal = parseFloat(rateSlider.value);
    const pitchVal = parseFloat(pitchSlider.value);
    const ratePercent = Math.round((rateVal - 1) * 100);
    const pitchPercent = Math.round((pitchVal - 1) * 50);
    const rateStr = (ratePercent >= 0 ? '+' : '') + ratePercent + '%';
    const pitchStr = (pitchPercent >= 0 ? '+' : '') + pitchPercent + '%';
    
    try {
        saveHistory(text, voice);
        const url = `/tts?voice=${voice}&text=${encodeURIComponent(text)}&rate=${encodeURIComponent(rateStr)}&pitch=${encodeURIComponent(pitchStr)}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorMsg = await response.text();
            throw new Error(errorMsg || 'Network response was not ok');
        }
        
        let finalBlob = await response.blob();
        
        if (format === 'wav') {
            showStatus('Converting to WAV...', 'success');
            const arrayBuffer = await finalBlob.arrayBuffer();
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            finalBlob = audioBufferToWav(audioBuffer);
        }
        
        const urlObj = URL.createObjectURL(finalBlob);
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = urlObj;
        a.download = `Vocalize_Premium_${voice}_${new Date().getTime()}.${format}`;
        document.body.appendChild(a);
        a.click();
        
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(urlObj);
        }, 100);
        
        showStatus(`${format.toUpperCase()} Download started!`, 'success');
        
    } catch (error) {
        console.error('Download Error:', error);
        showStatus('Failed to download audio. Error: ' + error.message, 'error');
    }
}

function audioBufferToWav(buffer) {
    let numOfChan = buffer.numberOfChannels,
        length = buffer.length * numOfChan * 2 + 44,
        bufferArr = new ArrayBuffer(length),
        view = new DataView(bufferArr),
        channels = [], i, sample,
        offset = 0,
        pos = 0;

    function setUint16(data) {
        view.setUint16(offset, data, true);
        offset += 2;
    }

    function setUint32(data) {
        view.setUint32(offset, data, true);
        offset += 4;
    }

    setUint32(0x46464952);                         // "RIFF"
    setUint32(length - 8);                         // file length - 8
    setUint32(0x45564157);                         // "WAVE"
    setUint32(0x20746d66);                         // "fmt " chunk
    setUint32(16);                                 // length = 16
    setUint16(1);                                  // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);  // avg. bytes/sec
    setUint16(numOfChan * 2);                      // block-align
    setUint16(16);                                 // 16-bit (hardcoded)
    setUint32(0x61746164);                         // "data" - chunk
    setUint32(length - pos - 4);                   // chunk length

    for(i = 0; i < buffer.numberOfChannels; i++)
        channels.push(buffer.getChannelData(i));

    while(pos < buffer.length) {
        for(i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][pos]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0;
            view.setInt16(offset, sample, true);
            offset += 2;
        }
        pos++;
    }

    return new Blob([bufferArr], {type: "audio/wav"});
}

function showStatus(msg, type = '') {
    statusMessage.textContent = msg;
    statusMessage.className = 'status-message ' + type;
}

// History Functionality
const historyList = document.getElementById('history-list');
const clearHistoryBtn = document.getElementById('clear-history-btn');

function loadHistory() {
    const history = JSON.parse(localStorage.getItem('ttsHistory') || '[]');
    historyList.innerHTML = '';
    
    if (history.length === 0) {
        historyList.innerHTML = '<li class="history-empty">No history yet. Convert some text to see it here!</li>';
        return;
    }
    
    history.forEach((item) => {
        const li = document.createElement('li');
        li.className = 'history-item';
        
        li.innerHTML = `
            <div style="max-width: 80%;">
                <div class="history-item-text">${item.text}</div>
                <div class="history-item-meta">${item.voice} • ${new Date(item.timestamp).toLocaleString()}</div>
            </div>
            <div>
                <button class="btn btn-primary" style="padding: 0.5rem; font-size: 0.8rem;" title="Restore">
                    <i class="fa-solid fa-rotate-left"></i>
                </button>
            </div>
        `;
        
        li.querySelector('button').addEventListener('click', (e) => {
            e.stopPropagation();
            textInput.value = item.text;
            premiumVoiceSelect.value = item.voice;
            textInput.dispatchEvent(new Event('input'));
            showStatus('Text restored from history', 'success');
        });
        
        historyList.appendChild(li);
    });
}

function saveHistory(text, voice) {
    let history = JSON.parse(localStorage.getItem('ttsHistory') || '[]');
    history.unshift({ text, voice, timestamp: Date.now() });
    if (history.length > 20) history.pop(); // Keep only last 20
    localStorage.setItem('ttsHistory', JSON.stringify(history));
    loadHistory();
}

clearHistoryBtn.addEventListener('click', () => {
    localStorage.removeItem('ttsHistory');
    loadHistory();
});

// Run loadHistory on startup
loadHistory();
