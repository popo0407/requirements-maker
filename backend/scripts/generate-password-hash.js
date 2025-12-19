#!/usr/bin/env node

/**
 * Password Hash Generator
 * 
 * Generates bcrypt password hashes for use in database migrations and user creation.
 * 
 * Usage:
 *   node generate-password-hash.js <password>
 * 
 * Example:
 *   node generate-password-hash.js mySecurePassword123
 */

const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

async function generateHash(password) {
  if (!password) {
    console.error('Error: Password argument is required');
    console.error('Usage: node generate-password-hash.js <password>');
    process.exit(1);
  }

  try {
    const hash = await bcrypt.hash(password, SALT_ROUNDS);
    console.log('\nPassword Hash Generated:');
    console.log('========================');
    console.log(hash);
    console.log('\nUse this hash in your SQL INSERT statement:');
    console.log(`INSERT INTO users (email, name, password_hash) VALUES ('user@example.com', 'User Name', '${hash}');`);
    console.log('\n');
  } catch (error) {
    console.error('Error generating hash:', error.message);
    process.exit(1);
  }
}

const password = process.argv[2];
generateHash(password);
