import mammoth from 'mammoth';
import * as pdfjs from 'pdfjs-dist';

// Vite worker for pdf.js
pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString();

export async function extractTextFromFile(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.txt') || name.endsWith('.md') || file.type.startsWith('text/')) {
    return file.text();
  }
  if (name.endsWith('.docx')) {
    const buf = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    return result.value || '';
  }
  if (name.endsWith('.doc')) {
    throw new Error('ไฟล์ .doc เก่าไม่รองรับ กรุณาบันทึกเป็น .docx ก่อน');
  }
  if (name.endsWith('.pdf') || file.type === 'application/pdf') {
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    const parts: string[] = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const line = content.items.map((it: any) => ('str' in it ? it.str : '')).join(' ');
      parts.push(line);
    }
    return parts.join('\n\n');
  }
  throw new Error('รองรับเฉพาะ .txt .md .docx .pdf');
}
