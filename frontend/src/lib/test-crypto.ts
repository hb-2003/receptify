import { encrypt, decrypt } from './crypto';

console.log('Testing encryption/decryption...');
const secret = 'receptify_test_secret_32_bytes_long_keys_123';
const encrypted = encrypt(secret);
console.log('Encrypted:', encrypted);
const decrypted = decrypt(encrypted);
console.log('Decrypted:', decrypted);

if (secret === decrypted) {
  console.log('SUCCESS: Decrypted value matches secret!');
} else {
  console.error('FAILURE: Decrypted value does not match secret.');
  process.exit(1);
}
