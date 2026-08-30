import os
from pathlib import Path
import chromadb
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from backend.config import CHROMA_DB_DIR, ENGLISH_MATERIAL_DIR, GEMINI_API_KEY, EMBEDDING_MODEL

def chunk_text(text: str, chunk_size: int = 500) -> list[str]:
    paragraphs = text.split("\n\n")
    chunks = []
    current_chunk = ""
    for para in paragraphs:
        if len(current_chunk) + len(para) + 2 <= chunk_size:
            current_chunk += ("\n\n" + para if current_chunk else para)
        else:
            if current_chunk:
                chunks.append(current_chunk)
            current_chunk = para
    if current_chunk:
        chunks.append(current_chunk)
    return chunks

class RAGPipeline:
    def __init__(self):
        self.chroma_client = chromadb.PersistentClient(path=CHROMA_DB_DIR)
        self.collection_name = "english_materials"
        
        try:
            self.embeddings = GoogleGenerativeAIEmbeddings(
                model=EMBEDDING_MODEL,
                google_api_key=GEMINI_API_KEY
            )
        except Exception:
            self.embeddings = None

        self.collection = self.chroma_client.get_or_create_collection(
            name=self.collection_name
        )
        
        if self.collection.count() == 0:
            self.index_documents()

    def index_documents(self):
        material_path = Path(ENGLISH_MATERIAL_DIR)
        if not material_path.exists():
            return "No material directory found."
            
        md_files = list(material_path.glob("*.md")) + list(material_path.glob("*.txt"))
        if not md_files:
            return "No material files found to index."
            
        raw_texts = []
        metadatas = []
        for file in md_files:
            try:
                with open(file, "r", encoding="utf-8") as f:
                    content = f.read()
                    if content.strip():
                        raw_texts.append(content)
                        metadatas.append({"source": file.name})
            except Exception as e:
                print(f"Error loading {file}: {e}")
                
        if not raw_texts:
            return "No content loaded."
            
        texts = []
        chunk_metadatas = []
        for text, meta in zip(raw_texts, metadatas):
            chunks = chunk_text(text, chunk_size=500)
            for c in chunks:
                texts.append(c)
                chunk_metadatas.append(meta)
        
        ids = [f"doc_{i}" for i in range(len(texts))]
        
        if self.embeddings:
            try:
                embeddings_list = self.embeddings.embed_documents(texts)
                self.collection.add(
                    ids=ids,
                    documents=texts,
                    embeddings=embeddings_list,
                    metadatas=chunk_metadatas
                )
                return f"Successfully indexed {len(texts)} chunks with Gemini Embeddings."
            except Exception as err:
                print("Gemini embeddings failed, falling back to default text storage:", err)
                
        self.collection.add(
            ids=ids,
            documents=texts,
            metadatas=chunk_metadatas
        )
        return f"Successfully indexed {len(texts)} chunks."

    def query(self, query_text: str, top_k: int = 2) -> str:
        if self.collection.count() == 0:
            self.index_documents()
            
        if self.embeddings:
            try:
                query_vec = self.embeddings.embed_query(query_text)
                results = self.collection.query(
                    query_embeddings=[query_vec],
                    n_results=top_k
                )
            except Exception:
                results = self.collection.query(
                    query_texts=[query_text],
                    n_results=top_k
                )
        else:
            results = self.collection.query(
                query_texts=[query_text],
                n_results=top_k
            )
            
        docs = results.get("documents", [[]])[0]
        if not docs:
            return ""
            
        return "\n---\n".join(docs)

rag_instance = RAGPipeline()

def get_rag_context(query: str) -> str:
    return rag_instance.query(query)

def reindex_rag() -> str:
    return rag_instance.index_documents()
