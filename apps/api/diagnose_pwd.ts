import { hashPassword, verifyPassword } from "./src/modules/auth/services/password.service.js";

async function run() {
  const hash = await hashPassword("mySuperSecretPassword123!");
  console.log("Generated hash:", hash);
  const isValid = await verifyPassword("mySuperSecretPassword123!", hash);
  console.log("Is Valid?", isValid);
}
run().catch(console.error);
