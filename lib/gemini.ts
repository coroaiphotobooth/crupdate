
import { GoogleGenAI } from "@google/genai";
import { PhotoboothSettings, AspectRatio } from "../types";

export const generateAIImage = async (base64Source: string, prompt: string, outputRatio: AspectRatio = '9:16') => {
  try {
    // 1. Dapatkan model terpilih dari Local Storage (Settings)
    const storedSettings = localStorage.getItem('pb_settings');
    let selectedModel = 'gemini-2.5-flash-image';
    
    if (storedSettings) {
      const parsedSettings: PhotoboothSettings = JSON.parse(storedSettings);
      if (parsedSettings.selectedModel) {
        selectedModel = parsedSettings.selectedModel;
      }
    }

    // 2. Gunakan Environment Variable (Vercel)
    const apiKey = process.env.API_KEY;

    if (!apiKey) {
      throw new Error("Server Environment Error: API Key is missing. Please check Vercel settings.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const mimeType = base64Source.startsWith('data:image/png') ? 'image/png' : 'image/jpeg';
    const cleanBase64 = base64Source.split(',')[1];

    // MAPPING RATIO: Gemini API hanya support '16:9', '9:16', '4:3', '3:4', '1:1'.
    // Kita harus mapping 3:2 ke 4:3 (Landscape) dan 2:3 ke 3:4 (Portrait) agar request tidak error.
    // Nanti di UI (ResultPage) kita akan crop hasilnya agar pas 3:2 atau 2:3.
    let apiAspectRatio = '9:16'; // Default Fallback
    if (outputRatio === '16:9') apiAspectRatio = '16:9';
    if (outputRatio === '9:16') apiAspectRatio = '9:16';
    if (outputRatio === '3:2') apiAspectRatio = '4:3'; // Closest Landscape
    if (outputRatio === '2:3') apiAspectRatio = '3:4'; // Closest Portrait

    // Function untuk memanggil model dengan konfigurasi dinamis
    const executeGenAI = async (model: string, useProConfig: boolean) => {
      // Kita aktifkan kembali aspectRatio di imageConfig agar output sesuai request
      const imageConfig: any = {
        aspectRatio: apiAspectRatio
      };

      // Hanya Gemini 3 Pro yang support parameter 'imageSize'
      if (useProConfig) {
        imageConfig.imageSize = '1K';
      }

      // PERUBAHAN: Template "HARD LOCK" sebelum prompt user.
      const finalPrompt = `*** EDIT MODE: HARD LOCK ENABLED ***
STRICT CONSTRAINTS:
1. PRESERVE IDENTITY: Face, features, and skin tone must remain EXACTLY the same.
2. PRESERVE STRUCTURE: Pose, posture, hand gestures, and body shape must remain EXACTLY the same.
3. PRESERVE FRAMING: Camera angle, zoom, and composition must remain EXACTLY the same. DO NOT CROP. DO NOT ZOOM.
4. PRESERVE HAIR/HEAD: Keep hairstyle/hijab shape identical unless explicitly asked to change.

CHANGE REQUEST:
${prompt}`;

      // Urutan parts: TEXT dulu, baru IMAGE.
      return await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            {
              text: finalPrompt,
            },
            {
              inlineData: {
                data: cleanBase64,
                mimeType: mimeType,
              },
            },
          ],
        },
        config: {
          imageConfig: imageConfig
        }
      });
    };

    let response;
    
    try {
      // PRIORITY 1: Coba model pilihan User (Admin)
      if (selectedModel.includes('pro')) {
         console.log(`Attempting generation with selected model: Gemini 3 Pro (Ratio: ${apiAspectRatio})...`);
         response = await executeGenAI('gemini-3-pro-image-preview', true);
      } else {
         console.log(`Attempting generation with selected model: Gemini 2.5 Flash (Ratio: ${apiAspectRatio})...`);
         response = await executeGenAI('gemini-2.5-flash-image', false);
      }
      
    } catch (err: any) {
      console.warn(`Model ${selectedModel} failed. Reason:`, err.message);
      
      // FALLBACK LOGIC
      if (
        selectedModel.includes('pro') &&
        (err.toString().includes('403') || 
         err.toString().includes('Permission denied') ||
         err.toString().includes('404') ||
         err.toString().includes('not found'))
      ) {
        console.log("Falling back to Gemini 2.5 Flash (Free Tier Compatible)...");
        response = await executeGenAI('gemini-2.5-flash-image', false);
      } else {
        throw err;
      }
    }

    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      for (const part of candidates[0].content.parts) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          return `data:image/png;base64,${base64EncodeString}`;
        }
      }
    }
    
    throw new Error("No image data returned from Gemini");
    
  } catch (error: any) {
    console.error("Gemini Generation Final Error:", error);
    if (error.message?.includes("403") || error.toString().includes("Permission denied")) {
      throw new Error("API Key Permission Denied. Ensure your Google Cloud Project has Billing Enabled for Pro models.");
    }
    throw error;
  }
};
