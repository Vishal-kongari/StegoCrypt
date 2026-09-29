import { packPayload, unpackPayload } from '@/crypto';

export type Capacity = { bytes: number; bits: number; usedPercent: number };

export function capacityFor(image: ImageData): Capacity {
  const bits = Math.max(0, image.data.length - (image.data.length % 4)) * 3 / 4;
  return { bits, bytes: Math.floor(bits / 8), usedPercent: 0 };
}

export function embedPayload(image: ImageData, payload: Uint8Array) {
  const packed = packPayload(payload);
  const capacity = capacityFor(image);
  if (packed.length > capacity.bytes) throw new Error(`Message is too large. This image can hold ${capacity.bytes.toLocaleString()} bytes.`);
  const output = new Uint8ClampedArray(image.data);
  let bitIndex = 0;
  for (let i = 0; i < output.length && bitIndex < packed.length * 8; i += 4) {
    for (let channel = 0; channel < 3 && bitIndex < packed.length * 8; channel++) {
      const byte = packed[Math.floor(bitIndex / 8)];
      const bit = (byte >> (7 - (bitIndex % 8))) & 1;
      output[i + channel] = (output[i + channel] & 0xfe) | bit;
      bitIndex++;
    }
  }
  return new ImageData(output, image.width, image.height);
}

export function extractPayload(image: ImageData) {
  const bits: number[] = [];
  for (let i = 0; i < image.data.length; i += 4) {
    for (let channel = 0; channel < 3; channel++) bits.push(image.data[i + channel] & 1);
  }
  if (bits.length < 64) throw new Error('Image is too small to contain a StegoCrypt message.');
  const readByte = (offset: number) => bits.slice(offset, offset + 8).reduce((value, bit) => (value << 1) | bit, 0);
  const header = new Uint8Array(4);
  for (let i = 0; i < 4; i++) header[i] = readByte(i * 8);
  if (new TextDecoder().decode(header) !== 'SC01') throw new Error('No StegoCrypt message found in this image.');
  const lengthBytes = new Uint8Array(4);
  for (let i = 0; i < 4; i++) lengthBytes[i] = readByte(32 + i * 8);
  const length = new DataView(lengthBytes.buffer).getUint32(0);
  const payload = new Uint8Array(length);
  for (let i = 0; i < length; i++) payload[i] = readByte(64 + i * 8);
  return unpackPayload(new Uint8Array([...header, ...lengthBytes, ...payload]));
}

export function calculatePsnr(original: ImageData, encoded: ImageData) {
  let sum = 0;
  for (let i = 0; i < original.data.length; i++) {
    const difference = original.data[i] - encoded.data[i];
    sum += difference * difference;
  }
  if (sum === 0) return Infinity;
  const mse = sum / original.data.length;
  return 10 * Math.log10((255 * 255) / mse);
}