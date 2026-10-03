// Jest uses this instead of the Gemini SDK in every test. Tests queue
// replies with generateContent.mockResolvedValueOnce(...).

const generateContent = jest.fn(async () => ({ text: "{}" }));

class GoogleGenAI {
  constructor() {
    this.models = { generateContent };
  }
}

module.exports = { GoogleGenAI, generateContent };
