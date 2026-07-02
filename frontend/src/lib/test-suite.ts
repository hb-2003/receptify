import assert from 'assert';
import { encrypt, decrypt } from './crypto';
import { getDB } from './db/data-source';
import { User } from './db/entities/User';
import { Campaign } from './db/entities/Campaign';
import { Call } from './db/entities/Call';

// Tiny custom test runner to avoid importing a full framework.
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m',
};

async function test(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`  ${colors.green}✓${colors.reset} ${name}`);
  } catch (err: any) {
    console.error(`  ${colors.red}✗${colors.reset} ${name}`);
    console.error(`    ${colors.red}Error: ${err.message}${colors.reset}`);
    process.exit(1);
  }
}

async function runTestSuite() {
  console.log(`${colors.bold}=== Receptify Test Suite ===${colors.reset}\n`);

  // --- CRYPTO UTILITIES TESTS ---
  console.log(`${colors.bold}--- Cryptography (crypto.ts) ---${colors.reset}`);

  await test('Crypto Encrypt & Decrypt matches input', async () => {
    const original = 'TW1234567890abcdef1234567890abcdef';
    const encrypted = encrypt(original);
    assert.notStrictEqual(original, encrypted, 'Ciphertext must not match plaintext');
    
    const decrypted = decrypt(encrypted);
    assert.strictEqual(original, decrypted, 'Decrypted value must match original');
  });

  await test('Crypto decrypt fails if ciphertext is tampered', async () => {
    const original = 'TW1234567890abcdef1234567890abcdef';
    const encrypted = encrypt(original);
    const parts = encrypted.split(':');
    
    // Tamper with the encrypted ciphertext part (part 3)
    parts[2] = parts[2].substring(0, parts[2].length - 2) + '00';
    const tampered = parts.join(':');

    assert.throws(() => {
      decrypt(tampered);
    }, /Unsupported state|unable to authenticate|bad decrypt|packet decrypt|tag decrypt/, 'Should throw decipher tag error if data is tampered');
  });

  await test('Crypto getEncryptionKey throws error in production mode if ENCRYPTION_KEY is missing', async () => {
    const originalKey = process.env.ENCRYPTION_KEY;
    const originalNodeEnv = process.env.NODE_ENV;
    const mutableEnv = process.env as Record<string, string | undefined>;

    try {
      delete process.env.ENCRYPTION_KEY;
      mutableEnv['NODE_ENV'] = 'production';
      
      assert.throws(() => {
        encrypt('test');
      }, /ENCRYPTION_KEY environment variable is required in production/, 'Should throw missing key error in production');
    } finally {
      // Restore
      mutableEnv['ENCRYPTION_KEY'] = originalKey;
      mutableEnv['NODE_ENV'] = originalNodeEnv;
    }
  });


  // --- API INTEGRATION TESTS ---
  console.log(`\n${colors.bold}--- API Integration Tests ---${colors.reset}`);

  await test('Database Connection verification', async () => {
    const database = await getDB();
    assert.strictEqual(database.isInitialized, true, 'TypeORM database should initialize and connect successfully');
    
    const userRepo = database.getRepository(User);
    const userCount = await userRepo.count();
    console.log(`    Database contains ${userCount} users.`);
    assert.ok(userCount >= 0);
  });

  console.log(`\n${colors.green}${colors.bold}ALL TESTS PASSED SUCCESSFULLY!${colors.reset}`);
}

runTestSuite().catch((err) => {
  console.error('Test suite failed catastrophically:', err);
  process.exit(1);
});
