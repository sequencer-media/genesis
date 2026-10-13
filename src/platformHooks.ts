/** Implemented by the deployment. Creator projects cannot provide prices, balances or receipts. */
export interface GenesisCommerceAdapter {
  quote(actorId: string, offerId: string): Promise<{ quoteId: string; offerId: string; label: string; gems: number; expiresAt: number }>;
  verifyReceipt(receipt: string): Promise<{ transactionId: string; actorId: string; offerId: string; benefit: Record<string, unknown> } | null>;
}
/** Feed from authoritative viewer admission/playback infrastructure, never creator JavaScript clocks. */
export interface GenesisMeteringAdapter {
  viewerAdmitted(sessionId: string, actorId: string): Promise<void>;
  viewerReleased(sessionId: string, actorId: string): Promise<void>;
}
