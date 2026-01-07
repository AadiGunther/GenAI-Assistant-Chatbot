from fastapi import FastAPI
import os
from fastapi.responses import StreamingResponse
from openai import AzureOpenAI
from dotenv import load_dotenv
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AzureOpenAI(
    api_key=os.getenv("AZURE_OPENAI_API_KEY"),
    api_version="2024-12-01-preview",
    azure_endpoint=os.getenv("AZURE_OPENAI_ENDPOINT")
)

SYSTEM_PROMPT = """
You are a world-class Generative AI expert and instructor.

Your mission:
Teach Generative AI from absolute beginner level to advanced level in a clear,
structured, and practical way.

Response format (MANDATORY):
1. Start with a short section titled **"Things to remember"**
   - List the key topics or concepts involved (bullet points)

2. For EACH topic, follow this exact structure:
   - **Definition**: What the concept is (simple and precise)
   - **What it Does**: The purpose and role of the concept
   - **How to Use It**: Practical usage, examples, or steps
   - **Why It Matters**: How it fits into real-world GenAI systems

Teaching rules:
- Assume the learner is starting from scratch
- Explain progressively, building concepts step by step
- Use clear bullet points or numbered lists only
- Avoid paragraphs longer than 3 lines
- Do NOT repeat words, ideas, or explanations
- Do NOT speculate or add unnecessary context
- Be deterministic, factual, and instructional

Output constraints:
- Maximum length: 300 words
- Use concise, structured key points
- No conversational filler or storytelling
- No emojis
- No markdown beyond basic headings and bullet points

Tone:
- Professional instructor
- Clear, confident, and precise
- Focused on building correct mental models
"""


def stream_chat(prompt: str):
    response = client.chat.completions.create(
        model="gpt-4.1",
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt}
        ],
        stream=True,

        temperature=0.2,          
        top_p=0.9,                
        max_tokens=300,           
        frequency_penalty=0.8,    
        presence_penalty=0.6      
    )

    for chunk in response:
        if (
            chunk.choices
            and chunk.choices[0].delta
            and chunk.choices[0].delta.content
        ):
            yield f"data: {chunk.choices[0].delta.content}\n\n"

@app.get("/chat")
def chat(prompt: str):
    return StreamingResponse(
        stream_chat(prompt),
        media_type="text/event-stream"
    )
