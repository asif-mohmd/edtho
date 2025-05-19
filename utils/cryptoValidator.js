const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { CRYPTO_IV, CRYPTO_ACCESS_TOKEN_KEY } = require("../config/envVariable");

const algorithm = "aes-256-cbc";

const key = Buffer.from(CRYPTO_ACCESS_TOKEN_KEY, "hex"); // 32 bytes for AES-256
const iv = Buffer.from(CRYPTO_IV, "hex"); // 16 bytes for AES

const cryptoEncrypt = async (data) => {
  try {
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(data), "utf8", "hex");
    encrypted += cipher.final("hex");
    return encrypted;
  } catch (error) {
    console.log("Error in cryptoEncrypt", error);

    throw new Error();
  }
};

const cryptoDecrypt = async (data) => {
  try {
    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(data, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return JSON.parse(decrypted); // Parse the decrypted string back to an object
  } catch (error) {
    console.log("Error in cryptoEncrypt", error);

    throw new Error();
  }
};

// Constants for password hashing
const SALT_ROUNDS = 12; // Increased from 10 for better security
const MIN_PASSWORD_LENGTH = 8;

/**
 * Hash a password using bcrypt
 * @param {string} password - The password to hash
 * @returns {Promise<string>} The hashed password
 */
async function hashPassword(password) {
  if (!password || typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
    throw new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  try {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return await bcrypt.hash(password, salt);
  } catch (error) {
    throw new Error('Error hashing password');
  }
}

/**
 * Compare a password with a hash
 * @param {string} password - The password to check
 * @param {string} hash - The hash to compare against
 * @returns {Promise<boolean>} Whether the password matches
 */
async function comparePassword(password, hash) {
  if (!password || !hash) {
    return false;
  }

  try {
    return await bcrypt.compare(password, hash);
  } catch (error) {
    throw new Error('Error comparing passwords');
  }
}

/**
 * Validate password strength
 * @param {string} password - The password to validate
 * @returns {Object} Validation result
 */
function validatePasswordStrength(password) {
  if (!password || typeof password !== 'string') {
    return {
      valid: false,
      message: 'Password is required'
    };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters long`
    };
  }

  // Check for at least one number
  if (!/\d/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one number'
    };
  }

  // Check for at least one uppercase letter
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter'
    };
  }

  // Check for at least one lowercase letter
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one lowercase letter'
    };
  }

  // Check for at least one special character
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one special character'
    };
  }

  return {
    valid: true,
    message: 'Password is strong'
  };
}

module.exports = {
  cryptoEncrypt,
  cryptoDecrypt,
  hashPassword,
  comparePassword,
  validatePasswordStrength
};
