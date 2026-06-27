const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

// Assuming db.js and User.js are already created from the previous steps
const connectDB = require('./db');
const User = require('./models/User');

const seedFromCsv = async () => {
  // 1. Connect to the database
  await connectDB();

  const results = [];
  
  // 2. Read the CSV file
  fs.createReadStream(path.join(__dirname, 'mock_users.csv'))
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      try {
        console.log(`Parsed ${results.length} users from CSV. Inserting to MongoDB...`);
        
        // 3. Clear existing users to avoid duplicates (optional but good for seeding)
        await User.deleteMany({});
        console.log('Cleared existing users.');

        // 4. Process and hash passwords for each user
        const usersToInsert = await Promise.all(results.map(async (user) => {
          // Generate a salt and hash the password
          const salt = await bcrypt.genSalt(10);
          const hashedPassword = await bcrypt.hash(user.password, salt);

          return {
            full_name: user.full_name,
            email: user.email,
            phone: user.phone,
            password: hashedPassword,
            role: user.role,
            total_reward_points: parseInt(user.total_reward_points) || 0
          };
        }));

        // 5. Insert into MongoDB
        await User.insertMany(usersToInsert);
        console.log('Successfully inserted users from CSV into the database.');
        
        // Close the connection and exit
        mongoose.connection.close();
        process.exit(0);
      } catch (error) {
        console.error('Error inserting users:', error);
        mongoose.connection.close();
        process.exit(1);
      }
    });
};

seedFromCsv();
