import os
import streamlit as st
from dotenv import load_dotenv
from langchain_google_genai import ChatGoogleGenerativeAI

load_dotenv()

api_key = os.getenv("GEMINI_API_KEY")

st.set_page_config(
    page_title="AI English Teacher",
    page_icon="🧑‍🏫"
)

st.title("🧑‍🏫 AI English Teacher")
st.caption("Practice English through natural conversation.")

# -----------------------------
# Gemini
# -----------------------------

llm = ChatGoogleGenerativeAI(
    model="gemini-3.6-flash",
    temperature=0.7,
    api_key=api_key
)

# -----------------------------
# Chat memory
# -----------------------------

if "messages" not in st.session_state:
    st.session_state.messages = []

# Display previous messages
for message in st.session_state.messages:

    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# -----------------------------
# User input
# -----------------------------

user_message = st.chat_input(
    "Talk to your English teacher..."
)

if user_message:

    # Show user message
    st.chat_message("user").markdown(user_message)

    # Save user message
    st.session_state.messages.append({
        "role": "user",
        "content": user_message
    })

    # Build conversation
    conversation = """
You are a friendly AI English speaking teacher.

Your goal is to help the student improve conversational English.

Rules:

1. Have a natural conversation.
2. Do not correct every tiny mistake.
3. Correct important or repeated mistakes.
4. When correcting grammar:
   - Show the corrected sentence.
   - Give a short explanation.
5. Suggest natural vocabulary when useful.
6. Ask follow-up questions.
7. Encourage the student.
8. Keep explanations simple.
9. Adapt to the student's English level.
10. Focus primarily on helping the student SPEAK naturally.

Conversation so far:

"""

    for message in st.session_state.messages:
        conversation += f"""
{message["role"]}: {message["content"]}
"""

    conversation += "\nRespond as the English teacher."

    # Get response
    response = llm.invoke(conversation)

    teacher_response = response.text

    # Display teacher
    with st.chat_message("assistant"):
        st.markdown(teacher_response)

    # Save teacher response
    st.session_state.messages.append({
        "role": "assistant",
        "content": teacher_response
    })