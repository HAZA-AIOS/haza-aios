import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);
const keyLength = 64;
const hashPrefix = "scrypt";

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derivedKey = await scryptAsync(password, salt, keyLength) as Buffer;
  return `${hashPrefix}$${salt}$${derivedKey.toString("base64url")}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [algorithm, salt, encodedHash] = storedHash.split("$");

  if (algorithm !== hashPrefix || !salt || !encodedHash) {
    return false;
  }

  const expected = Buffer.from(encodedHash, "base64url");
  const actual = await scryptAsync(password, salt, expected.length) as Buffer;

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
