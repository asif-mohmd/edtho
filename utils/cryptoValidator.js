const crypto = require("crypto");
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

module.exports = {
  cryptoEncrypt,
  cryptoDecrypt,
};
