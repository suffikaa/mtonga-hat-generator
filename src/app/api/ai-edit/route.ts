import { NextRequest, NextResponse } from "next/server";

const GEMINI_MODEL = "gemini-2.5-flash-image";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

function splitDataUrl(dataUrl: string) {
  const match = /^data:([^;]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return { mimeType: match[1], data: match[2] };
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY ?? "";
  if (!key) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY not configured" },
      { status: 503 },
    );
  }

  const { photo, hat, subject } = (await req.json()) as {
    photo: string;
    hat: string;
    subject: string;
  };

  const photoData = splitDataUrl(photo);
  const hatData = splitDataUrl(hat);
  if (!photoData || !hatData) {
    return NextResponse.json(
      { error: "Invalid image format" },
      { status: 400 },
    );
  }

  const prompt = [
    `First image: a photo of a ${subject}.`,
    "Second image: a blue baseball cap with '$MTONGA' text on it.",
    "Task: place the blue cap from the second image naturally onto the head of the subject in the first image.",
    "Requirements:",
    "- Keep the first image's background, pose, lighting and composition exactly the same.",
    "- Do not change the subject's face, fur, or identity.",
    "- Fit the cap to the size and angle of the head realistically.",
    "- Match the lighting of the scene, add a soft natural shadow under the brim.",
    "- Keep the '$MTONGA' text on the cap clear and readable, do not rewrite or distort it.",
    "- Output only the edited photo, nothing else.",
  ].join(" ");

  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          { inlineData: { mimeType: photoData.mimeType, data: photoData.data } },
          { inlineData: { mimeType: hatData.mimeType, data: hatData.data } },
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

  return NextResponse.json({
    id: "sync",
    status: "succeeded",
    output: `data:${outputMime};base64,${outputData}`,
  });
}

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  return NextResponse.json({ status: "succeeded", output: null });
}
