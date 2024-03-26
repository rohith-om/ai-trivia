const express = require('express');
const app = express();
const port = process.env.PORT || 3000;
const { Configuration, OpenAIApi } = require('openai');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

// Middleware for parsing request body
app.use(express.json());

// Serve static files from the 'public' directory
app.use(express.static('public'));

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dcgeg66gy',
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Configure OpenAI API
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Game state
const ASSISTANT_CONTENT = `You are a friendly assistant playing a game with a user. You are playing 20 questions and are the QUESTIONER.
The premise of the game is simple: One person, called the "answerer," thinks of an object. 
The other player — the "questioner" — asks up to 20 yes-or-no questions in order to determine what object the answerer is thinking about. 
If the questioner guesses correctly within 20 questions, they win. 
If the questioner does not correctly guess the answer, then the answerer wins. 
The fewer questions asked, the more the questioner's "win" is worth.

Begin by asking your first question: 1. Is it alive?
Keep your questions short.
After each response, you may try guessing the object with "MY GUESS: " followed by your guess.`;

const messages = [
  { role: 'assistant', content: ASSISTANT_CONTENT },
  { role: 'user', content: "I'm excited to play! Ok, I'm thinking of an object." },
];

const temperature = 0.8;
const maxTokens = 256;
const frequencyPenalty = 0.0;

// Route for handling the initial request
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Route for handling the poll response
app.post('/api', async (req, res) => {
  // Logic to handle the poll response
  const response = req.body.untrustedData;
  const buttonIndex = response.buttonIndex;

  let userResponse;
  if (buttonIndex === 1) {
    userResponse = 'Yes';
  } else if (buttonIndex === 2) {
    userResponse = 'No';
  } else {
    userResponse = 'Invalid Input';
  }

  // Call the function to get the LLM response
  const llmResponse = await getLlmResponse(userResponse);

  // Call the function to generate a new image
  const newImageUrl = await getNewImage(llmResponse);

  // Return the updated frame with the new image
  const updatedHtmlContent = `<!DOCTYPE html>
<html>
<head>
    <meta property="og:title" content="20 Questions"/>
    <meta name="fc:frame:post_url" content="https://frame-hack.vercel.app/api"/>
    <meta property="og:image" content="${newImageUrl}" />
    <meta property="fc:frame" content="vNext" />
    <meta property="fc:frame:image" content="${newImageUrl}" />
    <meta property="fc:frame:button:1" content="Yes" />
    <meta property="fc:frame:button:2" content="No" />
    <meta property="of:accepts:xmtp" content="2024-02-01" />
</head>
<body>
AI Trivia - 20 Questions
</body>
</html>`;

  res.send(updatedHtmlContent);
});

// Function to get the LLM response
async function getLlmResponse(input) {
  messages.push({ role: 'user', content: input });

  try {
    const response = await openai.createChatCompletion({
      model: 'gpt-4-0125-preview',
      messages,
      temperature,
      max_tokens: maxTokens,
      frequency_penalty: frequencyPenalty,
    });

    const text = response.data.choices[0].message.content;
    messages.push({ role: 'assistant', content: text });

    return text;
  } catch (error) {
    console.error('Error:', error);
    return 'Sorry, I encountered an error while processing your request.';
  }
}

// Function to generate a new image
async function getNewImage(text) {
  try {
    const imageAsset = fs.readFileSync('public/image-asset.jpg');
    const uploadResponse = await cloudinary.uploader.upload(
      `data:image/jpeg;base64,${imageAsset.toString('base64')}`,
      {
        public_id: `frame-${Date.now()}`,
        overwrite: true,
        transformation: {
          overlay: {
            font_family: 'Impact',
            font_size: 50,
            text: `${text}`,
            color: 'white',
            gravity: 'northwest',
            x: 40,
            y: 100,
          },
        },
      }
    );

    return uploadResponse.secure_url;
  } catch (error) {
    console.error('Error:', error);
    return 'https://res.cloudinary.com/dcgeg66gy/image/upload/v1706472695/wonh3histo05gxyu1ba8.jpg';
  }
}

app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});