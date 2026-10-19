require('dotenv').config();
const User = require('./src/models/User');

async function createAdmin() {
  try {
    const admin = await User.create({
      username: 'admin',
      email: 'admin@jnvspectra.com',
      password: 'admin123',
      role: 'admin',
    });
    console.log('Admin user created:', admin);
  } catch (error) {
    console.error('Error creating admin:', error);
  }
}

createAdmin();
