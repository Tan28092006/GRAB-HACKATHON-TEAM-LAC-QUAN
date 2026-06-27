const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User');
const connectDB = require('./db');

const seedUsers = async () => {
  await connectDB();

  try {
    // Clear existing users
    await User.deleteMany({});
    console.log('Cleared existing users');

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash('password123', salt);

    const mockUsers = [
      {
        full_name: 'Khách hàng 1',
        email: 'passenger1@grab.com',
        phone: '0901234567',
        password: passwordHash,
        role: 'passenger'
      },
      {
        full_name: 'Khách hàng 2',
        email: 'passenger2@grab.com',
        phone: '0902345678',
        password: passwordHash,
        role: 'passenger'
      },
      {
        full_name: 'Tài xế Nguyễn Văn A',
        email: 'driver1@grab.com',
        phone: '0912345678',
        password: passwordHash,
        role: 'driver'
      },
      {
        full_name: 'Tài xế Trần Thị B',
        email: 'driver2@grab.com',
        phone: '0913456789',
        password: passwordHash,
        role: 'driver'
      },
      {
        full_name: 'Admin User',
        email: 'admin@grab.com',
        phone: '0999999999',
        password: passwordHash,
        role: 'admin'
      }
    ];

    await User.insertMany(mockUsers);
    console.log('Mock users inserted successfully');
    
    // Log credentials for testing
    console.log('--- Test Credentials ---');
    console.log('Passenger 1: passenger1@grab.com / password123');
    console.log('Driver 1: driver1@grab.com / password123');
    console.log('------------------------');

    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
};

seedUsers();
