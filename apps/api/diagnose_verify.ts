import { verifyPassword } from "./src/modules/auth/services/password.service.js";

async function run() {
  const hash = "scrypt$vvpQxpeQ88J0Z680DoNNvQ$MIvLKOqXMzBb7Umra10BOg7AOI6FIo8fcVh5Ofngmb9ohNoll9fcE3AGKmExLgG2UMoIVRP-eTIbtBJ4gA6SpA";
  
  try {
    const isValid = await verifyPassword("password123", hash);
    console.log("IsValid (password123):", isValid);
  } catch (e) {
    console.error("Error:", e);
  }
  
  try {
    const isValid2 = await verifyPassword("password", hash);
    console.log("IsValid (password):", isValid2);
  } catch (e) {
    console.error("Error2:", e);
  }
  
  try {
    const isValid3 = await verifyPassword("mussawarhussain", hash);
    console.log("IsValid (mussawarhussain):", isValid3);
  } catch (e) {
    console.error("Error3:", e);
  }
}
run();
