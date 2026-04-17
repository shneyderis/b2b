// PDF generation stub. Filled in p.3.
import type { Response } from 'express';

export async function streamOrderPdf(_orderId: string, res: Response) {
  res.status(501).json({ error: 'pdf not implemented yet' });
}
