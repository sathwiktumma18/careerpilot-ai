"""PDF text extraction using PyMuPDF (fitz)."""
from pathlib import Path

import fitz


class PdfParseError(Exception):
    """Raised when a PDF cannot be parsed into usable text."""


def extract_text(pdf_path: str | Path) -> str:
    """Extract all text from a PDF. Returns normalized whitespace per line.

    Raises PdfParseError if the document yields no extractable text (scanned
    image PDFs have no text layer — those need OCR, which is out of scope).
    """
    path = Path(pdf_path)
    try:
        doc = fitz.open(path)
    except Exception as exc:  # corrupt / non-PDF files
        raise PdfParseError(f"Could not open PDF: {exc}") from exc

    try:
        pages: list[str] = []
        for page in doc:
            text = page.get_text("text")
            if text.strip():
                pages.append(text)
    finally:
        doc.close()

    body = "\n".join(pages)
    # Collapse runs of blank lines; keep single newlines (section detection
    # in the analyzer relies on line structure).
    normalized = "\n".join(line.rstrip() for line in body.splitlines() if line.strip())
    if not normalized.strip():
        raise PdfParseError("No extractable text found — the PDF may be a scanned image.")
    return normalized


def make_test_pdf(text: str) -> bytes:
    """Create an in-memory PDF from plain text. Used for tests and fixtures."""
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((72, 72), text, fontname="helv", fontsize=11)
    data = doc.tobytes()
    doc.close()
    return data
