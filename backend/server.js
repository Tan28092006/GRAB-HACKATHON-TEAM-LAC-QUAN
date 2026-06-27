const express = require('express');
const cors = require('cors');
const http = require('http');
const { Server } = require('socket.io');
require('dotenv').config();

const connectDB = require('./db');
const authRoutes = require('./routes/auth');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust in production
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB();

app.use(cors());
app.use(express.json());

// Auth routes
app.use('/api/auth', authRoutes);

// State to track waiting passengers and active trips
// In a production app, use Redis or MongoDB for this
const waitingPassengers = {}; // socketId -> userId
let activeTrip = null; // { pin, driverId, passengerId, driverName, passengerName, licensePlate }

const generatePin = () => {
  return Math.floor(1000 + Math.random() * 9000).toString();
};

io.on('connection', (socket) => {
  console.log('A user connected:', socket.id);

  socket.on('passenger-waiting', async (data) => {
    const { userId } = data;
    console.log(`Passenger ${userId} is waiting. Socket: ${socket.id}`);
    waitingPassengers[socket.id] = userId;
  });

  socket.on('driver-start', async (data) => {
    const { userId } = data;
    console.log(`Driver ${userId} started. Socket: ${socket.id}`);
    
    try {
      const driver = await User.findById(userId);
      if (!driver) return;

      // Find the first waiting passenger
      const waitingSocketIds = Object.keys(waitingPassengers);
      if (waitingSocketIds.length > 0) {
        const passengerSocketId = waitingSocketIds[0];
        const passengerUserId = waitingPassengers[passengerSocketId];
        const passenger = await User.findById(passengerUserId);

        // Create a new trip session
        activeTrip = {
          pin: generatePin(),
          driverId: userId,
          passengerId: passengerUserId,
          driverName: driver.full_name,
          passengerName: passenger.full_name,
          licensePlate: '51G-' + Math.floor(1000 + Math.random() * 9000) // Mock license plate
        };

        // Notify passenger
        io.to(passengerSocketId).emit('driver-arrived', {
          driverName: activeTrip.driverName,
          licensePlate: activeTrip.licensePlate,
          pin: activeTrip.pin
        });

        // Notify driver
        socket.emit('pin-display', {
          passengerName: activeTrip.passengerName
        });

        // Remove from waiting queue
        delete waitingPassengers[passengerSocketId];
      }
    } catch (err) {
      console.error('Error starting driver:', err);
    }
  });

  socket.on('verify-pin', (data) => {
    const { pin } = data;
    
    if (activeTrip && activeTrip.pin === pin) {
      console.log('PIN verified successfully');
      io.emit('pin-verified', { success: true, message: 'PIN verified successfully' });
      activeTrip = null; // Reset trip after success
    } else {
      console.log('Invalid PIN attempt');
      socket.emit('pin-failed', { success: false, message: 'Invalid PIN' });
    }
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (waitingPassengers[socket.id]) {
      delete waitingPassengers[socket.id];
    }
  });
});

// GET /api/trip - Fetch current trip details (kept for backward compatibility during transition if needed)
app.get('/api/trip', (req, res) => {
  if (activeTrip) {
    res.json({
      success: true,
      data: {
        pin: activeTrip.pin,
        driver_name: activeTrip.driverName,
        passenger_name: activeTrip.passengerName,
        license_plate: activeTrip.licensePlate
      }
    });
  } else {
    res.json({
      success: false,
      message: 'No active trip'
    });
  }
});

server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
