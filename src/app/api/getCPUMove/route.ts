import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const { fullBoard, visibleBoard, player } = await request.json();

  const AZURE_FUNCTION_URL = process.env.AZURE_FUNCTION_URL;
  const AZURE_FUNCTION_KEY = process.env.AZURE_FUNCTION_KEY;

  if (!AZURE_FUNCTION_URL) {
    return NextResponse.json(
      { error: "Azure Function URL is not defined" },
      { status: 500 }
    );
  }

  try {
    console.log("Sending request to Azure Function with data:", {
      fullBoard,
      visibleBoard,
      player,
    });
    const response = await fetch(AZURE_FUNCTION_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(AZURE_FUNCTION_KEY && { "x-functions-key": AZURE_FUNCTION_KEY }),
      },
      body: JSON.stringify({ fullBoard, visibleBoard, player }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `HTTP error! status: ${response.status}, body: ${errorText}`
      );
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log("Received response from Azure Function:", data);
    return NextResponse.json({ move: data.move });
  } catch (error) {
    console.error("Error fetching CPU move:", error);
    return NextResponse.json(
      {
        error: "Error fetching CPU move",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
