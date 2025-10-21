#!/usr/bin/env node
/**
 * Helper script to generate SHA-256 hashes for emails
 * Usage: node generate-hash.js email@example.com
 */

const crypto = require('node:crypto');

const email = process.argv[2];

if (!email) {
  console.error('Usage: node generate-hash.js email@example.com');
  process.exit(1);
}

const normalized = email.toLowerCase().trim();
const hash = crypto.createHash('sha256').update(normalized).digest('hex');

console.log('\n🔐 Email Hash Generated\n');
console.log('Email:  ', normalized);
console.log('Hash:   ', hash);
console.log('\nAdd this hash to allowed-emails.json\n');
