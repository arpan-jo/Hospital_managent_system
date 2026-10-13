import CryptoJS from 'crypto-js';
import { API_ENCRYPTION_KEY as DEFAULT_API_KEY } from '@env';

export let API_ENCRYPTION_KEY = DEFAULT_API_KEY || '';

export const setEncryptionKey = (key: string): void => {
  API_ENCRYPTION_KEY = key;
};

const getCryptoKey = (key: string) => {
  return CryptoJS.enc.Utf8.parse(key);
};

const getCryptoIV = (key: string) => {
  return CryptoJS.enc.Utf8.parse(key);
};

export const encryptData = (
  data: any,
  key: string = API_ENCRYPTION_KEY,
): string => {
  if (!key) {
    throw new Error(
      'Encryption key is not set. Call setEncryptionKey() before encrypting.',
    );
  }

  const plainText = typeof data === 'string' ? data : JSON.stringify(data);

  const cryptoKey = getCryptoKey(key);
  const iv = getCryptoIV(key);

  return CryptoJS.AES.encrypt(plainText, cryptoKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  }).toString();
};

export const decryptData = (
  ciphertext: string,
  key: string = API_ENCRYPTION_KEY,
): any => {
  if (!key) {
    throw new Error(
      'Encryption key is not set. Call setEncryptionKey() before decrypting.',
    );
  }

  if (!ciphertext) {
    return '';
  }

  const cryptoKey = getCryptoKey(key);
  const iv = getCryptoIV(key);

  const bytes = CryptoJS.AES.decrypt(ciphertext, cryptoKey, {
    iv,
    mode: CryptoJS.mode.CBC,
    padding: CryptoJS.pad.Pkcs7,
  });

  const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

  if (!decryptedText) {
    throw new Error(
      'Unable to decrypt data. Please check the encryption key and ciphertext.',
    );
  }

  try {
    return JSON.parse(decryptedText);
  } catch {
    return decryptedText;
  }
};
