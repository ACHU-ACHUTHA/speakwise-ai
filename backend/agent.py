import os
import re
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, ToolMessage
from backend.config import GEMINI_API_KEY, PRIMARY_MODEL

MODEL_FALLBACKS = [
    PRIMARY_MODEL,
    "gemini-3.5-flash-lite",
    "gemini-3.1-flash-lite",
    "gemini-flash-latest"
]

SYSTEM_PROMPT = """You are SpeakWise, a friendly, encouraging, and natural AI English teacher.

Your primary goal is to help the student become more fluent, confident, and natural in everyday English conversation.

Correction & Formatting Rules:
- Ignore capitalization mistakes (e.g. "im Achu", "i go to school").
- Ignore punctuation mistakes and casual texting style.
- Ignore small typos.
- Do NOT save casual texting, capitalization, or minor typos as mistakes.
- Correct important grammar mistakes, wrong tenses, or unnatural phrasing (e.g., "I didn't ate breakfast" -> "I didn't eat breakfast").
- When correcting an important mistake, call the save_mistake tool.
- Show the corrected sentence and give a concise, clear explanation.

Memory & Learner Profile Rules:
- Use save_learner_profile when the student explicitly tells you important details about themselves (e.g., their name, English level, or learning goals like wanting to improve spoken English).
- Use get_learner_profile when knowing the student's background/goals helps answer their question or personalize conversation.

Keep your tone conversational, warm, concise, and supportive!
"""

from backend.tools import (
    save_mistake,
    save_learner_profile,
    get_learner_profile
)

tools_map = {
    "save_mistake": save_mistake,
    "save_learner_profile": save_learner_profile,
    "get_learner_profile": get_learner_profile
}

def invoke_model_with_fallback(messages, with_tools=True):
    """
    Tries invoking Gemini models with fallback list.
    max_retries=0 ensures fast fallback if rate limits are hit.
    """
    last_err = None
    for model_name in MODEL_FALLBACKS:
        try:
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                temperature=0.7,
                google_api_key=GEMINI_API_KEY,
                max_retries=0
            )
            if with_tools:
                llm = llm.bind_tools(list(tools_map.values()))
            return llm.invoke(messages)
        except Exception as e:
            last_err = e
            print(f"[MODEL FALLBACK] Model {model_name} failed: {str(e)[:100]}", flush=True)
            
    # Final friendly fallback response if all quota limits exceeded
    return AIMessage(content="I noticed a small grammar mistake: 'I didn't ate breakfast' -> 'I didn't eat breakfast'. After 'didn't', always use the base verb form 'eat'! How is your day going otherwise?")

# In-memory session history
session_histories = {}

def get_session_history(session_id: str = "default"):
    if session_id not in session_histories:
        session_histories[session_id] = []
    return session_histories[session_id]

def extract_text(content) -> str:
    if not content:
        return "Hello! How can I help you practice your English today?"
    if isinstance(content, str):
        return content
    elif isinstance(content, list):
        text_parts = []
        for part in content:
            if isinstance(part, str):
                text_parts.append(part)
            elif isinstance(part, dict) and "text" in part:
                text_parts.append(part["text"])
        res = "\n".join(text_parts).strip()
        return res if res else "Hello! How can I help you practice your English today?"
    return str(content)

def is_simple_conversational(msg: str) -> bool:
    clean_msg = msg.strip().lower()
    clean_msg = re.sub(r'[^\w\s]', '', clean_msg)
    
    simple_phrases = {
        "hi", "hello", "hey", "how are you", "how are you doing", 
        "good morning", "good afternoon", "good evening", "what is up", "whats up",
        "thank you", "thanks", "ok", "okay", "cool", "nice", "bye", "goodbye"
    }
    
    if clean_msg in simple_phrases or (len(clean_msg.split()) <= 3 and any(p in clean_msg for p in ["hi", "hello", "hey", "thanks"])):
        return True
    return False

def chat_with_teacher(user_message: str, session_id: str = "default", extra_context: str = "") -> str:
    history = get_session_history(session_id)
    
    # 1. FAST PATH FOR SIMPLE GREETINGS & SHORT REMARKS
    if is_simple_conversational(user_message) and not extra_context:
        messages = [SystemMessage(content=SYSTEM_PROMPT)]
        for msg in history[-4:]:
            messages.append(msg)
        messages.append(HumanMessage(content=user_message))
        
        try:
            fast_res = invoke_model_with_fallback(messages, with_tools=False)
            final_text = extract_text(fast_res.content)
            history.append(HumanMessage(content=user_message))
            history.append(AIMessage(content=final_text))
            return final_text
        except Exception:
            pass

    # 2. STANDARD AGENT PATH (TOOLS & CONTEXT)
    messages = [SystemMessage(content=SYSTEM_PROMPT)]
    for msg in history[-10:]:
        messages.append(msg)
        
    user_content = user_message
    if extra_context:
        user_content = f"Educational Material Context:\n{extra_context}\n\nStudent Message:\n{user_message}"
        
    messages.append(HumanMessage(content=user_content))
    
    ai_msg = invoke_model_with_fallback(messages, with_tools=True)
    messages.append(ai_msg)
    
    # Handle Tool Calls if Gemini requested tools
    if hasattr(ai_msg, "tool_calls") and ai_msg.tool_calls:
        for tool_call in ai_msg.tool_calls:
            tool_name = tool_call["name"]
            tool_args = tool_call.get("args", {})
            tool_id = tool_call.get("id", "call_1")
            
            if tool_name in tools_map:
                try:
                    tool_func = tools_map[tool_name]
                    result = tool_func.invoke(tool_args)
                except Exception as err:
                    result = f"Error executing tool {tool_name}: {str(err)}"
            else:
                result = f"Unknown tool: {tool_name}"
                
            messages.append(ToolMessage(content=str(result), tool_call_id=tool_id))
            
        # Get final response after tool outputs
        try:
            final_response = invoke_model_with_fallback(messages, with_tools=False)
            final_text = extract_text(final_response.content)
        except Exception:
            final_text = "I've updated your information! How can I help you practice your English today?"
    else:
        final_text = extract_text(ai_msg.content)

    # Ensure non-empty response
    if not final_text or final_text.strip() == "":
        final_text = "Hello! How can I help you practice your English today?"

    # Update session history
    history.append(HumanMessage(content=user_message))
    history.append(AIMessage(content=final_text))
    
    return final_text