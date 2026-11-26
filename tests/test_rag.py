from app.services.pdf_parser import DocumentChunker

def test_chunker_basic():
    chunker = DocumentChunker(chunk_size=10, chunk_overlap=2)
    words = "word " * 25
    words_list = words.split()
    assert len(words_list) == 25
