import os
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI
from backend.tools import save_mistake

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",
    temperature=0.7,
    api_key=api_key
)
llm_with_tools = llm.bind_tools([save_mistake])


SYSTEM_PROMPT = """
You are SpeakWise, a friendly AI English speaking teacher.

Your primary goal is to help the student become more fluent and natural
in everyday English conversation.

Correction rules:

- Ignore capitalization mistakes.
- Ignore punctuation mistakes.
- Ignore casual texting style.
- Ignore small typos.
- Do not correct every small mistake.
- Correct important grammar mistakes.
- Correct repeated mistakes.
- Correct mistakes that affect meaning or naturalness.

When you identify an important or repeated English mistake,
use the save_mistake tool.

Do not save every minor mistake.

When correcting a mistake:
- Show the corrected sentence.
- Give a short explanation.
- Continue the conversation naturally.

You are a conversation partner first and a teacher second.
"""

conversation_history = []





def chat_with_teacher(user_message: str):

    conversation_history.append(
        f"Student: {user_message}"
    )

    conversation = "\n".join(conversation_history)

    prompt = f"""
{SYSTEM_PROMPT}

Conversation so far:

{conversation}

Student's latest message:
{user_message}

Respond as the English teacher.
"""

    # First call: Gemini decides whether to use a tool
    response = llm_with_tools.invoke(prompt)

    # If Gemini requested a tool
    if response.tool_calls:

        for tool_call in response.tool_calls:

            if tool_call["name"] == "save_mistake":

                result = save_mistake(
                    original=tool_call["args"]["original"],
                    correction=tool_call["args"]["correction"],
                    category=tool_call["args"]["category"]
                )

                print("🔧 Tool executed:", result)

        # Ask Gemini for the final response
        final_prompt = f"""
{SYSTEM_PROMPT}

The student said:

{user_message}

You identified an important mistake and saved it for future learning.

Now respond naturally to the student.

Give the correction briefly and continue the conversation.
"""

        final_response = llm.invoke(final_prompt)

        teacher_response = final_response.text

    else:
        # Normal response when no tool is needed
        teacher_response = response.text

    conversation_history.append(
        f"Teacher: {teacher_response}"
    )

    return teacher_response