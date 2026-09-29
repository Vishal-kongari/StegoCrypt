const encoder = new TextEncoder();
const decoder = new TextDecoder();

function concat(...parts: Uint8Array[]) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) { output.set(part, offset); offset += part.length; }
  return output;
}

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary);
}

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

export type EncryptedPayload = {
  version: 'SC1';
  salt: string;
  iv: string;
  ciphertext: string;
};

export async function deriveKey(password: string, salt: Uint8Array) {
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveKey']);
  const saltBuffer = salt.buffer.slice(salt.byteOffset, salt.byteOffset + salt.byteLength) as ArrayBuffer;
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBuffer, iterations: 120_000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export async function encryptMessage(message: string, password: string): Promise<Uint8Array> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoder.encode(message)));
  const envelope: EncryptedPayload = { version: 'SC1', salt: bytesToBase64(salt), iv: bytesToBase64(iv), ciphertext: bytesToBase64(encrypted) };
  return encoder.encode(JSON.stringify(envelope));
}

export async function decryptMessage(payload: Uint8Array, password: string) {
  const envelope = JSON.parse(decoder.decode(payload)) as EncryptedPayload;
  if (envelope.version !== 'SC1') throw new Error('Unsupported StegoCrypt payload.');
  const salt = base64ToBytes(envelope.salt);
  const iv = base64ToBytes(envelope.iv);
  const key = await deriveKey(password, salt);
  const clear = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, base64ToBytes(envelope.ciphertext));
  return decoder.decode(clear);
}

export function packPayload(data: Uint8Array) {
  const length = new Uint8Array(4);
  new DataView(length.buffer).setUint32(0, data.length);
  return concat(new TextEncoder().encode('SC01'), length, data);
}

export function unpackPayload(data: Uint8Array) {
  const header = decoder.decode(data.slice(0, 4));
  if (header !== 'SC01') throw new Error('No StegoCrypt message found in this image.');
  const length = new DataView(data.buffer, data.byteOffset + 4, 4).getUint32(0);
  return data.slice(8, 8 + length);
}