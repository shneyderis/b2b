# Fonts for PDF generation

PDFKit ships with Helvetica which does not cover Cyrillic. To render Ukrainian
correctly in generated PDFs, drop Unicode TTF files here:

- `NotoSans-Regular.ttf`
- `NotoSans-Bold.ttf`  (optional but recommended)

Any Unicode TTF works — Noto Sans is public domain and covers Cyrillic well.
Download from <https://fonts.google.com/noto/specimen/Noto+Sans>.

If the font files are absent the server falls back to Helvetica and
Cyrillic characters will appear as boxes.
