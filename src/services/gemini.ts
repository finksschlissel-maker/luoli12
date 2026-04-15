import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface WordDetail {
  word: string;
  phonetic: string;
  definition: string;
  example: string;
  translation: string;
}

export async function getWordDetails(input: string | { base64: string; mimeType: string }): Promise<WordDetail[]> {
  const isImage = typeof input !== "string";
  
  const prompt = isImage 
    ? "请识别图片中的英文单词，并为每个单词提供详细解释。如果是手写的请尽量准确识别。" 
    : `请为以下单词提供详细解释：${input}`;

  const contents: any = isImage 
    ? {
        parts: [
          { text: prompt + " 请以JSON数组格式返回。" },
          { inlineData: { data: input.base64, mimeType: input.mimeType } }
        ]
      }
    : prompt + " 请以JSON数组格式返回。";

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: contents,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            word: { type: Type.STRING },
            phonetic: { type: Type.STRING },
            definition: { type: Type.STRING },
            example: { type: Type.STRING },
            translation: { type: Type.STRING },
          },
          required: ["word", "phonetic", "definition", "example", "translation"],
        },
      },
    },
  });

  try {
    return JSON.parse(response.text || "[]");
  } catch (e) {
    console.error("Failed to parse AI response", e);
    return [];
  }
}
