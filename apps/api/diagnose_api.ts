async function run() {
  const response = await fetch("https://api.haza-aios.com/api/v1/auth/login", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ email: "mussawarhussain@gmail.com", password: "wrongpassword" })
  });
  console.log("Status:", response.status);
  const text = await response.text();
  console.log("Body:", text);
}
run().catch(console.error);
