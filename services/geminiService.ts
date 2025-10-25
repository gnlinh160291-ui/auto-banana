
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { CharacterPrompt } from '../types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });

const characterPromptSchema = {
  type: Type.OBJECT,
  properties: {
    character_id: {
      type: Type.STRING,
      description: "A unique identifier for the character, like 'heroine_01' or 'main_character_alpha'.",
    },
    appearance: {
      type: Type.OBJECT,
      properties: {
        gender: { type: Type.STRING, description: "The character's gender (e.g., 'female', 'male', 'non-binary')." },
        hair: { type: Type.STRING, description: "Description of the character's hair (e.g., 'long black hair', 'short blonde bob')." },
        eyes: { type: Type.STRING, description: "The character's eye color (e.g., 'brown', 'blue')." },
        clothing: { type: Type.STRING, description: "What the character is wearing (e.g., 'white dress', 'leather jacket')." },
        age: { type: Type.STRING, description: "The apparent age of the character (e.g., 'young adult', 'teenager', 'middle-aged')." },
      },
      required: ["gender", "hair", "eyes", "clothing", "age"],
    },
    scene: {
      type: Type.OBJECT,
      properties: {
        context: { type: Type.STRING, description: "The background or setting of the scene (e.g., 'sunset on the beach', 'bustling city street at night')." },
        action: { type: Type.STRING, description: "What the character is doing (e.g., 'walking along the shore', 'reading a book')." },
      },
      required: ["context", "action"],
    },
    style: {
      type: Type.STRING,
      description: "The overall artistic style for the image (e.g., 'cinematic, soft lighting, 4k resolution', 'anime style, vibrant colors').",
    },
  },
  required: ["character_id", "appearance", "scene", "style"],
};


export const generateCharacterJson = async (
  sceneDescription: string,
  baseCharacter?: Pick<CharacterPrompt, 'character_id' | 'appearance'>
): Promise<CharacterPrompt> => {
  const systemInstruction = baseCharacter
    ? `You are an expert creative assistant. Your task is to analyze a new scene description for an existing character and generate a structured JSON object.
       **Use the following character definition PRECISELY for 'character_id' and 'appearance'**:
       ${JSON.stringify(baseCharacter, null, 2)}
       Your job is to analyze the new scene description to populate ONLY the 'scene' and 'style' fields.
       **DO NOT, under any circumstances, alter the provided 'character_id' or 'appearance' object.**`
    : `You are an expert creative assistant. Your task is to analyze a user's scene description and convert it into a structured JSON object. This JSON will be used to generate consistent character art. Identify the main character, their appearance, the scene context, and the artistic style. Ensure all fields in the JSON schema are populated based on the user's prompt. Invent a plausible 'character_id'.`;

  const response = await ai.models.generateContent({
    model: "gemini-2.5-pro",
    contents: `Analyze the following scene description and generate the corresponding JSON object: "${sceneDescription}"`,
    config: {
      systemInstruction,
      responseMimeType: "application/json",
      responseSchema: characterPromptSchema,
    },
  });

  const jsonText = response.text;
  try {
    const parsedJson = JSON.parse(jsonText);
    return parsedJson as CharacterPrompt;
  } catch (e) {
    console.error("Failed to parse JSON response:", jsonText);
    throw new Error("The API returned an invalid JSON format.");
  }
};


export const generateImageFromPrompt = async (prompt: CharacterPrompt): Promise<string> => {
  const stringifiedPrompt = JSON.stringify(prompt, null, 2);
  
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: `Generate an image based on the following JSON description. It is crucial to maintain character consistency based on the 'character_id' and 'appearance' fields. The final image should strictly adhere to all details in this JSON. \n\n${stringifiedPrompt}`,
        },
      ],
    },
    config: {
      responseModalities: [Modality.IMAGE],
    },
  });
  
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      return part.inlineData.data;
    }
  }

  throw new Error("No image data found in the API response.");
};
