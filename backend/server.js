// Loads .env before anything reads it, then starts the API.
require("dotenv").config({ quiet: true });

const { app, GEMINI_MODEL, liveStatus, cacheMode } = require("./app");
const { connectDB } = require("./db");
const { allowedOrigins } = require("./security");

const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`SmartBuy AI Backend running on http://localhost:${PORT}`);
    console.log(`AI model: ${GEMINI_MODEL}`);
    console.log(`Live prices: ${liveStatus}`);
    console.log(`Cache: ${cacheMode}`);
    console.log(`Allowed frontends: ${allowedOrigins.join(", ")}`);
  });
});
