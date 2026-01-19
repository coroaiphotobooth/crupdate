import { GoogleGenAI } from "@google/genai";
import { PhotoboothSettings, AspectRatio } from "../types";

export const generateAIImage = async (
  base64Source: string,
  prompt: string,
  outputRatio: AspectRatio = "9:16"
) => {
  try {
    // 1) Model terpilih dari Local Storage (Settings)
    let selectedModel = "gemini-2.5-flash-image";

    const storedSettings = localStorage.getItem("pb_settings");
    if (storedSettings) {
      try {
        const parsedSettings: PhotoboothSettings = JSON.parse(storedSettings);
        if (parsedSettings?.selectedModel) {
          selectedModel = parsedSettings.selectedModel;
        }
      } catch {
        // ignore invalid JSON
      }
    }

    // 2) Env Vite (Client-side) - Vercel inject saat build
    const apiKey = (import.meta.env.VITE_GEMINI_API_KEY as string) || "";
    if (!apiKey) {
      throw new Error(
        "VITE_GEMINI_API_KEY is missing. Set it in Vercel Environment Variables then redeploy."
      );
    }

    // 3) Validasi base64 input
    if (!base64Source || !base64Source.includes(",")) {
      throw new Error(
        "Invalid base64Source format. Expected data:<mime>;base64,<data>."
      );
    }

    const ai = new GoogleGenAI({ apiKey });

    const mimeType = base64Source.startsWith("data:image/png")
      ? "image/png"
      : "image/jpeg";

    const cleanBase64 = base64Source.split(",")[1];
    if (!cleanBase64) {
      throw new Error("Invalid base64Source: missing base64 data.");
    }

    // MAPPING RATIO: Gemini API support: '16:9', '9:16', '4:3', '3:4', '1:1'
    // Map 3:2 -> 4:3, 2:3 -> 3:4
    let apiAspectRatio: "16:9" | "9:16" | "4:3" | "3:4" | "1:1" = "9:16";
    if (outputRatio === "16:9") apiAspectRatio = "16:9";
    if (outputRatio === "9:16") apiAspectRatio = "9:16";
    if (outputRatio === "3:2") apiAspectRatio = "4:3";
    if (outputRatio === "2:3") apiAspectRatio = "3:4";
    if (outputRatio === "1:1") apiAspectRatio = "1:1";

    const executeGenAI = async (model: string, useProConfig: boolean) => {
      const imageConfig: any = {
        aspectRatio: apiAspectRatio,
      };

      // Gemini 3 Pro support 'imageSize'
      if (useProConfig) {
        imageConfig.imageSize = "1K";
      }

      const finalPrompt = `*** EDIT MODE: HARD LOCK ENABLED ***
STRICT CONSTRAINTS:
1. PRESERVE IDENTITY: Face, features, and skin tone must remain EXACTLY the same.
2. PRESERVE STRUCTURE: Pose, posture, hand gestures, and body shape must remain EXACTLY the same.
3. PRESERVE FRAMING: Camera angle, zoom, and composition must remain EXACTLY the same. DO NOT CROP. DO NOT ZOOM.
4. PRESERVE HAIR/HEAD: Keep hairstyle/hijab shape identical unless explicitly asked to change.

CHANGE REQUEST:
${prompt}`;

      // TEXT dulu, baru IMAGE (sesuai request kamu)
      return await ai.models.generateContent({
        model,
        contents: {
          parts: [
            { text: finalPrompt },
            {
              inlineData: {
                data: cleanBase64,
                mimeType,
              },
            },
          ],
        },
        config: {
          imageConfig,
        },
      });
    };

    const wantsPro = selectedModel.toLowerCase().includes("pro");

    let response: any;

    try {
      if (wantsPro) {
        console.log(
          `Attempting generation with selected model: Gemini 3 Pro (Ratio: ${apiAspectRatio})...`
        );
        response = await executeGenAI("gemini-3-pro-image-preview", true);
      } else {
        console.log(
          `Attempting generation with selected model: Gemini 2.5 Flash (Ratio: ${apiAspectRatio})...`
        );
        response = await executeGenAI("gemini-2.5-flash-image", false);
      }
    } catch (err: any) {
      const errText = String(err?.message ?? err);
      console.warn(`Model ${selectedModel} failed. Reason:`, errText);

      // FALLBACK: Pro -> Flash jika permission/not found
      const shouldFallback =
        wantsPro &&
        (errText.includes("403") ||
          errText.toLowerCase().includes("permission denied") ||
          errText.includes("404") ||
          errText.toLowerCase().includes("not found"));

      if (shouldFallback) {
        console.log("Falling back to Gemini 2.5 Flash (Free Tier Compatible)...");
        response = await executeGenAI("gemini-2.5-flash-image", false);
      } else {
        throw err;
      }
    }

    const candidates = response?.candidates;
    if (candidates?.length > 0) {
      const parts = candidates[0]?.content?.parts ?? [];
      for (const part of parts) {
        const data = part?.inlineData?.data;
        if (data) {
          return `data:image/png;base64,${data}`;
        }
      }
    }

    throw new Error("No image data returned from Gemini");
  } catch (error: any) {
    const msg = String(error?.message ?? error);
    console.error("Gemini Generation Final Error:", msg);

    if (msg.includes("403") || msg.toLowerCase().includes("permission denied")) {
      throw new Error(
        "API Key Permission Denied (403). If using Pro model, ensure Billing enabled. Otherwise use Flash."
      );
    }
    throw error;
  }
};
