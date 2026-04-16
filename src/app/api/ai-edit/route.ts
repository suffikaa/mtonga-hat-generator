import { NextRequest, NextResponse } from "next/server";

// Gemini 2.5 Flash Image — native image editing model (Nano Banana).
// Much better at preserving the original image while making targeted edits,
// compared to SDXL img2img.

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function getKey() {
  return process.env.GEMINI_API_KEY ?? process.env.REPLICATE_API_TOKEN ?? "";
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY ?? "";
  if (!key) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 503 },
    );
  }

  const { image, subject } = (await req.json()) as {
    image: string;
    subject: string;
  };

  // Strip data URL prefix, extract MIME + base64
  const match = /^data:([^;]+);base64,(.+)$/.exec(image);
  if (!match) {
    return NextResponse.json(
      { error: "Invalid image format" },
      { status: 400 },
    );
  }
  const [, mimeType, base64Data] = match;

  const prompt = [
    `Edit this photo of a ${subject} wearing a blue MTONGA baseball cap.`,
    "Keep the subject, pose, background, and all details exactly the same.",
    "Only blend the cap naturally onto the head:",
    "match lighting, add subtle realistic shadow under the brim,",
    "soften hard edges so the cap looks physically worn,",
    "keep the $MTONGA text on the cap readable and intact.",
    "Do not change the face or identity of the subject.",
  ].join(" ");

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType, data: base64Data } },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };

  const res = await fetch(`${GEMINI_URL}?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorBody = await res.text();
    return NextResponse.json(
      { error: `Gemini error: ${res.status} ${errorBody}` },
      { status: 502 },
    );
  }

  const data = await res.json();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const parts = data?.candidates?.[0]?.content?.parts as any[] | undefined;
  const imagePart = parts?.find((p) => p.inlineData?.data);

  if (!imagePart) {
    return NextResponse.json(
      {
        error:
          data?.candidates?.[0]?.finishReason ??
          "No image in Gemini response",
      },
      { status: 502 },
    );
  }

  const outputMime = imagePart.inlineData.mimeType ?? "image/png";
  const outputData = imagePart.inlineData.data;

  // Synchronous — return result immediately (no polling needed)
  return NextResponse.json({
    id: "sync",
    status: "succeeded",
    output: `data:${outputMime};base64,${outputData}`,
  });
}

// GET is kept for backwards compatibility with the polling UI.
// Gemini responds synchronously, so POST already returns the final image;
// the client will immediately see "succeeded" on the first GET.
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  return NextResponse.json({ status: "succeeded", output: null });
}

// Suppress unused warning for fallback helper
void getKey;
