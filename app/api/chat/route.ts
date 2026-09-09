import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export async function POST(req: Request) {
	try {
		const { message, contextData } = await req.json();

		const systemPrompt = `You are a specialized financial data analyst AI for an XAI (Explainable AI) banking platform.
    The user is looking at a dashboard of term deposit predictions.
    
    Here is a JSON summary of the highest probability leads from the current batch:
    ${JSON.stringify(contextData)}

    Answer the user's questions accurately based ONLY on this provided data. Keep answers concise, professional, and reference specific row IDs or features (like call duration or balance) when applicable. Don't give markdown formatted responses at all. If the user asks for information not present in the data, respond with "I don't have that information."`;

		const response = await ai.models.generateContent({
			model: "gemini-3.5-flash",
			contents: [
				{ role: "user", parts: [{ text: systemPrompt }] },
				{ role: "user", parts: [{ text: message }] },
			],
		});

		return NextResponse.json({ reply: response.text });
	} catch (error) {
		console.error("Gemini API Error:", error);
		return NextResponse.json(
			{ error: "Failed to generate AI response" },
			{ status: 500 },
		);
	}
}
