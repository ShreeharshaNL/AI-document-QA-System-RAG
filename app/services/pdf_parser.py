import io
from pypdf import PdfReader
from typing import List, Dict

class DocumentChunker:
    def __init__(self, chunk_size: int = 300, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def extract_and_chunk_pdf(self, pdf_bytes: bytes) -> List[Dict]:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        chunks = []
        chunk_idx = 0

        for page_num, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            words = text.split()
            
            i = 0
            while i < len(words):
                chunk_words = words[i:i + self.chunk_size]
                chunk_text = " ".join(chunk_words)
                if chunk_text.strip():
                    chunks.append({
                        "chunk_index": chunk_idx,
                        "page_number": page_num,
                        "content": chunk_text
                    })
                    chunk_idx += 1
                i += (self.chunk_size - self.chunk_overlap)
        return chunks
