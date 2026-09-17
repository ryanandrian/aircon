-- Make payment storage provider-neutral after the iPaymu cutover.
-- Existing dummy payment history is retained under neutral audit fields; no provider runtime remains.
ALTER TABLE "Payment" RENAME COLUMN "snapRedirect" TO "checkoutRedirect";
ALTER TABLE "Payment" RENAME COLUMN "midtransTxId" TO "providerTransactionId";
ALTER TABLE "Payment" RENAME COLUMN "paymentType" TO "providerPaymentType";
ALTER TABLE "Payment" DROP COLUMN "snapToken";

ALTER TABLE "IotOrder" RENAME COLUMN "snapRedirect" TO "checkoutRedirect";
ALTER TABLE "IotOrder" DROP COLUMN "snapToken";
