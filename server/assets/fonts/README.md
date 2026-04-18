# Fonts for PDF generation

PDFKit ships with Helvetica which does not cover Cyrillic. To render
Ukrainian correctly in generated PDFs, the server loads:

- `NotoSans-Regular.ttf`
- `NotoSans-Bold.ttf`

Both files are committed next to this README and are included in the Vercel
serverless bundle via `vercel.json` (`includeFiles: "server/**"`).

Noto Sans is licensed under the SIL Open Font License 1.1 — free to
redistribute. Sourced from
<https://github.com/googlefonts/noto-fonts/tree/main/hinted/ttf/NotoSans>.

If the files are ever removed, `server/src/pdf.ts` falls back to Helvetica
and Cyrillic characters render as mojibake.
